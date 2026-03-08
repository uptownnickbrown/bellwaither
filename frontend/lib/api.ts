const API_BASE = "/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Framework
export const getFramework = () => fetchApi<import("./types").Dimension[]>("/framework");

// Engagements
export const getEngagements = () => fetchApi<import("./types").Engagement[]>("/engagements");
export const getEngagement = (id: string) => fetchApi<import("./types").Engagement>(`/engagements/${id}`);

// Evidence
export const getEvidence = (engId: string) => fetchApi<import("./types").Evidence[]>(`/engagements/${engId}/evidence`);
export const getExtractions = (engId: string, evId: string) => fetchApi<import("./types").Extraction[]>(`/engagements/${engId}/evidence/${evId}/extractions`);
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

// Scores
export const getScores = (engId: string) => fetchApi<import("./types").ComponentScore[]>(`/engagements/${engId}/scores`);
export const assessComponent = (engId: string, compId: string) =>
  fetchApi<{ id: string; rating: string; confidence: string }>(`/engagements/${engId}/scores/${compId}/assess`, { method: "POST" });

// Dimension summaries
export const getDimensionSummaries = (engId: string) => fetchApi<import("./types").DimensionSummary[]>(`/engagements/${engId}/dimension-summaries`);
export const synthesizeDimension = (engId: string, dimId: string) =>
  fetchApi<{ id: string }>(`/engagements/${engId}/dimensions/${dimId}/synthesize`, { method: "POST" });

// Global summary
export const getGlobalSummary = (engId: string) => fetchApi<import("./types").GlobalSummary>(`/engagements/${engId}/global-summary`);
export const generateGlobalSummary = (engId: string) =>
  fetchApi<{ id: string }>(`/engagements/${engId}/global-summary`, { method: "POST" });

// Data requests
export const getDataRequests = (engId: string) => fetchApi<import("./types").DataRequest[]>(`/engagements/${engId}/data-requests`);
export const createDataRequest = (engId: string, data: Record<string, unknown>) =>
  fetchApi<import("./types").DataRequest>(`/engagements/${engId}/data-requests`, { method: "POST", body: JSON.stringify(data) });
export const getComments = (engId: string, reqId: string) => fetchApi<import("./types").Comment[]>(`/engagements/${engId}/data-requests/${reqId}/comments`);
export const createComment = (engId: string, reqId: string, data: { author: string; role?: string; content: string }) =>
  fetchApi<import("./types").Comment>(`/engagements/${engId}/data-requests/${reqId}/comments`, { method: "POST", body: JSON.stringify(data) });

// Action plans
export const getActionPlans = (engId: string) => fetchApi<import("./types").ActionPlan[]>(`/engagements/${engId}/action-plans`);
export const getActionItems = (engId: string, planId: string) => fetchApi<import("./types").ActionItem[]>(`/engagements/${engId}/action-plans/${planId}/items`);

// Messaging
export const getThreads = (engId: string) => fetchApi<import("./types").MessageThread[]>(`/engagements/${engId}/threads`);
export const getMessages = (engId: string, threadId: string) => fetchApi<import("./types").Message[]>(`/engagements/${engId}/threads/${threadId}/messages`);
export const sendMessage = (engId: string, threadId: string, data: { author: string; role?: string; content: string }) =>
  fetchApi<import("./types").Message>(`/engagements/${engId}/threads/${threadId}/messages`, { method: "POST", body: JSON.stringify(data) });

// Copilot
export const chatWithCopilot = (engId: string, data: { message: string; context?: string; role?: string; conversation_history?: Array<{role: string; content: string}> }) =>
  fetchApi<{ content: string; model_used: string | null }>(`/engagements/${engId}/copilot`, { method: "POST", body: JSON.stringify(data) });
