"""
Hackathon Demo Scenario Seeder for Referral Guardian.

Populates 3 realistic cases demonstrating:
1. AI Bottleneck Detection & Alternative Specialist Reassignment (stu-rit-101)
2. Doctor Gmail Caseload Linking & Prioritized Specialist Portal (stu-rit-102)
3. New Referral Ingestion (stu-rit-103)
"""
import datetime
from app.models.database import SessionLocal, engine, Base, ensure_sqlite_columns
from app.models.models import (
    Case,
    CaseEvent,
    Specialist,
    Appointment,
    Document,
)


def seed_demo_data():
    ensure_sqlite_columns()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing records first for clean staging
        tables_to_clear = [
            "actions", "action_verifications", "agent_run_steps", "bottlenecks", 
            "agent_recommendations", "agent_observations", "agent_runs", 
            "case_events", "documents", "communications", "appointments", 
            "escalations", "follow_ups", "cases", "specialists"
        ]
        with engine.connect() as conn:
            for table in tables_to_clear:
                conn.exec_driver_sql(f"DELETE FROM {table}")
            conn.commit()

        print("Staging realistic demo specialists...")
        spec1 = Specialist(
            id="SPEC-001",
            name="Dr. Sarah Jenkins",
            email="dr.jenkins@clinic.org",
            specialization="Speech-Language Pathologist",
            location="North District Clinic",
            availability_status="UNAVAILABLE",
            active=True,
        )
        spec2 = Specialist(
            id="SPEC-002",
            name="Dr. Marcus Vance",
            email="dr.vance@clinic.org",
            specialization="Speech-Language Pathologist",
            location="Metro Child Development Center",
            availability_status="AVAILABLE",
            next_available_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
            active=True,
        )
        spec3 = Specialist(
            id="SPEC-003",
            name="Dr. Elena Rostova",
            email="dr.rostova@clinic.org",
            specialization="Occupational Therapist",
            location="Eastside Pediatrics",
            availability_status="AVAILABLE",
            next_available_date=datetime.datetime.utcnow() + datetime.timedelta(days=5),
            active=True,
        )
        db.add_all([spec1, spec2, spec3])
        db.commit()

        print("Staging realistic demo cases...")
        now = datetime.datetime.utcnow()

        # =========================================================================
        # CASE 1: stu-rit-101 (The AI Agent Showstopper: Specialist Unavailable)
        # =========================================================================
        c1 = Case(
            id="stu-rit-101",
            child_identifier="stu-rit-101",
            referral_type="Speech-Language Evaluation",
            status="STUCK",
            assigned_specialist_id="SPEC-001",
            assigned_specialist_email="dr.jenkins@clinic.org",
            current_bottleneck="SPECIALIST_UNAVAILABLE",
            coordinator_notes="Urgent speech baseline assessment required before district IEP deadline. Assigned specialist is currently at capacity.",
            educator_summary=(
                "• Student stu-rit-101 referred for Speech-Language Evaluation (18 days open).\n"
                "• Identified Bottleneck: Assigned specialist Dr. Sarah Jenkins is UNAVAILABLE.\n"
                "• Proposed AI Action: Reassign to Dr. Marcus Vance (available in 2 days).\n"
                "• Next Steps: Obtain coordinator approval to finalize schedule."
            ),
            created_date=now - datetime.timedelta(days=18),
            last_activity=now - datetime.timedelta(days=2),
            followup_attempts=2,
        )
        db.add(c1)
        db.flush()

        events1 = [
            CaseEvent(
                case_id="stu-rit-101",
                event_type="REFERRAL_CREATED",
                details="Referral initiated by Student Coordinator (24br02024@rit.ac.in).",
                timestamp=now - datetime.timedelta(days=18),
            ),
            CaseEvent(
                case_id="stu-rit-101",
                event_type="DOCUMENT_RECEIVED",
                details="Parent consent form verified and attached to clinical record.",
                timestamp=now - datetime.timedelta(days=15),
            ),
            CaseEvent(
                case_id="stu-rit-101",
                event_type="SPECIALIST_CONTACTED",
                details="Outreach sent to assigned specialist Dr. Sarah Jenkins (dr.jenkins@clinic.org).",
                timestamp=now - datetime.timedelta(days=14),
            ),
            CaseEvent(
                case_id="stu-rit-101",
                event_type="SPECIALIST_UNAVAILABLE",
                details="Dr. Sarah Jenkins responded: Zero intake openings available this quarter.",
                timestamp=now - datetime.timedelta(days=12),
            ),
            CaseEvent(
                case_id="stu-rit-101",
                event_type="FOLLOWUP_SENT",
                details="Automated check for cancellation slots dispatched.",
                timestamp=now - datetime.timedelta(days=4),
            ),
        ]
        db.add_all(events1)

        # =========================================================================
        # CASE 2: stu-rit-102 (The Doctor Portal Showcase: Assigned to Dr. Vance)
        # =========================================================================
        c2 = Case(
            id="stu-rit-102",
            child_identifier="stu-rit-102",
            referral_type="Speech-Language Evaluation",
            status="ACTIVE",
            assigned_specialist_id="SPEC-002",
            assigned_specialist_email="dr.vance@clinic.org",
            current_bottleneck=None,
            coordinator_notes="Articulation and language comprehension assessment.",
            created_date=now - datetime.timedelta(days=6),
            last_activity=now - datetime.timedelta(days=1),
            followup_attempts=0,
        )
        db.add(c2)
        db.flush()

        events2 = [
            CaseEvent(
                case_id="stu-rit-102",
                event_type="REFERRAL_CREATED",
                details="Referral initiated for articulation evaluation.",
                timestamp=now - datetime.timedelta(days=6),
            ),
            CaseEvent(
                case_id="stu-rit-102",
                event_type="SPECIALIST_CONTACTED",
                details="Assigned to Dr. Marcus Vance (dr.vance@clinic.org). Appointment requested.",
                timestamp=now - datetime.timedelta(days=5),
            ),
        ]
        db.add_all(events2)

        # =========================================================================
        # CASE 3: stu-rit-103 (OT Assessment assigned to Dr. Rostova)
        # =========================================================================
        c3 = Case(
            id="stu-rit-103",
            child_identifier="stu-rit-103",
            referral_type="Occupational Therapy Evaluation",
            status="ACTIVE",
            assigned_specialist_id="SPEC-003",
            assigned_specialist_email="dr.rostova@clinic.org",
            current_bottleneck=None,
            coordinator_notes="Fine motor skills evaluation for classroom grip accommodations.",
            created_date=now - datetime.timedelta(days=4),
            last_activity=now - datetime.timedelta(hours=6),
            followup_attempts=0,
        )
        db.add(c3)
        db.flush()

        events3 = [
            CaseEvent(
                case_id="stu-rit-103",
                event_type="REFERRAL_CREATED",
                details="Referral initiated by school coordinator.",
                timestamp=now - datetime.timedelta(days=4),
            ),
            CaseEvent(
                case_id="stu-rit-103",
                event_type="SPECIALIST_CONTACTED",
                details="Assigned to Dr. Elena Rostova (dr.rostova@clinic.org).",
                timestamp=now - datetime.timedelta(days=3),
            ),
        ]
        db.add_all(events3)

        db.commit()
        print("✅ Demo successfully staged with 3 realistic cases and 3 specialists!")

    except Exception as exc:
        db.rollback()
        print("❌ Error seeding demo:", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
