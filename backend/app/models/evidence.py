import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class EvidenceType(str, enum.Enum):
    DOCUMENT = "document"        # PDF, DOCX
    SPREADSHEET = "spreadsheet"  # XLSX, CSV
    PRESENTATION = "presentation"
    IMAGE = "image"
    INTERVIEW = "interview"      # transcript
    SURVEY = "survey"
    SIS_EXPORT = "sis_export"
    OTHER = "other"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    data_request_id = Column(UUID(as_uuid=True), ForeignKey("data_requests.id"), nullable=True)

    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(200), nullable=False)  # mime type
    file_size = Column(Integer, nullable=True)
    evidence_type = Column(SAEnum(EvidenceType), nullable=False)

    title = Column(String(500), nullable=True)  # AI-generated or user-provided
    description = Column(Text, nullable=True)
    uploaded_by = Column(String(200), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    processing_status = Column(SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING)
    processing_error = Column(Text, nullable=True)

    engagement = relationship("Engagement", back_populates="evidence")
    extractions = relationship("EvidenceExtraction", back_populates="evidence")
    mappings = relationship("EvidenceMapping", back_populates="evidence")


class EvidenceExtraction(Base):
    """AI-extracted findings from a single piece of evidence (Layer 1)."""
    __tablename__ = "evidence_extractions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evidence_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=False)

    summary = Column(Text, nullable=False)
    key_findings = Column(JSON, nullable=True)   # list of finding strings
    structured_data = Column(JSON, nullable=True) # extracted metrics, numbers, etc.
    raw_text = Column(Text, nullable=True)        # full extracted text
    model_used = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    evidence = relationship("Evidence", back_populates="extractions")


class EvidenceMapping(Base):
    """Maps evidence to framework components with confidence."""
    __tablename__ = "evidence_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evidence_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)

    relevance_score = Column(Float, nullable=False, default=0.0)  # 0.0 - 1.0
    relevant_excerpts = Column(JSON, nullable=True)  # list of excerpt strings with page/line refs
    rationale = Column(Text, nullable=True)  # why this evidence maps to this component
    is_confirmed = Column(Integer, default=0)  # 0=AI-suggested, 1=consultant-confirmed
    created_at = Column(DateTime, default=datetime.utcnow)

    evidence = relationship("Evidence", back_populates="mappings")
