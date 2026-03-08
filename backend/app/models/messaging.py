import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ThreadType(str, enum.Enum):
    GENERAL = "general"        # general engagement channel
    DATA_REQUEST = "data_request"  # tied to a specific data request
    COMPONENT = "component"    # tied to a specific component discussion
    ACTION_ITEM = "action_item"


class MessageThread(Base):
    __tablename__ = "message_threads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    thread_type = Column(SAEnum(ThreadType), default=ThreadType.GENERAL)
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # optional FK to data_request, component, etc.
    title = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    engagement = relationship("Engagement", back_populates="threads")
    messages = relationship("Message", back_populates="thread", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey("message_threads.id"), nullable=False)
    author = Column(String(200), nullable=False)
    role = Column(String(50), nullable=True)  # consultant, school_admin, system
    content = Column(Text, nullable=False)
    attachments = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    thread = relationship("MessageThread", back_populates="messages")
