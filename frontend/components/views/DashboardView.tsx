"use client";

import { useEffect, useState } from "react";
import type { Engagement, Dimension, ComponentScore, Evidence, DataRequest, GlobalSummary } from "@/lib/types";
import { RATING_CONFIG } from "@/lib/types";
import { getScores, getEvidence, getDataRequests, getGlobalSummary } from "@/lib/api";
import {
  School, MapPin, Users, Calendar, FileText,
  ClipboardList, BarChart3, CheckCircle2, AlertCircle,
  TrendingUp, ArrowUpRight,
} from "lucide-react";

interface Props {
  engagement: Engagement;
  framework: Dimension[];
}

export default function DashboardView({ engagement, framework }: Props) {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Evidence Items" value={evidence.length} color="indigo" />
        <StatCard icon={BarChart3} label="Components Scored" value={`${scoredComponents}/${totalComponents}`} color="emerald" />
        <StatCard icon={CheckCircle2} label="Confirmed" value={confirmedScores} color="blue" />
        <StatCard icon={ClipboardList} label="Pending Requests" value={pendingRequests} color="amber" />
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
          {scores.length === 0 ? (
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
                    <div key={score.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">{comp?.code}</span>
                          <span className="text-sm font-medium text-gray-800">{comp?.name}</span>
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
                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-700 truncate">{ev.title || ev.filename}</div>
                    <div className="text-xs text-gray-400">
                      {ev.uploaded_by} · {new Date(ev.uploaded_at).toLocaleDateString()}
                    </div>
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
