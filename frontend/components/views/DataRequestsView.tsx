"use client";

import { useEffect, useState, useCallback } from "react";
import type { DataRequest, Comment, UserRole } from "@/lib/types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/types";
import { getDataRequests, getComments, createComment, createDataRequest } from "@/lib/api";
import {
  ClipboardList, Plus, Send, MessageSquare,
  Clock, CheckCircle2, AlertCircle, Upload,
  ChevronRight, ArrowUpRight,
} from "lucide-react";

interface Props {
  engagementId: string;
  role: UserRole;
}

export default function DataRequestsView({ engagementId, role }: Props) {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadRequests = useCallback(() => {
    getDataRequests(engagementId).then((r) => {
      setRequests(r);
      if (!selectedRequest && r.length > 0) setSelectedRequest(r[0]);
    });
  }, [engagementId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

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
                <button
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                    selectedRequest?.id === req.id ? "bg-indigo-50/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{req.title}</h3>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusConf.color + "15", color: statusConf.color }}
                    >
                      {statusConf.label}
                    </span>
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
                </button>
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
                <h2 className="text-base font-semibold text-gray-900">{selectedRequest.title}</h2>
                {selectedRequest.description && (
                  <p className="text-sm text-gray-600 mt-2">{selectedRequest.description}</p>
                )}
                {selectedRequest.rationale && (
                  <div className="mt-3 bg-amber-50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-amber-700 mb-1">Why this is needed</h4>
                    <p className="text-xs text-amber-600">{selectedRequest.rationale}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-gray-400">Created by: {selectedRequest.created_by}</span>
                  <span className="text-xs text-gray-400">Assigned to: {selectedRequest.assigned_to}</span>
                  <span className="text-xs text-gray-400">{new Date(selectedRequest.created_at).toLocaleDateString()}</span>
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
    </div>
  );
}
