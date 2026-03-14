"""API routes for the Meridian platform."""

import io
import json
import logging
import os
import uuid
import zipfile
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.agents.component_agent import assess_component
from app.ai.agents.copilot_agent import copilot_chat
from app.ai.agents.dimension_agent import synthesize_dimension
from app.ai.agents.extraction_agent import extract_from_spreadsheet, extract_from_text
from app.ai.agents.global_agent import generate_global_summary
from app.database import get_db
from app.export import generate_assessment_pdf
from app.models import (
    ActionItem,
    ActionPlan,
    ActivityLog,
    AIFeedback,
    Component,
    ComponentScore,
    DataRequest,
    DataRequestComment,
    Dimension,
    DimensionSummary,
    Engagement,
    Evidence,
    EvidenceExtraction,
    EvidenceMapping,
    GlobalSummary,
    Message,
    MessageThread,
)
from app.models.data_request import RequestStatus
from app.models.evidence import EvidenceType, ProcessingStatus
from app.models.messaging import ThreadType
from app.models.scoring import RatingLevel, ScoreStatus
from app.schemas.schemas import *
from app.services.document_processor import process_document

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---- Framework ----

@router.get("/framework", response_model=list[DimensionResponse])
async def get_framework(db: AsyncSession = Depends(get_db)):
    """Get the full SQF framework with dimensions, components, and criteria."""
    result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components).selectinload(Component.criteria))
        .order_by(Dimension.number)
    )
    return result.scalars().all()


@router.get("/framework/components/{component_id}", response_model=ComponentResponse)
async def get_component(component_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Component)
        .options(selectinload(Component.criteria))
        .where(Component.id == component_id)
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    return comp


# ---- Engagements ----

@router.get("/engagements", response_model=list[EngagementResponse])
async def list_engagements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Engagement).order_by(Engagement.created_at.desc()))
    return result.scalars().all()


@router.post("/engagements", response_model=EngagementResponse)
async def create_engagement(data: EngagementCreate, db: AsyncSession = Depends(get_db)):
    engagement = Engagement(**data.model_dump())
    db.add(engagement)
    await db.commit()
    await db.refresh(engagement)
    return engagement


@router.get("/engagements/{engagement_id}", response_model=EngagementResponse)
async def get_engagement(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    eng = result.scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return eng


# ---- Evidence ----

@router.get("/engagements/{engagement_id}/evidence", response_model=list[EvidenceResponse])
async def list_evidence(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evidence)
        .where(Evidence.engagement_id == engagement_id)
        .order_by(Evidence.uploaded_at.desc())
    )
    return result.scalars().all()


@router.post("/engagements/{engagement_id}/evidence")
async def upload_evidence(
    engagement_id: uuid.UUID,
    file: UploadFile = File(...),
    evidence_type: str = "document",
    uploaded_by: str = "Consultant",
    db: AsyncSession = Depends(get_db),
):
    """Upload a document and trigger AI extraction."""
    # Save file
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Create evidence record
    evidence = Evidence(
        engagement_id=engagement_id,
        filename=file.filename or "unknown",
        file_path=file_path,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        evidence_type=EvidenceType(evidence_type) if evidence_type in EvidenceType.__members__.values() else EvidenceType.DOCUMENT,
        uploaded_by=uploaded_by,
        processing_status=ProcessingStatus.PROCESSING,
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    # Process document and extract with AI
    try:
        doc_result = await process_document(file_path, file.filename or "unknown")

        if doc_result["type"] == "text":
            ai_result = await extract_from_text(doc_result["content"], file.filename or "unknown", evidence_type)
        elif doc_result["type"] == "spreadsheet":
            ai_result = await extract_from_spreadsheet(doc_result["content"], file.filename or "unknown")
        else:
            ai_result = {"summary": "Unsupported file type", "key_findings": [], "model_used": None}

        extraction = EvidenceExtraction(
            evidence_id=evidence.id,
            summary=ai_result.get("summary", ""),
            key_findings=ai_result.get("key_findings", []),
            structured_data=ai_result.get("structured_data"),
            raw_text=doc_result["content"] if isinstance(doc_result["content"], str) else json.dumps(doc_result["content"], default=str)[:50000],
            model_used=ai_result.get("model_used"),
        )
        db.add(extraction)

        # Auto-map to components if suggested
        suggested_components = ai_result.get("suggested_components", [])
        if suggested_components:
            for comp_code in suggested_components[:10]:
                comp_result = await db.execute(
                    select(Component).where(Component.code == comp_code)
                )
                comp = comp_result.scalar_one_or_none()
                if comp:
                    mapping = EvidenceMapping(
                        evidence_id=evidence.id,
                        component_id=comp.id,
                        relevance_score=0.7,
                        rationale="AI-suggested mapping based on content analysis",
                    )
                    db.add(mapping)

        evidence.processing_status = ProcessingStatus.COMPLETED
        evidence.title = ai_result.get("title", file.filename)
        await log_activity(db, engagement_id, uploaded_by, "uploaded", "evidence", evidence.title or file.filename, f"AI extracted {len(ai_result.get('key_findings', []))} key findings")
    except Exception as e:
        logger.exception("Evidence processing failed for %s (engagement %s)", file.filename, engagement_id)
        evidence.processing_status = ProcessingStatus.FAILED
        evidence.processing_error = str(e)

    await db.commit()
    await db.refresh(evidence)
    return {"id": str(evidence.id), "status": evidence.processing_status.value}


@router.get("/engagements/{engagement_id}/evidence/{evidence_id}/extractions", response_model=list[ExtractionResponse])
async def get_extractions(evidence_id: uuid.UUID, engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EvidenceExtraction).where(EvidenceExtraction.evidence_id == evidence_id)
    )
    return result.scalars().all()


