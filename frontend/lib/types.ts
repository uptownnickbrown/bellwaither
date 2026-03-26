export interface SuccessCriterion {
  id: string;
  criterion_type: "core_action" | "progress_indicator";
  text: string;
  order: number;
}

export interface Component {
  id: string;
  code: string;
  name: string;
  description: string | null;
  evidence_guidance: string | null;
  criteria: SuccessCriterion[];
}

export interface Dimension {
  id: string;
  number: number;
  name: string;
  description: string | null;
  color: string | null;
  components: Component[];
}

// Engagement-scoped framework types
export interface EngagementCriterion {
  id: string;
  criterion_type: "core_action" | "progress_indicator";
  text: string;
  order: number;
}

export interface EngagementComponent {
  id: string;
  code: string;
  name: string;
  description: string | null;
  evidence_guidance: string | null;
  is_custom: number;
  source_component_id: string | null;
  criteria: EngagementCriterion[];
}

export interface EngagementDimension {
  id: string;
  number: string;
  name: string;
  description: string | null;
  color: string | null;
  is_custom: number;
  source_dimension_id: string | null;
  components: EngagementComponent[];
}

// School
export interface School {
  id: string;
  name: string;
  school_type: string | null;
  district: string | null;
  state: string | null;
  grade_levels: string | null;
  enrollment: string | null;
  description: string | null;
  created_at: string;
}

export interface Engagement {
  id: string;
  school_id: string | null;
  name: string;
  school_name: string;
  school_type: string | null;
  district: string | null;
  state: string | null;
  grade_levels: string | null;
  enrollment: number | null;
  stage: string;
  description: string | null;
  created_at: string;
}

export interface Evidence {
  id: string;
  engagement_id: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  evidence_type: string;
  title: string | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  processing_status: string;
}

export interface Extraction {
  id: string;
  evidence_id: string;
  summary: string;
  key_findings: string[] | null;
  structured_data: Record<string, unknown> | null;
  raw_text: string | null;
  model_used: string | null;
  created_at: string;
}

export interface EvidenceMapping {
  id: string;
  evidence_id: string;
  component_id: string;
  component_code: string | null;
  component_name: string | null;
  relevance_score: number;
  rationale: string | null;
}

export interface ComponentScore {
  id: string;
  engagement_id: string;
  component_id: string;
  rating: string;
  status: string;
  approved: boolean;
  strengths: string[] | null;
  gaps: string[] | null;
  contradictions: string[] | null;
  missing_evidence: string[] | null;
  ai_rationale: string | null;
  consultant_notes: string | null;
  evidence_count: number;
  stale: boolean;
  confidence: string | null;
  suggested_actions: string[] | null;
  follow_up_requests: string[] | null;
  model_used: string | null;
  scored_at: string;
}

export interface DimensionSummary {
  id: string;
  engagement_id: string;
  dimension_id: string;
  overall_assessment: string | null;
  patterns: string[] | null;
  compounding_risks: string[] | null;
  top_opportunities: string[] | null;
  leadership_attention: string[] | null;
  approved: boolean;
  generated_at: string;
}

export interface GlobalSummary {
  id: string;
  engagement_id: string;
  executive_summary: string | null;
  top_strengths: string[] | null;
  critical_gaps: string[] | null;
  strategic_priorities: string[] | null;
  resource_implications: string[] | null;
  recommended_next_steps: string[] | null;
  approved: boolean;
  generated_at: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  skipped_approved: number;
  skipped_no_evidence: number;
  failed: number;
  results: Array<{ status: string; component_code?: string; dimension?: string; error?: string }>;
}

export type EvidenceCountMap = Record<string, { total: number; new: number }>;

export interface NewEvidenceItem {
  evidence_id: string;
  title: string;
  filename: string;
  uploaded_at: string | null;
  relevance_score: number;
  relevant_excerpts: string[] | null;
}

export interface DataRequest {
  id: string;
  engagement_id: string;
  component_id: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  data_request_id: string;
  author: string;
  role: string | null;
  content: string;
  created_at: string;
}

export interface ActionPlan {
  id: string;
  engagement_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface ActionItem {
  id: string;
  action_plan_id: string;
  component_id: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  owner: string | null;
  status: string;
  priority_order: string | null;
  target_date: string | null;
}

export interface MessageThread {
  id: string;
  engagement_id: string;
  thread_type: string;
  reference_id: string | null;
  title: string | null;
  created_at: string;
  message_count: number;
  last_activity: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  author: string;
  role: string | null;
  content: string;
  mentions: string[] | null;
  attachments: { tool_results?: CopilotToolResult[] } | null;
  created_at: string;
}

export interface CopilotToolResult {
  tool: string;
  status: "success" | "error";
  data?: {
    id: string;
    title: string;
    description: string | null;
    rationale: string | null;
    priority: string;
    status: string;
    assigned_to: string | null;
    due_date: string | null;
    created_at: string | null;
    component_code: string | null;
  };
  error?: string;
}

export interface CopilotChatResponse {
  content: string;
  model_used: string | null;
  tool_results: CopilotToolResult[] | null;
}

export interface AIFeedbackItem {
  id: string;
  engagement_id: string;
  target_type: string;
  target_id: string;
  rating: string;
  comment: string | null;
  created_at: string;
}

// Onboarding
export interface OnboardingLearned {
  identity?: string;
  programs?: string[];
  priorities?: string[];
  challenges?: string[];
  custom_needs?: string[];
  skip_candidates?: string[];
}

export interface OnboardingAIResponse {
  status: "interviewing" | "proposal";
  message?: string;
  turn?: number;
  learned?: OnboardingLearned;
  framework?: {
    dimensions: OnboardingDimension[];
  };
  rationale?: string;
  model_used?: string;
}

export interface OnboardingDimension {
  number: string;
  name: string;
  description?: string;
  color?: string;
  is_custom: boolean;
  components: OnboardingComponent[];
}

export interface OnboardingComponent {
  code: string;
  name: string;
  description?: string;
  is_custom: boolean;
  criteria: OnboardingCriterion[];
}

export interface OnboardingCriterion {
  criterion_type: "core_action" | "progress_indicator";
  text: string;
}

export type UserRole = "consultant" | "school_admin";

export const RATING_CONFIG = {
  excelling: { label: "Excelling", color: "#065F46", bg: "#D1FAE5", textClass: "text-emerald-800" },
  meeting_expectations: { label: "Meeting Expectations", color: "#3730A3", bg: "#E0E7FF", textClass: "text-indigo-800" },
  developing: { label: "Developing", color: "#92400E", bg: "#FEF3C7", textClass: "text-amber-800" },
  needs_improvement: { label: "Needs Improvement", color: "#991B1B", bg: "#FEE2E2", textClass: "text-red-800" },
  not_rated: { label: "Not Rated", color: "#4B5563", bg: "#F3F4F6", textClass: "text-gray-600" },
} as const;

export const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#9CA3AF" },
  in_progress: { label: "In Progress", color: "#6366F1" },
  submitted: { label: "Submitted", color: "#F59E0B" },
  accepted: { label: "Accepted", color: "#059669" },
  needs_revision: { label: "Needs Revision", color: "#EF4444" },
} as const;

export const PRIORITY_CONFIG = {
  high: { label: "High", color: "#EF4444" },
  medium: { label: "Medium", color: "#F59E0B" },
  low: { label: "Low", color: "#6B7280" },
} as const;

export interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_label: string | null;
  detail: string | null;
  created_at: string;
}
