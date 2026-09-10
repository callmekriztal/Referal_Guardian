"""
Case Service — data access layer for the agent.

All database reads needed by the agent go through here,
keeping nodes thin and testable.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    Action,
    ActionVerification,
    AgentObservation,
    AgentRun,
    AgentRunStep,
    AgentRecommendation,
    Appointment,
    Bottleneck,
    Case,
    CaseEvent,
    Communication,
    Document,
    Escalation,
    FollowUp,
    Specialist,
)

from app.services.supabase_client import (
    supabase_get_case,
    supabase_get_timeline,
    supabase_insert,
    supabase_update,
    supabase_delete,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Case retrieval
# ---------------------------------------------------------------------------

def get_case(db: Session, case_id: str) -> Optional[dict[str, Any]]:
    """Return a flat dict representation of the case, checking Supabase and local DB."""
    # Check Supabase first if available
    sb_case = supabase_get_case(case_id)
    if sb_case:
        # Standardize keys from Supabase
        return {
            "id": sb_case.get("id", case_id),
            "child_identifier": sb_case.get("child_identifier") or sb_case.get("child_id", "STU-UNKNOWN"),
            "referral_type": sb_case.get("referral_type", "Evaluation"),
            "status": sb_case.get("status") or "NEW",
            "coordinator_id": sb_case.get("coordinator_id"),
            "assigned_specialist_id": sb_case.get("assigned_specialist_id"),
            "current_bottleneck": sb_case.get("current_bottleneck") or sb_case.get("bottleneck"),
            "coordinator_notes": sb_case.get("coordinator_notes"),
            "diagnostic_details": sb_case.get("diagnostic_details"),
            "created_date": sb_case.get("created_date"),
            "days_open": sb_case.get("days_open", 0),
            "followup_attempts": sb_case.get("followup_attempts", 0),
            "specialist_status": sb_case.get("specialist_status", "NONE"),
            "required_documents_missing": bool(sb_case.get("required_documents_missing")),
            "waiting_for_specialist": bool(sb_case.get("waiting_for_specialist")),
            "appointment_delayed": bool(sb_case.get("appointment_delayed")),
            "failed_attempts": sb_case.get("failed_attempts", sb_case.get("followup_attempts", 0)),
        }

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    return _case_to_dict(case)


def _case_to_dict(case: Case) -> dict[str, Any]:
    specialist_name = None
    if case.assigned_specialist:
        specialist_name = case.assigned_specialist.name
    elif case.appointments:
        latest = sorted(case.appointments, key=lambda a: a.scheduled_date or datetime.min)[-1]
        if latest.specialist:
            specialist_name = latest.specialist.name

    days_open = 0
    if case.created_date:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        created = case.created_date
        if created.tzinfo is None:
            now = now.replace(tzinfo=None)
        days_open = (now - created).days

    return {
        "id": case.id,
        "child_identifier": case.child_identifier,
        "referral_type": case.referral_type,
        "status": case.status,
        "coordinator_id": case.coordinator_id,
        "assigned_specialist_id": case.assigned_specialist_id,
        "assigned_specialist_name": specialist_name,
        "current_bottleneck": case.current_bottleneck,
        "current_responsible_person": case.current_responsible_person,
        "coordinator_notes": case.coordinator_notes,
        "diagnostic_details": case.diagnostic_details,
        "educator_summary": case.educator_summary,
        "created_date": case.created_date.isoformat() if case.created_date else None,
        "last_activity": case.last_activity.isoformat() if case.last_activity else None,
        "next_followup_date": (
            case.next_followup_date.isoformat() if case.next_followup_date else None
        ),
        "followup_attempts": case.followup_attempts or 0,
        "days_open": days_open,
        # Derived fields the bottleneck detector uses
        "specialist_status": _get_specialist_status(case),
        "required_documents_missing": _has_missing_documents(case),
        "waiting_for_specialist": _is_waiting_for_specialist(case),
        "appointment_delayed": _is_appointment_delayed(case),
        "failed_attempts": case.followup_attempts or 0,
    }


def _get_specialist_status(case: Case) -> str:
    """Derive specialist status from assigned specialist or the most recent appointment."""
    if case.assigned_specialist:
        if not case.assigned_specialist.active or case.assigned_specialist.availability_status == "UNAVAILABLE":
            return "UNAVAILABLE"
        return case.assigned_specialist.availability_status or "AVAILABLE"

    if not case.appointments:
        return "NONE"
    latest = sorted(case.appointments, key=lambda a: a.scheduled_date or datetime.min)[-1]
    if latest.specialist and not latest.specialist.active:
        return "UNAVAILABLE"
    if latest.specialist and latest.specialist.availability_status == "UNAVAILABLE":
        return "UNAVAILABLE"
    return "AVAILABLE"


def _has_missing_documents(case: Case) -> bool:
    return any(d.status in ("PENDING", "MISSING") for d in case.documents)


def _is_waiting_for_specialist(case: Case) -> bool:
    """True if there has been a CONTACT_SPECIALIST event without a follow-up response or diagnostic submission."""
    if bool(case.diagnostic_details and case.diagnostic_details.strip()):
        return False

    event_types = [e.event_type for e in case.events]
    has_contacted = "SPECIALIST_CONTACTED" in event_types
    has_responded = any(
        et in event_types
        for et in ("SPECIALIST_RESPONDED", "DIAGNOSTIC_EVALUATION_LOGGED", "APPOINTMENT_CONFIRMED")
    )
    return has_contacted and not has_responded


def _is_appointment_delayed(case: Case) -> bool:
    """True if an appointment was scheduled in the past but still REQUESTED."""
    now_utc = datetime.now(timezone.utc)
    delayed = False
    for a in case.appointments:
        if a.scheduled_date and a.status == "REQUESTED":
            s_date = a.scheduled_date
            if s_date.tzinfo is None:
                s_date = s_date.replace(tzinfo=timezone.utc)
            if s_date < now_utc:
                delayed = True
                break
    return delayed


# ---------------------------------------------------------------------------
# Timeline retrieval
# ---------------------------------------------------------------------------

def get_case_timeline(db: Session, case_id: str) -> list[dict[str, Any]]:
    """Return all case events ordered chronologically, checking Supabase and local DB."""
    events = (
        db.query(CaseEvent)
        .filter(CaseEvent.case_id == case_id)
        .order_by(CaseEvent.timestamp)
        .all()
    )
    local_events = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "details": e.details,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]

    sb_events = supabase_get_timeline(case_id)
    if sb_events:
        existing_ids = {e["id"] for e in local_events}
        for sbe in sb_events:
            if sbe.get("id") not in existing_ids:
                local_events.append({
                    "id": sbe.get("id"),
                    "event_type": sbe.get("event_type", "EVENT"),
                    "details": sbe.get("details"),
                    "timestamp": sbe.get("timestamp") or sbe.get("created_at"),
                })

    return local_events


def record_event(
    db: Session,
    case_id: str,
    event_type: str,
    details: Optional[str] = None,
) -> CaseEvent:
    """Insert a timeline event and update case.last_activity, syncing to Supabase."""
    event = CaseEvent(
        case_id=case_id,
        event_type=event_type,
        details=details,
    )
    db.add(event)

    case = db.query(Case).filter(Case.id == case_id).first()
    if case:
        case.last_activity = datetime.utcnow()

    db.commit()
    db.refresh(event)

    # Sync to Supabase case_events table
    supabase_insert("case_events", {
        "id": event.id,
        "case_id": case_id,
        "event_type": event_type,
        "details": details,
    })

    logger.info("Timeline event recorded: case=%s event=%s", case_id, event_type)
    return event


# ---------------------------------------------------------------------------
# Specialist queries
# ---------------------------------------------------------------------------

def get_available_specialists(
    db: Session, specialization: str
) -> list[dict[str, Any]]:
    """Return active, available specialists matching the given specialization."""
    specialists = (
        db.query(Specialist)
        .filter(
            Specialist.active.is_(True),
            Specialist.availability_status == "AVAILABLE",
            Specialist.specialization.ilike(f"%{specialization}%"),
        )
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "specialization": s.specialization,
            "location": s.location,
            "next_available_date": (
                s.next_available_date.isoformat() if s.next_available_date else None
            ),
        }
        for s in specialists
    ]


def get_all_specialists(db: Session) -> list[dict[str, Any]]:
    """Return all active specialists (for the reasoning layer)."""
    specialists = (
        db.query(Specialist)
        .filter(Specialist.active.is_(True))
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "specialization": s.specialization,
            "location": s.location,
            "availability_status": s.availability_status,
            "next_available_date": (
                s.next_available_date.isoformat() if s.next_available_date else None
            ),
        }
        for s in specialists
    ]


# ---------------------------------------------------------------------------
# Agent run tracking
# ---------------------------------------------------------------------------

def get_or_create_agent_run(db: Session, case_id: str) -> AgentRun:
    """Return the active agent run for a case, or create one."""
    import uuid
    run = (
        db.query(AgentRun)
        .filter(
            AgentRun.case_id == case_id,
            AgentRun.status.in_(["RUNNING", "WAITING_APPROVAL"]),
        )
        .order_by(AgentRun.started_at.desc())
        .first()
    )
    if run:
        return run

    run = AgentRun(
        case_id=case_id,
        thread_id=f"case-{case_id}-{uuid.uuid4().hex[:8]}",
        status="RUNNING",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def complete_agent_run(db: Session, run_id: str, status: str = "COMPLETED") -> None:
    run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    if run:
        run.status = status
        run.completed_at = datetime.utcnow()
        db.commit()


def record_run_step(
    db: Session,
    run_id: str,
    case_id: str,
    node_name: str,
    status: str = "COMPLETED",
    details: Optional[dict] = None,
) -> AgentRunStep:
    step = AgentRunStep(
        run_id=run_id,
        case_id=case_id,
        node_name=node_name,
        status=status,
        details=json.dumps(details) if details else None,
    )
    db.add(step)
    db.commit()
    return step


# ---------------------------------------------------------------------------
# Stuck cases for Celery monitoring
# ---------------------------------------------------------------------------

def get_stuck_cases(db: Session) -> list[dict[str, Any]]:
    """Return cases that are STUCK or ACTIVE but have had no activity in 24 h."""
    threshold = datetime.utcnow() - timedelta(hours=24)
    cases = (
        db.query(Case)
        .filter(
            Case.status.in_(["STUCK", "ACTIVE"]),
            Case.last_activity < threshold,
        )
        .all()
    )
    return [_case_to_dict(c) for c in cases]


def has_pending_recommendation(db: Session, case_id: str) -> bool:
    """True if there is already an unanswered recommendation for this case."""
    from app.models.models import AgentRecommendation
    return (
        db.query(AgentRecommendation)
        .filter(
            AgentRecommendation.case_id == case_id,
            AgentRecommendation.status == "PENDING",
        )
        .first()
        is not None
    )


# ---------------------------------------------------------------------------
# Case CRUD operations
# ---------------------------------------------------------------------------

import re

def is_student_coordinator_email(email: Optional[str]) -> bool:
    """Check if email belongs to a student coordinator (24brXXXXX@rit.ac.in)."""
    if not email:
        return False
    return bool(re.match(r"^24br[a-zA-Z0-9]{5}@rit\.ac\.in$", email.strip(), re.IGNORECASE))


def enforce_user_rbac(email_or_username: Optional[str], requested_role: str = "coordinator") -> str:
    """Hardcode RBAC rule: 24brXXXXX@rit.ac.in can ONLY be a student coordinator."""
    if is_student_coordinator_email(email_or_username):
        return "coordinator"
    return requested_role


def create_case(
    db: Session,
    child_identifier: str,
    referral_type: str,
    status: str = "NEW",
    coordinator_id: Optional[str] = None,
    assigned_specialist_id: Optional[str] = None,
    assigned_specialist_email: Optional[str] = None,
    current_bottleneck: Optional[str] = None,
    coordinator_notes: Optional[str] = None,
    initial_event_details: Optional[str] = None,
    custom_id: Optional[str] = None,
) -> Case:
    """Create a new referral case using human-readable ID (e.g. stu-schoolname-5001) instead of random UUID."""
    base_id = (custom_id or child_identifier or "").strip()
    if not base_id:
        base_id = f"stu-case-{uuid.uuid4().hex[:6]}"

    case_id = base_id
    counter = 1
    while db.query(Case).filter(Case.id == case_id).first():
        case_id = f"{base_id}-{counter}"
        counter += 1

    clean_email = assigned_specialist_email.strip().lower() if assigned_specialist_email else None

    # If email provided without specialist ID, try to match existing specialist
    if clean_email and not assigned_specialist_id:
        matched_spec = db.query(Specialist).filter(func.lower(Specialist.email) == clean_email).first()
        if matched_spec:
            assigned_specialist_id = matched_spec.id

    # If specialist ID provided without email, backfill from specialist record
    if assigned_specialist_id and not clean_email:
        spec_obj = db.query(Specialist).filter(Specialist.id == assigned_specialist_id).first()
        if spec_obj and spec_obj.email:
            clean_email = spec_obj.email.strip().lower()

    new_case = Case(
        id=case_id,
        child_identifier=child_identifier,
        referral_type=referral_type,
        status=status,
        coordinator_id=coordinator_id,
        assigned_specialist_id=assigned_specialist_id,
        assigned_specialist_email=clean_email,
        current_bottleneck=current_bottleneck,
        coordinator_notes=coordinator_notes,
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Initial event
    # Sync to Supabase first so FK constraints for case_events pass
    supabase_insert("cases", {
        "id": new_case.id,
        "child_identifier": child_identifier,
        "referral_type": referral_type,
        "status": status,
        "coordinator_id": coordinator_id,
        "assigned_specialist_id": assigned_specialist_id,
        "assigned_specialist_email": clean_email,
        "current_bottleneck": current_bottleneck,
        "coordinator_notes": coordinator_notes,
    })

    evt_text = initial_event_details or f"Referral created for {child_identifier} ({referral_type})."
    record_event(db, new_case.id, "REFERRAL_CREATED", evt_text)

    # If specialist is assigned, create initial appointment link and event
    if assigned_specialist_id:
        appt = Appointment(
            case_id=new_case.id,
            specialist_id=assigned_specialist_id,
            scheduled_date=datetime.utcnow() + timedelta(days=5),
            status="REQUESTED",
        )
        db.add(appt)
        db.commit()
        contact_note = f"Initial outreach sent to assigned specialist ({clean_email})." if clean_email else "Initial outreach sent to assigned specialist."
        record_event(db, new_case.id, "SPECIALIST_CONTACTED", contact_note)

    return new_case


def update_case(
    db: Session,
    case_id: str,
    updates: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """Update case fields and record modification event if status or bottleneck changed."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None

    old_status = case.status
    old_bottleneck = case.current_bottleneck

    for k, v in updates.items():
        if hasattr(case, k):
            setattr(case, k, v)

    case.last_activity = datetime.utcnow()
    db.commit()
    db.refresh(case)

    if "status" in updates and updates["status"] != old_status:
        record_event(
            db, case_id, "STATUS_UPDATED",
            f"Case status changed from {old_status} to {updates['status']}."
        )

    if "current_bottleneck" in updates and updates["current_bottleneck"] != old_bottleneck:
        record_event(
            db, case_id, "BOTTLENECK_UPDATED",
            f"Bottleneck updated to: {updates['current_bottleneck']}."
        )

    return _case_to_dict(case)


