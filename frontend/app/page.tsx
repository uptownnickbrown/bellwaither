"use client";

import { useEffect, useState } from "react";
import { getEngagements, getFramework } from "@/lib/api";
import type { Engagement, Dimension } from "@/lib/types";
import EngagementWorkspace from "@/components/EngagementWorkspace";
import MobileGate from "@/components/MobileGate";
import { Compass, ArrowRight, School } from "lucide-react";
import { ToastProvider } from "@/components/Toast";

export default function Home() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [framework, setFramework] = useState<Dimension[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [engs, fw] = await Promise.all([getEngagements(), getFramework()]);
        setEngagements(engs);
        setFramework(fw);
        if (engs.length > 0) setSelectedEngagement(engs[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading Meridian...</p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <p className="text-xs text-gray-400">Make sure the Meridian API server is running on port 8000.</p>
        </div>
      </div>
    );
  }

  if (!selectedEngagement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <Compass className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Engagements Found</h2>
          <p className="text-sm text-gray-500">Create your first school quality assessment to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <MobileGate>
      <ToastProvider>
        <EngagementWorkspace
          engagement={selectedEngagement}
          framework={framework}
          engagements={engagements}
          onSelectEngagement={setSelectedEngagement}
        />
      </ToastProvider>
    </MobileGate>
  );
}
