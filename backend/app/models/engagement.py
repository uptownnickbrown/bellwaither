import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class EngagementStage(str, enum.Enum):
    SETUP = "setup"
    ASSESSMENT = "assessment"
    PLAN_DEVELOPMENT = "plan_development"
    IMPLEMENTATION = "implementation"


class EngagementRole(str, enum.Enum):
    LEAD_CONSULTANT = "lead_consultant"
    ANALYST = "analyst"
    SCHOOL_LEADER = "school_leader"
    DATA_STEWARD = "data_steward"


class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    school_name = Column(String(200), nullable=False)
    school_type = Column(String(50), nullable=True)  # charter, traditional, etc.
    district = Column(String(200), nullable=True)
    state = Column(String(2), nullable=True)
    grade_levels = Column(String(50), nullable=True)  # e.g. "K-8"
    enrollment = Column(Integer, nullable=True)
    stage = Column(SAEnum(EngagementStage), default=EngagementStage.ASSESSMENT)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("EngagementMember", back_populates="engagement")
    evidence = relationship("Evidence", back_populates="engagement")
    data_requests = relationship("DataRequest", back_populates="engagement")
    component_scores = relationship("ComponentScore", back_populates="engagement")
    action_plans = relationship("ActionPlan", back_populates="engagement")
    threads = relationship("MessageThread", back_populates="engagement")


class EngagementMember(Base):
    __tablename__ = "engagement_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True)
    role = Column(SAEnum(EngagementRole), nullable=False)

    engagement = relationship("Engagement", back_populates="members")
