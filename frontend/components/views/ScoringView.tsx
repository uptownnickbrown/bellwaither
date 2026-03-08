"use client";

import { useEffect, useState } from "react";
import type { Dimension, ComponentScore, DimensionSummary, GlobalSummary } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import { getScores, getDimensionSummaries, getGlobalSummary, assessComponent, synthesizeDimension, generateGlobalSummary } from "@/lib/api";
import {
  BarChart3, Sparkles, ChevronRight, ChevronDown,
  AlertTriangle, CheckCircle2, TrendingUp, Layers,
  Globe, Loader2,
} from "lucide-react";

interface Props {
  engagementId: string;
  framework: Dimension[];
}

type ViewLevel = "components" | "dimensions" | "global";

export default function ScoringView({ engagementId, framework }: Props) {
  const [scores, setScores] = useState<ComponentScore[]>([]);
  const [dimSummaries, setDimSummaries] = useState<DimensionSummary[]>([]);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("components");
  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getScores(engagementId),
      getDimensionSummaries(engagementId),
      getGlobalSummary(engagementId).catch(() => null),
    ]).then(([s, d, g]) => {
      setScores(s);
      setDimSummaries(d);
      setGlobalSummary(g);
    });
  }, [engagementId]);

  const scoreMap = new Map(scores.map((s) => [s.component_id, s]));
  const dimSummaryMap = new Map(dimSummaries.map((d) => [d.dimension_id, d]));
  const selectedScore = scores.find((s) => s.id === selectedScoreId);

  const handleAssess = async (compId: string) => {
    setLoading(compId);
    try {
      await assessComponent(engagementId, compId);
      const newScores = await getScores(engagementId);
      setScores(newScores);
    } catch (e) {
      console.error("Assessment failed:", e);
    }
    setLoading(null);
  };

  const handleSynthesizeDim = async (dimId: string) => {
    setLoading(dimId);
    try {
      await synthesizeDimension(engagementId, dimId);
      const newSummaries = await getDimensionSummaries(engagementId);
      setDimSummaries(newSummaries);
    } catch (e) {
      console.error("Synthesis failed:", e);
    }
    setLoading(null);
  };

  const handleGenerateGlobal = async () => {
    setLoading("global");
    try {
      await generateGlobalSummary(engagementId);
      const summary = await getGlobalSummary(engagementId);
      setGlobalSummary(summary);
    } catch (e) {
      console.error("Global summary failed:", e);
    }
    setLoading(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Diagnostic Workspace</h1>
          <p className="text-sm text-gray-500">AI-powered multi-level assessment with evidence traceability</p>
        </div>
      </div>

      {/* Level Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-6 w-fit">
        {([
          { key: "components" as const, label: "Components (Layer 2)", icon: BarChart3 },
          { key: "dimensions" as const, label: "Dimensions (Layer 3)", icon: Layers },
          { key: "global" as const, label: "Global Summary (Layer 4)", icon: Globe },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewLevel(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              viewLevel === key ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Component Level View */}
      {viewLevel === "components" && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            {framework.map((dim) => (
              <div key={dim.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSelectedDimId(selectedDimId === dim.id ? null : dim.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: dim.color || "#6366F1" }} />
                    <div className="text-left">
                      <span className="text-sm font-semibold text-gray-800">{dim.number}. {dim.name}</span>
                      <div className="text-xs text-gray-400 mt-0.5">{dim.components.length} components</div>
                    </div>
                  </div>
                  {/* Mini heatmap */}
                  <div className="flex items-center gap-1">
                    {dim.components.map((c) => {
                      const score = scoreMap.get(c.id);
                      const rating = score?.rating || "not_rated";
                      const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                      return (
                        <div
                          key={c.id}
                          className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center"
                          style={{ backgroundColor: config.bg, color: config.color }}
                          title={`${c.code}: ${config.label}`}
                        >
                          {c.code.slice(-1)}
                        </div>
                      );
                    })}
                    <ChevronDown className={`w-4 h-4 text-gray-400 ml-2 transition ${selectedDimId === dim.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {selectedDimId === dim.id && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {dim.components.map((comp) => {
                      const score = scoreMap.get(comp.id);
                      const rating = score?.rating || "not_rated";
                      const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                      return (
                        <div
                          key={comp.id}
                          className={`p-3 px-5 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                            selectedScoreId === score?.id ? "bg-indigo-50/50" : ""
                          }`}
                          onClick={() => score && setSelectedScoreId(score.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400 w-6">{comp.code}</span>
                            <span className="text-sm text-gray-700">{comp.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: config.bg, color: config.color }}
                            >
                              {config.label}
                            </span>
                            {score?.confidence && (
                              <span className="text-[10px] text-gray-400">{score.confidence}</span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAssess(comp.id); }}
                              disabled={loading === comp.id}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition disabled:opacity-50"
                            >
                              {loading === comp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              Assess
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Score Detail Panel */}
          <div className="col-span-5">
            {selectedScore ? (
              <ScoreDetail score={selectedScore} framework={framework} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center sticky top-6">
                <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Select a scored component to see the full assessment with evidence traceability.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dimension Level View */}
      {viewLevel === "dimensions" && (
        <div className="space-y-4">
          {framework.map((dim) => {
            const summary = dimSummaryMap.get(dim.id);
            return (
              <div key={dim.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: dim.color || "#6366F1" }} />
                    <h3 className="text-base font-semibold text-gray-900">{dim.number}. {dim.name}</h3>
                  </div>
                  <button
                    onClick={() => handleSynthesizeDim(dim.id)}
                    disabled={loading === dim.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    {loading === dim.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Synthesize Dimension
                  </button>
                </div>

                {summary ? (
                  <div className="space-y-4">
                    {summary.overall_assessment && (
                      <p className="text-sm text-gray-700 leading-relaxed">{summary.overall_assessment}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {summary.patterns && summary.patterns.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Patterns</h4>
                          <ul className="space-y-1">
                            {summary.patterns.map((p, i) => (
                              <li key={i} className="text-xs text-gray-600">· {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summary.top_opportunities && summary.top_opportunities.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-2">Opportunities</h4>
                          <ul className="space-y-1">
                            {summary.top_opportunities.map((o, i) => (
                              <li key={i} className="text-xs text-gray-600">· {o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No synthesis yet. Run component assessments first, then synthesize.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Level View */}
      {viewLevel === "global" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-gray-900">Executive Summary</h2>
            <button
              onClick={handleGenerateGlobal}
              disabled={loading === "global"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading === "global" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Global Summary
            </button>
          </div>

          {globalSummary ? (
            <div className="space-y-6">
              {globalSummary.executive_summary && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Executive Summary</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{globalSummary.executive_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                {globalSummary.top_strengths && (
                  <ListSection title="Top Strengths" items={globalSummary.top_strengths} color="emerald" />
                )}
                {globalSummary.critical_gaps && (
                  <ListSection title="Critical Gaps" items={globalSummary.critical_gaps} color="red" />
                )}
                {globalSummary.strategic_priorities && (
                  <ListSection title="Strategic Priorities" items={globalSummary.strategic_priorities} color="indigo" />
                )}
                {globalSummary.recommended_next_steps && (
                  <ListSection title="Next Steps" items={globalSummary.recommended_next_steps} color="blue" />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-1">No global summary yet</h3>
              <p className="text-xs text-gray-400">Generate dimension syntheses first, then create the global executive summary.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreDetail({ score, framework }: { score: ComponentScore; framework: Dimension[] }) {
  const comp = framework.flatMap((d) => d.components).find((c) => c.id === score.component_id);
  const dim = framework.find((d) => d.components.some((c) => c.id === score.component_id));
  const config = RATING_CONFIG[score.rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-gray-400">{comp?.code}</span>
          <span className="text-base font-semibold text-gray-900">{comp?.name}</span>
        </div>
        <div className="text-xs text-gray-400">{dim?.name}</div>
        <div className="flex items-center gap-3 mt-3">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: config.bg, color: config.color }}
          >
            {config.label}
          </span>
          <span className="text-xs text-gray-400">Confidence: {score.confidence}</span>
          <span className="text-xs text-gray-400">{score.evidence_count} evidence items</span>
        </div>
      </div>

      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {score.strengths && score.strengths.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-emerald-700 uppercase mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
            </h4>
            <ul className="space-y-1.5">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 pl-4 relative before:content-['+'] before:absolute before:left-0 before:text-emerald-500 before:font-semibold">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {score.gaps && score.gaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-700 uppercase mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Gaps
            </h4>
            <ul className="space-y-1.5">
              {score.gaps.map((g, i) => (
                <li key={i} className="text-sm text-gray-600 pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-amber-500 before:font-semibold">{g}</li>
              ))}
            </ul>
          </div>
        )}

        {score.contradictions && score.contradictions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 uppercase mb-2">Contradictions</h4>
            <ul className="space-y-1.5">
              {score.contradictions.map((c, i) => (
                <li key={i} className="text-sm text-gray-600 bg-red-50 p-2 rounded">⚠ {c}</li>
              ))}
            </ul>
          </div>
        )}

        {score.ai_rationale && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Rationale</h4>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{score.ai_rationale}</p>
            <p className="text-[10px] text-gray-400 mt-1">Model: {score.model_used}</p>
          </div>
        )}

        {score.suggested_actions && score.suggested_actions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-indigo-700 uppercase mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Suggested Actions
            </h4>
            <ul className="space-y-1.5">
              {score.suggested_actions.map((a, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ListSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-700",
    red: "text-red-700",
    indigo: "text-indigo-700",
    blue: "text-blue-700",
  };
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase mb-2 ${colorMap[color] || "text-gray-700"}`}>{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
            <span className="text-gray-400 flex-shrink-0">{i + 1}.</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
