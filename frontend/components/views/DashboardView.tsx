"use client";

import { useEffect, useState } from "react";
import type { Engagement, Dimension, ComponentScore, Evidence, DataRequest, GlobalSummary, UserRole } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import { getScores, getEvidence, getDataRequests, getGlobalSummary } from "@/lib/api";
import {
  School, MapPin, Users, Calendar, FileText,
  ClipboardList, BarChart3, CheckCircle2, AlertCircle,
  TrendingUp, ArrowUpRight, Clock, Compass, FolderOpen,
  CircleDot, MessageSquare, Upload, CircleCheckBig,
} from "lucide-react";

interface Props {
  engagement: Engagement;
  framework: Dimension[];
  role?: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
}

export default function DashboardView({ engagement, framework, role = "consultant", onNavigate }: Props) {
  const isAdmin = role === "school_admin";
  const [scores, setScores] = useState<ComponentScore[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);

  useEffect(() => {
    Promise.all([
      getScores(engagement.id),
      getEvidence(engagement.id),
      getDataRequests(engagement.id),
      getGlobalSummary(engagement.id).catch(() => null),
    ]).then(([s, e, r, g]) => {
      setScores(s);
      setEvidence(e);
      setRequests(r);
      setGlobalSummary(g);
    });
  }, [engagement.id]);

  const totalComponents = framework.reduce((acc, d) => acc + d.components.length, 0);
  const scoredComponents = scores.filter((s) => s.rating !== "not_rated").length;
  const confirmedScores = scores.filter((s) => s.status === "confirmed").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const submittedRequests = requests.filter((r) => r.status === "submitted").length;
  const acceptedRequests = requests.filter((r) => r.status === "accepted").length;
  const inProgressRequests = requests.filter((r) => r.status === "in_progress").length;
  const progressPct = totalComponents > 0 ? Math.round((scoredComponents / totalComponents) * 100) : 0;

  // Build score map for framework visualization
  const scoreMap = new Map(scores.map((s) => [s.component_id, s]));

  const stageLabel = {
    setup: "Setup",
    assessment: "Assessment",
    plan_development: "Plan Development",
    implementation: "Implementation",
  }[engagement.stage] || engagement.stage;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* School Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
              <School className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{engagement.school_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{engagement.name}</p>
              <div className="flex items-center gap-4 mt-2">
                {engagement.district && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" /> {engagement.district}{engagement.state ? `, ${engagement.state}` : ""}
                  </span>
                )}
                {engagement.grade_levels && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="w-3 h-3" /> Grades {engagement.grade_levels} | {engagement.enrollment} students
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" /> Started {new Date(engagement.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
              {stageLabel}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              {engagement.school_type}
            </span>
          </div>
        </div>
      </div>

      {/* === SCHOOL ADMIN DASHBOARD === */}
      {isAdmin ? (
        <>
          {/* Top row: Progress ring + Your Action Items */}
          <div className="grid grid-cols-3 gap-6">
            {/* Progress overview — left column */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
              <div className="relative w-28 h-28 mb-4">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={progressPct >= 75 ? "#10B981" : progressPct >= 25 ? "#6366F1" : "#E5E7EB"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPct / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{progressPct}%</span>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700">Assessment Progress</p>
              <p className="text-xs text-gray-400 mt-1">{scoredComponents} of {totalComponents} areas reviewed</p>
            </div>

            {/* Your Action Items — right two columns */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-indigo-500" />
                Your Action Items
              </h2>
              <div className="space-y-3">
                {pendingRequests > 0 && (
                  <div
                    className="flex items-center gap-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl cursor-pointer hover:border-amber-200 hover:shadow-sm transition group"
                    onClick={() => onNavigate?.("requests")}
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-amber-100">
                      <Upload className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900">
                        {pendingRequests} data {pendingRequests === 1 ? "request needs" : "requests need"} your response
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        The consulting team is waiting on materials from you to continue the review.
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition flex-shrink-0" />
                  </div>
                )}

                {inProgressRequests > 0 && (
                  <div
                    className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer hover:border-blue-200 hover:shadow-sm transition group"
                    onClick={() => onNavigate?.("requests")}
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-blue-100">
                      <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900">
                        {inProgressRequests} {inProgressRequests === 1 ? "request" : "requests"} in progress
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        You&apos;ve started gathering these — finish and submit when ready.
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition flex-shrink-0" />
                  </div>
                )}

                {submittedRequests > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-900">
                        {submittedRequests} {submittedRequests === 1 ? "submission" : "submissions"} under review
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        The consulting team is reviewing materials you&apos;ve submitted.
                      </p>
                    </div>
                  </div>
                )}

                {pendingRequests === 0 && inProgressRequests === 0 && submittedRequests === 0 && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
                      <CircleCheckBig className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">You&apos;re all caught up</p>
                      <p className="text-xs text-gray-500 mt-0.5">No outstanding requests right now. The team will reach out if anything else is needed.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Engagement Timeline — mini stats row */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={FolderOpen} label="Documents Submitted" value={evidence.length} color="indigo" onClick={() => onNavigate?.("evidence")} />
            <StatCard icon={ClipboardList} label="Requests Completed" value={acceptedRequests} color="emerald" onClick={() => onNavigate?.("requests")} />
            <StatCard icon={MessageSquare} label="Open Conversations" value={requests.filter(r => r.status !== "accepted").length} color="blue" onClick={() => onNavigate?.("messages")} />
            <StatCard icon={BarChart3} label="Areas Reviewed" value={`${scoredComponents}/${totalComponents}`} color="amber" onClick={() => onNavigate?.("scoring")} />
          </div>

          {/* Assessment Overview heatmap — always visible */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Assessment Overview</h2>
              {scoredComponents < totalComponents && (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Review in progress — {totalComponents - scoredComponents} areas remaining
                </span>
              )}
            </div>
            <div className="space-y-3">
              {framework.map((dim) => {
                const dimScored = dim.components.filter(c => scoreMap.has(c.id) && scoreMap.get(c.id)!.rating !== "not_rated").length;
                return (
                  <div key={dim.id} className="flex items-center gap-3">
                    <div className="w-44 flex-shrink-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{dim.number}. {dim.name}</div>
                      <div className="text-[10px] text-gray-400">{dimScored}/{dim.components.length} reviewed</div>
                    </div>
                    <div className="flex gap-1 flex-1">
                      {dim.components.map((comp) => {
                        const score = scoreMap.get(comp.id);
                        const rating = score?.rating || "not_rated";
                        const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                        return (
                          <div
                            key={comp.id}
                            className="h-8 rounded flex-1 flex items-center justify-center text-[10px] font-medium transition-all hover:scale-105 cursor-pointer"
                            style={{ backgroundColor: config.bg, color: config.color, minWidth: "28px" }}
                            title={`${comp.code} ${comp.name}: ${rating === "not_rated" ? "Pending review" : config.label}`}
                            onClick={() => onNavigate?.("scoring", comp.id)}
                          >
                            {comp.code}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
              {Object.entries(RATING_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: config.bg, border: `1px solid ${config.color}` }} />
                  {key === "not_rated" ? "Pending" : config.label}
                </div>
              ))}
            </div>
          </div>

          {/* Two column: Findings (as available) + Recent Documents */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Findings So Far</h2>
              {scoredComponents === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Findings will appear here as the review progresses.</p>
                  <p className="text-xs text-gray-300 mt-1">Submitting requested materials helps move things along.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scores
                    .filter((s) => s.rating !== "not_rated")
                    .sort((a, b) => {
                      const order = ["needs_improvement", "developing", "meeting_expectations", "excelling"];
                      return order.indexOf(a.rating) - order.indexOf(b.rating);
                    })
                    .slice(0, 6)
                    .map((score) => {
                      const comp = framework.flatMap((d) => d.components).find((c) => c.id === score.component_id);
                      const config = RATING_CONFIG[score.rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                      return (
                        <div
                          key={score.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition group"
                          onClick={() => onNavigate?.("scoring", score.component_id)}
                        >
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: config.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500">{comp?.code}</span>
                              <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition">{comp?.name}</span>
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto flex-shrink-0"
                                style={{ backgroundColor: config.bg, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </div>
                            {score.strengths && score.strengths.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{score.strengths[0]}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Submitted Documents</h2>
              {evidence.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No documents submitted yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Upload materials through the Evidence tab or in response to data requests.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {evidence.slice(0, 8).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition cursor-pointer group"
                      onClick={() => onNavigate?.("evidence", ev.id)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-600 transition">{ev.title || ev.filename}</div>
                        <div className="text-xs text-gray-400">{new Date(ev.uploaded_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* === CONSULTANT DASHBOARD === */}
          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-4">
            <StatCard icon={FileText} label="Evidence Items" value={evidence.length} color="indigo" onClick={() => onNavigate?.("evidence")} />
            <StatCard
              icon={BarChart3}
              label="Components Scored"
              value={`${scoredComponents}/${totalComponents}`}
              color="emerald"
              onClick={() => onNavigate?.("scoring")}
            />
            <StatCard icon={CheckCircle2} label="Confirmed" value={confirmedScores} color="blue" onClick={() => onNavigate?.("scoring")} />
            <StatCard
              icon={ClipboardList}
              label="Pending Requests"
              value={pendingRequests}
              color="amber"
              onClick={() => onNavigate?.("requests")}
            />
          </div>

          {/* Framework Heat Map */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">SQF Assessment Progress</h2>
            <div className="space-y-3">
              {framework.map((dim) => (
                <div key={dim.id} className="flex items-center gap-3">
                  <div className="w-40 flex-shrink-0">
                    <div className="text-xs font-medium text-gray-700 truncate">{dim.number}. {dim.name}</div>
                  </div>
                  <div className="flex gap-1 flex-1">
                    {dim.components.map((comp) => {
                      const score = scoreMap.get(comp.id);
                      const rating = score?.rating || "not_rated";
                      const config = RATING_CONFIG[rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                      return (
                        <div
                          key={comp.id}
                          className="h-8 rounded flex-1 flex items-center justify-center text-[10px] font-medium transition-all hover:scale-105 cursor-pointer"
                          style={{ backgroundColor: config.bg, color: config.color, minWidth: "28px" }}
                          title={`${comp.code} ${comp.name}: ${config.label}`}
                          onClick={() => onNavigate?.("scoring", comp.id)}
                        >
                          {comp.code}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
              {Object.entries(RATING_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: config.bg, border: `1px solid ${config.color}` }} />
                  {config.label}
                </div>
              ))}
            </div>
          </div>

          {/* Two Column: Key Findings + Recent Activity */}
          <div className="grid grid-cols-2 gap-6">
            {/* Key Findings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Key Findings (Preliminary)</h2>
              {scoredComponents === 0 ? (
                <p className="text-sm text-gray-400">No component assessments yet. Upload evidence and run AI assessments to see findings.</p>
              ) : (
                <div className="space-y-3">
                  {scores
                    .filter((s) => s.rating !== "not_rated")
                    .sort((a, b) => {
                      const order = ["needs_improvement", "developing", "meeting_expectations", "excelling"];
                      return order.indexOf(a.rating) - order.indexOf(b.rating);
                    })
                    .slice(0, 6)
                    .map((score) => {
                      const comp = framework.flatMap((d) => d.components).find((c) => c.id === score.component_id);
                      const config = RATING_CONFIG[score.rating as keyof typeof RATING_CONFIG] || RATING_CONFIG.not_rated;
                      return (
                        <div
                          key={score.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition group"
                          onClick={() => onNavigate?.("scoring", score.component_id)}
                        >
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: config.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500">{comp?.code}</span>
                              <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition">{comp?.name}</span>
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto flex-shrink-0"
                                style={{ backgroundColor: config.bg, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </div>
                            {score.gaps && score.gaps.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{score.gaps[0]}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Recent Evidence */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Evidence</h2>
              {evidence.length === 0 ? (
                <p className="text-sm text-gray-400">No evidence uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {evidence.slice(0, 8).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition cursor-pointer group"
                      onClick={() => onNavigate?.("evidence", ev.id)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-600 transition">{ev.title || ev.filename}</div>
                        <div className="text-xs text-gray-400">{ev.uploaded_by} · {new Date(ev.uploaded_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ev.processing_status === "completed" ? "bg-emerald-400" :
                        ev.processing_status === "processing" ? "bg-amber-400 animate-pulse" :
                        ev.processing_status === "failed" ? "bg-red-400" : "bg-gray-300"
                      }`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: React.ElementType; label: string; value: string | number; color: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 ${onClick ? "cursor-pointer hover:border-indigo-300 hover:shadow-sm transition group" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
        {onClick && (
          <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition" />
        )}
      </div>
    </div>
  );
}
