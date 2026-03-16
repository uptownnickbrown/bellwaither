"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Monitor, ArrowRight } from "lucide-react";

export default function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Avoid flash — render nothing until we know
  if (isMobile === null) return null;

  if (!isMobile) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="mx-auto mb-8 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Compass className="w-8 h-8 text-white" />
        </div>

        {/* Copy */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-3 tracking-tight">
          Meridian is built for big&nbsp;screens
        </h1>
        <p className="text-gray-500 text-[15px] leading-relaxed mb-2">
          The assessment workspace needs room to spread out — framework views,
          evidence panels, scoring rubrics side by side.
        </p>
        <p className="text-gray-500 text-[15px] leading-relaxed mb-8">
          Open Meridian on a laptop or desktop to get the full experience.
        </p>

        {/* Tour CTA */}
        <Link
          href="/tour"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-[15px] font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Take the feature tour
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Desktop hint */}
        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Monitor className="w-3.5 h-3.5" />
          <span>Best on screens 1024px and&nbsp;wider</span>
        </div>
      </div>
    </div>
  );
}
