"""API routes for the Meridian platform."""

import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.agents.component_agent import assess_component
from app.ai.agents.copilot_agent import copilot_chat
from app.ai.agents.dimension_agent import synthesize_dimension
from app.ai.agents.extraction_agent import extract_from_spreadsheet, extract_from_text
from app.ai.agents.global_agent import generate_global_summary
from app.database import get_db
from app.models import (
    ActionItem,
    ActionPlan,
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
from app.models.scoring import RatingLevel, ScoreStatus
from app.schemas.schemas import *
from app.services.document_processor import process_document

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
    except Exception as e:
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

    from app.models.framework import CriterionType
    core_actions = [c.text for c in comp.criteria if c.criterion_type == CriterionType.CORE_ACTION]
    progress_indicators = [c.text for c in comp.criteria if c.criterion_type == CriterionType.PROGRESS_INDICATOR]

    # Run AI assessment
    ai_result = await assess_component(
        component_code=comp.code,
        component_name=comp.name,
        dimension_name=comp.dimension.name if comp.dimension else "Unknown",
        core_actions=core_actions,
        progress_indicators=progress_indicators,
        evidence_items=evidence_items,
    )

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

    await db.commit()
    await db.refresh(score)
    return {"id": str(score.id), "rating": score.rating.value, "confidence": score.confidence}


@router.patch("/engagements/{engagement_id}/scores/{score_id}")
async def update_score(
    engagement_id: uuid.UUID,
    score_id: uuid.UUID,
    consultant_notes: str = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Consultant reviews/confirms a score."""
    result = await db.execute(select(ComponentScore).where(ComponentScore.id == score_id))
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
    if consultant_notes is not None:
        score.consultant_notes = consultant_notes
    if status is not None:
        score.status = ScoreStatus(status)
        if status == "confirmed":
            score.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ---- Dimension Synthesis ----

@router.post("/engagements/{engagement_id}/dimensions/{dimension_id}/synthesize")
async def synthesize_dimension_endpoint(
    engagement_id: uuid.UUID,
    dimension_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger AI synthesis for a dimension."""
    dim_result = await db.execute(
        select(Dimension)
        .options(selectinload(Dimension.components))
        .where(Dimension.id == dimension_id)
    )
    dim = dim_result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")

    component_scores_data = []
    for comp in dim.components:
        score_result = await db.execute(
            select(ComponentScore)
            .where(ComponentScore.engagement_id == engagement_id, ComponentScore.component_id == comp.id)
        )
        score = score_result.scalar_one_or_none()
        component_scores_data.append({
            "code": comp.code,
            "name": comp.name,
            "rating": score.rating.value if score else "not_rated",
            "confidence": score.confidence if score else None,
            "strengths": score.strengths if score else None,
            "gaps": score.gaps if score else None,
            "rationale": score.ai_rationale if score else None,
        })

    ai_result = await synthesize_dimension(dim.name, component_scores_data)

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
    await db.refresh(summary)
    return {"id": str(summary.id)}


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
    result = await db.execute(
        select(MessageThread)
        .where(MessageThread.engagement_id == engagement_id)
        .order_by(MessageThread.created_at.desc())
    )
    return result.scalars().all()


@router.get("/engagements/{engagement_id}/threads/{thread_id}/messages", response_model=list[MessageResponse])
async def list_messages(thread_id: uuid.UUID, engagement_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/engagements/{engagement_id}/threads/{thread_id}/messages", response_model=MessageResponse)
async def create_message(
    engagement_id: uuid.UUID,
    thread_id: uuid.UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    msg = Message(thread_id=thread_id, **data.model_dump())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


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

    result = await copilot_chat(
        school_name=eng.school_name,
        current_context=data.context,
        user_role=data.role,
        user_message=data.message,
        evidence_context=evidence_context,
        conversation_history=data.conversation_history,
    )

    return CopilotResponse(**result)
