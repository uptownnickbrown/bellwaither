const API_BASE = "/api";

async function fetchApi<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, ...fetchOpts } = options || {};
  const controller = new AbortController();
  const timeout = timeoutMs || 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...fetchOpts?.headers },
      signal: controller.signal,
      ...fetchOpts,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch { /* no JSON body */ }
      throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Framework (canonical SQF library)
export const getFramework = () => fetchApi<import("./types").Dimension[]>("/framework");

// Engagement-scoped framework
export const getEngagementFramework = (engId: string) =>
  fetchApi<import("./types").EngagementDimension[]>(`/engagements/${engId}/framework`);

// Schools
export const getSchools = () => fetchApi<import("./types").School[]>("/schools");
export const getSchool = (id: string) => fetchApi<import("./types").School>(`/schools/${id}`);
export const createSchool = (data: { name: string; school_type?: string; district?: string; state?: string; grade_levels?: string; enrollment?: string }) =>
  fetchApi<import("./types").School>("/schools", { method: "POST", body: JSON.stringify(data) });
export const getSchoolEngagements = (schoolId: string) =>
  fetchApi<import("./types").Engagement[]>(`/schools/${schoolId}/engagements`);

// Engagements
export const getEngagements = () => fetchApi<import("./types").Engagement[]>("/engagements");
export const getEngagement = (id: string) => fetchApi<import("./types").Engagement>(`/engagements/${id}`);

// Evidence
export const getEvidence = (engId: string) => fetchApi<import("./types").Evidence[]>(`/engagements/${engId}/evidence`);
export const getExtractions = (engId: string, evId: string) => fetchApi<import("./types").Extraction[]>(`/engagements/${engId}/evidence/${evId}/extractions`);
export const getEvidenceMappings = (engId: string, evId: string) => fetchApi<import("./types").EvidenceMapping[]>(`/engagements/${engId}/evidence/${evId}/mappings`);
export const getEvidenceDownloadUrl = (engId: string, evId: string) => `${API_BASE}/engagements/${engId}/evidence/${evId}/download`;
export const uploadEvidence = async (engId: string, file: File, evidenceType: string, uploadedBy: string) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/engagements/${engId}/evidence?evidence_type=${evidenceType}&uploaded_by=${uploadedBy}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

// Inline edit: Extractions
export const updateExtraction = (engId: string, evId: string, extId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/evidence/${evId}/extractions/${extId}`, { method: "PATCH", body: JSON.stringify(data) });

// Evidence update
export const updateEvidence = (engId: string, evId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/evidence/${evId}`, { method: "PATCH", body: JSON.stringify(data) });

// Evidence delete
export const deleteEvidence = (engId: string, evId: string) =>
  fetchApi<{ ok: boolean; stale_scores: string[] }>(`/engagements/${engId}/evidence/${evId}`, { method: "DELETE" });

// Scores
export const getScores = (engId: string) => fetchApi<import("./types").ComponentScore[]>(`/engagements/${engId}/scores`);
export const assessComponent = (engId: string, compId: string) =>
  fetchApi<{ id: string; rating: string; confidence: string }>(`/engagements/${engId}/scores/${compId}/assess`, { method: "POST" });
