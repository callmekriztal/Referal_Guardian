"""
AI Reasoning — LLM-based recommendation layer.

The LLM receives structured case context and returns ONE recommended action.
It does not execute anything.

Supports LLM_PROVIDER=mock for local development without an OpenAI key.
"""
import json
import logging
import os
import re
from typing import Any, Optional

from app.agent.actions import ActionType, ALLOWED_ACTIONS

logger = logging.getLogger(__name__)

ALLOWED_ACTION_VALUES = {a.value for a in ALLOWED_ACTIONS}


# ---------------------------------------------------------------------------
# Mock provider (for dev / demo without an OpenAI key)
# ---------------------------------------------------------------------------

_MOCK_RECOMMENDATIONS: dict[str, dict[str, Any]] = {
    "SPECIALIST_UNAVAILABLE": {
        "action": "FIND_ALTERNATIVE_SPECIALIST",
        "reason": (
            "The assigned specialist is unavailable. Locating an alternative "
            "specialist is the most direct way to unblock the referral."
        ),
        "evidence": [
            "Assigned specialist marked as UNAVAILABLE",
            "No confirmed appointment exists",
        ],
        "confidence": 0.93,
    },
    "MISSING_DOCUMENT": {
        "action": "REQUEST_DOCUMENT",
        "reason": "Required documents are still pending. A document request will unblock processing.",
        "evidence": ["Document status is PENDING or MISSING"],
        "confidence": 0.97,
    },
    "NO_SPECIALIST_RESPONSE": {
        "action": "CONTACT_SPECIALIST",
        "reason": (
            "The specialist has not responded. A follow-up contact is the appropriate next step."
        ),
        "evidence": ["SPECIALIST_CONTACTED event exists", "No SPECIALIST_RESPONDED event"],
        "confidence": 0.88,
    },
    "APPOINTMENT_DELAYED": {
        "action": "CONTACT_SPECIALIST",
        "reason": (
            "Statutory 20-day evaluation deadline exceeded. Immediate outreach to the assigned specialist is required "
            "to request their diagnostic assessment submission and restore timeline compliance."
        ),
        "evidence": [
            "Statutory 20-day evaluation window exceeded",
            "Specialist diagnostic assessment findings pending",
        ],
        "confidence": 0.95,
    },
    "REPEATED_FAILURE": {
        "action": "ESCALATE_CASE",
        "reason": (
            "Multiple attempts to progress this referral have failed. "
            "Escalation is recommended to ensure the child receives timely services."
        ),
        "evidence": [
            "Three or more failed attempts detected in timeline",
            "No resolution after repeated follow-ups",
        ],
        "confidence": 0.95,
    },
}


def _mock_recommend(bottleneck: dict[str, Any]) -> dict[str, Any]:
    bottleneck_type = bottleneck.get("type", "")
    rec = _MOCK_RECOMMENDATIONS.get(
        bottleneck_type,
        {
            "action": "SCHEDULE_FOLLOWUP",
            "reason": "No specific bottleneck matched. Scheduling a follow-up to review.",
            "evidence": ["Generic follow-up recommended"],
            "confidence": 0.6,
        },
    )
    return rec.copy()


# ---------------------------------------------------------------------------
# LLM provider (Supports OpenRouter, OpenAI, and Mock)
# ---------------------------------------------------------------------------

def _get_llm():
    """Create the LLM instance supporting OpenRouter, OpenAI, or custom endpoints."""
    from langchain_openai import ChatOpenAI

    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if openrouter_key:
        model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
        logger.info("Initializing LLM via OpenRouter (model=%s)", model)
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
            model=model,
            temperature=0,
            default_headers={
                "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "http://localhost:3000"),
                "X-Title": "Referral Guardian",
            },
        )
    elif openai_key:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        logger.info("Initializing LLM via OpenAI (model=%s)", model)
        return ChatOpenAI(
            api_key=openai_key,
            model=model,
            temperature=0,
        )
    else:
        logger.info("No API keys found; using mock LLM fallback")
        return None


def _extract_json(content: str) -> dict[str, Any]:
    """Extract JSON from LLM response, handling markdown code fences."""
    # Strip markdown code fences
    content = re.sub(r"```(?:json)?\s*", "", content).strip().rstrip("`").strip()

    # Find JSON object boundaries
    start = content.find("{")
    end = content.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in LLM response: {content[:200]}")
    return json.loads(content[start:end])


