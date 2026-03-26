"""Framework forking and template management.

Handles the fork-on-create pattern: canonical SQF → school template → engagement snapshot.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.engagement_framework import EngagementComponent, EngagementCriterion, EngagementDimension
from app.models.framework import Component, Dimension, SuccessCriterion
from app.models.school import (
    SchoolFrameworkTemplate,
    SchoolTemplateCriterion,
    SchoolTemplateComponent,
    SchoolTemplateDimension,
)


async def fork_sqf_to_template(
    db: AsyncSession,
    school_id: uuid.UUID,
    template_name: str = "Standard SQF Framework",
) -> SchoolFrameworkTemplate:
    """Copy the canonical SQF into a SchoolFrameworkTemplate.

    Used when a school adopts the standard framework (with or without modifications).
    """
    # Load full SQF tree
    result = await db.execute(
        select(Dimension)
        .options(
            selectinload(Dimension.components).selectinload(Component.criteria)
        )
        .order_by(Dimension.number)
    )
    dimensions = result.scalars().all()

    template = SchoolFrameworkTemplate(
        id=uuid.uuid4(),
        school_id=school_id,
        name=template_name,
    )
    db.add(template)

    for dim in dimensions:
        tmpl_dim = SchoolTemplateDimension(
            id=uuid.uuid4(),
            template_id=template.id,
            source_dimension_id=dim.id,
            number=str(dim.number),
            name=dim.name,
            description=dim.description,
            color=dim.color,
            is_custom="0",
            order=str(dim.number),
        )
        db.add(tmpl_dim)

        for comp in dim.components:
            tmpl_comp = SchoolTemplateComponent(
                id=uuid.uuid4(),
                dimension_id=tmpl_dim.id,
                source_component_id=comp.id,
                code=comp.code,
                name=comp.name,
                description=comp.description,
                evidence_guidance=comp.evidence_guidance,
                is_custom="0",
                order=comp.code,
            )
            db.add(tmpl_comp)

            for crit in comp.criteria:
                tmpl_crit = SchoolTemplateCriterion(
                    id=uuid.uuid4(),
                    component_id=tmpl_comp.id,
                    criterion_type=crit.criterion_type.value,
                    text=crit.text,
                    order=str(crit.order),
                )
                db.add(tmpl_crit)

    return template


async def fork_template_to_engagement(
    db: AsyncSession,
    template_id: uuid.UUID,
    engagement_id: uuid.UUID,
) -> list[EngagementDimension]:
    """Snapshot a school's framework template into engagement-scoped tables.

    Called at engagement creation time. Creates EngagementDimension/Component/Criterion
    rows that the engagement owns independently.
    """
    result = await db.execute(
        select(SchoolTemplateDimension)
        .where(SchoolTemplateDimension.template_id == template_id)
        .options(
            selectinload(SchoolTemplateDimension.components)
            .selectinload(SchoolTemplateComponent.criteria)
        )
        .order_by(SchoolTemplateDimension.order)
    )
    tmpl_dims = result.scalars().all()

    eng_dims = []
    for tmpl_dim in tmpl_dims:
        eng_dim = EngagementDimension(
            id=uuid.uuid4(),
            engagement_id=engagement_id,
            source_dimension_id=tmpl_dim.source_dimension_id,
            number=tmpl_dim.number,
            name=tmpl_dim.name,
            description=tmpl_dim.description,
            color=tmpl_dim.color,
            is_custom=1 if tmpl_dim.is_custom == "1" else 0,
            order=int(tmpl_dim.order) if tmpl_dim.order.isdigit() else 0,
        )
        db.add(eng_dim)
        eng_dims.append(eng_dim)

        for tmpl_comp in tmpl_dim.components:
            eng_comp = EngagementComponent(
                id=uuid.uuid4(),
                dimension_id=eng_dim.id,
                source_component_id=tmpl_comp.source_component_id,
                code=tmpl_comp.code,
                name=tmpl_comp.name,
                description=tmpl_comp.description,
                evidence_guidance=tmpl_comp.evidence_guidance,
                is_custom=1 if tmpl_comp.is_custom == "1" else 0,
                order=_parse_order(tmpl_comp.order),
            )
            db.add(eng_comp)

            for tmpl_crit in tmpl_comp.criteria:
                eng_crit = EngagementCriterion(
                    id=uuid.uuid4(),
                    component_id=eng_comp.id,
                    criterion_type=tmpl_crit.criterion_type,
                    text=tmpl_crit.text,
                    order=int(tmpl_crit.order) if tmpl_crit.order.isdigit() else 0,
                )
                db.add(eng_crit)

    return eng_dims


async def fork_sqf_directly_to_engagement(
    db: AsyncSession,
    engagement_id: uuid.UUID,
) -> list[EngagementDimension]:
    """Shortcut: copy canonical SQF directly into engagement-scoped tables.

    Useful for seeding demo data where no school template exists yet.
    """
    result = await db.execute(
        select(Dimension)
        .options(
            selectinload(Dimension.components).selectinload(Component.criteria)
        )
        .order_by(Dimension.number)
    )
    dimensions = result.scalars().all()

    eng_dims = []
    for dim in dimensions:
        eng_dim = EngagementDimension(
            id=uuid.uuid4(),
            engagement_id=engagement_id,
            source_dimension_id=dim.id,
            number=str(dim.number),
            name=dim.name,
            description=dim.description,
            color=dim.color,
            is_custom=0,
            order=dim.number,
        )
        db.add(eng_dim)
        eng_dims.append(eng_dim)

        for comp in dim.components:
            eng_comp = EngagementComponent(
                id=uuid.uuid4(),
                dimension_id=eng_dim.id,
                source_component_id=comp.id,
                code=comp.code,
                name=comp.name,
                description=comp.description,
                evidence_guidance=comp.evidence_guidance,
                is_custom=0,
                order=_parse_order(comp.code),
            )
            db.add(eng_comp)

            for crit in comp.criteria:
                eng_crit = EngagementCriterion(
                    id=uuid.uuid4(),
                    component_id=eng_comp.id,
                    criterion_type=crit.criterion_type.value,
                    text=crit.text,
                    order=crit.order,
                )
                db.add(eng_crit)

    return eng_dims


def _parse_order(val: str) -> int:
    """Parse a component code like '2A' into a sortable integer, or return 0."""
    if not val:
        return 0
    # Try direct int parse first
    try:
        return int(val)
    except ValueError:
        pass
    # Parse codes like "1A" → 10, "2B" → 21, "10C" → 102
    digits = ""
    alpha = ""
    for ch in val:
        if ch.isdigit():
            digits += ch
        elif ch.isalpha():
            alpha += ch
    try:
        base = int(digits) * 10 if digits else 0
        offset = ord(alpha[0].upper()) - ord('A') if alpha else 0
        return base + offset
    except (ValueError, IndexError):
        return 0
