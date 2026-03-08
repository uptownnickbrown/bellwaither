import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    NEEDS_REVISION = "needs_revision"


class RequestPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DataRequest(Base):
    __tablename__ = "data_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=True)

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    rationale = Column(Text, nullable=True)  # why this evidence is needed
    examples = Column(JSON, nullable=True)   # example artifacts that would satisfy
    status = Column(SAEnum(RequestStatus), default=RequestStatus.PENDING)
    priority = Column(SAEnum(RequestPriority), default=RequestPriority.MEDIUM)
    due_date = Column(DateTime, nullable=True)
    assigned_to = Column(String(200), nullable=True)
    created_by = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    engagement = relationship("Engagement", back_populates="data_requests")
    comments = relationship("DataRequestComment", back_populates="data_request", order_by="DataRequestComment.created_at")
    evidence = relationship("Evidence", backref="data_request")


class DataRequestComment(Base):
    __tablename__ = "data_request_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_request_id = Column(UUID(as_uuid=True), ForeignKey("data_requests.id"), nullable=False)
    author = Column(String(200), nullable=False)
    role = Column(String(50), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    data_request = relationship("DataRequest", back_populates="comments")
