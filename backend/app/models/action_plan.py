import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PlanStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"


class ItemStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class ActionPlan(Base):
    __tablename__ = "action_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(PlanStatus), default=PlanStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)

    engagement = relationship("Engagement", back_populates="action_plans")
    items = relationship("ActionItem", back_populates="action_plan", order_by="ActionItem.priority_order")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_plan_id = Column(UUID(as_uuid=True), ForeignKey("action_plans.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("engagement_components.id"), nullable=True)

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    rationale = Column(Text, nullable=True)  # evidence-linked reasoning
    owner = Column(String(200), nullable=True)
    status = Column(SAEnum(ItemStatus), default=ItemStatus.NOT_STARTED)
    priority_order = Column(String(10), nullable=True)
    target_date = Column(DateTime, nullable=True)
    evidence_ids = Column(JSON, nullable=True)  # linked evidence for traceability
    created_at = Column(DateTime, default=datetime.utcnow)

    action_plan = relationship("ActionPlan", back_populates="items")
    engagement_component = relationship("EngagementComponent", back_populates="action_items")
    milestones = relationship("Milestone", back_populates="action_item", order_by="Milestone.target_date")


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_item_id = Column(UUID(as_uuid=True), ForeignKey("action_items.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    target_date = Column(DateTime, nullable=True)
    status = Column(SAEnum(ItemStatus), default=ItemStatus.NOT_STARTED)
    evidence_of_completion = Column(Text, nullable=True)

    action_item = relationship("ActionItem", back_populates="milestones")
