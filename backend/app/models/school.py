import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    school_type = Column(String(50), nullable=True)  # charter, traditional, etc.
    district = Column(String(200), nullable=True)
    state = Column(String(2), nullable=True)
    grade_levels = Column(String(50), nullable=True)  # e.g. "K-8"
    enrollment = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    onboarding_profile = relationship("SchoolOnboardingProfile", back_populates="school", uselist=False)
    framework_template = relationship("SchoolFrameworkTemplate", back_populates="school", uselist=False)
    engagements = relationship("Engagement", back_populates="school")


class SchoolOnboardingProfile(Base):
    __tablename__ = "school_onboarding_profiles"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    school_id = Column(Uuid, ForeignKey("schools.id"), nullable=False)

    programs = Column(JSON, nullable=True)  # e.g. ["DLI", "STEM", "IB"]
    strategic_priorities = Column(JSON, nullable=True)  # top priorities from interview
    pain_points = Column(JSON, nullable=True)  # known challenges
    interview_transcript = Column(JSON, nullable=True)  # full conversation history
    amendments = Column(JSON, nullable=True)  # rationalized amendment list for audit trail
    additional_context = Column(Text, nullable=True)  # free-form notes
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="onboarding_profile")


class SchoolFrameworkTemplate(Base):
    __tablename__ = "school_framework_templates"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    school_id = Column(Uuid, ForeignKey("schools.id"), nullable=False)
    name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    school = relationship("School", back_populates="framework_template")
    dimensions = relationship(
        "SchoolTemplateDimension", back_populates="template",
        order_by="SchoolTemplateDimension.order"
    )


class SchoolTemplateDimension(Base):
    __tablename__ = "school_template_dimensions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    template_id = Column(Uuid, ForeignKey("school_framework_templates.id"), nullable=False)
    source_dimension_id = Column(Uuid, ForeignKey("dimensions.id"), nullable=True)

    number = Column(String(10), nullable=False)  # "1", "2", ... or custom
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)
    is_custom = Column(String(1), default="0")  # "0"=SQF, "1"=custom
    order = Column(String(10), nullable=False, default="0")

    template = relationship("SchoolFrameworkTemplate", back_populates="dimensions")
    components = relationship(
        "SchoolTemplateComponent", back_populates="dimension",
        order_by="SchoolTemplateComponent.order"
    )


class SchoolTemplateComponent(Base):
    __tablename__ = "school_template_components"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_id = Column(Uuid, ForeignKey("school_template_dimensions.id"), nullable=False)
    source_component_id = Column(Uuid, ForeignKey("components.id"), nullable=True)

    code = Column(String(20), nullable=False)  # "1A", "2B", or custom codes
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    evidence_guidance = Column(Text, nullable=True)
    is_custom = Column(String(1), default="0")
    order = Column(String(10), nullable=False, default="0")

    dimension = relationship("SchoolTemplateDimension", back_populates="components")
    criteria = relationship(
        "SchoolTemplateCriterion", back_populates="component",
        order_by="SchoolTemplateCriterion.order"
    )


class SchoolTemplateCriterion(Base):
    __tablename__ = "school_template_criteria"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    component_id = Column(Uuid, ForeignKey("school_template_components.id"), nullable=False)
    criterion_type = Column(String(30), nullable=False)  # "core_action" or "progress_indicator"
    text = Column(Text, nullable=False)
    order = Column(String(10), nullable=False, default="0")

    component = relationship("SchoolTemplateComponent", back_populates="criteria")
