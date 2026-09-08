"""
Tests for bottleneck detection logic.
"""
import pytest

from app.agent.bottleneck import (
    BOTTLENECK_APPOINTMENT_DELAYED,
    BOTTLENECK_MISSING_DOCUMENT,
    BOTTLENECK_NO_SPECIALIST_RESPONSE,
    BOTTLENECK_REPEATED_FAILURE,
    BOTTLENECK_SPECIALIST_UNAVAILABLE,
    detect_bottleneck,
)


class TestNoBottleneck:
    def test_clean_case_returns_none(self, minimal_case, empty_timeline):
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is None

    def test_healthy_active_case(self, empty_timeline):
        case = {
            "status": "ACTIVE",
            "specialist_status": "AVAILABLE",
            "required_documents_missing": False,
            "waiting_for_specialist": False,
            "appointment_delayed": False,
            "failed_attempts": 0,
        }
        assert detect_bottleneck(case, empty_timeline) is None


class TestMissingDocument:
    def test_detects_missing_document(self, minimal_case, empty_timeline):
        minimal_case["required_documents_missing"] = True
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_MISSING_DOCUMENT
        assert result["severity"] == "MEDIUM"


class TestSpecialistUnavailable:
    def test_detects_unavailable_specialist(self, minimal_case, empty_timeline):
        minimal_case["specialist_status"] = "UNAVAILABLE"
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_SPECIALIST_UNAVAILABLE
        assert result["severity"] == "HIGH"


class TestNoSpecialistResponse:
    def test_detects_no_response(self, minimal_case, empty_timeline):
        minimal_case["waiting_for_specialist"] = True
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_NO_SPECIALIST_RESPONSE
        assert result["severity"] == "HIGH"


class TestAppointmentDelayed:
    def test_detects_delayed_appointment(self, minimal_case, empty_timeline):
        minimal_case["appointment_delayed"] = True
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_APPOINTMENT_DELAYED
        assert result["severity"] == "HIGH"


class TestRepeatedFailure:
    def test_detects_three_failures_from_db(self, minimal_case, empty_timeline):
        minimal_case["failed_attempts"] = 3
        result = detect_bottleneck(minimal_case, empty_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_REPEATED_FAILURE
        assert result["severity"] == "CRITICAL"

    def test_detects_three_failures_from_timeline(self, minimal_case, sample_timeline):
        """Timeline with 3 NO_RESPONSE events should trigger REPEATED_FAILURE."""
        result = detect_bottleneck(minimal_case, sample_timeline)
        assert result is not None
        assert result["type"] == BOTTLENECK_REPEATED_FAILURE

    def test_two_failures_not_enough(self, minimal_case, empty_timeline):
        minimal_case["failed_attempts"] = 2
        result = detect_bottleneck(minimal_case, empty_timeline)
        # Should not be REPEATED_FAILURE
        assert result is None or result["type"] != BOTTLENECK_REPEATED_FAILURE

    def test_repeated_failure_has_priority_over_specialist_unavailable(
        self, minimal_case, sample_timeline
    ):
        """REPEATED_FAILURE should take priority over SPECIALIST_UNAVAILABLE."""
        minimal_case["specialist_status"] = "UNAVAILABLE"
        result = detect_bottleneck(minimal_case, sample_timeline)
        assert result["type"] == BOTTLENECK_REPEATED_FAILURE

    def test_diagnostic_details_clears_specialist_bottleneck(self, minimal_case):
        """When specialist submits diagnostic findings, bottleneck should be None."""
        case = {
            "status": "ACTIVE",
            "specialist_status": "AVAILABLE",
            "diagnostic_details": "Diagnosed with mild articulation delay.",
            "waiting_for_specialist": True,
            "current_bottleneck": "NO_SPECIALIST_RESPONSE",
        }
        timeline = [
            {"event_type": "SPECIALIST_CONTACTED"},
            {"event_type": "DIAGNOSTIC_EVALUATION_LOGGED"},
        ]
        result = detect_bottleneck(case, timeline)
        assert result is None