@router.get("/engagements/{engagement_id}/evidence/{evidence_id}/download")
async def download_evidence(
    engagement_id: uuid.UUID,
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Download the original evidence file."""
    result = await db.execute(
        select(Evidence).where(
            Evidence.id == evidence_id,
            Evidence.engagement_id == engagement_id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if not os.path.exists(ev.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=ev.file_path,
        filename=ev.filename,
        media_type=ev.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{ev.filename}"'},
    )


@router.get("/engagements/{engagement_id}/evidence/{evidence_id}/mappings", response_model=list[EvidenceMappingResponse])
async def get_evidence_mappings(
    engagement_id: uuid.UUID,
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get component mappings for a piece of evidence, including component names."""
    result = await db.execute(
        select(EvidenceMapping, Component.code, Component.name)
        .join(Component, EvidenceMapping.component_id == Component.id)
        .where(EvidenceMapping.evidence_id == evidence_id)
    )
    rows = result.all()
    return [
        EvidenceMappingResponse(
            id=mapping.id,
            evidence_id=mapping.evidence_id,
            component_id=mapping.component_id,
            component_code=code,
            component_name=name,
            relevance_score=mapping.relevance_score,
            rationale=mapping.rationale,
        )
        for mapping, code, name in rows
    ]


# ---- Extraction Inline Edit ----

@router.patch("/engagements/{engagement_id}/evidence/{evidence_id}/extractions/{extraction_id}")
async def update_extraction(
    engagement_id: uuid.UUID,
    evidence_id: uuid.UUID,
    extraction_id: uuid.UUID,
    data: ExtractionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update AI-extracted summary or key findings (inline edit)."""
    result = await db.execute(
        select(EvidenceExtraction).where(EvidenceExtraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(extraction, field, value)
    await db.commit()
    return {"ok": True}


# ---- Scoring ----

@router.get("/engagements/{engagement_id}/scores", response_model=list[ComponentScoreResponse])
async def list_scores(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ComponentScore).where(ComponentScore.engagement_id == engagement_id)
    )
    return result.scalars().all()


@router.post("/engagements/{engagement_id}/scores/{component_id}/assess")
async def assess_component_endpoint(
    engagement_id: uuid.UUID,
    component_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger AI assessment for a specific component."""
    # Check if score is approved/locked
    existing_score = await db.execute(
        select(ComponentScore)
        .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == component_id)
    )
    existing = existing_score.scalar_one_or_none()
    if existing and existing.approved:
        raise HTTPException(status_code=409, detail="Score is approved/locked. Unlock it before regenerating.")

    # Get component with criteria
    comp_result = await db.execute(
        select(Component)
        .options(selectinload(Component.criteria), selectinload(Component.dimension))
        .where(Component.id == component_id)
    )
    comp = comp_result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")

    # Get mapped evidence
    mapping_result = await db.execute(
        select(EvidenceMapping)
        .where(EvidenceMapping.component_id == component_id)
        .join(Evidence)
        .where(Evidence.engagement_id == engagement_id)
    )
    mappings = mapping_result.scalars().all()

    evidence_items = []
    for m in mappings:
        ev_result = await db.execute(
            select(Evidence)
            .options(selectinload(Evidence.extractions))
            .where(Evidence.id == m.evidence_id)
        )
        ev = ev_result.scalar_one_or_none()
        if ev and ev.extractions:
            ext = ev.extractions[0]
            evidence_items.append({
                "filename": ev.filename,
                "evidence_type": ev.evidence_type.value,
                "summary": ext.summary,
                "key_findings": ext.key_findings,
                "relevant_excerpts": m.relevant_excerpts,
            })

    # Check for insufficient evidence
    if not evidence_items:
        raise HTTPException(
            status_code=422,
            detail="Insufficient evidence: no evidence has been mapped to this component. Upload or map evidence to enable analysis.",
        )

    from app.models.framework import CriterionType
    core_actions = [c.text for c in comp.criteria if c.criterion_type == CriterionType.CORE_ACTION]
    progress_indicators = [c.text for c in comp.criteria if c.criterion_type == CriterionType.PROGRESS_INDICATOR]

    # Run AI assessment
    try:
        ai_result = await assess_component(
            component_code=comp.code,
            component_name=comp.name,
            dimension_name=comp.dimension.name if comp.dimension else "Unknown",
            core_actions=core_actions,
            progress_indicators=progress_indicators,
            evidence_items=evidence_items,
        )
    except Exception as e:
        logger.exception("AI component assessment failed for %s", comp.code)
        raise HTTPException(status_code=502, detail=f"AI service error during component assessment: {e}")

    # Upsert score
    existing = await db.execute(
        select(ComponentScore)
        .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == component_id)
    )
    score = existing.scalar_one_or_none()

    rating_val = ai_result.get("rating", "not_rated")
    try:
        rating = RatingLevel(rating_val)
    except ValueError:
        rating = RatingLevel.NOT_RATED

    if score:
        score.rating = rating
        score.strengths = ai_result.get("strengths")
        score.gaps = ai_result.get("gaps")
        score.contradictions = ai_result.get("contradictions")
        score.missing_evidence = ai_result.get("missing_evidence")
        score.ai_rationale = ai_result.get("rationale")
        score.evidence_count = ai_result.get("evidence_count", 0)
        score.confidence = ai_result.get("confidence")
        score.suggested_actions = ai_result.get("suggested_actions")
        score.follow_up_requests = ai_result.get("follow_up_requests")
        score.model_used = ai_result.get("model_used")
        score.scored_at = datetime.utcnow()
        score.status = ScoreStatus.DRAFT
    else:
        score = ComponentScore(
            engagement_id=engagement_id,
            component_id=component_id,
            rating=rating,
            status=ScoreStatus.DRAFT,
            strengths=ai_result.get("strengths"),
            gaps=ai_result.get("gaps"),
            contradictions=ai_result.get("contradictions"),
            missing_evidence=ai_result.get("missing_evidence"),
            ai_rationale=ai_result.get("rationale"),
            evidence_count=ai_result.get("evidence_count", 0),
            confidence=ai_result.get("confidence"),
            suggested_actions=ai_result.get("suggested_actions"),
            follow_up_requests=ai_result.get("follow_up_requests"),
            model_used=ai_result.get("model_used"),
        )
        db.add(score)

    await log_activity(db, engagement_id, "AI System", "scored", "component_score", f"{comp.code}: {comp.name}", f"Rated as {RATING_LABELS.get(rating_val, rating_val)} ({ai_result.get('confidence', 'unknown')} confidence)")
    await db.commit()
    await db.refresh(score)
    return {"id": str(score.id), "rating": score.rating.value, "confidence": score.confidence}


