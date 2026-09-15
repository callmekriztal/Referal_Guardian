"""
Database Seeder for Referral Guardian Live Supabase Database.

Populates realistic, production-grade Special Education referral cases,
timeline events, documents, communications, and specialist rosters mapped to real
authenticated Supabase users.
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
    """Populate realistic cases and specialists mapped to real Supabase users."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    try:
        # 1. Clear existing records cleanly in reverse dependency order
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

        # 2. Seed Users (aligned to real authenticated coordinators and educators)
        u1 = User(id="USR-COORD-1", username="24br16363@rit.ac.in", hashed_password="mock_hash_coord", role="coordinator")
        u2 = User(id="USR-COORD-2", username="24br16018@rit.ac.in", hashed_password="mock_hash_coord2", role="coordinator")
        u3 = User(id="USR-SPEC-1", username="nairaryan847@gmail.com", hashed_password="mock_hash_ed", role="special_educator")
        u4 = User(id="USR-SPEC-2", username="doctor@gmail.com", hashed_password="mock_hash_doc", role="special_educator")
        u5 = User(id="USR-SPEC-3", username="aryanthegoat345@gmail.com", hashed_password="mock_hash_ed3", role="special_educator")
        u6 = User(id="USR-SPEC-4", username="aryanism234@gmail.com", hashed_password="mock_hash_ed4", role="special_educator")
        db.add_all([u1, u2, u3, u4, u5, u6])

        # 3. Seed Specialists with REAL Supabase emails
        spec1 = Specialist(
            id="SPEC-001",
            name="Nair (SLP)",
            email="nairaryan847@gmail.com",
            specialization="Speech-Language Pathologist",
            location="Kochi Pediatric Communication Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=2),
            active=True,
        )
        spec2 = Specialist(
            id="SPEC-002",
            name="Dr. Evania Milkovich",
            email="doctor@gmail.com",
            specialization="Child & Clinical Psychologist",
            location="Metro Children's Diagnostic Hospital",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=3),
            active=True,
        )
        spec3 = Specialist(
            id="SPEC-003",
            name="Dr. Aryan (OT)",
            email="aryanthegoat345@gmail.com",
            specialization="Occupational Therapist",
            location="Oak Ridge Sensory & Developmental Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=4),
            active=True,
        )
        spec4 = Specialist(
            id="SPEC-004",
            name="Dr. Avav (PT)",
            email="aryanism234@gmail.com",
            specialization="Physical Therapist",
            location="Regional Pediatric Physical Therapy Center",
            availability_status="AVAILABLE",
            next_available_date=now + timedelta(days=5),
            active=True,
        )
        spec5 = Specialist(
            id="SPEC-005",
            name="Dr. Sarah Jenkins",
            email="sarah.jenkins@clinic.org",
            specialization="Speech-Language Pathologist",
            location="North District Clinic",
            availability_status="UNAVAILABLE",
            next_available_date=now + timedelta(days=45),
            active=True,
        )
        db.add_all([spec1, spec2, spec3, spec4, spec5])
        db.commit()

        # 4. Seed Cases with Realistic Time-Aged Scenarios mapped to these specialists

        # Case 1: Assigned to Nair (Speech-Language Evaluation)
        c1 = Case(
            id="CASE-1042",
            child_identifier="STU-8821",
            referral_type="Speech-Language Evaluation",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec1.id,
            assigned_specialist_email=spec1.email,
            current_bottleneck="SPECIALIST_UNAVAILABLE",
            coordinator_notes="Expressive language regression reported. Assigned specialist Nair requested second clinical reviewer.",
            created_date=now - timedelta(days=16),
            last_activity=now - timedelta(days=3),
            followup_attempts=1,
            educator_summary="• Referral: STU-8821 referred for Comprehensive Speech-Language Assessment.\n• Assigned Specialist: Nair (nairaryan847@gmail.com).\n• Identified Bottleneck: Statutory 20-day evaluation approaching (16 days open).\n• Special Educator Action: Finalize articulation battery and diagnostic protocol.",
        )

        # Case 2: Assigned to Dr. Aryan (Occupational Therapy Evaluation)
        c2 = Case(
            id="CASE-1043",
            child_identifier="STU-4910",
            referral_type="Occupational Therapy Evaluation",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec3.id,
            assigned_specialist_email=spec3.email,
            current_bottleneck="MISSING_DOCUMENT",
            coordinator_notes="Awaiting signed Parent Sensory History Form before clinical intake can begin.",
            created_date=now - timedelta(days=24),
            last_activity=now - timedelta(days=5),
            followup_attempts=2,
            educator_summary="• Referral: STU-4910 referred for Occupational & Sensory Profile.\n• Assigned Specialist: Dr. Aryan (aryanthegoat345@gmail.com).\n• Bottleneck: Parent Sensory Form pending.\n• Action: Follow up with School Coordinator for expedited document receipt.",
        )

        # Case 3: Assigned to Dr. Evania Milkovich (Child Psychology Assessment)
        c3 = Case(
            id="CASE-1044",
            child_identifier="STU-3319",
            referral_type="Child Psychology Assessment",
            status="STUCK",
            coordinator_id=u2.id,
            assigned_specialist_id=spec2.id,
            assigned_specialist_email=spec2.email,
            current_bottleneck="REPEATED_FAILURE",
            coordinator_notes="Parent non-responsive after 3 attempts via standard SMS and portal notifications. Recommend home liaison visit.",
            created_date=now - timedelta(days=31),
            last_activity=now - timedelta(days=2),
            followup_attempts=3,
            educator_summary="• Referral: STU-3319 referred for Cognitive & Behavioral Assessment.\n• Assigned Specialist: Dr. Evania Milkovich (doctor@gmail.com).\n• Bottleneck: Escalation triggered due to repeated communication attempt timeouts.",
        )

        # Case 4: Assigned to Dr. Avav (Physical Therapy Assessment)
        c4 = Case(
            id="CASE-1045",
            child_identifier="STU-9102",
            referral_type="Physical Therapy Assessment",
            status="STUCK",
            coordinator_id=u1.id,
            assigned_specialist_id=spec4.id,
            assigned_specialist_email=spec4.email,
            current_bottleneck="DOCUMENT_DELAY",
            coordinator_notes="Medical release form submitted with missing signature from primary physician.",
            created_date=now - timedelta(days=19),
            last_activity=now - timedelta(days=1),
            followup_attempts=1,
            educator_summary="• Referral: STU-9102 Physical Assessment.\n• Assigned Specialist: Dr. Avav (aryanism234@gmail.com).\n• Bottleneck: Medical Release signature pending.",
        )

        # Case 5: Active evaluation assigned to Nair
        c5 = Case(
            id="CASE-1046",
            child_identifier="STU-7724",
            referral_type="Speech-Language Evaluation",
            status="ACTIVE",
            coordinator_id=u2.id,
            assigned_specialist_id=spec1.id,
            assigned_specialist_email=spec1.email,
            coordinator_notes="Intake verified. Appointment scheduled for next Tuesday at District Clinic.",
            created_date=now - timedelta(days=8),
            last_activity=now - timedelta(days=1),
            followup_attempts=0,
            educator_summary="• Referral: STU-7724 active speech intake.\n• Assigned Specialist: Nair (nairaryan847@gmail.com).\n• Status: On schedule for 20-day statutory milestone.",
        )

        # Case 6: Resolved case evaluated by Dr. Evania Milkovich
        c6 = Case(
            id="CASE-1047",
            child_identifier="STU-1205",
            referral_type="Behavioral Diagnostic Evaluation",
            status="RESOLVED",
            coordinator_id=u1.id,
            assigned_specialist_id=spec2.id,
            assigned_specialist_email=spec2.email,
            coordinator_notes="Evaluation complete. Comprehensive report delivered to Special Educator and IEP meeting confirmed.",
            created_date=now - timedelta(days=42),
            last_activity=now - timedelta(days=10),
            followup_attempts=0,
            educator_summary="• Referral & Student Background: Student STU-1205 referred for Behavioral Diagnostic Evaluation. Assigned Specialist: Dr. Evania Milkovich.\n• Identified Bottleneck: Resolved (Initial delay unblocked via specialist re-routing).\n• Referral Guardian Action: Reassignment verified and diagnostic report completed.\n• Special Educator Next Steps: Formulate behavioral IEP accommodations and convene multidisciplinary committee.",
        )

        db.add_all([c1, c2, c3, c4, c5, c6])
        db.commit()

        # 5. Seed Documents
        d1 = Document(case_id=c1.id, document_name="Parental Consent Form (Form B)", status="RECEIVED", uploaded_at=now - timedelta(days=15))
        d2 = Document(case_id=c1.id, document_name="Teacher Observation Worksheet", status="RECEIVED", uploaded_at=now - timedelta(days=14))
        d3 = Document(case_id=c2.id, document_name="Parent Sensory History Questionnaire", status="MISSING", uploaded_at=None)
        d4 = Document(case_id=c4.id, document_name="Physician Medical Clearance Form", status="PENDING", uploaded_at=now - timedelta(days=18))
        d5 = Document(case_id=c6.id, document_name="Full Diagnostic Evaluation Report", status="RECEIVED", uploaded_at=now - timedelta(days=12))
        db.add_all([d1, d2, d3, d4, d5])

        # 6. Seed Communications
        com1 = Communication(
            case_id=c3.id,
            recipient_type="PARENT",
            recipient_id="Parent of STU-3319",
            message="Second Reminder: Please confirm scheduling availability for child STU-3319 evaluation.",
            status="SENT",
            sent_at=now - timedelta(days=4),
            response_received=False,
        )
        com2 = Communication(
            case_id=c2.id,
            recipient_type="PARENT",
            recipient_id="Parent of STU-4910",
            message="Notice: Mandatory Sensory History Form still pending. Please return via the secure portal.",
            status="SENT",
            sent_at=now - timedelta(days=5),
            response_received=False,
        )
        db.add_all([com1, com2])

        # 7. Seed Appointments
        apt1 = Appointment(
            case_id=c1.id,
            specialist_id=spec1.id,
            scheduled_date=now - timedelta(days=2),
            status="CANCELLED",
        )
        apt2 = Appointment(
            case_id=c5.id,
            specialist_id=spec1.id,
            scheduled_date=now + timedelta(days=3),
            status="CONFIRMED",
        )
        apt3 = Appointment(
            case_id=c6.id,
            specialist_id=spec2.id,
            scheduled_date=now - timedelta(days=14),
            status="COMPLETED",
        )
        db.add_all([apt1, apt2, apt3])

        # 8. Seed Timeline Events
        evt1 = CaseEvent(case_id=c1.id, event_type="CASE_CREATED", details="Referral initiated by Student Coordinator Aryan (24br16363@rit.ac.in).", timestamp=now - timedelta(days=16))
        evt2 = CaseEvent(case_id=c1.id, event_type="SPECIALIST_ASSIGNED", details="Assigned to Nair (nairaryan847@gmail.com).", timestamp=now - timedelta(days=15))
        evt3 = CaseEvent(case_id=c1.id, event_type="BOTTLENECK_DETECTED", details="Evaluation approaching statutory 20-day compliance timeline.", timestamp=now - timedelta(days=3))
        
        evt4 = CaseEvent(case_id=c2.id, event_type="CASE_CREATED", details="Referral initiated for STU-4910.", timestamp=now - timedelta(days=24))
        evt5 = CaseEvent(case_id=c2.id, event_type="BOTTLENECK_DETECTED", details="Missing Parent Sensory History questionnaire.", timestamp=now - timedelta(days=5))

        evt6 = CaseEvent(case_id=c3.id, event_type="CASE_CREATED", details="Referral initiated by Coordinator Christy (24br16018@rit.ac.in).", timestamp=now - timedelta(days=31))
        evt7 = CaseEvent(case_id=c3.id, event_type="ESCALATION_TRIGGERED", details="3 automated follow-ups timed out without parent response.", timestamp=now - timedelta(days=2))

        evt8 = CaseEvent(case_id=c6.id, event_type="CASE_CREATED", details="Referral initiated.", timestamp=now - timedelta(days=42))
        evt9 = CaseEvent(case_id=c6.id, event_type="DIAGNOSTIC_COMPLETED", details="Dr. Evania Milkovich submitted completed evaluation.", timestamp=now - timedelta(days=12))
        evt10 = CaseEvent(case_id=c6.id, event_type="CASE_RESOLVED", details="IEP accommodations meeting finalized.", timestamp=now - timedelta(days=10))

        db.add_all([evt1, evt2, evt3, evt4, evt5, evt6, evt7, evt8, evt9, evt10])
        db.commit()

        print("Successfully seeded all cases mapped to real Supabase users!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
