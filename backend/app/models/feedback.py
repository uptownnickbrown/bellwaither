import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AIFeedback(Base):
    """Thumbs-up/down feedback on AI-generated content."""
    __tablename__ = "ai_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    target_type = Column(String(50), nullable=False)  # component_score, dimension_summary, global_summary, extraction
    target_id = Column(UUID(as_uuid=True), nullable=False)
    rating = Column(String(10), nullable=False)  # "up" or "down"
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
