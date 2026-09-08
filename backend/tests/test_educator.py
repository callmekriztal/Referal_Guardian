"""
Tests for Coordinator CRUD, Timeline Event Simulation, and Special Educator Portal.
"""
import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    return TestClient(app)


def test_coordinator_create_case_crud(client):
    # 1. Create case
    create_payload = {
        "child_identifier": "STU-TEST-900",
        "referral_type": "Speech Evaluation",
        "status": "STUCK",
        "current_bottleneck": "SPECIALIST_UNAVAILABLE",
        "coordinator_notes": "Initial referral notes from coordinator.",
    }
    res = client.post("/api/cases", json=create_payload)
    assert res.status_code == 200
    created = res.json()
    case_id = created["id"]
    assert created["child_identifier"] == "STU-TEST-900"
    assert created["coordinator_notes"] == "Initial referral notes from coordinator."
    assert "timeline" in created
    assert len(created["timeline"]) >= 1

    # 2. Add manual timeline event to test bottleneck triggers
    evt_res = client.post(f"/api/cases/{case_id}/events", json={
        "event_type": "NO_RESPONSE",
        "details": "Specialist failed to reply after second attempt.",
    })
    assert evt_res.status_code == 200
    evt_data = evt_res.json()
    assert evt_data["event_type"] == "NO_RESPONSE"

    # 3. Update case status
    update_res = client.put(f"/api/cases/{case_id}", json={
        "status": "ESCALATED",
        "coordinator_notes": "Updated note: escalating to clinical director.",
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "ESCALATED"
    assert updated["coordinator_notes"] == "Updated note: escalating to clinical director."

    # 4. Delete case
    del_res = client.delete(f"/api/cases/{case_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 5. Verify deleted
    get_res = client.get(f"/api/cases/{case_id}")
    assert get_res.status_code == 404


def test_specialist_availability_and_diagnostics(client):
    # 1. List specialists
    specs_res = client.get("/api/specialists")
    assert specs_res.status_code == 200
    specs = specs_res.json()
    assert len(specs) >= 1
    spec_id = specs[0]["id"]

    # 2. Toggle specialist availability
    avail_res = client.patch(f"/api/educator/specialists/{spec_id}/availability", json={
        "availability_status": "UNAVAILABLE",
    })
    assert avail_res.status_code == 200
    assert avail_res.json()["availability_status"] == "UNAVAILABLE"

    # 3. List educator cases
    educator_cases_res = client.get("/api/educator/cases")
    assert educator_cases_res.status_code == 200
    ed_cases = educator_cases_res.json()
    assert len(ed_cases) >= 1

    # 4. Submit diagnostic details for a case
    diag_res = client.post("/api/cases/CASE-1042/diagnostics", json={
        "diagnostic_details": "Completed CELF-5 standardized battery. Articulation score within average range; mild expressive delay.",
        "educator_name": "Dr. Marcus Vance",
    })
    assert diag_res.status_code == 200
    diag_data = diag_res.json()
    assert "mild expressive delay" in diag_data["diagnostic_details"]

    # Verify timeline event was added and status is ACTIVE
    timeline_events = [e["event_type"] for e in diag_data["timeline"]]
    assert "DIAGNOSTIC_EVALUATION_LOGGED" in timeline_events
    assert "SPECIALIST_RESPONDED" in timeline_events
    assert diag_data["status"] == "ACTIVE"


def test_delete_case_with_associated_records(client):
    # 1. Create a case
    create_res = client.post("/api/cases", json={
        "child_identifier": "CHILD-DELETE-TEST",
        "referral_type": "SPEECH_LANGUAGE",
        "coordinator_notes": "Test case for deletion with associated records.",
        "current_bottleneck": "SPECIALIST_UNAVAILABLE"
    })
    assert create_res.status_code in (200, 201)
    case_id = create_res.json()["id"]

    # 2. Run agent to populate recommendations and actions
    run_res = client.post(f"/api/cases/{case_id}/agent/run")
    assert run_res.status_code == 200


    # 3. Delete case (must handle cascading child deletions without IntegrityError)
    del_res = client.delete(f"/api/cases/{case_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 4. Verify case is gone
    get_res = client.get(f"/api/cases/{case_id}")
    assert get_res.status_code == 404


def test_stu_school_id_format(client):
    """Verify that case creation uses human-readable stu-schoolname-serial ID format instead of random UUID."""
    res = client.post("/api/cases", json={
        "child_identifier": "stu-rit-5001",
        "custom_id": "stu-rit-5001",
        "referral_type": "Speech Evaluation",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "stu-rit-5001"
    assert data["child_identifier"] == "stu-rit-5001"


def test_rit_student_coordinator_rbac():
    """Verify hardcoded RBAC rule for 24brXXXXX@rit.ac.in emails."""
    from app.services.case_service import is_student_coordinator_email, enforce_user_rbac

    rit_email = "24br02024@rit.ac.in"
    other_email = "teacher@other.edu"

    assert is_student_coordinator_email(rit_email) is True
    assert is_student_coordinator_email("24br12345@rit.ac.in") is True
    assert is_student_coordinator_email("24br202@rit.ac.in") is False  # too short
    assert is_student_coordinator_email("24br123456@rit.ac.in") is False  # too long
    assert is_student_coordinator_email(other_email) is False

    # 24br email MUST always return "coordinator"
    assert enforce_user_rbac(rit_email, "special_educator") == "coordinator"
    assert enforce_user_rbac(rit_email, "coordinator") == "coordinator"
    # non-24br email retains requested role
    assert enforce_user_rbac(other_email, "special_educator") == "special_educator"


def test_doctor_email_linking_and_sorted_cases(client):
    """Verify that coordinator can specify doctor gmail, and doctor sees sorted assigned cases."""
    doc_email = "dr.specialist77@gmail.com"
    other_email = "dr.someoneelse@gmail.com"

    # 1. Create a STUCK case assigned to doc_email
    res1 = client.post("/api/cases", json={
        "child_identifier": "stu-rit-9001",
        "custom_id": "stu-rit-9001",
        "referral_type": "Audiology Assessment",
        "status": "STUCK",
        "current_bottleneck": "SPECIALIST_UNAVAILABLE",
        "assigned_specialist_email": doc_email,
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["assigned_specialist_email"] == doc_email

    # 2. Create an ACTIVE case assigned to doc_email
    res2 = client.post("/api/cases", json={
        "child_identifier": "stu-rit-9002",
        "custom_id": "stu-rit-9002",
        "referral_type": "Speech Evaluation",
        "status": "ACTIVE",
        "assigned_specialist_email": doc_email,
    })
    assert res2.status_code == 200

    # 3. Create a case assigned to other_email
    res3 = client.post("/api/cases", json={
        "child_identifier": "stu-rit-9003",
        "custom_id": "stu-rit-9003",
        "referral_type": "OT Evaluation",
        "status": "NEW",
        "assigned_specialist_email": other_email,
    })
    assert res3.status_code == 200

    # 4. Fetch cases for doc_email -> should return exactly the 2 cases assigned to doc_email
    filter_res = client.get(f"/api/educator/cases?email={doc_email}&sort_by=urgency")
    assert filter_res.status_code == 200
    doc_cases = filter_res.json()
    case_ids = [c["id"] for c in doc_cases]
    assert "stu-rit-9001" in case_ids
    assert "stu-rit-9002" in case_ids
    assert "stu-rit-9003" not in case_ids

    # 5. Check sorted order: STUCK should come before ACTIVE in urgency sort
    assert doc_cases[0]["id"] == "stu-rit-9001"
    assert doc_cases[0]["status"] == "STUCK"
    assert doc_cases[1]["id"] == "stu-rit-9002"
    assert doc_cases[1]["status"] == "ACTIVE"

    # 6. Clean up created cases
    client.delete("/api/cases/stu-rit-9001")
    client.delete("/api/cases/stu-rit-9002")
    client.delete("/api/cases/stu-rit-9003")