def delete_case(db: Session, case_id: str) -> bool:
    """Delete a case and all associated records (explicit cascade for SQLite)."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return False

    # Delete leaves first (tables that reference child tables, not just cases)
    db.query(ActionVerification).filter(ActionVerification.case_id == case_id).delete(synchronize_session=False)
    db.query(AgentRunStep).filter(AgentRunStep.case_id == case_id).delete(synchronize_session=False)

    # Delete agent-side records
    db.query(Action).filter(Action.case_id == case_id).delete(synchronize_session=False)
    db.query(AgentRecommendation).filter(AgentRecommendation.case_id == case_id).delete(synchronize_session=False)
    db.query(AgentObservation).filter(AgentObservation.case_id == case_id).delete(synchronize_session=False)
    db.query(Bottleneck).filter(Bottleneck.case_id == case_id).delete(synchronize_session=False)
    db.query(AgentRun).filter(AgentRun.case_id == case_id).delete(synchronize_session=False)

    # Delete case-related records
    db.query(ActionVerification).filter(ActionVerification.case_id == case_id).delete(synchronize_session=False)
    db.query(Appointment).filter(Appointment.case_id == case_id).delete(synchronize_session=False)
    db.query(Escalation).filter(Escalation.case_id == case_id).delete(synchronize_session=False)
    db.query(FollowUp).filter(FollowUp.case_id == case_id).delete(synchronize_session=False)
    db.query(Communication).filter(Communication.case_id == case_id).delete(synchronize_session=False)
    db.query(Document).filter(Document.case_id == case_id).delete(synchronize_session=False)
    db.query(CaseEvent).filter(CaseEvent.case_id == case_id).delete(synchronize_session=False)

    # Finally delete the case itself
    db.delete(case)
    db.commit()
    return True


def update_specialist_availability(
    db: Session,
    specialist_id: str,
    availability_status: str,
    next_available_date: Optional[datetime] = None,
) -> Optional[dict[str, Any]]:
    """Update specialist availability status."""
    spec = db.query(Specialist).filter(Specialist.id == specialist_id).first()
    if not spec:
        return None

    spec.availability_status = availability_status
    if next_available_date:
        spec.next_available_date = next_available_date
    db.commit()
    db.refresh(spec)

    return {
        "id": spec.id,
        "name": spec.name,
        "specialization": spec.specialization,
        "location": spec.location,
        "availability_status": spec.availability_status,
        "next_available_date": spec.next_available_date.isoformat() if spec.next_available_date else None,
        "active": spec.active,
    }


def update_diagnostic_details(
    db: Session,
    case_id: str,
    diagnostic_details: str,
    educator_name: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Save diagnostic evaluation notes, clear specialist bottleneck, transition status to ACTIVE, and add timeline events."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None

    case.diagnostic_details = diagnostic_details
    case.current_bottleneck = None
    case.status = "ACTIVE"
    # Revert timeline to default (Day 0) now that specialist diagnostic evaluation is received
    case.created_date = datetime.utcnow()
    case.last_activity = datetime.utcnow()

    # Dismiss/resolve any pending recommendations since specialist has responded
    from app.models.models import AgentRecommendation
    db.query(AgentRecommendation).filter(
        AgentRecommendation.case_id == case_id,
        AgentRecommendation.status == "PENDING",
    ).update({"status": "RESOLVED"})

    db.commit()
    db.refresh(case)

    # Sync to Supabase
    supabase_update("cases", case_id, {
        "diagnostic_details": diagnostic_details,
        "current_bottleneck": case.current_bottleneck,
        "status": case.status,
    })

    name_str = f" by {educator_name}" if educator_name else ""
    record_event(
        db,
        case_id,
        "SPECIALIST_RESPONDED",
        f"Clinical specialist response recorded{name_str} with diagnostic evaluation findings."
    )
    record_event(
        db,
        case_id,
        "DIAGNOSTIC_EVALUATION_LOGGED",
        f"Diagnostic assessment notes submitted{name_str}: {diagnostic_details[:100]}..."
    )

    return _case_to_dict(case)
