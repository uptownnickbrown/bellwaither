"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


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
    description: Optional[str] = None
    evidence_guidance: Optional[str] = None
    criteria: list[SuccessCriterionResponse] = []

    class Config:
        from_attributes = True


class DimensionResponse(BaseModel):
    id: UUID
    number: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    components: list[ComponentResponse] = []

    class Config:
        from_attributes = True


# --- Engagement ---
class EngagementCreate(BaseModel):
    name: str
    school_name: str
    school_type: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    grade_levels: Optional[str] = None
    enrollment: Optional[int] = None
    description: Optional[str] = None


class EngagementResponse(BaseModel):
    id: UUID
    name: str
    school_name: str
    school_type: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    grade_levels: Optional[str] = None
    enrollment: Optional[int] = None
    stage: str
    description: Optional[str] = None
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
    title: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime
    processing_status: str

    class Config:
        from_attributes = True


class ExtractionResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: UUID
    evidence_id: UUID
    summary: str
    key_findings: Optional[list] = None
    structured_data: Optional[dict] = None
    model_used: Optional[str] = None
    created_at: datetime


# --- Scoring ---
class ComponentScoreResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: UUID
    engagement_id: UUID
    component_id: UUID
    rating: str
    status: str
    strengths: Optional[list] = None
    gaps: Optional[list] = None
    contradictions: Optional[list] = None
    missing_evidence: Optional[list] = None
    ai_rationale: Optional[str] = None
    consultant_notes: Optional[str] = None
    evidence_count: int
    confidence: Optional[str] = None
    suggested_actions: Optional[list] = None
    follow_up_requests: Optional[list] = None
    model_used: Optional[str] = None
    scored_at: datetime


class DimensionSummaryResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    dimension_id: UUID
    overall_assessment: Optional[str] = None
    patterns: Optional[list] = None
    compounding_risks: Optional[list] = None
    top_opportunities: Optional[list] = None
    leadership_attention: Optional[list] = None
    generated_at: datetime

    class Config:
        from_attributes = True


class GlobalSummaryResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    executive_summary: Optional[str] = None
    top_strengths: Optional[list] = None
    critical_gaps: Optional[list] = None
    strategic_priorities: Optional[list] = None
    resource_implications: Optional[list] = None
    recommended_next_steps: Optional[list] = None
    generated_at: datetime

    class Config:
        from_attributes = True


# --- Data Requests ---
class DataRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    rationale: Optional[str] = None
    component_id: Optional[UUID] = None
    priority: str = "medium"
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None


class DataRequestResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    component_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    rationale: Optional[str] = None
    status: str
    priority: str
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    author: str
    role: Optional[str] = None
    content: str


class CommentResponse(BaseModel):
    id: UUID
    data_request_id: UUID
    author: str
    role: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Action Plans ---
class ActionPlanResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActionItemResponse(BaseModel):
    id: UUID
    action_plan_id: UUID
    component_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    rationale: Optional[str] = None
    owner: Optional[str] = None
    status: str
    priority_order: Optional[str] = None
    target_date: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Messaging ---
class ThreadResponse(BaseModel):
    id: UUID
    engagement_id: UUID
    thread_type: str
    title: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    author: str
    role: Optional[str] = None
    content: str


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    author: str
    role: Optional[str] = None
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
    model_used: Optional[str] = None
