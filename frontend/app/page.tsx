"use client";

import { Suspense, useEffect, useState } from "react";
import { getEngagements, getFramework, getEngagementFramework, getSchools } from "@/lib/api";
import type { Engagement, Dimension, EngagementDimension, School } from "@/lib/types";
import EngagementWorkspace from "@/components/EngagementWorkspace";
import MobileGate from "@/components/MobileGate";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Compass, ArrowRight, School as SchoolIcon, Sparkles,
  FileText, BarChart3, Target, MessageSquare, Shield,
  Layers, Play, BookOpen,
} from "lucide-react";
import { ToastProvider } from "@/components/Toast";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading Meridian...</p>
        </div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [framework, setFramework] = useState<Dimension[]>([]);
  const [engagementFramework, setEngagementFramework] = useState<EngagementDimension[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"landing" | "workspace">("landing");

  useEffect(() => {
    async function load() {
      try {
        const [engs, fw] = await Promise.all([getEngagements(), getFramework()]);
        setEngagements(engs);
        setFramework(fw);

        // If ?engagement= is in URL, jump straight to that engagement
        const engParam = searchParams.get("engagement");
        if (engParam) {
          const target = engs.find((e) => e.id === engParam);
          if (target) {
            const engFw = await getEngagementFramework(target.id);
            setEngagementFramework(engFw);
            setSelectedEngagement(target);
            setView("workspace");
          }
        }
      } catch {
        // Landing page works without API
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams]);

  const openEngagement = async (eng: Engagement) => {
    const engFw = await getEngagementFramework(eng.id);
    setEngagementFramework(engFw);
    setSelectedEngagement(eng);
    setView("workspace");
    // Update URL so the Meridian logo link (href="/") navigates away from workspace
    router.push(`/?engagement=${eng.id}`, { scroll: false });
  };

  // Workspace view
  if (view === "workspace" && selectedEngagement) {
    return (
      <MobileGate>
        <ToastProvider>
          <EngagementWorkspace
            engagement={selectedEngagement}
            framework={framework}
            engagementFramework={engagementFramework}
            engagements={engagements}
            onSelectEngagement={openEngagement}
          />
        </ToastProvider>
      </MobileGate>
    );
  }

  // Find the demo engagement (Lincoln)
  const demoEngagement = engagements.find((e) => e.school_name === "Lincoln Innovation Academy") || engagements[0];

  // ---- Landing Page ----
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">Meridian</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tour" className="text-sm text-gray-500 hover:text-gray-700 transition px-3 py-1.5">
              Feature Tour
            </Link>
            {demoEngagement && (
              <button
                onClick={() => openEngagement(demoEngagement)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition px-3 py-1.5"
              >
                View Demo
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600">AI-powered school quality assessment</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.15] mb-5">
            Understand your school deeply.<br />
            Improve it with confidence.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-10">
            Meridian operationalizes Bellwether's School Quality Framework into a two-sided workspace where
            consultants and school teams collaborate on evidence-based assessment across 9 dimensions of school quality.
            AI handles extraction, mapping, and synthesis. Humans make the decisions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding"
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
              <SchoolIcon className="w-4 h-4" />
              Onboard a New School
            </Link>
            {demoEngagement && !loading && (
              <button
                onClick={() => openEngagement(demoEngagement)}
                className="px-6 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200 shadow-sm"
              >
                <Play className="w-4 h-4 text-indigo-500" />
                View an Engagement in Action
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Dashboard screenshot */}
      <div className="max-w-5xl mx-auto px-6 mb-24">
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
          <img src="/screenshots/01_dashboard.png" alt="Meridian consultant dashboard" className="w-full block" loading="lazy" />
        </div>
      </div>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">How Meridian works</h2>
          <p className="text-gray-600 max-w-xl mx-auto">A structured workflow from evidence collection through actionable improvement plans, powered by a 4-layer AI architecture.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { icon: FileText, title: "Collect Evidence", desc: "Upload documents, spreadsheets, and data. AI automatically extracts key findings and maps them to framework components." },
            { icon: BarChart3, title: "Assess Quality", desc: "AI synthesizes evidence into component ratings, dimension patterns, and an executive summary. Consultants review and confirm." },
            { icon: Target, title: "Plan Improvement", desc: "Assessment findings translate into prioritized action items with evidence-based rationale and owner accountability." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature sections */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-24 space-y-32">

          {/* Evidence + AI Extraction */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full mb-4">
                <FileText className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Evidence</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI-powered document analysis</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Upload any school document — PDFs, spreadsheets, reports, observation notes. Meridian's extraction layer
                produces a structured summary, numbered key findings, and automatic component mappings.
                Everything is editable and traceable back to the source.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Deleting evidence automatically marks affected component scores as stale, so you always know when
                assessments need to be refreshed.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md">
              <img src="/screenshots/03b_evidence_detail.png" alt="Evidence detail with AI extraction" className="w-full" loading="lazy" />
            </div>
          </div>

          {/* Diagnostic */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 rounded-xl overflow-hidden border border-gray-200 shadow-md">
              <img src="/screenshots/05c_diagnostic_component_detail.png" alt="Component assessment detail" className="w-full" loading="lazy" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-full mb-4">
                <BarChart3 className="w-3 h-3 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Diagnostic</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">4-layer AI assessment</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                The diagnostic workspace implements a structured AI hierarchy: evidence extraction, component assessment,
                dimension synthesis, and executive summary. Each layer builds on the one below, with explicit confidence
                levels and evidence citations at every step.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Ratings follow Bellwether's 4-point scale. Every strength, gap, and recommendation traces back to
                specific documents and data points — no black-box conclusions.
              </p>
            </div>
          </div>

          {/* Two-sided */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full mb-4">
                <Shield className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Two-Sided</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">One engagement, two perspectives</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Consultants and school teams see the same engagement through role-appropriate lenses.
                Consultants get the full diagnostic toolkit. School admins see a progress-and-action view:
                what's been assessed, what needs their input, and how to respond to data requests.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Messaging, data requests, and activity logs are shared. "Gaps" become "Areas for Growth" in the school view.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md">
              <img src="/screenshots/10_admin_dashboard.png" alt="School admin dashboard" className="w-full" loading="lazy" />
            </div>
          </div>

          {/* Copilot + Messaging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 rounded-xl overflow-hidden border border-gray-200 shadow-md">
              <img src="/screenshots/09_copilot_panel.png" alt="AI Copilot panel" className="w-full" loading="lazy" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-full mb-4">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">AI Copilot</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Contextual AI on every screen</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                The copilot knows your current context — which tab you're on, what evidence exists, what's been scored.
                Ask it to find evidence, explain ratings, identify gaps, draft follow-up requests, or suggest next steps.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                It can take action too: say "Create a data request for PD logs and assign it to Tom" and it will create
                the request directly, with a confirmation card in the chat.
              </p>
            </div>
          </div>

          {/* Custom Frameworks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-full mb-4">
                <Layers className="w-3 h-3 text-amber-600" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Custom Frameworks</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Every school gets its own framework</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                The standard SQF is the starting point, not the boundary. An AI-guided onboarding interview
                learns about your school's identity, programs, and priorities, then proposes a customized framework —
                selecting the dimensions that matter, adding custom components, and tailoring success criteria.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                The Framework Studio lets you explore, edit, and refine your framework in a split-screen with
                an AI advisor. The standard SQF components maintain lineage for cross-school benchmarking.
              </p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 border border-indigo-100">
              <div className="space-y-3">
                {["Organizational Purpose", "Academic Program", "Student Culture", "Talent", "Quaker Identity"].map((name, i) => (
                  <div key={name} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm border border-gray-100">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ["#6366F1", "#8B5CF6", "#EC4899", "#F43F5E", "#22C55E"][i] }} />
                    <span className="text-sm font-medium text-gray-700">{name}</span>
                    {i === 4 && <span className="ml-auto px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded">Custom</span>}
                  </div>
                ))}
                <div className="flex items-center gap-3 bg-white/60 rounded-lg px-4 py-2.5 border border-dashed border-gray-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <span className="text-sm text-gray-400 italic">3 dimensions removed</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-gray-100 bg-[#FAFBFC]">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Try it yourself</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            Explore the demo engagement with pre-loaded evidence and scores, or start fresh with the
            AI-guided onboarding flow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding"
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
              <SchoolIcon className="w-4 h-4" />
              Onboard a New School
            </Link>
            {demoEngagement && (
              <button
                onClick={() => openEngagement(demoEngagement)}
                className="px-6 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200 shadow-sm"
              >
                <Play className="w-4 h-4 text-indigo-500" />
                View Demo Engagement
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">
          Meridian by Bellwether. Built around the School Quality Framework.
        </p>
      </footer>
    </div>
  );
}
