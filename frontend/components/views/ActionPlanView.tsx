"use client";

import { useEffect, useState } from "react";
import type { ActionPlan, ActionItem, UserRole } from "@/lib/types";
import { getActionPlans, getActionItems, updateActionItem, deleteActionItem } from "@/lib/api";
import EditableText from "@/components/EditableText";
import { Target, CheckCircle2, Clock, AlertCircle, Ban, FileText, ArrowRight, Milestone, CalendarClock, ArrowUpRight, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Props {
  engagementId: string;
  role?: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  not_started: { icon: Clock, color: "#9CA3AF", bg: "#F9FAFB", label: "Not Started" },
  in_progress: { icon: ArrowRight, color: "#6366F1", bg: "#EEF2FF", label: "In Progress" },
  completed: { icon: CheckCircle2, color: "#059669", bg: "#ECFDF5", label: "Completed" },
  blocked: { icon: Ban, color: "#EF4444", bg: "#FEF2F2", label: "Blocked" },
};

export default function ActionPlanView({ engagementId, role = "consultant", onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const isAdmin = role === "school_admin";
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ActionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getActionPlans(engagementId).then((p) => {
      setPlans(p);
      if (p.length > 0) setSelectedPlan(p[0]);
    });
  }, [engagementId]);

  useEffect(() => {
    if (selectedPlan) {
      getActionItems(engagementId, selectedPlan.id).then(setItems);
    }
  }, [selectedPlan, engagementId]);

  // Handle incoming navigation target
  useEffect(() => {
    if (navTargetId && items.length > 0) {
      const target = items.find((it) => it.id === navTargetId);
      if (target) {
        setSelectedItem(target);
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, items, onNavTargetConsumed]);

  const handleDeleteItem = async () => {
    if (!itemToDelete || !selectedPlan) return;
    setDeleting(true);
    try {
      await deleteActionItem(engagementId, selectedPlan.id, itemToDelete.id);
      if (selectedItem?.id === itemToDelete.id) setSelectedItem(null);
      getActionItems(engagementId, selectedPlan.id).then(setItems);
      toast(`Deleted "${itemToDelete.title}"`, "success");
    } catch {
      toast("Failed to delete action item", "error");
    } finally {
      setDeleting(false);
      setItemToDelete(null);
    }
  };

  // School admin: "coming soon" state when no action plan or items exist
  if (isAdmin && plans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Milestone className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Action planning is coming soon</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto mb-6">
            Action planning begins after the diagnostic assessment. Your team will work together with the
            consulting team to build priorities and next steps based on the findings.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-gray-300" />
              </div>
              <span>Set priorities</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-gray-300" />
              </div>
              <span>Define milestones</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-gray-300" />
              </div>
              <span>Track progress</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // School admin: empty items in an existing plan
  if (isAdmin && selectedPlan && items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Action Plan</h1>
            <p className="text-sm text-gray-500">{selectedPlan.title}</p>
          </div>
        </div>
        <div className="max-w-lg mx-auto py-12">
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Milestone className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Action items are being developed</h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
              The consulting team is building action items based on the assessment findings.
              Specific priorities and next steps will appear here as they are finalized.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Action Plan</h1>
          <p className="text-sm text-gray-500">
            {selectedPlan ? selectedPlan.title : "No action plans yet"}
          </p>
        </div>
        {/* Hide draft status badge for admin */}
        {!isAdmin && selectedPlan && (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
            {selectedPlan.status === "draft" ? "Draft" : selectedPlan.status}
          </span>
        )}
      </div>

      {selectedPlan && selectedPlan.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-sm text-gray-600">{selectedPlan.description}</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Action Items List */}
        <div className="col-span-5">
          <div className="space-y-3">
            {items.map((item) => {
              const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.not_started;
              const Icon = statusStyle.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`group w-full text-left bg-white rounded-xl border p-4 transition hover:shadow-sm cursor-pointer ${
                    selectedItem?.id === item.id ? "border-indigo-300 shadow-sm" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-500 flex-shrink-0">
                      {item.priority_order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                        {!isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                            className="hidden group-hover:flex w-7 h-7 items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition flex-shrink-0"
                            title="Delete action item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          <Icon className="w-3 h-3" />
                          {statusStyle.label}
                        </span>
                        {item.owner && <span className="text-xs text-gray-400">Owner: {item.owner}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && !isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Target className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No action items yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Item Detail */}
        <div className="col-span-7">
          {selectedItem ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {selectedItem.priority_order}
                  </span>
                  <h2 className="text-base font-semibold text-gray-900">{selectedItem.title}</h2>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {selectedItem.owner && (
                    <span className="text-xs text-gray-500">Owner: <strong>{selectedItem.owner}</strong></span>
                  )}
                  {selectedItem.target_date && (
                    <span className="text-xs text-gray-500">Target: <strong>{new Date(selectedItem.target_date).toLocaleDateString()}</strong></span>
                  )}
                </div>
                {selectedItem.component_id && (
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => onNavigate?.("scoring", selectedItem.component_id!)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
                    >
                      View in Diagnostic
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onNavigate?.("framework", selectedItem.component_id!)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
                    >
                      View in Framework
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                {selectedItem.description && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</h3>
                    {isAdmin ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{selectedItem.description}</p>
                    ) : (
                      <EditableText
                        value={selectedItem.description}
                        multiline
                        className="text-sm text-gray-700 leading-relaxed"
                        onSave={async (v) => {
                          await updateActionItem(engagementId, selectedPlan!.id, selectedItem.id, { description: v });
                          const updated = { ...selectedItem, description: v };
                          setSelectedItem(updated);
                          setItems(items.map((it) => it.id === updated.id ? updated : it));
                        }}
                      />
                    )}
                  </div>
                )}

                {selectedItem.rationale && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Evidence-Based Rationale</h3>
                    <div className="bg-indigo-50/50 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        {isAdmin ? (
                          <p className="text-sm text-indigo-800 flex-1">{selectedItem.rationale}</p>
                        ) : (
                          <EditableText
                            value={selectedItem.rationale}
                            multiline
                            className="text-sm text-indigo-800 flex-1"
                            onSave={async (v) => {
                              await updateActionItem(engagementId, selectedPlan!.id, selectedItem.id, { rationale: v });
                              const updated = { ...selectedItem, rationale: v };
                              setSelectedItem(updated);
                              setItems(items.map((it) => it.id === updated.id ? updated : it));
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Target className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-1">Select an action item</h3>
              <p className="text-xs text-gray-400">Click on an action item to see its full description, evidence-based rationale, and milestones.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteItem}
        title="Delete Action Item"
        description={`This will permanently delete "${itemToDelete?.title}" and its milestones.`}
        loading={deleting}
      />
    </div>
  );
}
