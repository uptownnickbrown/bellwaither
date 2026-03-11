"""Pydantic schemas for API request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# --- Framework ---
class SuccessCriterionResponse(BaseModel):
    id: UUID
    criterion_type: str
    text: str
    order: int

    class Config:
        from_attributes = True


class ComponentResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None = None
    evidence_guidance: str | None = None
    criteria: list[SuccessCriterionResponse] = []

    class Config:
        from_attributes = True


class DimensionResponse(BaseModel):
    id: UUID
    number: int
    name: str
    description: str | None = None
    color: str | None = None
    components: list[ComponentResponse] = []

    class Config:
        from_attributes = True


# --- Engagement ---
class EngagementCreate(BaseModel):
    name: str
    school_name: str
    school_type: str | None = None
    district: str | None = None
    state: str | None = None
    grade_levels: str | None = None
    enrollment: int | None = None
    description: str | None = None


class EngagementResponse(BaseModel):
    id: UUID
    name: str
    school_name: str
    school_type: str | None = None
    district: str | None = None
    state: str | None = None
    grade_levels: str | None = None
    enrollment: int | None = None
    stage: str
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Evidence ---
class EvidenceResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    filename: str
    file_type: str
    file_size: int | None = None
    evidence_type: str
    title: str | None = None
    description: str | None = None
    uploaded_by: str | None = None
    uploaded_at: datetime
    processing_status: str

    class Config:
        from_attributes = True


class ExtractionResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: UUID
    evidence_id: UUID
    summary: str
    key_findings: list | None = None
    structured_data: dict | None = None
    raw_text: str | None = None
    model_used: str | None = None
    created_at: datetime


class EvidenceMappingResponse(BaseModel):
    id: UUID
    evidence_id: UUID
    component_id: UUID
    component_code: str | None = None
    component_name: str | None = None
    relevance_score: float
    rationale: str | None = None

    class Config:
        from_attributes = True


# --- Scoring ---
class ComponentScoreResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: UUID
    engagement_id: UUID
    component_id: UUID
    rating: str
    status: str
    approved: bool = False
    strengths: list | None = None
    gaps: list | None = None
    contradictions: list | None = None
    missing_evidence: list | None = None
    ai_rationale: str | None = None
    consultant_notes: str | None = None
    evidence_count: int
    confidence: str | None = None
    suggested_actions: list | None = None
    follow_up_requests: list | None = None
    model_used: str | None = None
    scored_at: datetime


class DimensionSummaryResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    dimension_id: UUID
    overall_assessment: str | None = None
    patterns: list | None = None
    compounding_risks: list | None = None
    top_opportunities: list | None = None
    leadership_attention: list | None = None
    approved: bool = False
    generated_at: datetime

    class Config:
        from_attributes = True


class GlobalSummaryResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    executive_summary: str | None = None
    top_strengths: list | None = None
    critical_gaps: list | None = None
    strategic_priorities: list | None = None
    resource_implications: list | None = None
    recommended_next_steps: list | None = None
    approved: bool = False
    generated_at: datetime

    class Config:
        from_attributes = True


# --- Batch/Approval Schemas ---
class BatchProgressResponse(BaseModel):
    """Response for batch generation progress."""
    total: int
    completed: int
    skipped_approved: int
    skipped_no_evidence: int
    failed: int
    results: list[dict] = []


class ApprovalToggleRequest(BaseModel):
    approved: bool


class EvidenceCountResponse(BaseModel):
    """Per-component evidence mapping counts."""
    component_id: UUID
    evidence_count: int


# --- Data Requests ---
class DataRequestCreate(BaseModel):
    title: str
    description: str | None = None
    rationale: str | None = None
    component_id: UUID | None = None
    priority: str = "medium"
    assigned_to: str | None = None
    created_by: str | None = None


class DataRequestResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    component_id: UUID | None = None
    title: str
    description: str | None = None
    rationale: str | None = None
    status: str
    priority: str
    assigned_to: str | None = None
    created_by: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    author: str
    role: str | None = None
    content: str


class CommentResponse(BaseModel):
    id: UUID
    data_request_id: UUID
    author: str
    role: str | None = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Action Plans ---
class ActionPlanResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    title: str
    description: str | None = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActionItemResponse(BaseModel):
    id: UUID
    action_plan_id: UUID
    component_id: UUID | None = None
    title: str
    description: str | None = None
    rationale: str | None = None
    owner: str | None = None
    status: str
    priority_order: str | None = None
    target_date: datetime | None = None

    class Config:
        from_attributes = True


# --- Inline Edit Schemas ---
class ExtractionUpdate(BaseModel):
    summary: str | None = None
    key_findings: list[str] | None = None


class ComponentScoreUpdate(BaseModel):
    strengths: list[str] | None = None
    gaps: list[str] | None = None
    contradictions: list[str] | None = None
    ai_rationale: str | None = None
    suggested_actions: list[str] | None = None
    consultant_notes: str | None = None


class DimensionSummaryUpdate(BaseModel):
    overall_assessment: str | None = None
    patterns: list[str] | None = None
    compounding_risks: list[str] | None = None
    top_opportunities: list[str] | None = None
    leadership_attention: list[str] | None = None


class GlobalSummaryUpdate(BaseModel):
    executive_summary: str | None = None
    top_strengths: list[str] | None = None
    critical_gaps: list[str] | None = None
    strategic_priorities: list[str] | None = None
    resource_implications: list[str] | None = None
    recommended_next_steps: list[str] | None = None


class ActionItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    rationale: str | None = None
    owner: str | None = None
    status: str | None = None


# --- Messaging ---
class ThreadCreate(BaseModel):
    title: str
    thread_type: str = "general"


class ThreadResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    thread_type: str
    reference_id: UUID | None = None
    title: str | None = None
    message_count: int = 0
    last_activity: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    author: str
    role: str | None = None
    content: str
    mentions: list[str] | None = None


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    author: str
    role: str | None = None
    content: str
    mentions: list[str] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Copilot ---
class CopilotRequest(BaseModel):
    message: str
    context: str = "dashboard"
    role: str = "consultant"
    conversation_history: list[dict] = []


class CopilotToolResult(BaseModel):
    tool: str
    status: str
    data: dict | None = None
    error: str | None = None


class CopilotResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    content: str
    model_used: str | None = None
    tool_results: list[CopilotToolResult] | None = None


# --- AI Feedback ---
class AIFeedbackCreate(BaseModel):
    target_type: str  # component_score, dimension_summary, global_summary, extraction
    target_id: UUID
    rating: str  # "up" or "down"
    comment: str | None = None


class AIFeedbackResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    target_type: str
    target_id: UUID
    rating: str
    comment: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
