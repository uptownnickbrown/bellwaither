"use client";

import { useEffect, useState, use } from "react";
import { getSchool, getSchoolEngagements } from "@/lib/api";
import type { School, Engagement } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  School as SchoolIcon,
  Plus,
  MapPin,
  Users,
  GraduationCap,
  Building2,
} from "lucide-react";

const STAGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  setup: { label: "Setup", bg: "bg-gray-100", text: "text-gray-700" },
  assessment: { label: "Assessment", bg: "bg-indigo-100", text: "text-indigo-700" },
  plan_development: { label: "Plan Development", bg: "bg-amber-100", text: "text-amber-700" },
  implementation: { label: "Implementation", bg: "bg-green-100", text: "text-green-700" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [sch, engs] = await Promise.all([
          getSchool(id),
          getSchoolEngagements(id),
        ]);
        setSchool(sch);
        setEngagements(engs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load school data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading school...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading School</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Back to Schools
          </Link>
        </div>
      </div>
    );
  }

  if (!school) return null;

  const infoItems = [
    { icon: Building2, label: "Type", value: school.school_type },
    { icon: GraduationCap, label: "Grades", value: school.grade_levels },
    { icon: Users, label: "Enrollment", value: school.enrollment },
    { icon: MapPin, label: "Location", value: [school.district, school.state].filter(Boolean).join(", ") || null },
  ].filter((item) => item.value);

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 h-16 flex items-center">
        <div className="flex items-center gap-3 w-full">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900 tracking-tight">Meridian</span>
          <span className="text-gray-300 mx-2">/</span>
          <span className="text-lg text-gray-600 truncate">{school.name}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* School Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <SchoolIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-gray-900 mb-1">{school.name}</h1>
              {school.description && (
                <p className="text-sm text-gray-500 mb-3">{school.description}</p>
              )}
              {infoItems.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-3">
                  {infoItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-sm text-gray-600">
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">{item.label}:</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Engagements Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Engagements</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {engagements.length} engagement{engagements.length !== 1 ? "s" : ""} for this school
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Start New Engagement
          </Link>
        </div>

        {engagements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Compass className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">No Engagements Yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Start a new engagement to begin assessing this school.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start New Engagement
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {engagements.map((eng) => {
              const stage = STAGE_CONFIG[eng.stage] || STAGE_CONFIG.setup;
              return (
                <div
                  key={eng.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => router.push(`/?engagement=${eng.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">{eng.name}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stage.bg} ${stage.text}`}
                        >
                          {stage.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Created {formatDate(eng.created_at)}</span>
                        {eng.description && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="truncate">{eng.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
