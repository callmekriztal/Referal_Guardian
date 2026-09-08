"""
Referral Guardian — FastAPI Backend

Replaces the mock in-memory implementation with real SQLAlchemy + LangGraph.
All existing route paths are preserved.
"""
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import Base, engine, get_db
from app.models.models import (
    AgentRecommendation,
    AgentRun,
    Case,
)
from app.services.case_service import (
    get_case,
    get_case_timeline,
    record_event,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# Lifespan — create tables on startup if they don't exist
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        from app.models.database import ensure_sqlite_columns
        ensure_sqlite_columns()
        logger.info("Database tables and columns ensured")
    except Exception as exc:
        logger.warning("Startup initialization error: %s", exc)
    yield


app = FastAPI(title="Referral Guardian MVP API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",   # alt Next.js port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class CreateCaseRequest(BaseModel):
    child_identifier: str
    referral_type: str
    status: Optional[str] = "NEW"
    coordinator_id: Optional[str] = None
    assigned_specialist_id: Optional[str] = None
    assigned_specialist_email: Optional[str] = None
    current_bottleneck: Optional[str] = None
    coordinator_notes: Optional[str] = None
    initial_event_details: Optional[str] = None
    custom_id: Optional[str] = None


class UpdateCaseRequest(BaseModel):
    status: Optional[str] = None
    current_bottleneck: Optional[str] = None
    coordinator_notes: Optional[str] = None
    assigned_specialist_id: Optional[str] = None
    assigned_specialist_email: Optional[str] = None
    referral_type: Optional[str] = None


class AddEventRequest(BaseModel):
    event_type: str
    details: Optional[str] = None


class FastForwardRequest(BaseModel):
    days: int


class DiagnosticRequest(BaseModel):
    diagnostic_details: str
    educator_name: Optional[str] = "Special Educator"


class UpdateAvailabilityRequest(BaseModel):
    availability_status: str  # AVAILABLE, UNAVAILABLE
    next_available_date: Optional[str] = None


class ApproveRequest(BaseModel):
    approver_id: Optional[str] = None
    coordinator_notes: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = None
    coordinator_notes: Optional[str] = None


class ModifyRequest(BaseModel):
    action: str
    reason: Optional[str] = None
    coordinator_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total = db.query(Case).count()
        stuck = db.query(Case).filter(Case.status.in_(["STUCK", "ESCALATED"])).count()
        pending = (
            db.query(AgentRecommendation)
            .filter(AgentRecommendation.status == "PENDING")
            .count()
        )
        escalations = db.query(Case).filter(Case.status == "ESCALATED").count()
        return {
            "active_cases": total,
            "stuck_cases": stuck,
            "pending_actions": pending,
            "escalations": escalations,
        }
    except Exception:
        logger.exception("Dashboard query failed")
        return {
            "active_cases": 0,
            "stuck_cases": 0,
            "pending_actions": 0,
            "escalations": 0,
        }


# ---------------------------------------------------------------------------
# Cases & Coordinator CRUD
# ---------------------------------------------------------------------------

@app.get("/api/cases")
def list_cases(db: Session = Depends(get_db)):
    try:
        cases = db.query(Case).order_by(Case.created_date.desc()).all()
        return [_case_to_response(c, db) for c in cases]
    except Exception:
        logger.exception("Failed to list cases")
        return []


@app.post("/api/cases")
def create_new_case(body: CreateCaseRequest, db: Session = Depends(get_db)):
    """Coordinator endpoint: Create a new referral case."""
    from app.services.case_service import create_case
    try:
        new_case = create_case(
            db=db,
            child_identifier=body.child_identifier,
            referral_type=body.referral_type,
            status=body.status or "NEW",
            coordinator_id=body.coordinator_id,
            assigned_specialist_id=body.assigned_specialist_id,
            assigned_specialist_email=body.assigned_specialist_email,
            current_bottleneck=body.current_bottleneck,
            coordinator_notes=body.coordinator_notes,
            initial_event_details=body.initial_event_details,
            custom_id=body.custom_id,
        )
        return _case_to_response(new_case, db, include_timeline=True)
    except Exception as exc:
        logger.exception("Failed to create case")
        raise HTTPException(status_code=500, detail=f"Failed to create case: {str(exc)}")


@app.get("/api/cases/{case_id}")
def get_case_detail(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_to_response(case, db, include_timeline=True)


@app.put("/api/cases/{case_id}")
def update_case_detail(case_id: str, body: UpdateCaseRequest, db: Session = Depends(get_db)):
    """Coordinator endpoint: Update case metadata or status."""
    from app.services.case_service import update_case
    updates = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else body.dict(exclude_unset=True)
    res = update_case(db, case_id, updates)
    if not res:
        raise HTTPException(status_code=404, detail="Case not found")
    case = db.query(Case).filter(Case.id == case_id).first()
    return _case_to_response(case, db, include_timeline=True)


@app.delete("/api/cases/{case_id}")
def delete_case_detail(case_id: str, db: Session = Depends(get_db)):
    """Coordinator endpoint: Delete a case."""
    from app.services.case_service import delete_case
    success = delete_case(db, case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"success": True, "message": f"Case {case_id} deleted successfully"}


@app.post("/api/seed")
def seed_demo_data():
    """Endpoint to seed/restore all realistic demo cases and specialists."""
    from app.seed import seed_database
    seed_database()
    return {"success": True, "message": "Demo data populated successfully"}


@app.post("/api/cases/{case_id}/events")
def add_case_event(case_id: str, body: AddEventRequest, db: Session = Depends(get_db)):
    """Coordinator endpoint: Manually log a timeline milestone (useful for simulating bottlenecks)."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evt = record_event(db, case_id, body.event_type, body.details)
    return {
        "id": evt.id,
        "case_id": case_id,
        "event_type": evt.event_type,
        "details": evt.details,
        "timestamp": evt.timestamp.isoformat() if evt.timestamp else None,
    }


@app.post("/api/cases/{case_id}/fast-forward")
def fast_forward_case(
    case_id: str,
    body: FastForwardRequest,
    db: Session = Depends(get_db),
):
    """Fast-forward (or reset) the case's timeline to simulate statutory 20-day assessment compliance."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    new_created_date = datetime.utcnow() - timedelta(days=body.days)
    case.created_date = new_created_date
    case.last_activity = datetime.utcnow()

    is_overdue = body.days >= 20 and case.status != "RESOLVED"
    if is_overdue:
        case.status = "STUCK"
        case.current_bottleneck = "APPOINTMENT_DELAYED"
        record_event(
            db,
            case_id,
            "APPOINTMENT_DELAYED",
            f"Statutory 20-day timeline exceeded! Referral has reached Day {body.days} without finalized diagnostic assessment and IEP determination.",
        )
    else:
        if body.days == 0:
            if case.status == "STUCK" and case.current_bottleneck == "APPOINTMENT_DELAYED":
                case.current_bottleneck = None
                case.status = "ACTIVE"
            record_event(db, case_id, "TIMELINE_RESET", "Case timeline reset to Day 0 intake.")
        else:
            record_event(
                db,
                case_id,
                "TIMELINE_FAST_FORWARDED",
                f"Timeline fast-forwarded: case aged to Day {body.days}.",
            )

    db.commit()
    db.refresh(case)
    return _case_to_response(case, db, include_timeline=True)


# ---------------------------------------------------------------------------
# Specialists & Special Educator Portal Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/specialists")
def list_specialists(db: Session = Depends(get_db)):
    """List all specialists with their availability status."""
    from app.models.models import Specialist
    specs = db.query(Specialist).filter(Specialist.active.is_(True)).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "specialization": s.specialization,
            "location": s.location,
            "availability_status": s.availability_status,
            "next_available_date": s.next_available_date.isoformat() if s.next_available_date else None,
            "active": s.active,
        }
        for s in specs
    ]


@app.get("/api/educator/cases")
def list_educator_cases(
    email: Optional[str] = None,
    sort_by: Optional[str] = "urgency",
    db: Session = Depends(get_db),
):
    """Special Educator view: List cases with diagnostic & coordinator context.
    Optionally filters by doctor/specialist email and sorts by urgency/days_open/last_activity/id.
    """
    from sqlalchemy import or_, func
    from app.models.models import Specialist

    query = db.query(Case)
    if email and email.strip():
        clean_email = email.strip().lower()
        query = query.filter(
            or_(
                func.lower(Case.assigned_specialist_email) == clean_email,
                Case.assigned_specialist.has(func.lower(Specialist.email) == clean_email),
            )
        )

    cases = query.all()

    # Sort cases based on requested criteria
    if sort_by == "days_open":
        cases.sort(key=lambda c: c.created_date or datetime.max)
    elif sort_by == "last_activity":
        cases.sort(key=lambda c: c.last_activity or datetime.min, reverse=True)
    elif sort_by == "id":
        cases.sort(key=lambda c: (c.child_identifier or c.id).lower())
    else:  # default: urgency
        def _urgency_rank(c: Case):
            status_order = {
                "ESCALATED": 0,
                "STUCK": 1,
                "ACTIVE": 2 if c.current_bottleneck else 3,
                "NEW": 4,
                "RESOLVED": 5,
            }
            weight = status_order.get(c.status, 3)
            # Secondary sort: newest activity first
            act_ts = c.last_activity.timestamp() if c.last_activity else 0
            return (weight, -act_ts)

        cases.sort(key=_urgency_rank)

    return [_case_to_response(c, db, include_timeline=True) for c in cases]


@app.patch("/api/educator/specialists/{specialist_id}/availability")
def toggle_specialist_availability(
    specialist_id: str,
    body: UpdateAvailabilityRequest,
    db: Session = Depends(get_db),
):
    """Special Educator endpoint: Update availability (AVAILABLE / UNAVAILABLE)."""
    from app.services.case_service import update_specialist_availability
    from datetime import datetime
    next_date = None
    if body.next_available_date:
        try:
            next_date = datetime.fromisoformat(body.next_available_date)
        except Exception:
            pass

    res = update_specialist_availability(db, specialist_id, body.availability_status, next_date)
    if not res:
        raise HTTPException(status_code=404, detail="Specialist not found")
    return res


@app.post("/api/cases/{case_id}/diagnostics")
def submit_case_diagnostics(
    case_id: str,
    body: DiagnosticRequest,
    db: Session = Depends(get_db),
):
    """Special Educator endpoint: Submit diagnostic findings and evaluation notes."""
    from app.services.case_service import update_diagnostic_details
    res = update_diagnostic_details(db, case_id, body.diagnostic_details, body.educator_name)
    if not res:
        raise HTTPException(status_code=404, detail="Case not found")
    case = db.query(Case).filter(Case.id == case_id).first()
    return _case_to_response(case, db, include_timeline=True)


def _case_to_response(case: Case, db: Session, include_timeline: bool = False) -> dict[str, Any]:
    from datetime import datetime
    days_open = (datetime.utcnow() - case.created_date).days if case.created_date else 0

    # Pending recommendation
    pending_rec = (
        db.query(AgentRecommendation)
        .filter(
            AgentRecommendation.case_id == case.id,
            AgentRecommendation.status == "PENDING",
        )
        .order_by(AgentRecommendation.created_at.desc())
        .first()
    )

    specialist_name = None
    if case.assigned_specialist:
        specialist_name = case.assigned_specialist.name
    elif case.appointments:
        latest = sorted(case.appointments, key=lambda a: a.scheduled_date or datetime.min)[-1]
        if latest.specialist:
            specialist_name = latest.specialist.name

    specialist_email = case.assigned_specialist_email
    if not specialist_email and case.assigned_specialist and case.assigned_specialist.email:
        specialist_email = case.assigned_specialist.email

    result: dict[str, Any] = {
        "id": case.id,
        "child_identifier": case.child_identifier,
        "referral_type": case.referral_type,
        "status": case.status,
        "coordinator_id": case.coordinator_id,
        "assigned_specialist_id": case.assigned_specialist_id,
        "assigned_specialist_name": specialist_name,
        "assigned_specialist_email": specialist_email,
        "current_bottleneck": case.current_bottleneck,
        "coordinator_notes": case.coordinator_notes,
        "diagnostic_details": case.diagnostic_details,
        "educator_summary": getattr(case, "educator_summary", None),
        "created_date": case.created_date.isoformat() if case.created_date else None,
        "last_activity": case.last_activity.isoformat() if case.last_activity else None,
        "days_open": days_open,
        "followup_attempts": case.followup_attempts or 0,
        "recommendation": _rec_to_response(pending_rec) if pending_rec else None,
    }

    if include_timeline:
        result["timeline"] = get_case_timeline(db, case.id)

    return result


def _rec_to_response(rec: AgentRecommendation) -> dict[str, Any]:
    return {
        "id": rec.id,
        "bottleneck": rec.bottleneck,
        "confidence": rec.confidence,
        "recommended_action": rec.recommended_action,
        "priority": rec.priority,
        "reason": rec.reason,
        "evidence": json.loads(rec.evidence) if rec.evidence else [],
        "status": rec.status,
        "requires_human_approval": True,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


# ---------------------------------------------------------------------------
# Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/api/cases/{case_id}/agent/run")
def run_agent(case_id: str, db: Session = Depends(get_db)):
    """
    Evaluate the referral case using the Referral Guardian agent.
    Always analyzes the current timeline and state to detect bottlenecks or verify progress.
    """
    case_data = get_case(db, case_id)
    if not case_data:
        raise HTTPException(status_code=404, detail="Case not found")

    from app.agent.graph import get_graph
    from app.services.case_service import get_or_create_agent_run

    graph = get_graph()
    run = get_or_create_agent_run(db, case_id)
    thread_id = f"case-{case_id}"
    config = {"configurable": {"thread_id": thread_id}}

    try:
        initial_state: dict[str, Any] = {
            "case_id": case_id,
            "run_id": run.id,
            "step_count": 0,
        }

        final_state = None
        for chunk in graph.stream(initial_state, config, stream_mode="values"):
            final_state = chunk

        snapshot = graph.get_state(config)
        detected_b = snapshot.values.get("bottleneck") if snapshot and snapshot.values else None

        # If no bottleneck was detected, ensure DB case status is ACTIVE and clear current_bottleneck
        if not detected_b:
            case_obj = db.query(Case).filter(Case.id == case_id).first()
            if case_obj:
                case_obj.current_bottleneck = None
                if case_obj.status in ("STUCK", "NEW"):
                    case_obj.status = "ACTIVE"
                db.commit()
            db.query(AgentRecommendation).filter(
                AgentRecommendation.case_id == case_id,
                AgentRecommendation.status == "PENDING",
            ).update({"status": "RESOLVED"})
            db.commit()

        return _build_agent_state_response(case_id, snapshot, run, db)

    except Exception as exc:
        logger.exception("Agent run failed for case %s", case_id)
        raise HTTPException(status_code=500, detail=f"Agent run failed: {str(exc)}")


@app.get("/api/cases/{case_id}/agent/state")
def get_agent_state(case_id: str, db: Session = Depends(get_db)):
    """Return the current agent state and any pending recommendation."""
    # Verify case exists
    if not db.query(Case).filter(Case.id == case_id).first():
        raise HTTPException(status_code=404, detail="Case not found")

    from app.agent.graph import get_graph

    graph = get_graph()
    config = {"configurable": {"thread_id": f"case-{case_id}"}}

    try:
        snapshot = graph.get_state(config)
    except Exception:
        snapshot = None

    run = (
        db.query(AgentRun)
        .filter(AgentRun.case_id == case_id)
        .order_by(AgentRun.started_at.desc())
        .first()
    )

    return _build_agent_state_response(case_id, snapshot, run, db)


@app.post("/api/cases/{case_id}/agent/approve")
def approve_recommendation(
    case_id: str,
    body: ApproveRequest,
    db: Session = Depends(get_db),
):
    """Approve the pending recommendation and resume graph execution."""
    if body.coordinator_notes:
        case = db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.coordinator_notes = body.coordinator_notes
            db.commit()

    return _resume_graph(
        case_id=case_id,
        db=db,
        human_response={"decision": "APPROVE", "coordinator_notes": body.coordinator_notes},
    )


@app.post("/api/cases/{case_id}/agent/reject")
def reject_recommendation(
    case_id: str,
    body: RejectRequest,
    db: Session = Depends(get_db),
):
    """Reject the pending recommendation and end this graph run."""
    if body.coordinator_notes:
        case = db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.coordinator_notes = body.coordinator_notes
            db.commit()

    return _resume_graph(
        case_id=case_id,
        db=db,
        human_response={"decision": "REJECT", "reason": body.reason, "coordinator_notes": body.coordinator_notes},
    )


@app.post("/api/cases/{case_id}/agent/modify")
def modify_recommendation(
    case_id: str,
    body: ModifyRequest,
    db: Session = Depends(get_db),
):
    """Modify the recommended action and resume graph execution."""
    from app.agent.actions import is_valid_action

    if not is_valid_action(body.action):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{body.action}'. Must be one of the allowed actions.",
        )

    if body.coordinator_notes:
        case = db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.coordinator_notes = body.coordinator_notes
            db.commit()

    return _resume_graph(
        case_id=case_id,
        db=db,
        human_response={
            "decision": "MODIFY",
            "modification": {"action": body.action, "reason": body.reason},
            "coordinator_notes": body.coordinator_notes,
        },
    )


def _resume_graph(
    case_id: str,
    db: Session,
    human_response: dict[str, Any],
) -> dict[str, Any]:
    """Resume a paused graph with a human decision."""
    from app.agent.graph import get_graph
    from app.services.action_executor import execute_action

    graph = get_graph()
    config = {"configurable": {"thread_id": f"case-{case_id}"}}

    snapshot = None
    try:
        snapshot = graph.get_state(config)
    except Exception:
        pass

    if snapshot and snapshot.next:
        try:
            final_state = None
            for chunk in graph.stream(
                Command(resume=human_response),
                config,
                stream_mode="values",
            ):
                final_state = chunk

            snapshot = graph.get_state(config)
            run = (
                db.query(AgentRun)
                .filter(AgentRun.case_id == case_id)
                .order_by(AgentRun.started_at.desc())
                .first()
            )
            return _build_agent_state_response(case_id, snapshot, run, db)
        except Exception as exc:
            logger.warning("Stream resume failed, falling back to direct execution: %s", exc)

    # Fallback for database-backed recommendations
    pending_rec = (
        db.query(AgentRecommendation)
        .filter(
            AgentRecommendation.case_id == case_id,
            AgentRecommendation.status == "PENDING",
        )
        .order_by(AgentRecommendation.created_at.desc())
        .first()
    )

    if not pending_rec:
        raise HTTPException(
            status_code=404,
            detail="No pending recommendation found for this case.",
        )

    decision = human_response.get("decision", "APPROVE")
    modification = human_response.get("modification")
    action_to_execute = pending_rec.recommended_action

    if decision == "MODIFY" and modification:
        action_to_execute = modification.get("action", pending_rec.recommended_action)
        pending_rec.human_modified_action = action_to_execute
        pending_rec.status = "MODIFIED"
    elif decision == "REJECT":
        pending_rec.status = "REJECTED"
        db.commit()
        record_event(db, case_id, "RECOMMENDATION_REJECTED", "Recommendation rejected by coordinator.")
        return {
            "case_id": case_id,
            "agent_status": "COMPLETED",
            "action_result": {"status": "REJECTED", "message": "Recommendation rejected by coordinator."},
        }
    else:
        pending_rec.status = "APPROVED"

    pending_rec.approval_timestamp = datetime.utcnow()
    db.commit()

    event_map = {
        "APPROVE": "RECOMMENDATION_APPROVED",
        "MODIFY": "RECOMMENDATION_MODIFIED",
    }
    record_event(
        db,
        case_id,
        event_map.get(decision, "RECOMMENDATION_APPROVED"),
        json.dumps({"decision": decision, "action": action_to_execute}, default=str),
    )

    exec_result = execute_action(
        case_id=case_id,
        action=action_to_execute,
        db=db,
        recommendation_id=str(pending_rec.id),
    )

    run = (
        db.query(AgentRun)
        .filter(AgentRun.case_id == case_id)
        .order_by(AgentRun.started_at.desc())
        .first()
    )
    if run:
        run.status = "COMPLETED"
        run.completed_at = datetime.utcnow()
        db.commit()

    return {
        "case_id": case_id,
        "agent_status": "COMPLETED",
        "action_result": exec_result,
        "verification": {"success": exec_result.get("status") in ("SUCCESS", "SIMULATED"), "status": "VERIFIED"},
        "recommendation": None,
    }


def _build_agent_state_response(
    case_id: str,
    snapshot,
    run: Optional[AgentRun],
    db: Session,
) -> dict[str, Any]:
    """Build a unified agent state response for the frontend."""
    state_values = snapshot.values if snapshot else {}
    pending_nodes = list(snapshot.next) if snapshot and snapshot.next else []

    waiting_for_approval = "approval" in pending_nodes
    detected_bottleneck = state_values.get("bottleneck")

    # Pending recommendation
    pending_rec = (
        db.query(AgentRecommendation)
        .filter(
            AgentRecommendation.case_id == case_id,
            AgentRecommendation.status == "PENDING",
        )
        .order_by(AgentRecommendation.created_at.desc())
        .first()
    )

    return {
        "case_id": case_id,
        "agent_status": _agent_status(state_values, pending_nodes, run),
        "current_node": pending_nodes[0] if pending_nodes else None,
        "waiting_for_approval": waiting_for_approval,
        "bottleneck": detected_bottleneck,
        "recommendation": _rec_to_response(pending_rec) if pending_rec else None,
        "action_result": state_values.get("action_result"),
        "verification": state_values.get("verification"),
        "error": state_values.get("error"),
        "run_id": run.id if run else None,
    }


def _agent_status(
    state_values: dict, pending_nodes: list, run: Optional[AgentRun]
) -> str:
    if state_values.get("error"):
        return "ERROR"
    if "approval" in pending_nodes:
        return "WAITING_APPROVAL"
    if pending_nodes:
        return "RUNNING"
    if state_values.get("verification", {}).get("success"):
        return "COMPLETED"
    if run and run.status:
        return run.status
    return "IDLE"


# ---------------------------------------------------------------------------
# Legacy recommendation endpoints (backward compat with old frontend)
# ---------------------------------------------------------------------------

@app.post("/api/recommendations/{rec_id}/approve")
def legacy_approve(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(AgentRecommendation).filter(AgentRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return approve_recommendation(rec.case_id, ApproveRequest(), db)


@app.post("/api/recommendations/{rec_id}/reject")
def legacy_reject(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(AgentRecommendation).filter(AgentRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return reject_recommendation(rec.case_id, RejectRequest(), db)


# ---------------------------------------------------------------------------
# Import Command for LangGraph resume
# ---------------------------------------------------------------------------

try:
    from langgraph.types import Command
except ImportError:
    # Older langgraph versions
    class Command:  # type: ignore
        def __init__(self, resume=None):
            self.resume = resume


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
