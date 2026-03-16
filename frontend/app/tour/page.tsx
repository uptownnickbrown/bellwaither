"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TourBlock {
  type: "text" | "image" | "subheading";
  content: string;
  alt?: string;
}

interface TourSection {
  title: string;
  blocks: TourBlock[];
}

interface TourData {
  subtitle: string;
  dividers: Map<number, string>; // section index → divider label
  sections: TourSection[];
  closingLabel: string;
  closingText: string[];
}

/* ── Parser ─────────────────────────────────────────────────────────── */

function parseTour(md: string): TourData {
  const lines = md.split("\n");
  const sections: TourSection[] = [];
  const dividers = new Map<number, string>();
  const subtitleLines: string[] = [];
  const closingText: string[] = [];
  let closingLabel = "";
  let current: TourSection | null = null;
  let inHero = true;
  let pastLastSection = false;

  for (const line of lines) {
    // Skip the h1 title
    if (line.startsWith("# ") && !line.startsWith("## ")) continue;

    // h2 = section dividers or closing sections
    if (line.startsWith("## ")) {
      const label = line.replace(/^## /, "").trim();
      if (label === "Demo") {
        pastLastSection = true;
        closingLabel = label;
        continue;
      }
      inHero = false;
      dividers.set(sections.length, label);
      continue;
    }

    // h3 = feature section
    if (line.startsWith("### ")) {
      inHero = false;
      pastLastSection = false;
      current = { title: line.replace(/^### /, "").trim(), blocks: [] };
      sections.push(current);
      continue;
    }

    // Horizontal rules
    if (line.trim() === "---") continue;

    // Blank lines
    if (line.trim() === "") continue;

    // Collect hero subtitle
    if (inHero) {
      subtitleLines.push(line.trim());
      continue;
    }

    // Closing text (Demo section)
    if (pastLastSection) {
      if (line.trim()) closingText.push(line.trim());
      continue;
    }

    if (!current) continue;

    // Images (<img> tags)
    const imgMatch = line.match(/src="([^"]+)".*?alt="([^"]*)"/);
    if (imgMatch) {
      const src = imgMatch[1].replace(/^screenshots\//, "/screenshots/");
      current.blocks.push({ type: "image", content: src, alt: imgMatch[2] });
      continue;
    }

    // Sub-headings (bold at start of line like **Components**)
    if (line.match(/^\*\*[^*]+\*\*\s*—/)) {
      const subMatch = line.match(/^\*\*([^*]+)\*\*\s*—\s*(.*)/);
      if (subMatch) {
        current.blocks.push({ type: "subheading", content: subMatch[1] });
        current.blocks.push({ type: "text", content: subMatch[2] });
        continue;
      }
    }

    // Regular text
    current.blocks.push({ type: "text", content: line.trim() });
  }

  return {
    subtitle: subtitleLines.join(" "),
    dividers,
    sections,
    closingLabel,
    closingText,
  };
}

/* ── Inline markdown renderer (bold, code, entities) ───────────────── */

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Process **bold**, `code`, and &apos; entities
  const regex = /\*\*(.+?)\*\*|`([^`]+)`|&apos;|&ldquo;|&rdquo;/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++} className="text-gray-700 font-semibold">{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={key++} className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-indigo-700">{match[2]}</code>);
    } else {
      parts.push(match[0] === "&apos;" ? "'" : match[0] === "&ldquo;" ? "\u201C" : "\u201D");
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

/* ── Section component (Stripe-style on desktop) ───────────────────── */

function FeatureSection({ section }: { section: TourSection }) {
  const textBlocks = section.blocks.filter((b) => b.type === "text" || b.type === "subheading");
  const imageBlocks = section.blocks.filter((b) => b.type === "image");

  return (
    <>
      {/* Mobile: natural document order */}
      <div className="lg:hidden mb-24">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{section.title}</h3>
        <div className="space-y-4">
          {section.blocks.map((block, i) =>
            block.type === "subheading" ? (
              <h4 key={i} className="text-base font-semibold text-gray-800 mt-6 mb-1">
                {block.content}
              </h4>
            ) : block.type === "image" ? (
              <figure key={i} className="my-6">
                <div className="rounded-xl overflow-hidden border border-gray-200/80 shadow-md">
                  <img src={block.content} alt={block.alt || ""} className="w-full block" loading="lazy" />
                </div>
                {block.alt && (
                  <figcaption className="text-[12px] text-gray-400 mt-2.5 text-center">{block.alt}</figcaption>
                )}
              </figure>
            ) : (
              <p key={i} className="text-[15px] text-gray-500 leading-relaxed">
                <InlineMarkdown text={block.content} />
              </p>
            )
          )}
        </div>
      </div>

      {/* Desktop: split layout with sticky text */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-12 xl:gap-16 mb-32">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h3 className="text-xl font-bold text-gray-900 mb-4">{section.title}</h3>
          <div className="space-y-4">
            {textBlocks.map((block, i) =>
              block.type === "subheading" ? (
                <h4 key={i} className="text-base font-semibold text-gray-800 mt-6 mb-1">
                  {block.content}
                </h4>
              ) : (
                <p key={i} className="text-[15px] text-gray-500 leading-relaxed">
                  <InlineMarkdown text={block.content} />
                </p>
              )
            )}
          </div>
        </div>
        <div className="space-y-6">
          {imageBlocks.map((block, i) => (
            <figure key={i}>
              <div className="rounded-xl overflow-hidden border border-gray-200/80 shadow-md hover:shadow-lg transition-shadow duration-300">
                <img src={block.content} alt={block.alt || ""} className="w-full block" loading="lazy" />
              </div>
              {block.alt && (
                <figcaption className="text-[12px] text-gray-400 mt-2.5 text-center">{block.alt}</figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function TourPage() {
  const [tour, setTour] = useState<TourData | null>(null);

  useEffect(() => {
    fetch("/TOUR.md")
      .then((r) => r.text())
      .then((md) => setTour(parseTour(md)));
  }, []);

  if (!tour) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Meridian
          </Link>
          <span className="text-sm font-semibold text-gray-800">Meridian</span>
          <div className="w-[120px]" />
        </div>
      </nav>

      {/* Hero — compact */}
      <header className="pt-20 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Feature Tour
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-xl">
            <InlineMarkdown text={tour.subtitle} />
          </p>
        </div>
      </header>

      {/* Content */}
      <article className="max-w-6xl mx-auto px-6 pb-16">
        {tour.sections.map((section, i) => (
          <div key={i}>
            {/* Section divider if one exists at this index */}
            {tour.dividers.has(i) && (
              <div className="flex items-center gap-3 mb-12 mt-8">
                <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
                  {tour.dividers.get(i)}
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-indigo-200 to-transparent" />
              </div>
            )}
            <FeatureSection section={section} />
          </div>
        ))}

        {/* Closing section */}
        {tour.closingText.length > 0 && (
          <div className="mt-8 mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
                {tour.closingLabel}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-indigo-200 to-transparent" />
            </div>
            <div className="max-w-xl space-y-3">
              {tour.closingText.map((line, i) => (
                <p key={i} className="text-[15px] text-gray-500 leading-relaxed">
                  <InlineMarkdown text={line} />
                </p>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Footer — minimal */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <Link href="/" className="text-sm text-gray-400 hover:text-indigo-600 transition">
          Back to Meridian
        </Link>
      </footer>
    </div>
  );
}