RATING_LABELS = {
    "excelling": "Excelling",
    "meeting_expectations": "Meeting Expectations",
    "developing": "Developing",
    "needs_improvement": "Needs Improvement",
    "not_rated": "Not Rated",
}


@router.patch("/engagements/{engagement_id}/scores/{score_id}")
async def update_score(
    engagement_id: uuid.UUID,
    score_id: uuid.UUID,
    data: ComponentScoreUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update component score fields (inline edit or consultant review)."""
    result = await db.execute(select(ComponentScore).where(ComponentScore.id == score_id))
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(score, field, value)
    await db.commit()
    return {"ok": True}


# ---- Evidence Counts (per-component) ----

@router.get("/engagements/{engagement_id}/evidence-counts")
async def get_evidence_counts(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get evidence mapping counts per component for this engagement."""
    result = await db.execute(
        select(
            EvidenceMapping.component_id,
            func.count(EvidenceMapping.id).label("evidence_count"),
        )
        .join(Evidence, EvidenceMapping.evidence_id == Evidence.id)
        .where(Evidence.engagement_id == engagement_id)
        .group_by(EvidenceMapping.component_id)
    )
    rows = result.all()
    return {str(r.component_id): r.evidence_count for r in rows}


@router.get("/engagements/{engagement_id}/components/{component_id}/evidence-ids")
async def get_component_evidence_ids(
    engagement_id: uuid.UUID,
    component_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get evidence IDs mapped to a specific component."""
    result = await db.execute(
        select(EvidenceMapping.evidence_id)
        .join(Evidence, EvidenceMapping.evidence_id == Evidence.id)
        .where(
            Evidence.engagement_id == engagement_id,
            EvidenceMapping.component_id == component_id,
        )
        .distinct()
    )
    return [str(r[0]) for r in result.all()]


# ---- Approval Toggle Endpoints ----

@router.patch("/engagements/{engagement_id}/scores/{score_id}/approve")
async def toggle_score_approval(
    engagement_id: uuid.UUID,
    score_id: uuid.UUID,
    data: ApprovalToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Toggle approval/lock status of a component score."""
    result = await db.execute(
        select(ComponentScore).where(
            ComponentScore.id == score_id,
            ComponentScore.engagement_id == engagement_id,
        )
    )
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
    score.approved = data.approved
    if data.approved:
        score.status = "confirmed"
        score.reviewed_at = datetime.utcnow()
    else:
        score.status = "draft"
    # Get component name for activity log
    comp_result = await db.execute(select(Component).where(Component.id == score.component_id))
    comp = comp_result.scalar_one_or_none()
    comp_label = f"{comp.code}: {comp.name}" if comp else "Unknown"
    await log_activity(db, engagement_id, "Sarah Chen", "approved" if data.approved else "unlocked", "component_score", comp_label)
    await db.commit()
    return {"ok": True, "approved": score.approved}


@router.patch("/engagements/{engagement_id}/dimension-summaries/{summary_id}/approve")
async def toggle_dimension_summary_approval(
    engagement_id: uuid.UUID,
    summary_id: uuid.UUID,
    data: ApprovalToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Toggle approval/lock status of a dimension summary."""
    result = await db.execute(
        select(DimensionSummary).where(
            DimensionSummary.id == summary_id,
            DimensionSummary.engagement_id == engagement_id,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Dimension summary not found")
    summary.approved = data.approved
    await db.commit()
    return {"ok": True, "approved": summary.approved}


@router.patch("/engagements/{engagement_id}/global-summary/{summary_id}/approve")
async def toggle_global_summary_approval(
    engagement_id: uuid.UUID,
    summary_id: uuid.UUID,
    data: ApprovalToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Toggle approval/lock status of a global summary."""
    result = await db.execute(
        select(GlobalSummary).where(
            GlobalSummary.id == summary_id,
            GlobalSummary.engagement_id == engagement_id,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Global summary not found")
    summary.approved = data.approved
    await db.commit()
    return {"ok": True, "approved": summary.approved}


# ---- Batch Generation Endpoints ----

async def _get_component_evidence_count(
    db: AsyncSession, engagement_id: uuid.UUID, component_id: uuid.UUID
) -> int:
    """Helper: count evidence items mapped to a component for a given engagement."""
    result = await db.execute(
        select(func.count(EvidenceMapping.id))
        .join(Evidence, EvidenceMapping.evidence_id == Evidence.id)
        .where(
            EvidenceMapping.component_id == component_id,
            Evidence.engagement_id == engagement_id,
        )
    )
    return result.scalar() or 0


async def _assess_single_component(
    db: AsyncSession, engagement_id: uuid.UUID, component_id: uuid.UUID
) -> dict:
    """
    Run AI assessment for a single component.
    Returns dict with status info. Raises on insufficient evidence.
    """
    comp_result = await db.execute(
        select(Component)
        .options(selectinload(Component.criteria), selectinload(Component.dimension))
        .where(Component.id == component_id)
    )
    comp = comp_result.scalar_one_or_none()
    if not comp:
        return {"status": "error", "error": "Component not found"}

    # Get mapped evidence
    mapping_result = await db.execute(
        select(EvidenceMapping)
        .where(EvidenceMapping.component_id == component_id)
        .join(Evidence)
        .where(Evidence.engagement_id == engagement_id)
    )
    mappings = mapping_result.scalars().all()

    evidence_items = []
    for m in mappings:
        ev_result = await db.execute(
            select(Evidence)
            .options(selectinload(Evidence.extractions))
            .where(Evidence.id == m.evidence_id)
        )
        ev = ev_result.scalar_one_or_none()
        if ev and ev.extractions:
            ext = ev.extractions[0]
            evidence_items.append({
                "filename": ev.filename,
                "evidence_type": ev.evidence_type.value,
                "summary": ext.summary,
                "key_findings": ext.key_findings,
                "relevant_excerpts": m.relevant_excerpts,
            })

    if not evidence_items:
        return {"status": "no_evidence", "component_code": comp.code}

    from app.models.framework import CriterionType
    core_actions = [c.text for c in comp.criteria if c.criterion_type == CriterionType.CORE_ACTION]
    progress_indicators = [c.text for c in comp.criteria if c.criterion_type == CriterionType.PROGRESS_INDICATOR]

    ai_result = await assess_component(
        component_code=comp.code,
        component_name=comp.name,
        dimension_name=comp.dimension.name if comp.dimension else "Unknown",
        core_actions=core_actions,
        progress_indicators=progress_indicators,
        evidence_items=evidence_items,
    )

    rating_val = ai_result.get("rating", "not_rated")
    try:
        rating = RatingLevel(rating_val)
    except ValueError:
        rating = RatingLevel.NOT_RATED

    existing = await db.execute(
        select(ComponentScore)
        .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == component_id)
    )
    score = existing.scalar_one_or_none()

    if score:
        score.rating = rating
        score.strengths = ai_result.get("strengths")
        score.gaps = ai_result.get("gaps")
        score.contradictions = ai_result.get("contradictions")
        score.missing_evidence = ai_result.get("missing_evidence")
        score.ai_rationale = ai_result.get("rationale")
        score.evidence_count = ai_result.get("evidence_count", 0)
        score.confidence = ai_result.get("confidence")
        score.suggested_actions = ai_result.get("suggested_actions")
        score.follow_up_requests = ai_result.get("follow_up_requests")
        score.model_used = ai_result.get("model_used")
        score.scored_at = datetime.utcnow()
        score.status = ScoreStatus.DRAFT
    else:
        score = ComponentScore(
            engagement_id=engagement_id,
            component_id=component_id,
            rating=rating,
            status=ScoreStatus.DRAFT,
            strengths=ai_result.get("strengths"),
            gaps=ai_result.get("gaps"),
            contradictions=ai_result.get("contradictions"),
            missing_evidence=ai_result.get("missing_evidence"),
            ai_rationale=ai_result.get("rationale"),
            evidence_count=ai_result.get("evidence_count", 0),
            confidence=ai_result.get("confidence"),
            suggested_actions=ai_result.get("suggested_actions"),
            follow_up_requests=ai_result.get("follow_up_requests"),
            model_used=ai_result.get("model_used"),
        )
        db.add(score)

    await db.commit()
    return {"status": "completed", "component_code": comp.code, "rating": rating.value}


@router.post("/engagements/{engagement_id}/batch/assess-components")
async def batch_assess_components(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Batch-generate ALL component assessments. Skips approved and no-evidence components."""
    # Get all components
    dims_result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components))
        .order_by(Dimension.number)
    )
    dims = dims_result.scalars().all()
    all_components = [comp for dim in dims for comp in dim.components]

    # Get existing approved scores
    scores_result = await db.execute(
        select(ComponentScore)
        .where(ComponentScore.engagement_id == engagement_id, ComponentScore.approved)
    )
    approved_component_ids = {str(s.component_id) for s in scores_result.scalars().all()}

    total = len(all_components)
    completed = 0
    skipped_approved = 0
    skipped_no_evidence = 0
    failed = 0
    results = []

    for comp in all_components:
        comp_id_str = str(comp.id)
        if comp_id_str in approved_component_ids:
            skipped_approved += 1
            results.append({"component_code": comp.code, "status": "skipped_approved"})
            continue

        try:
            result = await _assess_single_component(db, engagement_id, comp.id)
            if result["status"] == "no_evidence":
                skipped_no_evidence += 1
            elif result["status"] == "completed":
                completed += 1
            else:
                failed += 1
            results.append(result)
        except Exception as e:
            failed += 1
            results.append({"component_code": comp.code, "status": "error", "error": str(e)})
            logger.exception(f"Batch assess failed for {comp.code}")

    return {
        "total": total,
        "completed": completed,
        "skipped_approved": skipped_approved,
        "skipped_no_evidence": skipped_no_evidence,
        "failed": failed,
        "results": results,
    }


@router.post("/engagements/{engagement_id}/batch/synthesize-dimensions")
async def batch_synthesize_dimensions(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Batch-generate ALL dimension syntheses. Skips approved summaries."""
    dims_result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components))
        .order_by(Dimension.number)
    )
    dims = dims_result.scalars().all()

    # Get existing approved summaries
    existing_result = await db.execute(
        select(DimensionSummary)
        .where(DimensionSummary.engagement_id == engagement_id, DimensionSummary.approved)
    )
    approved_dim_ids = {str(s.dimension_id) for s in existing_result.scalars().all()}

    total = len(dims)
    completed = 0
    skipped_approved = 0
    skipped_no_evidence = 0
    failed = 0
    results = []

    for dim in dims:
        dim_id_str = str(dim.id)
        if dim_id_str in approved_dim_ids:
            skipped_approved += 1
            results.append({"dimension": dim.name, "status": "skipped_approved"})
            continue

        # Gather component scores for this dimension
        component_scores_data = []
        has_any_scored = False
        for comp in dim.components:
            score_result = await db.execute(
                select(ComponentScore)
                .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == comp.id)
            )
            score = score_result.scalar_one_or_none()
            if score and score.rating != RatingLevel.NOT_RATED:
                has_any_scored = True
            component_scores_data.append({
                "code": comp.code,
                "name": comp.name,
                "rating": score.rating.value if score else "not_rated",
                "confidence": score.confidence if score else None,
                "strengths": score.strengths if score else None,
                "gaps": score.gaps if score else None,
                "rationale": score.ai_rationale if score else None,
            })

        if not has_any_scored:
            skipped_no_evidence += 1
            results.append({"dimension": dim.name, "status": "skipped_no_evidence"})
            continue

        try:
            ai_result = await synthesize_dimension(dim.name, component_scores_data)
            summary = DimensionSummary(
                engagement_id=engagement_id,
                dimension_id=dim.id,
                overall_assessment=ai_result.get("overall_assessment"),
                patterns=ai_result.get("patterns"),
                compounding_risks=ai_result.get("compounding_risks"),
                top_opportunities=ai_result.get("top_opportunities"),
                leadership_attention=ai_result.get("leadership_attention"),
                model_used=ai_result.get("model_used"),
            )
            db.add(summary)
            await db.commit()
            completed += 1
            results.append({"dimension": dim.name, "status": "completed"})
        except Exception as e:
            failed += 1
            results.append({"dimension": dim.name, "status": "error", "error": str(e)})
            logger.exception(f"Batch synthesis failed for {dim.name}")

    return {
        "total": total,
        "completed": completed,
        "skipped_approved": skipped_approved,
        "skipped_no_evidence": skipped_no_evidence,
        "failed": failed,
        "results": results,
    }


@router.post("/engagements/{engagement_id}/batch/generate-global")
async def batch_generate_global(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate global summary (single item, but checks for approval lock)."""
    # Check if latest global summary is approved
    existing_result = await db.execute(
        select(GlobalSummary)
        .where(GlobalSummary.engagement_id == engagement_id)
        .order_by(GlobalSummary.generated_at.desc())
    )
    existing = existing_result.scalars().first()
    if existing and existing.approved:
        return {
            "total": 1,
            "completed": 0,
            "skipped_approved": 1,
            "skipped_no_evidence": 0,
            "failed": 0,
            "results": [{"status": "skipped_approved"}],
        }

    # Check if we have any dimension summaries
    dim_summaries_result = await db.execute(
        select(DimensionSummary).where(DimensionSummary.engagement_id == engagement_id)
    )
    dim_summaries = dim_summaries_result.scalars().all()
    if not dim_summaries:
        return {
            "total": 1,
            "completed": 0,
            "skipped_approved": 0,
            "skipped_no_evidence": 1,
            "failed": 0,
            "results": [{"status": "skipped_no_evidence"}],
        }

    # Generate
    eng_result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    eng = eng_result.scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    dims_result = await db.execute(select(Dimension).order_by(Dimension.number))
    dims = {str(d.id): d.name for d in dims_result.scalars().all()}

    dimension_data = []
    for ds in dim_summaries:
        dimension_data.append({
            "name": dims.get(str(ds.dimension_id), "Unknown"),
            "overall_assessment": ds.overall_assessment,
            "patterns": ds.patterns,
            "top_opportunities": ds.top_opportunities,
            "compounding_risks": ds.compounding_risks,
        })

    try:
        ai_result = await generate_global_summary(eng.school_name, eng.stage.value, dimension_data)
        summary = GlobalSummary(
            engagement_id=engagement_id,
            executive_summary=ai_result.get("executive_summary"),
            top_strengths=ai_result.get("top_strengths"),
            critical_gaps=ai_result.get("critical_gaps"),
            strategic_priorities=ai_result.get("strategic_priorities"),
            resource_implications=ai_result.get("resource_implications"),
            recommended_next_steps=ai_result.get("recommended_next_steps"),
            model_used=ai_result.get("model_used"),
        )
        db.add(summary)
        await db.commit()
        return {
            "total": 1,
            "completed": 1,
            "skipped_approved": 0,
            "skipped_no_evidence": 0,
            "failed": 0,
            "results": [{"status": "completed"}],
        }
    except Exception as e:
        logger.exception("Batch global summary generation failed")
        return {
            "total": 1,
            "completed": 0,
            "skipped_approved": 0,
            "skipped_no_evidence": 0,
            "failed": 1,
            "results": [{"status": "error", "error": str(e)}],
        }


# ---- Dimension Synthesis ----

@router.post("/engagements/{engagement_id}/dimensions/{dimension_id}/synthesize")
async def synthesize_dimension_endpoint(
    engagement_id: uuid.UUID,
    dimension_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger AI synthesis for a dimension."""
    # Check if existing summary is approved/locked
    existing_summary_result = await db.execute(
        select(DimensionSummary)
        .where(
            DimensionSummary.engagement_id == engagement_id,
            DimensionSummary.dimension_id == dimension_id,
            DimensionSummary.approved,
        )
    )
    if existing_summary_result.scalars().first():
        raise HTTPException(status_code=409, detail="Dimension summary is approved/locked. Unlock it before regenerating.")

    dim_result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components))
        .where(Dimension.id == dimension_id)
    )
    dim = dim_result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")

    component_scores_data = []
    has_any_scored = False
    for comp in dim.components:
        score_result = await db.execute(
            select(ComponentScore)
            .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == comp.id)
        )
        score = score_result.scalar_one_or_none()
        if score and score.rating != RatingLevel.NOT_RATED:
            has_any_scored = True
        component_scores_data.append({
            "code": comp.code,
            "name": comp.name,
            "rating": score.rating.value if score else "not_rated",
            "confidence": score.confidence if score else None,
            "strengths": score.strengths if score else None,
            "gaps": score.gaps if score else None,
            "rationale": score.ai_rationale if score else None,
        })

    if not has_any_scored:
        raise HTTPException(
            status_code=422,
            detail="Insufficient evidence: no components in this dimension have been assessed yet.",
        )

    try:
        ai_result = await synthesize_dimension(dim.name, component_scores_data)
    except Exception as e:
        logger.exception("AI dimension synthesis failed for %s", dim.name)
        raise HTTPException(status_code=502, detail=f"AI service error during dimension synthesis: {e}")

    summary = DimensionSummary(
        engagement_id=engagement_id,
        dimension_id=dimension_id,
        overall_assessment=ai_result.get("overall_assessment"),
        patterns=ai_result.get("patterns"),
        compounding_risks=ai_result.get("compounding_risks"),
        top_opportunities=ai_result.get("top_opportunities"),
        leadership_attention=ai_result.get("leadership_attention"),
        model_used=ai_result.get("model_used"),
    )
    db.add(summary)
    await db.commit()
    await db.refresh(summary)
    return {"id": str(summary.id)}