export const updateScore = (engId: string, scoreId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/scores/${scoreId}`, { method: "PATCH", body: JSON.stringify(data) });

// Approval toggles
export const toggleScoreApproval = (engId: string, scoreId: string, approved: boolean) =>
  fetchApi<{ ok: boolean; approved: boolean }>(`/engagements/${engId}/scores/${scoreId}/approve`, { method: "PATCH", body: JSON.stringify({ approved }) });
export const toggleDimensionSummaryApproval = (engId: string, summaryId: string, approved: boolean) =>
  fetchApi<{ ok: boolean; approved: boolean }>(`/engagements/${engId}/dimension-summaries/${summaryId}/approve`, { method: "PATCH", body: JSON.stringify({ approved }) });
export const toggleGlobalSummaryApproval = (engId: string, summaryId: string, approved: boolean) =>
  fetchApi<{ ok: boolean; approved: boolean }>(`/engagements/${engId}/global-summary/${summaryId}/approve`, { method: "PATCH", body: JSON.stringify({ approved }) });

// Evidence counts per component
export const getEvidenceCounts = (engId: string) =>
  fetchApi<import("./types").EvidenceCountMap>(`/engagements/${engId}/evidence-counts`);

// New evidence since last score
export const getNewEvidence = (engId: string, compId: string) =>
  fetchApi<import("./types").NewEvidenceItem[]>(`/engagements/${engId}/scores/${compId}/new-evidence`);

// Evidence IDs for a component
export const getComponentEvidenceIds = (engId: string, compId: string) =>
  fetchApi<string[]>(`/engagements/${engId}/components/${compId}/evidence-ids`);

// Batch generation
export const batchAssessComponents = (engId: string) =>
  fetchApi<import("./types").BatchProgress>(`/engagements/${engId}/batch/assess-components`, { method: "POST" });
export const batchSynthesizeDimensions = (engId: string) =>
  fetchApi<import("./types").BatchProgress>(`/engagements/${engId}/batch/synthesize-dimensions`, { method: "POST" });
export const batchGenerateGlobal = (engId: string) =>
  fetchApi<import("./types").BatchProgress>(`/engagements/${engId}/batch/generate-global`, { method: "POST" });

// Dimension summaries
export const getDimensionSummaries = (engId: string) => fetchApi<import("./types").DimensionSummary[]>(`/engagements/${engId}/dimension-summaries`);
export const synthesizeDimension = (engId: string, dimId: string) =>
  fetchApi<{ id: string }>(`/engagements/${engId}/dimensions/${dimId}/synthesize`, { method: "POST" });
export const updateDimensionSummary = (engId: string, summaryId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/dimension-summaries/${summaryId}`, { method: "PATCH", body: JSON.stringify(data) });

// Global summary
export const getGlobalSummary = (engId: string) => fetchApi<import("./types").GlobalSummary>(`/engagements/${engId}/global-summary`);
export const generateGlobalSummary = (engId: string) =>
  fetchApi<{ id: string }>(`/engagements/${engId}/global-summary`, { method: "POST" });
export const updateGlobalSummary = (engId: string, summaryId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/global-summary/${summaryId}`, { method: "PATCH", body: JSON.stringify(data) });

// Data requests
export const getDataRequests = (engId: string) => fetchApi<import("./types").DataRequest[]>(`/engagements/${engId}/data-requests`);
export const createDataRequest = (engId: string, data: Record<string, unknown>) =>
  fetchApi<import("./types").DataRequest>(`/engagements/${engId}/data-requests`, { method: "POST", body: JSON.stringify(data) });
export const getComments = (engId: string, reqId: string) => fetchApi<import("./types").Comment[]>(`/engagements/${engId}/data-requests/${reqId}/comments`);
export const createComment = (engId: string, reqId: string, data: { author: string; role?: string; content: string }) =>
  fetchApi<import("./types").Comment>(`/engagements/${engId}/data-requests/${reqId}/comments`, { method: "POST", body: JSON.stringify(data) });

// Data request update
export const updateDataRequest = (engId: string, reqId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/data-requests/${reqId}`, { method: "PATCH", body: JSON.stringify(data) });

// Data request delete
export const deleteDataRequest = (engId: string, reqId: string) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/data-requests/${reqId}`, { method: "DELETE" });

// Action plans
export const getActionPlans = (engId: string) => fetchApi<import("./types").ActionPlan[]>(`/engagements/${engId}/action-plans`);
export const getActionItems = (engId: string, planId: string) => fetchApi<import("./types").ActionItem[]>(`/engagements/${engId}/action-plans/${planId}/items`);
export const updateActionItem = (engId: string, planId: string, itemId: string, data: Record<string, unknown>) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/action-plans/${planId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) });

// Action item delete
export const deleteActionItem = (engId: string, planId: string, itemId: string) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/action-plans/${planId}/items/${itemId}`, { method: "DELETE" });

