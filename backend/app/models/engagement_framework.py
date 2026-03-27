import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.database import Base


class EngagementDimension(Base):
    """Engagement-scoped dimension — forked from school template at engagement creation."""
    __tablename__ = "engagement_dimensions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    engagement_id = Column(Uuid, ForeignKey("engagements.id"), nullable=False)
    source_dimension_id = Column(Uuid, ForeignKey("dimensions.id"), nullable=True)

    number = Column(String(10), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)
    is_custom = Column(Integer, default=0)  # 0=SQF, 1=custom
    order = Column(Integer, nullable=False, default=0)

    engagement = relationship("Engagement", back_populates="framework_dimensions")
    components = relationship(
        "EngagementComponent", back_populates="dimension",
        order_by="EngagementComponent.order"
    )
    summaries = relationship("DimensionSummary", back_populates="engagement_dimension")


class EngagementComponent(Base):
    """Engagement-scoped component — forked from school template at engagement creation."""
    __tablename__ = "engagement_components"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_id = Column(Uuid, ForeignKey("engagement_dimensions.id"), nullable=False)
    source_component_id = Column(Uuid, ForeignKey("components.id"), nullable=True)

    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    evidence_guidance = Column(Text, nullable=True)
    is_custom = Column(Integer, default=0)
    order = Column(Integer, nullable=False, default=0)

    dimension = relationship("EngagementDimension", back_populates="components")
    criteria = relationship(
        "EngagementCriterion", back_populates="component",
        order_by="EngagementCriterion.order"
    )
    scores = relationship("ComponentScore", back_populates="engagement_component")
    mappings = relationship("EvidenceMapping", back_populates="engagement_component")
    action_items = relationship("ActionItem", back_populates="engagement_component")
    data_requests = relationship("DataRequest", back_populates="engagement_component")


class EngagementCriterion(Base):
    """Engagement-scoped success criterion — forked from school template at engagement creation."""
    __tablename__ = "engagement_criteria"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    component_id = Column(Uuid, ForeignKey("engagement_components.id"), nullable=False)
    criterion_type = Column(String(30), nullable=False)  # "core_action" or "progress_indicator"
    text = Column(Text, nullable=False)
    order = Column(Integer, nullable=False, default=0)

    component = relationship("EngagementComponent", back_populates="criteria")
