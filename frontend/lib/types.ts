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

export interface Engagement {
  id: string;
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

export type EvidenceCountMap = Record<string, number>;

export interface DataRequest {
  id: string;
  engagement_id: string;
  component_id: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  status: string;
  priority: string;
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

export type UserRole = "consultant" | "school_admin";

export const RATING_CONFIG = {
  excelling: { label: "Excelling", color: "#059669", bg: "#ECFDF5", textClass: "text-emerald-700" },
  meeting_expectations: { label: "Meeting Expectations", color: "#6366F1", bg: "#EEF2FF", textClass: "text-indigo-700" },
  developing: { label: "Developing", color: "#F59E0B", bg: "#FFFBEB", textClass: "text-amber-700" },
  needs_improvement: { label: "Needs Improvement", color: "#EF4444", bg: "#FEF2F2", textClass: "text-red-700" },
  not_rated: { label: "Not Rated", color: "#9CA3AF", bg: "#F9FAFB", textClass: "text-gray-500" },
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