def _llm_recommend(
    case: dict[str, Any],
    timeline: list[dict[str, Any]],
    bottleneck: dict[str, Any],
    specialists: list[dict[str, Any]],
) -> dict[str, Any]:
    """Call the LLM and return a validated recommendation."""
    llm = _get_llm()
    if llm is None:
        return _mock_recommend(bottleneck)

    allowed_actions = sorted(ALLOWED_ACTION_VALUES)

    specialists_section = (
        f"\nAVAILABLE SPECIALISTS (for FIND_ALTERNATIVE_SPECIALIST):\n"
        f"{json.dumps(specialists, indent=2, default=str)}\n"
        if specialists
        else ""
    )

    prompt = f"""You are Referral Guardian, an AI referral continuity assistant.

Your job is to analyze a referral case and recommend the next operational action
that a school staff member should consider taking.

IMPORTANT RULES:
- You MUST choose exactly ONE action from the ALLOWED ACTIONS list below.
- You MUST NOT execute any action yourself.
- Base your recommendation on the case data, timeline, and detected bottleneck.
- Prefer the smallest reasonable action that can unblock the referral.
- If 3 or more attempts have failed, consider ESCALATE_CASE.
- confidence must be between 0.0 and 1.0.

CASE:
{json.dumps(case, indent=2, default=str)}

TIMELINE (chronological):
{json.dumps(timeline, indent=2, default=str)}

DETECTED BOTTLENECK:
{json.dumps(bottleneck, indent=2, default=str)}
{specialists_section}
ALLOWED ACTIONS:
{json.dumps(allowed_actions, indent=2)}

Return ONLY valid JSON in exactly this format (no markdown, no extra text):

{{
    "action": "ONE_ALLOWED_ACTION",
    "reason": "Short explanation of why this action is appropriate.",
    "evidence": [
        "Relevant evidence from the case or timeline."
    ],
    "confidence": 0.0
}}
"""

    response = llm.invoke(prompt)
    content = response.content

    if isinstance(content, list):
        content = "".join(
            item.get("text", str(item)) if isinstance(item, dict) else str(item)
            for item in content
        )

    recommendation = _extract_json(content)
    return recommendation


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_recommendation(recommendation: dict[str, Any]) -> dict[str, Any]:
    """Ensure the recommendation has a valid action and required fields."""
    action = recommendation.get("action")
    if action not in ALLOWED_ACTION_VALUES:
        raise ValueError(
            f"LLM returned invalid action '{action}'. "
            f"Allowed: {sorted(ALLOWED_ACTION_VALUES)}"
        )

    confidence = recommendation.get("confidence", 0.0)
    if not (0.0 <= float(confidence) <= 1.0):
        recommendation["confidence"] = max(0.0, min(1.0, float(confidence)))

    # Ensure evidence is a list
    if not isinstance(recommendation.get("evidence"), list):
        recommendation["evidence"] = [str(recommendation.get("evidence", ""))]

    return recommendation


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def recommend_action(
    case: dict[str, Any],
    timeline: list[dict[str, Any]],
    bottleneck: dict[str, Any],
    specialists: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Recommend the next operational action for a stuck referral case.

    Checks OPENROUTER_API_KEY, OPENAI_API_KEY, or LLM_PROVIDER env vars.
    Returns a validated recommendation dict.
    """
    provider = os.getenv("LLM_PROVIDER", "").lower()
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    specialists = specialists or []

    # If explicitly forced to mock, or no API keys available
    if provider == "mock" or (not openrouter_key and not openai_key and provider not in ("openrouter", "openai")):
        logger.info("Using mock LLM provider")
        recommendation = _mock_recommend(bottleneck)
        return _validate_recommendation(recommendation)

    try:
        recommendation = _llm_recommend(case, timeline, bottleneck, specialists)
        return _validate_recommendation(recommendation)

    except ValueError:
        raise
    except Exception as exc:
        logger.exception("LLM recommendation failed (%s), using mock fallback", exc)
        recommendation = _mock_recommend(bottleneck)
        recommendation["_fallback"] = True
        return _validate_recommendation(recommendation)


# ---------------------------------------------------------------------------
# Special Educator Referral Summary Generator
# ---------------------------------------------------------------------------

def generate_educator_summary(
    case: dict[str, Any],
    timeline: list[dict[str, Any]],
    bottleneck: Optional[dict[str, Any]] = None,
    recommendation: Optional[dict[str, Any]] = None,
) -> str:
    """
    Generate a clinical and operational referral handoff summary for the Special Educator.
    Invokes OpenRouter / OpenAI if available, or falls back to a deterministic summary.
    """
    child_id = case.get("child_identifier") or case.get("child_id", "Unknown Child")
    referral_type = case.get("referral_type", "Special Education Evaluation")
    days_open = case.get("days_open", 0)
    specialist_name = case.get("assigned_specialist_name") or "Unassigned"
    bottleneck_desc = bottleneck.get("description", "None identified") if bottleneck else "No active bottleneck"
    rec_action = recommendation.get("action") or recommendation.get("recommended_action") if recommendation else "Pending review"
    rec_reason = recommendation.get("reason", "Referral processing under active monitoring.") if recommendation else "Normal tracking."

    llm = _get_llm()
    if llm is not None:
        try:
            prompt = f"""You are an expert Special Education Referral Assistant.
Write a clear, professional, bulleted Clinical & Operational Intake Summary for the Special Educator who is reviewing this child's referral case.

CASE CONTEXT:
- Student ID: {child_id}
- Referral Type: {referral_type}
- Days Open: {days_open} days
- Assigned Specialist: {specialist_name}
- Identified Bottleneck: {bottleneck_desc}
- Referral Guardian Proposed Action: {rec_action} ({rec_reason})
- Recent Milestones: {json.dumps(timeline[-5:], default=str)}

REQUIREMENTS:
1. Provide 3-4 concise, bulleted sections:
   • Referral & Student Background
   • Identified Friction / Bottleneck
   • Action Taken / Proposed by Referral Guardian
   • Special Educator Clinical Next Steps
2. Keep the tone clinical, objective, and supportive.
3. Plain text with bullets (no JSON, no markdown codeblocks).
"""
            res = llm.invoke(prompt)
            text = res.content
            if isinstance(text, list):
                text = "".join(item.get("text", str(item)) if isinstance(item, dict) else str(item) for item in text)
            if text and len(text.strip()) > 30:
                return text.strip()
        except Exception as exc:
            logger.warning("LLM educator summary generation failed: %s, using fallback", exc)

    # Deterministic fallback summary
    return (
        f"• Referral & Student Background: Student {child_id} referred for {referral_type} (active for {days_open} days). Assigned Specialist: {specialist_name}.\n"
        f"• Identified Bottleneck: {bottleneck_desc}.\n"
        f"• Referral Guardian Action: {rec_action.replace('_', ' ')} — {rec_reason}\n"
        f"• Special Educator Next Steps: Review intake documentation, prepare assessment protocols, and coordinate directly with the specialist team upon resolution."
    )

