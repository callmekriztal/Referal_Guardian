"""
Database Seeder for Referral Guardian Demo Scenarios.

Populates realistic, production-grade Special Education referral cases,
timeline events, documents, communications, and specialist rosters to
simulate realistic time delays, statutory assessment compliance tracking, and bottleneck resolution.
"""
import datetime
from datetime import timedelta
from app.models.database import SessionLocal, engine, Base
from app.models.models import (
    Case,
    CaseEvent,
    Specialist,
    Appointment,
    Document,
    Communication,
    User,
    AgentRecommendation,
    Action,
    ActionVerification,
)


def seed_database():
    """Populate realistic cases and specialists for demo and testing."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    now = datetime.datetime.utcnow()

    try:
        # 1. Clear existing seed data cleanly in reverse dependency order
        db.query(ActionVerification).delete()
        db.query(Action).delete()
        db.query(AgentRecommendation).delete()
        db.query(Appointment).delete()
        db.query(Document).delete()
        db.query(Communication).delete()
        db.query(CaseEvent).delete()
        db.query(Case).delete()
        db.query(Specialist).delete()
        db.query(User).delete()
        db.commit()

        print("Cleared existing records.")

        # 2. Seed Users
        u1 = User(id="USR-COORD-1", username="coordinator@school.org", hashed_password="mock_hash_coord", role="coordinator")
        u2 = User(id="USR-SPEC-1", username="educator@clinic.org", hashed_password="mock_hash_ed", role="special_educator")
        db.add_all([u1, u2])

        # 3. Seed Specialists
        spec1 = Specialist(
            id="SPEC-001",
            name="Dr. Sarah Jenkins",
            specialization="Speech-Language Pathologist",
            location="North District Clinic",
            availability_status="UNAVAILABLE",
            next_available_date=now + timedelta(days=45),
            active=True,
        )
        spec2 = Specialist(
            id="SPEC-002",
            name="Dr. Marcus Vance",
            specialization="Speech-Language Pathologist",
            location="Metro Children's Hospital",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=2),
            active=True,
        )
        spec3 = Specialist(
            id="SPEC-003",
            name="Dr. Elena Rostova",
            specialization="Occupational Therapist",
            location="Oak Ridge Sensory Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=4),
            active=True,
        )
        spec4 = Specialist(
            id="SPEC-004",
            name="Dr. Aisha Patel",
            specialization="Child & Clinical Psychologist",
            location="University Pediatric Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=3),
            active=True,
        )
        spec5 = Specialist(
            id="SPEC-005",
            name="Dr. Gregory House",
            specialization="Physical Therapist",
            location="Regional Rehab Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=5),
            active=True,
        )
        db.add_all([spec1, spec2, spec3, spec4, spec5])
        db.commit()

        # 4. Seed Cases with Realistic Time-Aged Scenarios

        # Case 1: SPECIALIST_UNAVAILABLE (The Hero Demo Case)
        c1 = Case(
            id="CASE-1042",
            child_identifier="STU-8821",
            referral_type="Speech-Language Evaluation",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec1.id,
            current_bottleneck="SPECIALIST_UNAVAILABLE",
            coordinator_notes="Teacher reported expressive language regression. Assigned Dr. Jenkins who is on emergency leave. Need immediate re-match.",
            created_date=now - timedelta(days=16),
            last_activity=now - timedelta(days=3),
            followup_attempts=1,
        )

        # Case 2: MISSING_DOCUMENT Bottleneck
        c2 = Case(
            id="CASE-1043",
            child_identifier="STU-4910",
            referral_type="Occupational Therapy Evaluation",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec3.id,
            current_bottleneck="MISSING_DOCUMENT",
            coordinator_notes="Awaiting signed Parent Sensory History Form before clinical intake can begin.",
            created_date=now - timedelta(days=24),
            last_activity=now - timedelta(days=5),
            followup_attempts=2,
        )

        # Case 3: REPEATED_FAILURE (Escalation Trigger)
        c3 = Case(
            id="CASE-1044",
            child_identifier="STU-3319",
            referral_type="Child Psychology Assessment",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec4.id,
            current_bottleneck="REPEATED_FAILURE",
            coordinator_notes="3 outreach attempts to specialist partner went unanswered. Statutory assessment timeline at risk.",
            created_date=now - timedelta(days=42),
            last_activity=now - timedelta(days=1),
            followup_attempts=3,
        )

        # Case 4: APPOINTMENT_DELAYED
        c4 = Case(
            id="CASE-1045",
            child_identifier="STU-9102",
            referral_type="Physical Therapy Evaluation",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec5.id,
            current_bottleneck="APPOINTMENT_DELAYED",
            coordinator_notes="Appointment was scheduled 10 days ago, but specialist has not submitted diagnostic intake report.",
            created_date=now - timedelta(days=31),
            last_activity=now - timedelta(days=6),
            followup_attempts=1,
        )

        # Case 5: Healthy ACTIVE Referral
        c5 = Case(
            id="CASE-1046",
            child_identifier="STU-7724",
            referral_type="Audiology & Assistive Tech",
            status="ACTIVE",
            coordinator_id=u1.id,
            assigned_specialist_id=spec2.id,
            current_bottleneck=None,
            coordinator_notes="Consent received, Dr. Vance confirmed hearing screening on schedule for this Friday.",
            created_date=now - timedelta(days=8),
            last_activity=now - timedelta(days=1),
            followup_attempts=0,
        )

        # Case 6: RESOLVED Referral
        c6 = Case(
            id="CASE-1047",
            child_identifier="STU-1205",
            referral_type="Behavioral Diagnostic Evaluation",
            status="RESOLVED",
            coordinator_id=u1.id,
            assigned_specialist_id=spec4.id,
            current_bottleneck=None,
            coordinator_notes="Evaluation complete. Comprehensive report delivered to Special Educator and IEP meeting confirmed.",
            diagnostic_details="Completed Vineland-3 Adaptive Behavior Scales. Recommendations formulated for IEP accommodations.",
            educator_summary="• Referral & Student Background: Student STU-1205 referred for Behavioral Diagnostic Evaluation. Assigned Specialist: Dr. Aisha Patel.\n• Identified Bottleneck: Resolved (Initial delay unblocked via specialist re-routing).\n• Referral Guardian Action: Reassignment verified and diagnostic report completed.\n• Special Educator Next Steps: Formulate behavioral IEP accommodations and convene multidisciplinary committee.",
            created_date=now - timedelta(days=52),
            last_activity=now - timedelta(days=2),
            followup_attempts=1,
        )

        db.add_all([c1, c2, c3, c4, c5, c6])
        db.commit()

        # 5. Seed Timeline Events for Case 1
        e1_1 = CaseEvent(case_id=c1.id, event_type="REFERRAL_CREATED", details="Referral initiated by school psychologist for student STU-8821.", timestamp=now - timedelta(days=16))
        e1_2 = CaseEvent(case_id=c1.id, event_type="PARENT_CONSENT_RECEIVED", details="Parent consent form signed and uploaded.", timestamp=now - timedelta(days=14))
        e1_3 = CaseEvent(case_id=c1.id, event_type="SPECIALIST_ASSIGNED", details="Assigned to Dr. Sarah Jenkins (Speech-Language Pathologist).", timestamp=now - timedelta(days=12))
        e1_4 = CaseEvent(case_id=c1.id, event_type="SPECIALIST_UNAVAILABLE", details="Dr. Sarah Jenkins marked UNAVAILABLE (Caseload capacity reached).", timestamp=now - timedelta(days=3))

        # Seed Timeline Events for Case 2
        e2_1 = CaseEvent(case_id=c2.id, event_type="REFERRAL_CREATED", details="Referral initiated for fine motor & sensory processing evaluation.", timestamp=now - timedelta(days=24))
        e2_2 = CaseEvent(case_id=c2.id, event_type="DOCUMENT_REQUESTED", details="Parent Sensory Profile requested from family.", timestamp=now - timedelta(days=20))
        e2_3 = CaseEvent(case_id=c2.id, event_type="DOCUMENT_PENDING", details="Document still pending after 14 days.", timestamp=now - timedelta(days=5))

        # Seed Timeline Events for Case 3 (Repeated failure)
        e3_1 = CaseEvent(case_id=c3.id, event_type="REFERRAL_CREATED", details="Referral initiated for psychological assessment.", timestamp=now - timedelta(days=42))
        e3_2 = CaseEvent(case_id=c3.id, event_type="SPECIALIST_CONTACTED", details="Attempt 1: Email outreach sent to partner clinic.", timestamp=now - timedelta(days=30))
        e3_3 = CaseEvent(case_id=c3.id, event_type="FOLLOWUP_FAILED", details="Attempt 2: No reply received after 7 business days.", timestamp=now - timedelta(days=20))
        e3_4 = CaseEvent(case_id=c3.id, event_type="FOLLOWUP_FAILED", details="Attempt 3: Phone follow-up went to voicemail. 3 consecutive failures recorded.", timestamp=now - timedelta(days=5))

        db.add_all([e1_1, e1_2, e1_3, e1_4, e2_1, e2_2, e2_3, e3_1, e3_2, e3_3, e3_4])

        # 6. Seed Documents
        d1 = Document(case_id=c1.id, document_name="Parent Signed Consent Form", status="RECEIVED", uploaded_at=now - timedelta(days=14))
        d2 = Document(case_id=c2.id, document_name="Parent Sensory History Profile", status="MISSING")
        d3 = Document(case_id=c2.id, document_name="General Intake Form", status="RECEIVED", uploaded_at=now - timedelta(days=23))
        db.add_all([d1, d2, d3])

        # 7. Seed Appointments
        a1 = Appointment(case_id=c1.id, specialist_id=spec1.id, scheduled_date=now - timedelta(days=2), status="CANCELLED")
        a4 = Appointment(case_id=c4.id, specialist_id=spec5.id, scheduled_date=now - timedelta(days=7), status="REQUESTED")
        a5 = Appointment(case_id=c5.id, specialist_id=spec2.id, scheduled_date=now + timedelta(days=4), status="CONFIRMED")
        db.add_all([a1, a4, a5])

        db.commit()
        print("Successfully seeded 6 realistic referral cases, 5 specialists, timeline events, and documents!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