// Messaging
export const getThreads = (engId: string) => fetchApi<import("./types").MessageThread[]>(`/engagements/${engId}/threads`);
export const createThread = (engId: string, data: { title: string; thread_type?: string }) =>
  fetchApi<import("./types").MessageThread>(`/engagements/${engId}/threads`, { method: "POST", body: JSON.stringify(data) });
export const getMessages = (engId: string, threadId: string) => fetchApi<import("./types").Message[]>(`/engagements/${engId}/threads/${threadId}/messages`);
export const sendMessage = (engId: string, threadId: string, data: { author: string; role?: string; content: string; mentions?: string[]; attachments?: Record<string, unknown> }) =>
  fetchApi<import("./types").Message>(`/engagements/${engId}/threads/${threadId}/messages`, { method: "POST", body: JSON.stringify(data) });

// Thread and message delete
export const deleteThread = (engId: string, threadId: string) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/threads/${threadId}`, { method: "DELETE" });
export const deleteMessage = (engId: string, threadId: string, msgId: string) =>
  fetchApi<{ ok: boolean }>(`/engagements/${engId}/threads/${threadId}/messages/${msgId}`, { method: "DELETE" });

// Copilot
export const chatWithCopilot = (engId: string, data: { message: string; context?: string; role?: string; conversation_history?: Array<{role: string; content: string}> }) =>
  fetchApi<import("./types").CopilotChatResponse>(`/engagements/${engId}/copilot`, { method: "POST", body: JSON.stringify(data) });

// Export
export const getExportUrl = (engId: string) => `${API_BASE}/engagements/${engId}/export`;

// Onboarding
// Onboarding uses custom API routes (not the rewrite proxy) for longer timeouts
export const startOnboarding = (data: { name: string; school_type?: string; district?: string; state?: string; grade_levels?: string; enrollment?: string }) =>
  fetchApi<{ school_id: string; school: import("./types").School; ai_response: import("./types").OnboardingAIResponse }>("/onboarding/start", { method: "POST", body: JSON.stringify(data), timeoutMs: 60000 });
export const onboardingRespond = (schoolId: string, message: string) =>
  fetchApi<{ ai_response: import("./types").OnboardingAIResponse }>(`/onboarding/${schoolId}/respond`, { method: "POST", body: JSON.stringify({ message }), timeoutMs: 120000 });
export const finalizeOnboarding = (schoolId: string, data: { framework: unknown; engagement_name?: string; strategic_priorities?: string[]; programs?: string[] }) =>
  fetchApi<{ engagement_id: string; school_id: string; engagement: import("./types").Engagement }>(`/onboarding/${schoolId}/finalize`, { method: "POST", body: JSON.stringify(data) });

// Activity Log
export const getActivityLog = (engId: string, limit = 50) =>
  fetchApi<import("./types").ActivityEntry[]>(`/engagements/${engId}/activity?limit=${limit}`);

// AI Feedback
export const createAIFeedback = (engId: string, data: { target_type: string; target_id: string; rating: string; comment?: string }) =>
  fetchApi<import("./types").AIFeedbackItem>(`/engagements/${engId}/feedback`, { method: "POST", body: JSON.stringify(data) });
export const getAIFeedback = (engId: string, targetType?: string, targetId?: string) => {
  const params = new URLSearchParams();
  if (targetType) params.set("target_type", targetType);
  if (targetId) params.set("target_id", targetId);
  const qs = params.toString();
  return fetchApi<import("./types").AIFeedbackItem[]>(`/engagements/${engId}/feedback${qs ? `?${qs}` : ""}`);
};
