"use client";

import { useEffect, useState, useCallback } from "react";
import type { ActivityEntry, UserRole } from "@/lib/types";
import { getActivityLog } from "@/lib/api";
import {
  Upload, Sparkles, ShieldCheck, ClipboardList,
  FileText, BarChart3, Globe, Layers, Target,
  Clock, Activity,
} from "lucide-react";

interface Props {
  engagementId: string;
  role: UserRole;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  uploaded: Upload,
  scored: Sparkles,
  approved: ShieldCheck,
  unlocked: ShieldCheck,
  created: ClipboardList,
  generated: Sparkles,
  edited: FileText,
};

const TARGET_ICONS: Record<string, React.ElementType> = {
  evidence: FileText,
  component_score: BarChart3,
  dimension_summary: Layers,
  global_summary: Globe,
  data_request: ClipboardList,
  action_item: Target,
};

const ACTION_COLORS: Record<string, string> = {
  uploaded: "bg-blue-50 text-blue-600",
  scored: "bg-indigo-50 text-indigo-600",
  approved: "bg-emerald-50 text-emerald-600",
  unlocked: "bg-amber-50 text-amber-600",
  created: "bg-violet-50 text-violet-600",
  generated: "bg-purple-50 text-purple-600",
  edited: "bg-gray-50 text-gray-600",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function actionVerb(action: string): string {
  switch (action) {
    case "uploaded": return "uploaded";
    case "scored": return "assessed";
    case "approved": return "approved";
    case "unlocked": return "unlocked";
    case "created": return "created";
    case "generated": return "generated";
    case "edited": return "edited";
    default: return action;
  }
}

export default function ActivityView({ engagementId, role }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const data = await getActivityLog(engagementId);
      setEntries(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 15000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  // Group entries by day
  const grouped: { date: string; entries: ActivityEntry[] }[] = [];
  let currentDay = "";
  for (const entry of entries) {
    const day = new Date(entry.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (day !== currentDay) {
      currentDay = day;
      grouped.push({ date: day, entries: [] });
    }
    grouped[grouped.length - 1].entries.push(entry);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-indigo-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500">Recent actions and events in this engagement</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="w-6 h-6 text-gray-300 animate-pulse" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No activity yet</h3>
          <p className="text-xs text-gray-400">Actions like uploading evidence, running assessments, and approving findings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.date}</div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-1">
                {group.entries.map((entry) => {
                  const ActionIcon = ACTION_ICONS[entry.action] || Sparkles;
                  const colorClass = ACTION_COLORS[entry.action] || "bg-gray-50 text-gray-500";

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <ActionIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">{entry.actor}</span>
                          {" "}
                          <span className="text-gray-500">{actionVerb(entry.action)}</span>
                          {entry.target_label && (
                            <>
                              {" "}
                              <span className="font-medium text-gray-700">{entry.target_label}</span>
                            </>
                          )}
                        </p>
                        {entry.detail && (
                          <p className="text-xs text-gray-400 mt-0.5">{entry.detail}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-1">
                        {relativeTime(entry.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
