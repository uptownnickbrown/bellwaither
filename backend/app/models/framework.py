import enum
import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CriterionType(str, enum.Enum):
    CORE_ACTION = "core_action"
    PROGRESS_INDICATOR = "progress_indicator"


class Dimension(Base):
    __tablename__ = "dimensions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    number = Column(Integer, nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)  # hex color for UI

    components = relationship("Component", back_populates="dimension", order_by="Component.code")


class Component(Base):
    __tablename__ = "components"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dimension_id = Column(UUID(as_uuid=True), ForeignKey("dimensions.id"), nullable=False)
    code = Column(String(10), nullable=False, unique=True)  # e.g. "1A", "2B"
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    evidence_guidance = Column(Text, nullable=True)  # what evidence is typically needed

    dimension = relationship("Dimension", back_populates="components")
    criteria = relationship("SuccessCriterion", back_populates="component", order_by="SuccessCriterion.order")


class SuccessCriterion(Base):
    __tablename__ = "success_criteria"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)
    criterion_type = Column(SAEnum(CriterionType), nullable=False)
    text = Column(Text, nullable=False)
    order = Column(Integer, nullable=False, default=0)

    component = relationship("Component", back_populates="criteria")