@router.patch("/engagements/{engagement_id}/dimension-summaries/{summary_id}")
async def update_dimension_summary(
    engagement_id: uuid.UUID,
    summary_id: uuid.UUID,
    data: DimensionSummaryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update dimension synthesis text (inline edit)."""
    result = await db.execute(
        select(DimensionSummary).where(DimensionSummary.id == summary_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Dimension summary not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(summary, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/engagements/{engagement_id}/dimension-summaries", response_model=list[DimensionSummaryResponse])
async def list_dimension_summaries(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DimensionSummary).where(DimensionSummary.engagement_id == engagement_id)
    )
    return result.scalars().all()


# ---- Global Summary ----

@router.post("/engagements/{engagement_id}/global-summary")
async def generate_global_summary_endpoint(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate executive-level global summary."""
    eng_result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    eng = eng_result.scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    dim_summaries_result = await db.execute(
        select(DimensionSummary).where(DimensionSummary.engagement_id == engagement_id)
    )
    dim_summaries = dim_summaries_result.scalars().all()

    dims_result = await db.execute(select(Dimension).order_by(Dimension.number))
    dims = {str(d.id): d.name for d in dims_result.scalars().all()}

    dimension_data = []
    for ds in dim_summaries:
        dimension_data.append({
            "name": dims.get(str(ds.dimension_id), "Unknown"),
            "overall_assessment": ds.overall_assessment,
            "patterns": ds.patterns,
            "top_opportunities": ds.top_opportunities,
            "compounding_risks": ds.compounding_risks,
        })

    try:
        ai_result = await generate_global_summary(eng.school_name, eng.stage.value, dimension_data)
    except Exception as e:
        logger.exception("AI global summary generation failed for engagement %s", engagement_id)
        raise HTTPException(status_code=502, detail=f"AI service error during global summary: {e}")

    summary = GlobalSummary(
        engagement_id=engagement_id,
        executive_summary=ai_result.get("executive_summary"),
        top_strengths=ai_result.get("top_strengths"),
        critical_gaps=ai_result.get("critical_gaps"),
        strategic_priorities=ai_result.get("strategic_priorities"),
        resource_implications=ai_result.get("resource_implications"),
        recommended_next_steps=ai_result.get("recommended_next_steps"),
        model_used=ai_result.get("model_used"),
    )
    db.add(summary)
    await db.commit()
    await db.refresh(summary)
    return {"id": str(summary.id)}


@router.patch("/engagements/{engagement_id}/global-summary/{summary_id}")
async def update_global_summary(
    engagement_id: uuid.UUID,
    summary_id: uuid.UUID,
    data: GlobalSummaryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update global summary text (inline edit)."""
    result = await db.execute(
        select(GlobalSummary).where(GlobalSummary.id == summary_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Global summary not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(summary, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/engagements/{engagement_id}/global-summary")
async def get_global_summary(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GlobalSummary)
        .where(GlobalSummary.engagement_id == engagement_id)
        .order_by(GlobalSummary.generated_at.desc())
    )
    summary = result.scalars().first()
    if not summary:
        raise HTTPException(status_code=404, detail="No global summary found")
    return GlobalSummaryResponse.model_validate(summary)


# ---- Data Requests ----

@router.get("/engagements/{engagement_id}/data-requests", response_model=list[DataRequestResponse])
async def list_data_requests(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DataRequest)
        .where(DataRequest.engagement_id == engagement_id)
        .order_by(DataRequest.created_at.desc())
    )
    return result.scalars().all()


@router.post("/engagements/{engagement_id}/data-requests", response_model=DataRequestResponse)
async def create_data_request(
    engagement_id: uuid.UUID,
    data: DataRequestCreate,
    db: AsyncSession = Depends(get_db),
):
    req = DataRequest(engagement_id=engagement_id, **data.model_dump())
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.patch("/engagements/{engagement_id}/data-requests/{request_id}")
async def update_data_request(
    engagement_id: uuid.UUID,
    request_id: uuid.UUID,
    status: str = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DataRequest).where(DataRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Data request not found")
    if status:
        req.status = RequestStatus(status)
    await db.commit()
    return {"ok": True}


@router.get("/engagements/{engagement_id}/data-requests/{request_id}/comments", response_model=list[CommentResponse])
async def list_comments(request_id: uuid.UUID, engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DataRequestComment)
        .where(DataRequestComment.data_request_id == request_id)
        .order_by(DataRequestComment.created_at)
    )
    return result.scalars().all()


@router.post("/engagements/{engagement_id}/data-requests/{request_id}/comments", response_model=CommentResponse)
async def create_comment(
    engagement_id: uuid.UUID,
    request_id: uuid.UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
):
    comment = DataRequestComment(data_request_id=request_id, **data.model_dump())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


# ---- Action Plans ----

@router.get("/engagements/{engagement_id}/action-plans", response_model=list[ActionPlanResponse])
async def list_action_plans(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActionPlan).where(ActionPlan.engagement_id == engagement_id)
    )
    return result.scalars().all()


@router.patch("/engagements/{engagement_id}/action-plans/{plan_id}/items/{item_id}")
async def update_action_item(
    engagement_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ActionItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update action item text fields (inline edit)."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status":
            from app.models.action_plan import ItemStatus
            value = ItemStatus(value)
        setattr(item, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/engagements/{engagement_id}/action-plans/{plan_id}/items", response_model=list[ActionItemResponse])
async def list_action_items(plan_id: uuid.UUID, engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActionItem)
        .where(ActionItem.action_plan_id == plan_id)
        .order_by(ActionItem.priority_order)
    )
    return result.scalars().all()


# ---- Messaging ----

@router.get("/engagements/{engagement_id}/threads", response_model=list[ThreadResponse])
async def list_threads(engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # Fetch real message threads with message counts and last activity
    result = await db.execute(
        select(MessageThread)
        .options(selectinload(MessageThread.messages))
        .where(MessageThread.engagement_id == engagement_id)
    )
    real_threads = result.scalars().all()

    thread_list = []
    for t in real_threads:
        msg_count = len(t.messages)
        last_act = max((m.created_at for m in t.messages), default=t.created_at)
        thread_list.append(ThreadResponse(
            id=t.id,
            engagement_id=t.engagement_id,
            thread_type=t.thread_type.value if hasattr(t.thread_type, 'value') else str(t.thread_type),
            reference_id=t.reference_id,
            title=t.title,
            message_count=msg_count,
            last_activity=last_act,
            created_at=t.created_at,
        ))

    # Fetch data requests with at least 1 comment to create virtual threads
    dr_result = await db.execute(
        select(DataRequest)
        .options(selectinload(DataRequest.comments))
        .where(DataRequest.engagement_id == engagement_id)
    )
    data_requests = dr_result.scalars().all()

    for dr in data_requests:
        if not dr.comments:
            continue
        comment_count = len(dr.comments)
        last_comment = max((c.created_at for c in dr.comments), default=dr.created_at)
        # Use a deterministic UUID derived from the data request id for the virtual thread
        # so the frontend can consistently reference it
        virtual_thread_id = uuid.uuid5(uuid.NAMESPACE_URL, f"data_request_thread:{dr.id}")
        thread_list.append(ThreadResponse(
            id=virtual_thread_id,
            engagement_id=dr.engagement_id,
            thread_type="data_request",
            reference_id=dr.id,
            title=f"DR: {dr.title}",
            message_count=comment_count,
            last_activity=last_comment,
            created_at=dr.created_at,
        ))

    # Sort all threads by most recent activity (descending)
    thread_list.sort(key=lambda t: t.last_activity or t.created_at, reverse=True)
    return thread_list


@router.post("/engagements/{engagement_id}/threads", response_model=ThreadResponse)
async def create_thread(
    engagement_id: uuid.UUID,
    data: ThreadCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new message thread (channel)."""
    # Validate engagement exists
    eng_result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    eng = eng_result.scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    thread = MessageThread(
        engagement_id=engagement_id,
        title=data.title,
        thread_type=ThreadType(data.thread_type),
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return ThreadResponse(
        id=thread.id,
        engagement_id=thread.engagement_id,
        thread_type=thread.thread_type.value if hasattr(thread.thread_type, 'value') else str(thread.thread_type),
        reference_id=thread.reference_id,
        title=thread.title,
        message_count=0,
        last_activity=thread.created_at,
        created_at=thread.created_at,
    )


@router.get("/engagements/{engagement_id}/threads/{thread_id}/messages", response_model=list[MessageResponse])
async def list_messages(thread_id: uuid.UUID, engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # Check if this is a virtual data_request thread
    # Virtual thread IDs are uuid5 based on "data_request_thread:{dr_id}"
    # Try to find a real thread first
    real_thread_result = await db.execute(
        select(MessageThread).where(MessageThread.id == thread_id)
    )
    real_thread = real_thread_result.scalar_one_or_none()

    if real_thread:
        # Real thread - return its messages
        result = await db.execute(
            select(Message)
            .where(Message.thread_id == thread_id)
            .order_by(Message.created_at)
        )
        return result.scalars().all()

    # Not a real thread - check if it's a virtual data_request thread
    # Search through data requests to find one whose virtual thread id matches
    dr_result = await db.execute(
        select(DataRequest)
        .options(selectinload(DataRequest.comments))
        .where(DataRequest.engagement_id == engagement_id)
    )
    data_requests = dr_result.scalars().all()

    for dr in data_requests:
        virtual_id = uuid.uuid5(uuid.NAMESPACE_URL, f"data_request_thread:{dr.id}")
        if virtual_id == thread_id:
            # Return comments formatted as messages
            messages = []
            for c in sorted(dr.comments, key=lambda x: x.created_at):
                messages.append(MessageResponse(
                    id=c.id,
                    thread_id=thread_id,
                    author=c.author,
                    role=c.role,
                    content=c.content,
                    mentions=None,
                    created_at=c.created_at,
                ))
            return messages

    raise HTTPException(status_code=404, detail="Thread not found")


@router.post("/engagements/{engagement_id}/threads/{thread_id}/messages", response_model=MessageResponse)
async def create_message(
    engagement_id: uuid.UUID,
    thread_id: uuid.UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    # Check if this is a real thread
    real_thread_result = await db.execute(
        select(MessageThread).where(MessageThread.id == thread_id)
    )
    real_thread = real_thread_result.scalar_one_or_none()

    if real_thread:
        # Real thread - create a regular message
        msg = Message(thread_id=thread_id, **data.model_dump())
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

    # Check if it's a virtual data_request thread
    dr_result = await db.execute(
        select(DataRequest)
        .where(DataRequest.engagement_id == engagement_id)
    )
    data_requests = dr_result.scalars().all()

    for dr in data_requests:
        virtual_id = uuid.uuid5(uuid.NAMESPACE_URL, f"data_request_thread:{dr.id}")
        if virtual_id == thread_id:
            # Create a DataRequestComment on the underlying data request
            comment = DataRequestComment(
                data_request_id=dr.id,
                author=data.author,
                role=data.role,
                content=data.content,
            )
            db.add(comment)
            await db.commit()
            await db.refresh(comment)
            return MessageResponse(
                id=comment.id,
                thread_id=thread_id,
                author=comment.author,
                role=comment.role,
                content=comment.content,
                mentions=data.mentions,
                created_at=comment.created_at,
            )

    raise HTTPException(status_code=404, detail="Thread not found")


# ---- Copilot ----

@router.post("/engagements/{engagement_id}/copilot", response_model=CopilotResponse)
async def copilot_endpoint(
    engagement_id: uuid.UUID,
    data: CopilotRequest,
    db: AsyncSession = Depends(get_db),
):
    """Interactive AI copilot chat."""
    eng_result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    eng = eng_result.scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Get evidence context
    ev_result = await db.execute(
        select(Evidence)
        .options(selectinload(Evidence.extractions))
        .where(Evidence.engagement_id == engagement_id)
    )
    evidence_list = ev_result.scalars().all()
    evidence_context = []
    for ev in evidence_list:
        ctx = {"filename": ev.filename, "evidence_type": ev.evidence_type.value}
        if ev.extractions:
            ctx["summary"] = ev.extractions[0].summary
            ctx["key_findings"] = ev.extractions[0].key_findings
        evidence_context.append(ctx)

    try:
        result = await copilot_chat(
            school_name=eng.school_name,
            current_context=data.context,
            user_role=data.role,
            user_message=data.message,
            evidence_context=evidence_context,
            conversation_history=data.conversation_history,
            engagement_id=engagement_id,
            db=db,
        )
    except Exception as e:
        logger.exception("AI copilot chat failed for engagement %s", engagement_id)
        raise HTTPException(status_code=502, detail=f"AI service error during copilot chat: {e}")

    return CopilotResponse(**result)


# ---- AI Feedback ----

@router.post("/engagements/{engagement_id}/feedback", response_model=AIFeedbackResponse)
async def create_feedback(
    engagement_id: uuid.UUID,
    data: AIFeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create thumbs-up/down feedback on AI-generated content."""
    # Upsert: replace existing feedback for the same target
    existing_result = await db.execute(
        select(AIFeedback).where(
            AIFeedback.engagement_id == engagement_id,
            AIFeedback.target_type == data.target_type,
            AIFeedback.target_id == data.target_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        existing.created_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing

    feedback = AIFeedback(
        engagement_id=engagement_id,
        target_type=data.target_type,
        target_id=data.target_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.get("/engagements/{engagement_id}/feedback", response_model=list[AIFeedbackResponse])
async def get_feedback(
    engagement_id: uuid.UUID,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get feedback for an engagement, optionally filtered by target_type and target_id."""
    query = select(AIFeedback).where(AIFeedback.engagement_id == engagement_id)
    if target_type:
        query = query.where(AIFeedback.target_type == target_type)
    if target_id:
        query = query.where(AIFeedback.target_id == target_id)
    result = await db.execute(query)
    return result.scalars().all()


# ---- Activity Log ----

async def log_activity(db: AsyncSession, engagement_id: uuid.UUID, actor: str, action: str, target_type: str, target_label: str | None = None, detail: str | None = None):
    """Helper to record an activity log entry."""
    entry = ActivityLog(
        engagement_id=engagement_id,
        actor=actor,
        action=action,
        target_type=target_type,
        target_label=target_label,
        detail=detail,
    )
    db.add(entry)
    # Don't flush here — let the caller's transaction handle it


@router.get("/engagements/{engagement_id}/activity")
async def get_activity_log(
    engagement_id: uuid.UUID,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity for an engagement."""
    result = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.engagement_id == engagement_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "actor": e.actor,
            "action": e.action,
            "target_type": e.target_type,
            "target_label": e.target_label,
            "detail": e.detail,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]


# ---- Export Assessment PDF ----

@router.get("/engagements/{engagement_id}/export")
async def export_assessment_pdf(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate and download a PDF assessment report."""
    # Fetch engagement
    eng_result = await db.execute(select(Engagement).where(Engagement.id == engagement_id))
    engagement = eng_result.scalar_one_or_none()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Fetch dimensions with components
    dim_result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components))
        .order_by(Dimension.number)
    )
    dimensions = [
        {
            "id": str(d.id),
            "name": d.name,
            "number": d.number,
            "components": [
                {"id": str(c.id), "code": c.code, "name": c.name}
                for c in d.components
            ],
        }
        for d in dim_result.scalars().all()
    ]

    # Fetch scores
    score_result = await db.execute(
        select(ComponentScore).where(ComponentScore.engagement_id == engagement_id)
    )
    scores = [
        {
            "component_id": str(s.component_id),
            "rating": s.rating.value if s.rating else "not_rated",
            "confidence": s.confidence if s.confidence else "-",
        }
        for s in score_result.scalars().all()
    ]

    # Fetch dimension summaries
    ds_result = await db.execute(
        select(DimensionSummary).where(DimensionSummary.engagement_id == engagement_id)
    )
    dim_summaries = []
    for ds in ds_result.scalars().all():
        entry = {"dimension_id": str(ds.dimension_id), "overall_assessment": ds.overall_assessment or ""}
        if ds.patterns:
            entry["patterns"] = ds.patterns if isinstance(ds.patterns, list) else []
        if ds.top_opportunities:
            entry["top_opportunities"] = ds.top_opportunities if isinstance(ds.top_opportunities, list) else []
        dim_summaries.append(entry)

    # Fetch global summary
    gs_result = await db.execute(
        select(GlobalSummary).where(GlobalSummary.engagement_id == engagement_id)
    )
    gs = gs_result.scalar_one_or_none()
    global_summary = None
    if gs:
        global_summary = {
            "executive_summary": gs.executive_summary or "",
            "top_strengths": gs.top_strengths if isinstance(gs.top_strengths, list) else [],
            "critical_gaps": gs.critical_gaps if isinstance(gs.critical_gaps, list) else [],
            "strategic_priorities": gs.strategic_priorities if isinstance(gs.strategic_priorities, list) else [],
        }

    # Fetch action items
    plan_result = await db.execute(
        select(ActionPlan)
        .options(selectinload(ActionPlan.items))
        .where(ActionPlan.engagement_id == engagement_id)
    )
    plan = plan_result.scalar_one_or_none()
    action_items = []
    if plan:
        for item in sorted(plan.items, key=lambda i: i.priority_order or ""):
            action_items.append({
                "title": item.title,
                "description": item.description,
                "rationale": item.rationale,
                "owner": item.owner,
                "status": item.status.value if item.status else "not_started",
            })

    pdf_bytes = generate_assessment_pdf(
        school_name=engagement.school_name,
        engagement_name=engagement.name,
        dimensions=dimensions,
        scores=scores,
        dim_summaries=dim_summaries,
        global_summary=global_summary,
        action_items=action_items,
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{engagement.school_name.replace(" ", "_")}_Assessment_Report.pdf"',
        },
    )


# ---- Demo Documents Download ----

DEMO_UPLOADS_DIR = "demo_uploads/samples"

@router.get("/demo-documents")
async def download_demo_documents():
    """Download sample school documents as a ZIP file for demo purposes."""
    demo_dir = os.path.abspath(DEMO_UPLOADS_DIR)
    if not os.path.isdir(demo_dir):
        raise HTTPException(status_code=404, detail="Demo documents directory not found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in sorted(os.listdir(demo_dir)):
            fpath = os.path.join(demo_dir, fname)
            if os.path.isfile(fpath):
                zf.write(fpath, fname)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="Meridian_Sample_Documents.zip"'},
    )
