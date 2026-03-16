"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DataRequest, Comment, UserRole } from "@/lib/types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/types";
import { getDataRequests, getComments, createComment, createDataRequest, deleteDataRequest, updateDataRequest } from "@/lib/api";
import EditableText from "@/components/EditableText";
import {
  ClipboardList, Plus, Send, MessageSquare,
  Clock, CheckCircle2, AlertCircle, Upload,
  ChevronRight, ArrowUpRight, Trash2,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Props {
  engagementId: string;
  role: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

export default function DataRequestsView({ engagementId, role, onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<DataRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Track pending nav target so loadRequests can pick the right default
  const navTargetRef = useRef(navTargetId);
  navTargetRef.current = navTargetId;

  const loadRequests = useCallback(() => {
    getDataRequests(engagementId).then((r) => {
      setRequests(r);
      if (!selectedRequest && r.length > 0) {
        if (navTargetRef.current) {
          const target = r.find((req) => req.id === navTargetRef.current);
          if (target) { setSelectedRequest(target); return; }
        }
        setSelectedRequest(r[0]);
      }
    });
  }, [engagementId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Handle incoming navigation target
  useEffect(() => {
    if (navTargetId && requests.length > 0) {
      const target = requests.find((r) => r.id === navTargetId);
      if (target) {
        setSelectedRequest(target);
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, requests, onNavTargetConsumed]);

  useEffect(() => {
    if (selectedRequest) {
      getComments(engagementId, selectedRequest.id).then(setComments);
    }
  }, [selectedRequest, engagementId]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedRequest) return;
    const author = role === "consultant" ? "Sarah Chen" : "Tom Nakamura";
    await createComment(engagementId, selectedRequest.id, {
      author,
      role: role === "consultant" ? "consultant" : "school_admin",
      content: newComment,
    });
    setNewComment("");
    getComments(engagementId, selectedRequest.id).then(setComments);
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    setDeleting(true);
    try {
      await deleteDataRequest(engagementId, requestToDelete.id);
      if (selectedRequest?.id === requestToDelete.id) {
        setSelectedRequest(null);
        setComments([]);
      }
      loadRequests();
      toast(`Deleted "${requestToDelete.title}"`, "success");
    } catch {
      toast("Failed to delete data request", "error");
    } finally {
      setDeleting(false);
      setRequestToDelete(null);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    if (!selectedRequest) return;
    await updateDataRequest(engagementId, selectedRequest.id, { [field]: value });
    const updated = { ...selectedRequest, [field]: value };
    setSelectedRequest(updated);
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  };

  const cyclePriority = async () => {
    if (!selectedRequest || role !== "consultant") return;
    const cycle = ["low", "medium", "high"];
    const idx = cycle.indexOf(selectedRequest.priority);
    const next = cycle[(idx + 1) % cycle.length];
    await handleUpdateField("priority", next);
  };

  const cycleStatus = async () => {
    if (!selectedRequest || role !== "consultant") return;
    const cycle = ["pending", "in_progress", "submitted", "accepted", "needs_revision"];
    const idx = cycle.indexOf(selectedRequest.status);
    const next = cycle[(idx + 1) % cycle.length];
    await handleUpdateField("status", next);
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const submittedCount = requests.filter((r) => r.status === "submitted").length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Data Requests</h1>
          <p className="text-sm text-gray-500">{requests.length} requests · {pendingCount} pending · {submittedCount} submitted</p>
        </div>
        {role === "consultant" && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Request List */}
        <div className="col-span-5">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
            {requests.map((req) => {
              const statusConf = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const priorityConf = PRIORITY_CONFIG[req.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`group w-full text-left p-4 hover:bg-gray-50 transition cursor-pointer ${
                    selectedRequest?.id === req.id ? "bg-indigo-50/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{req.title}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {role === "consultant" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRequestToDelete(req); }}
                          className="hidden group-hover:flex w-7 h-7 items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: statusConf.color + "15", color: statusConf.color }}
                      >
                        {statusConf.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: priorityConf.color + "15", color: priorityConf.color }}
                    >
                      {priorityConf.label}
                    </span>
                    {req.assigned_to && <span className="text-xs text-gray-400">→ {req.assigned_to}</span>}
                  </div>
                </div>
              );
            })}
            {requests.length === 0 && (
              <div className="p-8 text-center">
                <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No data requests yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Request Detail + Thread */}
        <div className="col-span-7">
          {selectedRequest ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {/* Request Header */}
              <div className="p-5 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between">
                  {role === "consultant" ? (
                    <EditableText
                      value={selectedRequest.title}
                      className="text-base font-semibold text-gray-900"
                      onSave={(v) => handleUpdateField("title", v)}
                    />
                  ) : (
                    <h2 className="text-base font-semibold text-gray-900">{selectedRequest.title}</h2>
                  )}
                  {role === "consultant" && (
                    <button
                      onClick={() => setRequestToDelete(selectedRequest)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition flex-shrink-0"
                      title="Delete request"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {(selectedRequest.description || role === "consultant") && (
                  <div className="mt-2">
                    {role === "consultant" ? (
                      <EditableText
                        value={selectedRequest.description || ""}
                        multiline
                        className="text-sm text-gray-600"
                        placeholder="Add a description..."
                        onSave={(v) => handleUpdateField("description", v)}
                      />
                    ) : selectedRequest.description ? (
                      <p className="text-sm text-gray-600">{selectedRequest.description}</p>
                    ) : null}
                  </div>
                )}
                {(selectedRequest.rationale || role === "consultant") && (
                  <div className="mt-3 bg-amber-50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-amber-700 mb-1">Why this is needed</h4>
                    {role === "consultant" ? (
                      <EditableText
                        value={selectedRequest.rationale || ""}
                        multiline
                        className="text-xs text-amber-600"
                        placeholder="Add a rationale..."
                        onSave={(v) => handleUpdateField("rationale", v)}
                      />
                    ) : (
                      <p className="text-xs text-amber-600">{selectedRequest.rationale}</p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="text-xs text-gray-400">Created by: {selectedRequest.created_by}</span>
                  {role === "consultant" ? (
                    <span className="text-xs text-gray-400">
                      Assigned to:{" "}
                      <EditableText
                        value={selectedRequest.assigned_to || ""}
                        className="text-xs text-gray-600 font-medium inline"
                        placeholder="Unassigned"
                        onSave={(v) => handleUpdateField("assigned_to", v)}
                      />
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Assigned to: {selectedRequest.assigned_to}</span>
                  )}
                  <span className="text-xs text-gray-400">{new Date(selectedRequest.created_at).toLocaleDateString()}</span>
                  {role === "consultant" && (
                    <>
                      <button
                        onClick={cyclePriority}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition"
                        style={{
                          backgroundColor: (PRIORITY_CONFIG[selectedRequest.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium).color + "15",
                          color: (PRIORITY_CONFIG[selectedRequest.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium).color,
                        }}
                        title="Click to cycle priority"
                      >
                        {(PRIORITY_CONFIG[selectedRequest.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium).label}
                      </button>
                      <button
                        onClick={cycleStatus}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition"
                        style={{
                          backgroundColor: (STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending).color + "15",
                          color: (STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending).color,
                        }}
                        title="Click to cycle status"
                      >
                        {(STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending).label}
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {selectedRequest.component_id && (
                    <button
                      onClick={() => onNavigate?.("scoring", selectedRequest.component_id!)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
                    >
                      View Component in Diagnostic
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate?.("messages", selectedRequest.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
                  >
                    View in Messages
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No messages yet. Start the conversation.</p>
                ) : (
                  comments.map((comment) => {
                    const isConsultant = comment.role === "consultant" || comment.role === "analyst";
                    return (
                      <div key={comment.id} className={`flex ${isConsultant ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-xl p-3 ${
                          isConsultant ? "bg-indigo-50" : "bg-gray-50"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-700">{comment.author}</span>
                            <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={!newComment.trim()}
                    className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Select a data request to view details and discussion thread.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        onConfirm={handleDeleteRequest}
        title="Delete Data Request"
        description={`This will permanently delete "${requestToDelete?.title}" and all its comments. Evidence linked to this request will not be deleted.`}
        loading={deleting}
      />
    </div>
  );
}
