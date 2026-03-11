"use client";

import { useState, useCallback, useEffect } from "react";
import type { Engagement, Dimension, UserRole } from "@/lib/types";
import { getThreads } from "@/lib/api";
import {
  Compass, LayoutDashboard, FileText, ClipboardList,
  Target, BarChart3, MessageSquare, Sparkles,
  ChevronDown, School, Users, Activity,
} from "lucide-react";
import DashboardView from "./views/DashboardView";
import FrameworkView from "./views/FrameworkView";
import EvidenceView from "./views/EvidenceView";
import DataRequestsView from "./views/DataRequestsView";
import ScoringView from "./views/ScoringView";
import ActionPlanView from "./views/ActionPlanView";
import MessagingView from "./views/MessagingView";
import ActivityView from "./views/ActivityView";
import CopilotPanel from "./CopilotPanel";

type Tab = "dashboard" | "framework" | "evidence" | "requests" | "scoring" | "actions" | "messages" | "activity";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "framework", label: "Framework", icon: Compass },
  { key: "evidence", label: "Evidence", icon: FileText },
  { key: "requests", label: "Data Requests", icon: ClipboardList },
  { key: "scoring", label: "Diagnostic", icon: BarChart3 },
  { key: "actions", label: "Action Plan", icon: Target },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "activity", label: "Activity", icon: Activity },
];

interface Props {
  engagement: Engagement;
  framework: Dimension[];
  engagements: Engagement[];
  onSelectEngagement: (e: Engagement) => void;
}

export default function EngagementWorkspace({ engagement, framework, engagements, onSelectEngagement }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [role, setRole] = useState<UserRole>("consultant");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [engDropdownOpen, setEngDropdownOpen] = useState(false);
  const [navTargetId, setNavTargetId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  // Fetch message thread counts for badge
  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const threads = await getThreads(engagement.id);
        const total = threads.reduce((sum, t) => sum + (t.message_count || 0), 0);
        if (mounted) setMessageCount(total);
      } catch { /* ignore */ }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [engagement.id]);

  const navigateTo = useCallback((tab: string, id?: string) => {
    setActiveTab(tab as Tab);
    setNavTargetId(id || null);
  }, []);

  const currentUser = role === "consultant"
    ? { name: "Sarah Chen", role: "Lead Consultant" }
    : { name: "Dr. Angela Rivera", role: "School Leader" };

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFC] overflow-hidden">
      {/* Top Bar + Tab Navigation: sticky so they remain visible when scrolling */}
      <div className="sticky top-0 z-30 flex-shrink-0">
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg text-gray-900 tracking-tight">Meridian</span>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="relative">
            <button
              onClick={() => setEngDropdownOpen(!engDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <School className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700">{engagement.school_name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {engDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-72 z-50">
                {engagements.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { onSelectEngagement(e); setEngDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition ${e.id === engagement.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                  >
                    <div className="font-medium">{e.school_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{e.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Role Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setRole("consultant")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                role === "consultant" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Consultant
            </button>
            <button
              onClick={() => setRole("school_admin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                role === "school_admin" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <School className="w-3.5 h-3.5" />
              School Admin
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Copilot Toggle */}
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              copilotOpen
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Copilot
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
              {currentUser.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="text-xs">
              <div className="font-medium text-gray-700">{currentUser.name}</div>
              <div className="text-gray-400">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === "messages" && messageCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded-full">
                  {messageCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 overflow-y-auto p-6 ${copilotOpen ? "" : ""}`}>
          {activeTab === "dashboard" && <DashboardView engagement={engagement} framework={framework} role={role} onNavigate={navigateTo} />}
          {activeTab === "framework" && <FrameworkView framework={framework} engagementId={engagement.id} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "evidence" && <EvidenceView engagementId={engagement.id} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "requests" && <DataRequestsView engagementId={engagement.id} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "scoring" && <ScoringView engagementId={engagement.id} framework={framework} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "actions" && <ActionPlanView engagementId={engagement.id} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "messages" && <MessagingView engagementId={engagement.id} role={role} onNavigate={navigateTo} navTargetId={navTargetId} onNavTargetConsumed={() => setNavTargetId(null)} />}
          {activeTab === "activity" && <ActivityView engagementId={engagement.id} role={role} />}
        </main>

        {/* Copilot Panel */}
        {copilotOpen && (
          <CopilotPanel
            engagementId={engagement.id}
            schoolName={engagement.school_name}
            context={activeTab}
            role={role}
            onClose={() => setCopilotOpen(false)}
            onNavigate={navigateTo}
          />
        )}
      </div>
    </div>
  );
}
