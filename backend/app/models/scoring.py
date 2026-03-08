import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class RatingLevel(str, enum.Enum):
    EXCELLING = "excelling"
    MEETING = "meeting_expectations"
    DEVELOPING = "developing"
    NEEDS_IMPROVEMENT = "needs_improvement"
    NOT_RATED = "not_rated"


class ScoreStatus(str, enum.Enum):
    DRAFT = "draft"           # AI-generated, not yet reviewed
    IN_REVIEW = "in_review"   # Consultant is reviewing
    CONFIRMED = "confirmed"   # Consultant has confirmed


class ComponentScore(Base):
    """Layer 2: Component-level assessment (one of 43 components)."""
    __tablename__ = "component_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)

    rating = Column(SAEnum(RatingLevel), default=RatingLevel.NOT_RATED)
    status = Column(SAEnum(ScoreStatus), default=ScoreStatus.DRAFT)

    strengths = Column(JSON, nullable=True)           # list of strength findings
    gaps = Column(JSON, nullable=True)                # list of gap findings
    contradictions = Column(JSON, nullable=True)      # conflicting evidence
    missing_evidence = Column(JSON, nullable=True)    # what's still needed
    ai_rationale = Column(Text, nullable=True)        # AI's reasoning for the rating
    consultant_notes = Column(Text, nullable=True)    # Consultant's notes/overrides
    evidence_count = Column(Integer, default=0)
    confidence = Column(String(20), nullable=True)    # low, medium, high

    suggested_actions = Column(JSON, nullable=True)   # draft action items
    follow_up_requests = Column(JSON, nullable=True)  # suggested data requests

    model_used = Column(String(50), nullable=True)
    scored_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    engagement = relationship("Engagement", back_populates="component_scores")


class DimensionSummary(Base):
    """Layer 3: Dimension-level synthesis (one of 9 dimensions)."""
    __tablename__ = "dimension_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    dimension_id = Column(UUID(as_uuid=True), ForeignKey("dimensions.id"), nullable=False)

    overall_assessment = Column(Text, nullable=True)
    patterns = Column(JSON, nullable=True)       # cross-component patterns
    compounding_risks = Column(JSON, nullable=True)
    top_opportunities = Column(JSON, nullable=True)
    leadership_attention = Column(JSON, nullable=True)  # what leaders should focus on
    model_used = Column(String(50), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)


class GlobalSummary(Base):
    """Layer 4: Global orchestration summary."""
    __tablename__ = "global_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    executive_summary = Column(Text, nullable=True)
    top_strengths = Column(JSON, nullable=True)
    critical_gaps = Column(JSON, nullable=True)
    strategic_priorities = Column(JSON, nullable=True)
    resource_implications = Column(JSON, nullable=True)
    recommended_next_steps = Column(JSON, nullable=True)
    model_used = Column(String(50), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
