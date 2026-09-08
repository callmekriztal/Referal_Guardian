"""
SQLAlchemy Data Models
Aligned to the existing Supabase schema.
"""
import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Core domain models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="coordinator")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=_uuid)
    child_identifier = Column(String, nullable=False)   # pseudonymous e.g. STU-8821
    referral_type = Column(String, nullable=False)
    status = Column(String, default="NEW")              # NEW, ACTIVE, STUCK, RESOLVED, ESCALATED
    coordinator_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_specialist_id = Column(String, ForeignKey("specialists.id"), nullable=True)
    assigned_specialist_email = Column(String, nullable=True)
    current_bottleneck = Column(String, nullable=True)
    current_responsible_person = Column(String, nullable=True)
    coordinator_notes = Column(Text, nullable=True)
    diagnostic_details = Column(Text, nullable=True)
    educator_summary = Column(Text, nullable=True)
    created_date = Column(DateTime, default=datetime.datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.datetime.utcnow)
    next_followup_date = Column(DateTime, nullable=True)
    followup_attempts = Column(Integer, default=0)

    assigned_specialist = relationship("Specialist", foreign_keys=[assigned_specialist_id])
    events = relationship("CaseEvent", back_populates="case", order_by="CaseEvent.timestamp", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="case", cascade="all, delete-orphan")
    communications = relationship("Communication", back_populates="case", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="case", cascade="all, delete-orphan")
    recommendations = relationship("AgentRecommendation", back_populates="case", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="case")
    escalations = relationship("Escalation", back_populates="case")
    followups = relationship("FollowUp", back_populates="case")
    agent_runs = relationship("AgentRun", back_populates="case")


class CaseEvent(Base):
    """Timeline / audit trail for a case."""
    __tablename__ = "case_events"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    event_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    case = relationship("Case", back_populates="events")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    document_name = Column(String, nullable=False)
    status = Column(String, default="PENDING")   # PENDING, RECEIVED, MISSING
    uploaded_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="documents")


class Communication(Base):
    __tablename__ = "communications"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    recipient_type = Column(String, nullable=False)   # PARENT, SPECIALIST, EDUCATOR
    recipient_id = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="SENT")
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    response_received = Column(Boolean, default=False)

    case = relationship("Case", back_populates="communications")


class Specialist(Base):
    __tablename__ = "specialists"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    specialization = Column(String, nullable=False)
    location = Column(String, nullable=True)
    availability_status = Column(String, default="AVAILABLE")   # AVAILABLE, UNAVAILABLE
    next_available_date = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    specialist_id = Column(String, ForeignKey("specialists.id"), nullable=True)
    scheduled_date = Column(DateTime, nullable=True)
    status = Column(String, default="REQUESTED")   # REQUESTED, CONFIRMED, CANCELLED, COMPLETED

    case = relationship("Case", back_populates="appointments")
    specialist = relationship("Specialist")


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    reason = Column(Text, nullable=False)
    priority = Column(String, default="HIGH")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    case = relationship("Case", back_populates="escalations")


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    scheduled_for = Column(DateTime, nullable=False)
    completed = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    case = relationship("Case", back_populates="followups")


# ---------------------------------------------------------------------------
# Agent-side models  (match Supabase RLS table names)
# ---------------------------------------------------------------------------

class AgentObservation(Base):
    """Snapshot of a case at the time the agent observed it."""
    __tablename__ = "agent_observations"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=True)
    observed_status = Column(String, nullable=True)
    observed_bottleneck = Column(String, nullable=True)
    timeline_snapshot = Column(Text, nullable=True)   # JSON
    observed_at = Column(DateTime, default=datetime.datetime.utcnow)


class Bottleneck(Base):
    """Detected bottlenecks logged per agent run."""
    __tablename__ = "bottlenecks"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=True)
    bottleneck_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=True)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)


class AgentRecommendation(Base):
    """LLM-generated recommendation awaiting human review."""
    __tablename__ = "agent_recommendations"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=True)
    bottleneck = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    recommended_action = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)             # JSON array of strings
    status = Column(String, default="PENDING")         # PENDING, APPROVED, REJECTED, MODIFIED
    human_modified_action = Column(String, nullable=True)
    approval_timestamp = Column(DateTime, nullable=True)
    approver_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    case = relationship("Case", back_populates="recommendations")


class Action(Base):
    """Record of an executed action."""
    __tablename__ = "actions"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    recommendation_id = Column(String, ForeignKey("agent_recommendations.id"), nullable=True)
    action_type = Column(String, nullable=False)
    status = Column(String, default="EXECUTED")        # EXECUTED, FAILED, SIMULATED
    result_message = Column(Text, nullable=True)
    entity_id = Column(String, nullable=True)          # ID of created record (comm, appt, etc.)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)

    case = relationship("Case", back_populates="actions")


class ActionVerification(Base):
    """Verification result after an action was executed."""
    __tablename__ = "action_verifications"

    id = Column(String, primary_key=True, default=_uuid)
    action_id = Column(String, ForeignKey("actions.id"), nullable=False)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    success = Column(Boolean, nullable=False)
    verification_status = Column(String, nullable=False)   # VERIFIED, FAILED
    reason = Column(Text, nullable=True)
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)


class AgentRun(Base):
    """One invocation of the Referral Guardian agent graph for a case."""
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    thread_id = Column(String, nullable=False)                # LangGraph checkpointer thread_id
    status = Column(String, default="RUNNING")                # RUNNING, WAITING_APPROVAL, COMPLETED, FAILED
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="agent_runs")
    steps = relationship("AgentRunStep", back_populates="run")


class AgentRunStep(Base):
    """Individual step/node execution within an agent run."""
    __tablename__ = "agent_run_steps"

    id = Column(String, primary_key=True, default=_uuid)
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=False)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    node_name = Column(String, nullable=False)
    status = Column(String, default="COMPLETED")   # COMPLETED, FAILED
    details = Column(Text, nullable=True)          # JSON
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)

    run = relationship("AgentRun", back_populates="steps")
