"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import Link from "next/link";
import { ArrowLeft, Compass, Loader2 } from "lucide-react";
import type { Components } from "react-markdown";

/* ── Custom renderers ──────────────────────────────────────────────────
   These turn generic markdown into a polished, designed page.
   react-markdown parses the TOUR.md; these components control every
   visual detail. Update the markdown, and the page updates.          */

const components: Components = {
  h1: ({ children }) => (
    <header className="text-center mb-16">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold mb-6">
        <Compass className="w-3.5 h-3.5" />
        Product Tour
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
        {children}
      </h1>
    </header>
  ),

  h2: ({ children }) => {
    const text = String(children);
    // Section dividers like "Consultant View", "School Admin View"
    if (text === "Consultant View" || text === "School Admin View" || text === "Cross-Navigation") {
      return (
        <div className="mt-20 mb-10">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{children}</span>
            <div className="h-px flex-1 bg-gradient-to-l from-indigo-200 to-transparent" />
          </div>
        </div>
      );
    }
    return <h2 className="text-2xl font-bold text-gray-900 mt-20 mb-4">{children}</h2>;
  },

  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-800 mt-10 mb-3">{children}</h3>
  ),

  p: ({ children, node }) => {
    // Check if this paragraph contains only an img — if so, render it as a figure
    const childArr = node?.children;
    if (childArr?.length === 1 && childArr[0].type === "element" && childArr[0].tagName === "img") {
      return <>{children}</>;
    }
    return <p className="text-[15px] text-gray-500 leading-relaxed mb-5 max-w-2xl">{children}</p>;
  },

  strong: ({ children }) => (
    <strong className="text-gray-700 font-semibold">{children}</strong>
  ),

  code: ({ children }) => (
    <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-indigo-700">{children}</code>
  ),

  hr: () => (
    <div className="my-20 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
  ),

  img: ({ src, alt }) => (
    <figure className="my-8">
      <div className="rounded-xl overflow-hidden border border-gray-200/80 shadow-md hover:shadow-lg transition-shadow duration-300">
        <img
          src={src}
          alt={alt || ""}
          className="w-full block"
          loading="lazy"
        />
      </div>
      {alt && (
        <figcaption className="text-[13px] text-gray-400 mt-3 text-center">{alt}</figcaption>
      )}
    </figure>
  ),
};

/* ── Page ───────────────────────────────────────────────────────────── */

export default function TourPage() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/TOUR.md")
      .then((r) => r.text())
      .then((md) => {
        // Rewrite relative image paths to absolute for Next.js public dir
        const fixed = md.replace(
          /src="screenshots\//g,
          'src="/screenshots/'
        );
        setContent(fixed);
      });
  }, []);

  if (content === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Floating nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meridian
          </Link>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">Feature Tour</span>
          </div>
          <div className="w-[130px]" />
        </div>
      </nav>

      {/* Content */}
      <article className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>
          {content}
        </ReactMarkdown>
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Meridian
        </Link>
      </footer>
    </div>
  );
}
