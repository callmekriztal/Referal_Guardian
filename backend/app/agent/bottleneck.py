"""
Bottleneck Detection — deterministic Python logic only.

The LLM is NOT involved here. If a condition can be reliably
detected from structured state, it should be.
"""
from typing import Any, Optional


BOTTLENECK_MISSING_DOCUMENT = "MISSING_DOCUMENT"
BOTTLENECK_SPECIALIST_UNAVAILABLE = "SPECIALIST_UNAVAILABLE"
BOTTLENECK_NO_SPECIALIST_RESPONSE = "NO_SPECIALIST_RESPONSE"
BOTTLENECK_APPOINTMENT_DELAYED = "APPOINTMENT_DELAYED"
BOTTLENECK_REPEATED_FAILURE = "REPEATED_FAILURE"

# After this many failed/unanswered attempts we flag REPEATED_FAILURE
REPEATED_FAILURE_THRESHOLD = 3


def detect_bottleneck(
    case: dict[str, Any],
    timeline: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    """
    Detect the most urgent bottleneck using deterministic rules.

    Returns a bottleneck dict or None if no bottleneck is found.
    Priority order: REPEATED_FAILURE > SPECIALIST_UNAVAILABLE > MISSING_DOCUMENT
    > NO_SPECIALIST_RESPONSE > APPOINTMENT_DELAYED
    """
    has_specialist_response = bool(case.get("diagnostic_details") and str(case.get("diagnostic_details")).strip()) or any(
        e.get("event_type") in ("DIAGNOSTIC_EVALUATION_LOGGED", "SPECIALIST_RESPONDED")
        for e in timeline
    )

    # --- Repeated failure (check first — highest priority for escalation) ---
    failed_attempts = _count_failed_attempts(case, timeline)
    if (failed_attempts >= REPEATED_FAILURE_THRESHOLD or case.get("current_bottleneck") == BOTTLENECK_REPEATED_FAILURE) and not has_specialist_response:
        return {
            "type": BOTTLENECK_REPEATED_FAILURE,
            "description": (
                f"Multiple attempts ({failed_attempts}) to progress the referral "
                "have failed or received no response."
            ),
            "severity": "CRITICAL",
            "failed_attempt_count": failed_attempts,
        }

    # --- Specialist unavailable ---
    is_spec_unavailable = (
        case.get("specialist_status") == "UNAVAILABLE"
        or (case.get("current_bottleneck") == BOTTLENECK_SPECIALIST_UNAVAILABLE and not has_specialist_response)
    )
    if is_spec_unavailable and not has_specialist_response:
        return {
            "type": BOTTLENECK_SPECIALIST_UNAVAILABLE,
            "description": "The assigned specialist is marked as unavailable.",
            "severity": "HIGH",
        }

    # --- Missing documents ---
    if case.get("required_documents_missing") or case.get("current_bottleneck") == BOTTLENECK_MISSING_DOCUMENT:
        return {
            "type": BOTTLENECK_MISSING_DOCUMENT,
            "description": "Required documents are missing or pending upload.",
            "severity": "MEDIUM",
        }

    # --- No specialist response ---
    if not has_specialist_response:
        if case.get("waiting_for_specialist") or case.get("current_bottleneck") == BOTTLENECK_NO_SPECIALIST_RESPONSE:
            return {
                "type": BOTTLENECK_NO_SPECIALIST_RESPONSE,
                "description": "The specialist has not responded to the referral.",
                "severity": "HIGH",
            }

    # --- Appointment delayed ---
    days_open = case.get("days_open", 0)
    if (
        case.get("appointment_delayed")
        or case.get("current_bottleneck") == BOTTLENECK_APPOINTMENT_DELAYED
        or (days_open >= 20 and case.get("status") not in ("RESOLVED", "ESCALATED"))
    ):
        return {
            "type": BOTTLENECK_APPOINTMENT_DELAYED,
            "description": f"Statutory 20-day evaluation window exceeded ({days_open} days open) without completed IEP determination.",
            "severity": "HIGH",
        }

    return None


def _count_failed_attempts(
    case: dict[str, Any],
    timeline: list[dict[str, Any]],
) -> int:
    """
    Count meaningful failed / unanswered attempts from the timeline.

    Events that signal a failed or unanswered attempt:
      NO_RESPONSE, SPECIALIST_UNAVAILABLE, FOLLOWUP_SENT (≥2), ACTION_FAILED
    """
    failure_events = {
        "NO_RESPONSE",
        "SPECIALIST_UNAVAILABLE",
        "ACTION_FAILED",
        "CONTACT_FAILED",
    }
    count = sum(
        1 for e in timeline if e.get("event_type") in failure_events
    )

    # Also count FOLLOWUP_SENT occurrences (each follow-up implies a prior non-response)
    followup_count = sum(
        1 for e in timeline if e.get("event_type") in ("FOLLOWUP_SENT", "FOLLOWUP_SCHEDULED")
    )
    if followup_count >= 2:
        count += followup_count - 1  # first follow-up is normal; extras signal failure

    # Fallback to the DB counter
    db_attempts = case.get("failed_attempts", 0) or case.get("followup_attempts", 0)
    return max(count, db_attempts)
