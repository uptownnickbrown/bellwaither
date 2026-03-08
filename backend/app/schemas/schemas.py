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
    model_used: str | None = None
    created_at: datetime


# --- Scoring ---
class ComponentScoreResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: UUID
    engagement_id: UUID
    component_id: UUID
    rating: str
    status: str
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
    generated_at: datetime

    class Config:
        from_attributes = True


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


# --- Messaging ---
class ThreadResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    thread_type: str
    title: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    author: str
    role: str | None = None
    content: str


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    author: str
    role: str | None = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Copilot ---
class CopilotRequest(BaseModel):
    message: str
    context: str = "dashboard"
    role: str = "consultant"
    conversation_history: list[dict] = []


class CopilotResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    content: str
    model_used: str | None = None
