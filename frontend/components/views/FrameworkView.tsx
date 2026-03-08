"use client";

import { useEffect, useState } from "react";
import type { Dimension, Component as ComponentType, ComponentScore } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import { getScores } from "@/lib/api";
import { ChevronRight, CheckCircle2, AlertTriangle, BookOpen, Target } from "lucide-react";

interface Props {
  framework: Dimension[];
  engagementId: string;
}

export default function FrameworkView({ framework, engagementId }: Props) {
  const [selectedDim, setSelectedDim] = useState<Dimension | null>(framework[0] || null);
  const [selectedComp, setSelectedComp] = useState<ComponentType | null>(null);
  const [scores, setScores] = useState<ComponentScore[]>([]);

  useEffect(() => {
    getScores(engagementId).then(setScores);
  }, [engagementId]);

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
                    <div className="text-xs text-gray-400 mt-0.5">{dim.components.length} components · {scored} scored</div>
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
                        </div>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                      </div>
                      {score && score.confidence && (
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
            <ComponentDetail component={selectedComp} score={scoreMap.get(selectedComp.id)} />
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

function ComponentDetail({ component, score }: { component: ComponentType; score?: ComponentScore }) {
  const rating = score?.rating || "not_rated";
  const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;

  const coreActions = component.criteria.filter((c) => c.criterion_type === "core_action");
  const progressIndicators = component.criteria.filter((c) => c.criterion_type === "progress_indicator");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-400">{component.code}</span>
            <h3 className="text-base font-semibold text-gray-900">{component.name}</h3>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: config.bg, color: config.color }}
          >
            {config.label}
          </span>
        </div>
        <p className="text-sm text-gray-600">{component.description}</p>
        {score?.confidence && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-gray-400">Confidence: <strong className="text-gray-600">{score.confidence}</strong></span>
            <span className="text-xs text-gray-400">Evidence: <strong className="text-gray-600">{score.evidence_count} items</strong></span>
            <span className="text-xs text-gray-400">Status: <strong className="text-gray-600">{score.status}</strong></span>
          </div>
        )}
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
                      <span className="text-emerald-500 mt-1">+</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {score.gaps && score.gaps.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Gaps</h4>
                <ul className="space-y-1">
                  {score.gaps.map((g, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-amber-500 mt-1">-</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {score.ai_rationale && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Rationale</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{score.ai_rationale}</p>
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
