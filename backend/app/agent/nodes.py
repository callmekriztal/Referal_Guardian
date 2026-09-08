"""
LangGraph Node implementations for the Referral Guardian agent.

Each node has a single responsibility.
All DB access goes through services.
The LLM is only invoked in the reasoning_node.
"""
import json
import logging
from typing import Any

from langgraph.types import interrupt

from app.agent.actions import is_valid_action
from app.agent.bottleneck import detect_bottleneck
from app.agent.reasoning import generate_educator_summary, recommend_action
from app.agent.state import ReferralState
from app.agent.verification import verify_action

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node 1 — Observe
# ---------------------------------------------------------------------------

def observe_node(state: ReferralState) -> dict[str, Any]:
    """
    Fetch the case and its full timeline from the database.

    The DB session is injected via state["_db"] by the API layer before
    invoking the graph. For runs without DB (e.g. tests), stub data is used.
    """
    from app.models.database import SessionLocal
    from app.services.case_service import (
        get_case,
        get_case_timeline,
        get_all_specialists,
        record_event,
    )

    case_id = state["case_id"]
    logger.info("[observe] case=%s", case_id)

    db = SessionLocal()
    try:
        case = get_case(db, case_id)
        if not case:
            return {"error": f"Case {case_id} not found", "should_continue": False}

        timeline = get_case_timeline(db, case_id)
        specialists = get_all_specialists(db)

        record_event(db, case_id, "AGENT_OBSERVED_CASE",
                     f"Agent observed case. Timeline events: {len(timeline)}")

        return {
            "case": case,
            "timeline": timeline,
            "specialists": specialists,
            "current_state": case.get("status"),
            "error": None,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Node 2 — Detect Bottleneck
# ---------------------------------------------------------------------------

def bottleneck_node(state: ReferralState) -> dict[str, Any]:
    """Deterministic bottleneck detection — no LLM involved."""
    from app.models.database import SessionLocal
    from app.services.case_service import record_event
    from app.models.models import Bottleneck, AgentRun

    case_id = state["case_id"]
    case = state.get("case", {})
    timeline = state.get("timeline", [])

    logger.info("[bottleneck] case=%s", case_id)

    bottleneck = detect_bottleneck(case, timeline)

    db = SessionLocal()
    try:
        run_id = state.get("run_id")
        if bottleneck:
            b = Bottleneck(
                case_id=case_id,
                run_id=run_id,
                bottleneck_type=bottleneck["type"],
                description=bottleneck.get("description"),
                severity=bottleneck.get("severity"),
            )
            db.add(b)
            db.commit()

            from app.services.supabase_client import supabase_insert
            supabase_insert("bottlenecks", {
                "id": b.id,
                "case_id": case_id,
                "run_id": run_id,
                "bottleneck_type": bottleneck["type"],
                "description": bottleneck.get("description"),
                "severity": bottleneck.get("severity"),
            })

            record_event(
                db, case_id, "BOTTLENECK_DETECTED",
                json.dumps(bottleneck, default=str),
            )
        else:
            record_event(db, case_id, "NO_BOTTLENECK_DETECTED",
                         "Agent confirmed case is on track with no pending bottlenecks.")
    finally:
        db.close()

    return {
        "bottleneck": bottleneck,
        "should_continue": bottleneck is not None,
    }


# ---------------------------------------------------------------------------
# Node 3 — Reasoning
# ---------------------------------------------------------------------------

def reasoning_node(state: ReferralState) -> dict[str, Any]:
    """
    Ask the LLM to recommend the next operational action.

    Saves the recommendation to the DB.
    Does NOT execute anything.
    """
    from app.models.database import SessionLocal
    from app.services.case_service import record_event
    from app.models.models import AgentRecommendation

    case_id = state["case_id"]
    bottleneck = state.get("bottleneck")

    if not bottleneck:
        return {
            "recommendation": None,
            "requires_approval": False,
            "should_continue": False,
        }

    logger.info("[reasoning] case=%s bottleneck=%s", case_id, bottleneck.get("type"))

    recommendation = recommend_action(
        case=state["case"],
        timeline=state["timeline"],
        bottleneck=bottleneck,
        specialists=state.get("specialists", []),
    )

    db = SessionLocal()
    rec_id = None
    try:
        rec = AgentRecommendation(
            case_id=case_id,
            run_id=state.get("run_id"),
            bottleneck=bottleneck["type"],
            confidence=recommendation["confidence"],
            recommended_action=recommendation["action"],
            priority=_confidence_to_priority(recommendation["confidence"]),
            reason=recommendation["reason"],
            evidence=json.dumps(recommendation.get("evidence", []), default=str),
            status="PENDING",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        rec_id = str(rec.id) if getattr(rec, "id", None) else None

        from app.services.supabase_client import supabase_insert
        supabase_insert("agent_recommendations", {
            "id": rec_id,
            "case_id": case_id,
            "run_id": state.get("run_id"),
            "bottleneck": bottleneck["type"],
            "confidence": recommendation["confidence"],
            "recommended_action": recommendation["action"],
            "priority": _confidence_to_priority(recommendation["confidence"]),
            "reason": recommendation["reason"],
            "status": "PENDING",
        })

        # Generate and persist clinical handoff summary for Special Educator
        from app.models.models import Case
        educator_summary_text = generate_educator_summary(
            case=state.get("case", {}),
            timeline=state.get("timeline", []),
            bottleneck=bottleneck,
            recommendation=recommendation,
        )
        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if case_obj:
            case_obj.educator_summary = educator_summary_text
            db.commit()

        record_event(
            db, case_id, "RECOMMENDATION_CREATED",
            json.dumps({**recommendation, "recommendation_id": rec_id}, default=str),
        )
    finally:
        db.close()

    return {
        "recommendation": recommendation,
        "recommendation_id": rec_id,
        "educator_summary": educator_summary_text,
        "requires_approval": True,
    }


def _confidence_to_priority(confidence: float) -> str:
    if confidence >= 0.9:
        return "HIGH"
    if confidence >= 0.7:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Node 4 — Human Approval (interrupt)
# ---------------------------------------------------------------------------

def approval_node(state: ReferralState) -> dict[str, Any]:
    """
    Pause execution and wait for human decision.

    LangGraph interrupt() suspends the graph here.
    The API layer resumes the graph with human_decision set.
    """
    case_id = state["case_id"]
    recommendation = state.get("recommendation")
    bottleneck = state.get("bottleneck")

    logger.info("[approval] case=%s — pausing for human approval", case_id)

    # This interrupt suspends the graph until resumed via the API
    human_response = interrupt({
        "case_id": case_id,
        "bottleneck": bottleneck,
        "recommendation": recommendation,
        "message": "Human approval required before executing action.",
    })

    # When resumed, human_response contains the decision from the API
    decision = human_response.get("decision", "REJECT") if isinstance(human_response, dict) else str(human_response)
    modification = human_response.get("modification") if isinstance(human_response, dict) else None

    from app.models.database import SessionLocal
    from app.services.case_service import record_event
    from app.models.models import AgentRecommendation
    import datetime

    db = SessionLocal()
    try:
        rec_id = state.get("recommendation_id")
        if rec_id:
            rec = db.query(AgentRecommendation).filter(AgentRecommendation.id == rec_id).first()
            if rec:
                rec.status = decision
                if modification:
                    rec.human_modified_action = modification.get("action")
                rec.approval_timestamp = datetime.datetime.utcnow()
                db.commit()

        event_map = {
            "APPROVE": "RECOMMENDATION_APPROVED",
            "REJECT": "RECOMMENDATION_REJECTED",
            "MODIFY": "RECOMMENDATION_MODIFIED",
        }
        record_event(
            db, case_id,
            event_map.get(decision, "RECOMMENDATION_REVIEWED"),
            json.dumps({"decision": decision, "modification": modification}, default=str),
        )
    finally:
        db.close()

    # Apply modification to recommendation if present
    updated_recommendation = state.get("recommendation", {})
    if decision == "MODIFY" and modification:
        mod_action = modification.get("action", "")
        if is_valid_action(mod_action):
            updated_recommendation = {**updated_recommendation, "action": mod_action}
            updated_recommendation["reason"] = (
                modification.get("reason")
                or f"Human modified action to: {mod_action}"
            )
        else:
            # Invalid modification → treat as reject
            decision = "REJECT"

    return {
        "human_decision": decision,
        "human_modification": modification,
        "recommendation": updated_recommendation,
        "should_continue": decision in ("APPROVE", "MODIFY"),
    }


# ---------------------------------------------------------------------------
# Node 5 — Execute
# ---------------------------------------------------------------------------

def execute_node(state: ReferralState) -> dict[str, Any]:
    """Execute the approved action through the controlled action executor."""
    from app.models.database import SessionLocal
    from app.services.action_executor import execute_action
    from app.services.case_service import record_event

    case_id = state["case_id"]
    recommendation = state.get("recommendation")

    if not recommendation:
        return {
            "action_result": {
                "status": "FAILED",
                "error": "No recommendation available to execute.",
            }
        }

    action = recommendation.get("action")
    logger.info("[execute] case=%s action=%s", case_id, action)

    db = SessionLocal()
    try:
        result = execute_action(
            case_id=case_id,
            action=action,
            db=db,
            recommendation_id=state.get("recommendation_id"),
            parameters=recommendation.get("parameters", {}),
        )

        event = "ACTION_EXECUTED" if result.get("status") != "FAILED" else "ACTION_FAILED"
        record_event(db, case_id, event, json.dumps(result, default=str))
    finally:
        db.close()

    return {"action_result": result}


# ---------------------------------------------------------------------------
# Node 6 — Verify
# ---------------------------------------------------------------------------

def verification_node(state: ReferralState) -> dict[str, Any]:
    """Verify the action result and persist an ActionVerification record."""
    from app.models.database import SessionLocal
    from app.services.action_executor import verify_and_persist
    from app.services.case_service import record_event

    case_id = state["case_id"]
    action_result = state.get("action_result", {})

    logger.info("[verify] case=%s", case_id)

    db = SessionLocal()
    try:
        action_record_id = action_result.get("action_record_id")
        if action_record_id:
            verification = verify_and_persist(db, case_id, action_record_id, action_result)
        else:
            # No DB record — use in-memory verification
            from app.agent.verification import verify_action
            verification = verify_action(action_result)

        event = "OUTCOME_VERIFIED" if verification["success"] else "OUTCOME_FAILED"
        record_event(db, case_id, event, json.dumps(verification, default=str))
    finally:
        db.close()

    return {
        "verification": verification,
        "should_continue": verification["success"],
    }
