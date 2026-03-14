"use client";

import { useEffect, useState, useCallback } from "react";
import type { Dimension, ComponentScore, DimensionSummary, GlobalSummary, BatchProgress, EvidenceCountMap, UserRole } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import {
  getScores, getDimensionSummaries, getGlobalSummary,
  assessComponent, synthesizeDimension, generateGlobalSummary,
  updateScore, updateDimensionSummary, updateGlobalSummary,
  toggleScoreApproval, toggleDimensionSummaryApproval, toggleGlobalSummaryApproval,
  getEvidenceCounts, getExportUrl,
  batchAssessComponents, batchSynthesizeDimensions, batchGenerateGlobal,
} from "@/lib/api";
import EditableText, { EditableListItem } from "@/components/EditableText";
import AIFeedback from "@/components/AIFeedback";
import {
  BarChart3, Sparkles, ChevronDown,
  AlertTriangle, CheckCircle2, TrendingUp, Layers,
  Globe, Loader2, Lock, Unlock, ShieldCheck, FileQuestion,
  PlayCircle, Ban, ClipboardCheck, Clock, ArrowUpRight, FileDown,
} from "lucide-react";

interface Props {
  engagementId: string;
  framework: Dimension[];
  role?: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

type ViewLevel = "components" | "dimensions" | "global";

export default function ScoringView({ engagementId, framework, role = "consultant", onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const isAdmin = role === "school_admin";
  const [scores, setScores] = useState<ComponentScore[]>([]);
  const [dimSummaries, setDimSummaries] = useState<DimensionSummary[]>([]);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);
  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCountMap>({});
  const [viewLevel, setViewLevel] = useState<ViewLevel>("components");
  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const refreshData = useCallback(async () => {
    const [s, d, g, ec] = await Promise.all([
      getScores(engagementId),
      getDimensionSummaries(engagementId),
      getGlobalSummary(engagementId).catch(() => null),
      getEvidenceCounts(engagementId),
    ]);
    setScores(s);
    setDimSummaries(d);
    setGlobalSummary(g);
    setEvidenceCounts(ec);
  }, [engagementId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle incoming navigation target (component_id)
  useEffect(() => {
    if (navTargetId && scores.length > 0) {
      // navTargetId could be a component_id or a score_id
      const scoreByComp = scores.find((s) => s.component_id === navTargetId);
      if (scoreByComp) {
        setSelectedScoreId(scoreByComp.id);
        // Expand the dimension containing this component
        const dim = framework.find((d) => d.components.some((c) => c.id === navTargetId));
        if (dim) setSelectedDimId(dim.id);
        setViewLevel("components");
      } else {
        const scoreById = scores.find((s) => s.id === navTargetId);
        if (scoreById) {
          setSelectedScoreId(scoreById.id);
          const dim = framework.find((d) => d.components.some((c) => c.id === scoreById.component_id));
          if (dim) setSelectedDimId(dim.id);
          setViewLevel("components");
        }
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, scores, framework, onNavTargetConsumed]);

  const scoreMap = new Map(scores.map((s) => [s.component_id, s]));
  const dimSummaryMap = new Map(dimSummaries.map((d) => [d.dimension_id, d]));
  const selectedScore = scores.find((s) => s.id === selectedScoreId);

  // Count totals for the current level
  const totalComponents = framework.reduce((sum, d) => sum + d.components.length, 0);
  const scoredComponents = scores.filter((s) => s.rating !== "not_rated").length;
  const approvedComponents = scores.filter((s) => s.approved).length;

  // School admin: full "in progress" state when no scores exist yet
  if (isAdmin && scoredComponents === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ClipboardCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Assessment in progress</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto mb-8">
            The consulting team is currently reviewing your school&apos;s materials and conducting the diagnostic assessment.
            Component-level results will appear here as each area is completed.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-gray-300" />
              </div>
              <span>0 of {totalComponents} components</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-gray-300" />
              </div>
              <span>Review underway</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAssess = async (compId: string) => {
    const evCount = evidenceCounts[compId] || 0;
    if (evCount === 0) return; // Silently refuse -- UI disables it
    const score = scoreMap.get(compId);
    if (score?.approved) return;

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

  const handleToggleScoreApproval = async (scoreId: string, approved: boolean) => {
    setLoading(`approve-${scoreId}`);
    try {
      await toggleScoreApproval(engagementId, scoreId, approved);
      const newScores = await getScores(engagementId);
      setScores(newScores);
    } catch (e) {
      console.error("Approval toggle failed:", e);
    }
    setLoading(null);
  };

  const handleSynthesizeDim = async (dimId: string) => {
    const summary = dimSummaryMap.get(dimId);
    if (summary?.approved) return;
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

  const handleToggleDimApproval = async (summaryId: string, approved: boolean) => {
    setLoading(`approve-dim-${summaryId}`);
    try {
      await toggleDimensionSummaryApproval(engagementId, summaryId, approved);
      const newSummaries = await getDimensionSummaries(engagementId);
      setDimSummaries(newSummaries);
    } catch (e) {
      console.error("Dimension approval toggle failed:", e);
    }
    setLoading(null);
  };

  const handleGenerateGlobal = async () => {
    if (globalSummary?.approved) return;
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

  const handleToggleGlobalApproval = async (summaryId: string, approved: boolean) => {
    setLoading("approve-global");
    try {
      await toggleGlobalSummaryApproval(engagementId, summaryId, approved);
      const summary = await getGlobalSummary(engagementId);
      setGlobalSummary(summary);
    } catch (e) {
      console.error("Global approval toggle failed:", e);
    }
    setLoading(null);
  };

  // Batch handlers
  const handleBatchComponents = async () => {
    setBatchRunning(true);
    setBatchProgress(null);
    try {
      const result = await batchAssessComponents(engagementId);
      setBatchProgress(result);
      await refreshData();
    } catch (e) {
      console.error("Batch component assessment failed:", e);
    }
    setBatchRunning(false);
  };

  const handleBatchDimensions = async () => {
    setBatchRunning(true);
    setBatchProgress(null);
    try {
      const result = await batchSynthesizeDimensions(engagementId);
      setBatchProgress(result);
      await refreshData();
    } catch (e) {
      console.error("Batch dimension synthesis failed:", e);
    }
    setBatchRunning(false);
  };

  const handleBatchGlobal = async () => {
    setBatchRunning(true);
    setBatchProgress(null);
    try {
      const result = await batchGenerateGlobal(engagementId);
      setBatchProgress(result);
      await refreshData();
    } catch (e) {
      console.error("Batch global summary failed:", e);
    }
    setBatchRunning(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {isAdmin ? "Assessment Results" : "Diagnostic Workspace"}
          </h1>
          <p className="text-sm text-gray-500">
            {isAdmin
              ? "Component-level diagnostic results for your school"
              : "Multi-level assessment with evidence traceability"}
          </p>
        </div>
      </div>

      {/* Admin partial-progress banner */}
      {isAdmin && scoredComponents > 0 && scoredComponents < totalComponents && (
        <div className="mb-6 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-indigo-100">
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-900">Assessment in progress</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {scoredComponents} of {totalComponents} components have been assessed so far. Results will continue to appear as the review progresses.
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-24 h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((scoredComponents / totalComponents) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-indigo-400 mt-1 text-right">{Math.round((scoredComponents / totalComponents) * 100)}%</p>
          </div>
        </div>
      )}

      {/* Level Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-6 w-fit">
        {([
          { key: "components" as const, label: "Components", icon: BarChart3 },
          { key: "dimensions" as const, label: "Dimensions", icon: Layers },
          { key: "global" as const, label: "Executive Summary", icon: Globe },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setViewLevel(key); setBatchProgress(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              viewLevel === key ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Batch Progress Banner (consultant only) */}
      {!isAdmin && batchProgress && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Batch Generation Complete</h3>
            <button onClick={() => setBatchProgress(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-600 font-medium">{batchProgress.completed} completed</span>
            {batchProgress.skipped_approved > 0 && (
              <span className="text-blue-600 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" /> {batchProgress.skipped_approved} skipped (approved)
              </span>
            )}
            {batchProgress.skipped_no_evidence > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <FileQuestion className="w-3 h-3" /> {batchProgress.skipped_no_evidence} skipped (no evidence)
              </span>
            )}
            {batchProgress.failed > 0 && (
              <span className="text-red-600 font-medium">{batchProgress.failed} failed</span>
            )}
            <span className="text-gray-400">of {batchProgress.total} total</span>
          </div>
        </div>
      )}

      {/* Component Level View */}
      {viewLevel === "components" && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            {/* Generate All Components button (consultant only) */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {scoredComponents}/{totalComponents} {isAdmin ? "completed" : "scored"}{!isAdmin && ` | ${approvedComponents} approved`}
              </div>
              {!isAdmin && (
                <button
                  onClick={handleBatchComponents}
                  disabled={batchRunning}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {batchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  {batchRunning ? "Generating..." : "Generate All Component Assessments"}
                </button>
              )}
            </div>

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
                      const evCount = evidenceCounts[c.id] || 0;
                      return (
                        <div
                          key={c.id}
                          className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center relative ${evCount === 0 ? "opacity-40" : ""}`}
                          style={{ backgroundColor: config.bg, color: config.color }}
                          title={`${c.code}: ${config.label}${evCount === 0 ? " (no evidence)" : ""}${score?.approved ? " [Approved]" : ""}`}
                        >
                          {score?.approved ? (
                            <Lock className="w-2.5 h-2.5" />
                          ) : (
                            c.code.slice(-1)
                          )}
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
                      const evCount = evidenceCounts[comp.id] || 0;
                      const isApproved = score?.approved || false;
                      const hasNoEvidence = evCount === 0;

                      const isGenerating = batchRunning && !isApproved && !hasNoEvidence && rating === "not_rated";

                      return (
                        <div
                          key={comp.id}
                          className={`p-3 px-5 flex items-center justify-between cursor-pointer transition ${
                            hasNoEvidence ? "bg-gray-50/80" : "hover:bg-gray-50"
                          } ${selectedScoreId === score?.id ? "bg-indigo-50/50" : ""} ${isGenerating ? "animate-pulse bg-indigo-50/30" : ""}`}
                          onClick={() => score && setSelectedScoreId(score.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0">{comp.code}</span>
                            <span className={`text-sm truncate ${hasNoEvidence && !isAdmin ? "text-gray-400" : "text-gray-700"}`}>{comp.name}</span>
                            {/* Approval badge (consultant only) */}
                            {!isAdmin && isApproved && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-semibold flex-shrink-0">
                                <ShieldCheck className="w-2.5 h-2.5" /> Approved
                              </span>
                            )}
                            {/* Insufficient evidence indicator (consultant only) */}
                            {!isAdmin && hasNoEvidence && !score && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-medium flex-shrink-0">
                                <FileQuestion className="w-2.5 h-2.5" /> No evidence
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: config.bg, color: config.color }}
                            >
                              {config.label}
                            </span>
                            {score?.confidence && !isAdmin && (
                              <span className="text-[10px] text-gray-400">{score.confidence}</span>
                            )}
                            {/* Approve/Unlock button (consultant only) */}
                            {!isAdmin && score && (score.rating !== "not_rated" || isApproved) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleScoreApproval(score.id, !isApproved);
                                }}
                                disabled={loading === `approve-${score.id}`}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition disabled:opacity-50 ${
                                  isApproved
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                                title={isApproved ? "Unlock to allow regeneration" : "Approve and lock"}
                              >
                                {loading === `approve-${score.id}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : isApproved ? (
                                  <Unlock className="w-3 h-3" />
                                ) : (
                                  <Lock className="w-3 h-3" />
                                )}
                                {isApproved ? "Unlock" : "Approve"}
                              </button>
                            )}
                            {/* Assess button (consultant only) */}
                            {!isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAssess(comp.id); }}
                                disabled={loading === comp.id || isApproved || hasNoEvidence}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition disabled:opacity-50 ${
                                  hasNoEvidence
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : isApproved
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                }`}
                                title={hasNoEvidence ? "No evidence mapped" : isApproved ? "Unlock to reassess" : "Run assessment"}
                              >
                                {loading === comp.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : hasNoEvidence ? (
                                  <Ban className="w-3 h-3" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                Assess
                              </button>
                            )}
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
              <ScoreDetail
                score={selectedScore}
                framework={framework}
                engagementId={engagementId}
                evidenceCount={evidenceCounts[selectedScore.component_id] || 0}
                onScoreUpdate={(updated) => setScores(scores.map((s) => s.id === updated.id ? updated : s))}
                onToggleApproval={(approved) => handleToggleScoreApproval(selectedScore.id, approved)}
                loading={loading}
                role={role}
                onNavigate={onNavigate}
              />
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
          {/* Generate All Dimensions button (consultant only) */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {isAdmin
                ? `${dimSummaries.length} of ${framework.length} dimensions reviewed`
                : `${dimSummaries.length}/${framework.length} synthesized | ${dimSummaries.filter((d) => d.approved).length} approved`}
            </div>
            {!isAdmin && (
              <button
                onClick={handleBatchDimensions}
                disabled={batchRunning}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {batchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {batchRunning ? "Generating..." : "Generate All Dimension Summaries"}
              </button>
            )}
          </div>

          {framework.map((dim) => {
            const summary = dimSummaryMap.get(dim.id);
            const isApproved = summary?.approved || false;
            // Check if all components in this dimension lack evidence
            const dimHasAnyEvidence = dim.components.some((c) => (evidenceCounts[c.id] || 0) > 0);
            const dimHasAnyScored = dim.components.some((c) => {
              const s = scoreMap.get(c.id);
              return s && s.rating !== "not_rated";
            });

            return (
              <div key={dim.id} className={`bg-white rounded-xl border border-gray-200 p-6 ${!dimHasAnyEvidence && !summary ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: dim.color || "#6366F1" }} />
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{dim.number}. {dim.name}</h3>
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold mt-1">
                          <ShieldCheck className="w-3 h-3" /> Approved
                        </span>
                      )}
                    </div>
                  </div>
                  {!isAdmin && (
                    <div className="flex items-center gap-2">
                      {/* Approve/Unlock for dimension */}
                      {summary && (
                        <button
                          onClick={() => handleToggleDimApproval(summary.id, !isApproved)}
                          disabled={loading === `approve-dim-${summary.id}`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {loading === `approve-dim-${summary.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isApproved ? (
                            <Unlock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          {isApproved ? "Unlock" : "Approve"}
                        </button>
                      )}
                      <button
                        onClick={() => handleSynthesizeDim(dim.id)}
                        disabled={loading === dim.id || isApproved || (!dimHasAnyEvidence && !dimHasAnyScored)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                          isApproved || (!dimHasAnyEvidence && !dimHasAnyScored)
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        }`}
                        title={isApproved ? "Unlock to regenerate" : !dimHasAnyEvidence ? "No evidence mapped to components in this dimension" : ""}
                      >
                        {loading === dim.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : !dimHasAnyEvidence && !dimHasAnyScored ? (
                          <Ban className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Synthesize Dimension
                      </button>
                    </div>
                  )}
                </div>

                {/* Insufficient evidence / pending state */}
                {!dimHasAnyEvidence && !dimHasAnyScored && !summary ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <FileQuestion className="w-8 h-8 text-gray-300 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {isAdmin ? "Review pending" : "Insufficient Evidence"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isAdmin
                          ? "This dimension is still being reviewed. Results will appear here once the analysis is complete."
                          : "No evidence has been mapped to components in this dimension. Upload or map evidence to enable analysis."}
                      </p>
                    </div>
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    {summary.overall_assessment && (
                      <div>
                        <EditableText
                          value={summary.overall_assessment}
                          multiline
                          className="text-sm text-gray-700 leading-relaxed"
                          readOnly={isAdmin || isApproved}
                          onSave={async (v) => {
                            await updateDimensionSummary(engagementId, summary.id, { overall_assessment: v });
                            setDimSummaries(dimSummaries.map((ds) => ds.id === summary.id ? { ...ds, overall_assessment: v } : ds));
                          }}
                        />
                        <AIFeedback
                          engagementId={engagementId}
                          targetType="dimension_summary"
                          targetId={summary.id}
                          visible={!isAdmin}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {summary.patterns && summary.patterns.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Patterns</h4>
                          <ul className="space-y-1">
                            {summary.patterns.map((p, i) => (
                              <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                                <span className="flex-shrink-0">·</span>
                                <EditableListItem
                                  value={p}
                                  className="text-xs text-gray-600 flex-1"
                                  readOnly={isAdmin || isApproved}
                                  onSave={async (v) => {
                                    const updated = [...(summary.patterns || [])];
                                    updated[i] = v;
                                    await updateDimensionSummary(engagementId, summary.id, { patterns: updated });
                                    setDimSummaries(dimSummaries.map((ds) => ds.id === summary.id ? { ...ds, patterns: updated } : ds));
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summary.top_opportunities && summary.top_opportunities.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-2">Opportunities</h4>
                          <ul className="space-y-1">
                            {summary.top_opportunities.map((o, i) => (
                              <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                                <span className="flex-shrink-0">·</span>
                                <EditableListItem
                                  value={o}
                                  className="text-xs text-gray-600 flex-1"
                                  readOnly={isAdmin || isApproved}
                                  onSave={async (v) => {
                                    const updated = [...(summary.top_opportunities || [])];
                                    updated[i] = v;
                                    await updateDimensionSummary(engagementId, summary.id, { top_opportunities: updated });
                                    setDimSummaries(dimSummaries.map((ds) => ds.id === summary.id ? { ...ds, top_opportunities: updated } : ds));
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {isAdmin
                      ? "The dimension-level summary for this area is still being developed."
                      : "No synthesis yet. Run component assessments first, then synthesize."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Level View */}
      {viewLevel === "global" && (
        <div className="space-y-4">
          {/* Generate Global button bar (consultant only) */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {isAdmin
                ? (dimSummaries.length > 0 ? `${dimSummaries.length} dimension reviews completed` : "")
                : `${dimSummaries.length} dimension summaries available`}
            </div>
            {!isAdmin && (
              <button
                onClick={handleBatchGlobal}
                disabled={batchRunning || globalSummary?.approved}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {batchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {batchRunning ? "Generating..." : "Generate Executive Summary"}
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900">Executive Summary</h2>
                {globalSummary?.approved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                    <ShieldCheck className="w-3 h-3" /> Approved
                  </span>
                )}
              </div>
              {!isAdmin && (
                <div className="flex items-center gap-2">
                  {globalSummary && (
                    <button
                      onClick={() => handleToggleGlobalApproval(globalSummary.id, !globalSummary.approved)}
                      disabled={loading === "approve-global"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                        globalSummary.approved
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {loading === "approve-global" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : globalSummary.approved ? (
                        <Unlock className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      {globalSummary.approved ? "Unlock" : "Approve"}
                    </button>
                  )}
                  <button
                    onClick={handleGenerateGlobal}
                    disabled={loading === "global" || globalSummary?.approved}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 ${
                      globalSummary?.approved
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {loading === "global" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {globalSummary ? "Regenerate" : "Generate"}
                  </button>
                </div>
              )}
              {/* Export button - visible to both roles when summary exists */}
              {globalSummary && (
                <a
                  href={getExportUrl(engagementId)}
                  download
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export Report
                </a>
              )}
            </div>

            {dimSummaries.length === 0 && !globalSummary ? (
              <div className={`flex ${isAdmin ? "flex-col items-center text-center py-8" : "flex-row items-center"} gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100`}>
                {isAdmin ? (
                  <>
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-100 mb-2">
                      <Globe className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Executive summary in development</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">The executive summary draws on completed dimension reviews. It will be available once the assessment reaches that stage.</p>
                  </>
                ) : (
                  <>
                    <FileQuestion className="w-8 h-8 text-gray-300 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Insufficient Evidence</p>
                      <p className="text-xs text-gray-400 mt-0.5">No dimension summaries have been generated yet. Generate dimension syntheses first, then create the global executive summary.</p>
                    </div>
                  </>
                )}
              </div>
            ) : globalSummary ? (
              <div className="space-y-6">
                {globalSummary.executive_summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Executive Summary</h3>
                    <EditableText
                      value={globalSummary.executive_summary}
                      multiline
                      className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"
                      readOnly={isAdmin || globalSummary.approved}
                      onSave={async (v) => {
                        await updateGlobalSummary(engagementId, globalSummary.id, { executive_summary: v });
                        setGlobalSummary({ ...globalSummary, executive_summary: v });
                      }}
                    />
                    <AIFeedback
                      engagementId={engagementId}
                      targetType="global_summary"
                      targetId={globalSummary.id}
                      visible={!isAdmin}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  {globalSummary.top_strengths && (
                    <EditableListSection
                      title="Top Strengths"
                      items={globalSummary.top_strengths}
                      color="emerald"
                      field="top_strengths"
                      engagementId={engagementId}
                      summaryId={globalSummary.id}
                      readOnly={isAdmin || globalSummary.approved}
                      onUpdate={(updated) => setGlobalSummary({ ...globalSummary, top_strengths: updated })}
                    />
                  )}
                  {globalSummary.critical_gaps && (
                    <EditableListSection
                      title="Critical Gaps"
                      items={globalSummary.critical_gaps}
                      color="red"
                      field="critical_gaps"
                      engagementId={engagementId}
                      summaryId={globalSummary.id}
                      readOnly={isAdmin || globalSummary.approved}
                      onUpdate={(updated) => setGlobalSummary({ ...globalSummary, critical_gaps: updated })}
                    />
                  )}
                  {globalSummary.strategic_priorities && (
                    <EditableListSection
                      title="Strategic Priorities"
                      items={globalSummary.strategic_priorities}
                      color="indigo"
                      field="strategic_priorities"
                      engagementId={engagementId}
                      summaryId={globalSummary.id}
                      readOnly={isAdmin || globalSummary.approved}
                      onUpdate={(updated) => setGlobalSummary({ ...globalSummary, strategic_priorities: updated })}
                    />
                  )}
                  {globalSummary.recommended_next_steps && (
                    <EditableListSection
                      title="Next Steps"
                      items={globalSummary.recommended_next_steps}
                      color="blue"
                      field="recommended_next_steps"
                      engagementId={engagementId}
                      summaryId={globalSummary.id}
                      readOnly={isAdmin || globalSummary.approved}
                      onUpdate={(updated) => setGlobalSummary({ ...globalSummary, recommended_next_steps: updated })}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  {isAdmin ? "Executive summary in development" : "No global summary yet"}
                </h3>
                <p className="text-xs text-gray-400">
                  {isAdmin
                    ? "The executive summary will be available once the dimension-level reviews are complete."
                    : "Generate dimension syntheses first, then create the global executive summary."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDetail({
  score, framework, engagementId, evidenceCount, onScoreUpdate, onToggleApproval, loading, role = "consultant", onNavigate,
}: {
  score: ComponentScore;
  framework: Dimension[];
  engagementId: string;
  evidenceCount: number;
  onScoreUpdate: (s: ComponentScore) => void;
  onToggleApproval: (approved: boolean) => void;
  loading: string | null;
  role?: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
}) {
  const isAdmin = role === "school_admin";
  const comp = framework.flatMap((d) => d.components).find((c) => c.id === score.component_id);
  const dim = framework.find((d) => d.components.some((c) => c.id === score.component_id));
  const config = RATING_CONFIG[score.rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
  const isApproved = score.approved;

  const patchScore = async (field: string, value: unknown) => {
    await updateScore(engagementId, score.id, { [field]: value });
    onScoreUpdate({ ...score, [field]: value } as ComponentScore);
  };

  const patchListItem = async (field: string, list: string[], index: number, value: string) => {
    const updated = [...list];
    updated[index] = value;
    await patchScore(field, updated);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">{comp?.code}</span>
            <span className="text-base font-semibold text-gray-900">{comp?.name}</span>
          </div>
          {/* Approval toggle in detail panel (consultant only) */}
          {!isAdmin && (score.rating !== "not_rated" || isApproved) && (
            <button
              onClick={() => onToggleApproval(!isApproved)}
              disabled={loading === `approve-${score.id}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                isApproved
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {loading === `approve-${score.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isApproved ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Approved
                  <span className="text-[9px] text-emerald-500 ml-1">(click to unlock)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Approve & Lock
                </>
              )}
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400">{dim?.name}</div>
        <div className="flex items-center gap-3 mt-3">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: config.bg, color: config.color }}
          >
            {config.label}
          </span>
          {!isAdmin && <span className="text-xs text-gray-400">Confidence: {score.confidence}</span>}
          {!isAdmin && score.evidence_count > 0 ? (
            <button
              onClick={() => onNavigate?.("evidence", `component:${score.component_id}`)}
              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium flex items-center gap-1 transition"
            >
              {score.evidence_count} evidence items
              <ArrowUpRight className="w-3 h-3" />
            </button>
          ) : (
            !isAdmin && <span className="text-xs text-gray-400">{score.evidence_count} evidence items</span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Insufficient evidence warning in detail (consultant only) */}
        {!isAdmin && evidenceCount === 0 && score.rating === "not_rated" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <FileQuestion className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700">No Evidence Mapped</p>
              <p className="text-xs text-amber-600 mt-0.5">Upload or map evidence to this component to enable assessment.</p>
            </div>
          </div>
        )}

        {score.strengths && score.strengths.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-emerald-700 uppercase mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
            </h4>
            <ul className="space-y-1.5">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 pl-4 relative before:content-['+'] before:absolute before:left-0 before:text-emerald-500 before:font-semibold">
                  <EditableListItem value={s} readOnly={isAdmin || isApproved} onSave={(v) => patchListItem("strengths", score.strengths!, i, v)} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {score.gaps && score.gaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-700 uppercase mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {isAdmin ? "Areas for Growth" : "Gaps"}
            </h4>
            <ul className="space-y-1.5">
              {score.gaps.map((g, i) => (
                <li key={i} className="text-sm text-gray-600 pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-amber-500 before:font-semibold">
                  <EditableListItem value={g} readOnly={isAdmin || isApproved} onSave={(v) => patchListItem("gaps", score.gaps!, i, v)} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contradictions - hidden for school_admin role, contains internal consultant notes */}
        {!isAdmin && score.contradictions && score.contradictions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 uppercase mb-2">Contradictions</h4>
            <ul className="space-y-1.5">
              {score.contradictions.map((c, i) => (
                <li key={i} className="text-sm text-gray-600 bg-red-50 p-2 rounded">
                  <EditableListItem value={c} readOnly={isApproved} onSave={(v) => patchListItem("contradictions", score.contradictions!, i, v)} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rationale - hidden for school_admin role */}
        {!isAdmin && score.ai_rationale && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Rationale
              <AIFeedback
                engagementId={engagementId}
                targetType="component_score"
                targetId={score.id}
                visible={!isAdmin}
              />
            </h4>
            <div className="bg-gray-50 p-3 rounded-lg">
              <EditableText
                value={score.ai_rationale}
                multiline
                readOnly={isAdmin || isApproved}
                className="text-sm text-gray-600"
                onSave={(v) => patchScore("ai_rationale", v)}
              />
            </div>
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
                  <EditableListItem value={a} className="flex-1" readOnly={isAdmin || isApproved} onSave={(v) => patchListItem("suggested_actions", score.suggested_actions!, i, v)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function EditableListSection({ title, items, color, field, engagementId, summaryId, readOnly = false, onUpdate }: {
  title: string; items: string[]; color: string; field: string;
  engagementId: string; summaryId: string; readOnly?: boolean; onUpdate: (items: string[]) => void;
}) {
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
            <EditableListItem
              value={item}
              className="flex-1"
              readOnly={readOnly}
              onSave={async (v) => {
                const updated = [...items];
                updated[i] = v;
                await updateGlobalSummary(engagementId, summaryId, { [field]: updated });
                onUpdate(updated);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
