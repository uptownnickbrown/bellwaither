"use client";

import { useEffect, useState } from "react";
import type { Dimension, Component as ComponentType, ComponentScore, UserRole } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import { getScores, updateScore } from "@/lib/api";
import EditableText, { EditableListItem } from "@/components/EditableText";
import { ChevronRight, CheckCircle2, AlertTriangle, BookOpen, Target, ShieldCheck, ArrowUpRight } from "lucide-react";

interface Props {
  framework: Dimension[];
  engagementId: string;
  role?: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

export default function FrameworkView({ framework, engagementId, role = "consultant", onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const isAdmin = role === "school_admin";
  const [selectedDim, setSelectedDim] = useState<Dimension | null>(framework[0] || null);
  const [selectedComp, setSelectedComp] = useState<ComponentType | null>(null);
  const [scores, setScores] = useState<ComponentScore[]>([]);

  useEffect(() => {
    getScores(engagementId).then(setScores);
  }, [engagementId]);

  // Handle incoming navigation target (component_id)
  useEffect(() => {
    if (navTargetId && framework.length > 0) {
      for (const dim of framework) {
        const comp = dim.components.find((c) => c.id === navTargetId);
        if (comp) {
          setSelectedDim(dim);
          setSelectedComp(comp);
          break;
        }
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, framework, onNavTargetConsumed]);

  const scoreMap = new Map(scores.map((s) => [s.component_id, s]));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900">School Quality Framework</h1>
        <p className="text-sm text-gray-500">9 dimensions, 43 components with Core Actions and Progress Indicators</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Dimension Sidebar */}
        <div className="col-span-3 space-y-1">
          {framework.map((dim) => {
            const dimScores = dim.components.map((c) => scoreMap.get(c.id));
            const scored = dimScores.filter((s) => s && s.rating !== "not_rated").length;
            const approved = dimScores.filter((s) => s?.approved).length;
            return (
              <button
                key={dim.id}
                onClick={() => { setSelectedDim(dim); setSelectedComp(null); }}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedDim?.id === dim.id
                    ? "bg-white border border-gray-200 shadow-sm"
                    : "hover:bg-white/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full" style={{ backgroundColor: dim.color || "#6366F1" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{dim.number}. {dim.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {dim.components.length} components
                      {!isAdmin && <>{" "}· {scored} scored</>}
                      {!isAdmin && approved > 0 && (
                        <span className="text-emerald-600"> · {approved} approved</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Component List */}
        <div className="col-span-4">
          {selectedDim && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100" style={{ borderLeftColor: selectedDim.color || "#6366F1", borderLeftWidth: "3px" }}>
                <h2 className="text-sm font-semibold text-gray-900">{selectedDim.number}. {selectedDim.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedDim.description}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {selectedDim.components.map((comp) => {
                  const score = scoreMap.get(comp.id);
                  const rating = score?.rating || "not_rated";
                  const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                  return (
                    <button
                      key={comp.id}
                      onClick={() => setSelectedComp(comp)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                        selectedComp?.id === comp.id ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">{comp.code}</span>
                          <span className="text-sm font-medium text-gray-800">{comp.name}</span>
                          {!isAdmin && score?.approved && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-semibold">
                              <ShieldCheck className="w-2.5 h-2.5" /> Approved
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                      </div>
                      {!isAdmin && score && score.confidence && (
                        <div className="mt-1 text-xs text-gray-400">
                          Confidence: {score.confidence} · {score.evidence_count} evidence items
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Component Detail */}
        <div className="col-span-5">
          {selectedComp ? (
            <ComponentDetail component={selectedComp} score={scoreMap.get(selectedComp.id)} engagementId={engagementId} role={role} onScoreUpdate={(updated) => setScores(scores.map((s) => s.id === updated.id ? updated : s))} onNavigate={onNavigate} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Select a component to view its success criteria and assessment details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponentDetail({ component, score, engagementId, role = "consultant", onScoreUpdate, onNavigate }: { component: ComponentType; score?: ComponentScore; engagementId: string; role?: UserRole; onScoreUpdate: (s: ComponentScore) => void; onNavigate?: (tab: string, id?: string) => void }) {
  const isAdmin = role === "school_admin";
  const rating = score?.rating || "not_rated";
  const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;

  const coreActions = component.criteria.filter((c) => c.criterion_type === "core_action");
  const progressIndicators = component.criteria.filter((c) => c.criterion_type === "progress_indicator");

  const patchListItem = async (field: string, list: string[], index: number, value: string) => {
    if (!score) return;
    const updated = [...list];
    updated[index] = value;
    await updateScore(engagementId, score.id, { [field]: updated });
    onScoreUpdate({ ...score, [field]: updated } as ComponentScore);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-400">{component.code}</span>
            <h3 className="text-base font-semibold text-gray-900">{component.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isAdmin && score?.approved && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                <ShieldCheck className="w-3 h-3" /> Approved
              </span>
            )}
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: config.bg, color: config.color }}
            >
              {config.label}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-600">{component.description}</p>
        {!isAdmin && score?.confidence && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-gray-400">Confidence: <strong className="text-gray-600">{score.confidence}</strong></span>
            <span className="text-xs text-gray-400">Evidence: <strong className="text-gray-600">{score.evidence_count} items</strong></span>
            <span className="text-xs text-gray-400">Status: <strong className="text-gray-600">{score.status}</strong></span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => onNavigate?.("scoring", component.id)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
          >
            View in Diagnostic
            <ArrowUpRight className="w-3 h-3" />
          </button>
          {score && score.evidence_count > 0 && (
            <button
              onClick={() => onNavigate?.("evidence", `component:${component.id}`)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
            >
              View Evidence
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Success Criteria */}
      <div className="p-5 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Core Actions
          </h4>
          <ul className="space-y-2">
            {coreActions.map((ca) => (
              <li key={ca.id} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                <span>{ca.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Progress Indicators
          </h4>
          <ul className="space-y-2">
            {progressIndicators.map((pi) => (
              <li key={pi.id} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0 mt-0.5" />
                <span>{pi.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Score Details */}
        {score && score.rating !== "not_rated" && (
          <>
            {score.strengths && score.strengths.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {score.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-emerald-500 mt-1 flex-shrink-0">+</span>
                      {isAdmin ? (
                        <span className="flex-1">{s}</span>
                      ) : (
                        <EditableListItem value={s} className="flex-1" onSave={(v) => patchListItem("strengths", score.strengths!, i, v)} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {score.gaps && score.gaps.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                  {isAdmin ? "Areas for Growth" : "Gaps"}
                </h4>
                <ul className="space-y-1">
                  {score.gaps.map((g, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-amber-500 mt-1 flex-shrink-0">-</span>
                      {isAdmin ? (
                        <span className="flex-1">{g}</span>
                      ) : (
                        <EditableListItem value={g} className="flex-1" onSave={(v) => patchListItem("gaps", score.gaps!, i, v)} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Rationale (consultant only -- hidden from school admins) */}
            {!isAdmin && score.ai_rationale && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rationale</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <EditableText
                    value={score.ai_rationale}
                    multiline
                    className="text-sm text-gray-600"
                    onSave={async (v) => {
                      await updateScore(engagementId, score.id, { ai_rationale: v });
                      onScoreUpdate({ ...score, ai_rationale: v });
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Evidence Guidance */}
      {component.evidence_guidance && (
        <div className="px-5 pb-5">
          <div className="bg-indigo-50/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-indigo-700 mb-1">Evidence Guidance</h4>
            <p className="text-xs text-indigo-600">{component.evidence_guidance}</p>
          </div>
        </div>
      )}
    </div>
  );
}
