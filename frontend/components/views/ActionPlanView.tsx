"use client";

import { useEffect, useState } from "react";
import type { ActionPlan, ActionItem } from "@/lib/types";
import { getActionPlans, getActionItems } from "@/lib/api";
import { Target, CheckCircle2, Clock, AlertCircle, Ban, FileText, ArrowRight } from "lucide-react";

interface Props {
  engagementId: string;
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  not_started: { icon: Clock, color: "#9CA3AF", bg: "#F9FAFB", label: "Not Started" },
  in_progress: { icon: ArrowRight, color: "#6366F1", bg: "#EEF2FF", label: "In Progress" },
  completed: { icon: CheckCircle2, color: "#059669", bg: "#ECFDF5", label: "Completed" },
  blocked: { icon: Ban, color: "#EF4444", bg: "#FEF2F2", label: "Blocked" },
};

export default function ActionPlanView({ engagementId }: Props) {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);

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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Action Plan</h1>
          <p className="text-sm text-gray-500">
            {selectedPlan ? selectedPlan.title : "No action plans yet"}
          </p>
        </div>
        {selectedPlan && (
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
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left bg-white rounded-xl border p-4 transition hover:shadow-sm ${
                    selectedItem?.id === item.id ? "border-indigo-300 shadow-sm" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-500 flex-shrink-0">
                      {item.priority_order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
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
                </button>
              );
            })}
            {items.length === 0 && (
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
              </div>

              <div className="p-5 space-y-4">
                {selectedItem.description && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedItem.description}</p>
                  </div>
                )}

                {selectedItem.rationale && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Evidence-Based Rationale</h3>
                    <div className="bg-indigo-50/50 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-indigo-800">{selectedItem.rationale}</p>
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
    </div>
  );
}
