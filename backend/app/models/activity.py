"""Activity log model for tracking engagement events."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ActivityLog(Base):
    """Tracks user and system actions within an engagement."""
    __tablename__ = "activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    actor = Column(String(200), nullable=False)  # "Sarah Chen", "AI System", etc.
    action = Column(String(50), nullable=False)  # "uploaded", "scored", "approved", "created", "edited", "generated"
    target_type = Column(String(50), nullable=False)  # "evidence", "component_score", "dimension_summary", "global_summary", "data_request", "action_item"
    target_label = Column(String(500), nullable=True)  # Human-readable label, e.g., "Student Achievement Data 2022-2025"
    detail = Column(Text, nullable=True)  # Optional extra context, e.g., "Rated as Developing (medium confidence)"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
