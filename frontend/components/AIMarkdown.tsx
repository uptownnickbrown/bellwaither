"use client";

import React from "react";
import { Sparkles } from "lucide-react";

/**
 * Lightweight markdown renderer for AI-generated content.
 * Handles: bullet/numbered lists, bold, italic, code, headings, @mentions.
 */
export default function AIMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let currentList: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (currentList.length === 0) return;
    const Tag = listOrdered ? "ol" : "ul";
    elements.push(
      <Tag
        key={`list-${elements.length}`}
        className={`my-1.5 space-y-1 ${listOrdered ? "list-decimal" : "list-disc"} pl-5 text-sm text-gray-700`}
      >
        {currentList.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </Tag>
    );
    currentList = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Bullet list: "- text" or "* text"
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    // Numbered list: "1. text" or "2) text"
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);

    if (bulletMatch) {
      if (currentList.length > 0 && listOrdered) flushList();
      listOrdered = false;
      currentList.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (currentList.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      currentList.push(numberedMatch[1]);
    } else {
      flushList();
      if (trimmed === "") continue;

      // Heading
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const cls =
          level === 1
            ? "text-sm font-bold text-gray-900 mt-3 mb-1"
            : level === 2
            ? "text-sm font-semibold text-gray-800 mt-2.5 mb-1"
            : "text-sm font-medium text-gray-800 mt-2 mb-0.5";
        elements.push(
          <p key={`h-${i}`} className={cls}>
            {formatInline(headingMatch[2])}
          </p>
        );
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-sm text-gray-700 leading-relaxed">
            {formatInline(trimmed)}
          </p>
        );
      }
    }
  }
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

/** Inline formatting: **bold**, *italic*, `code`, @mentions */
function formatInline(text: string): React.ReactNode {
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|@(Meridian AI|(?:Dr\.\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)+))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-gray-900">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          className="bg-gray-100 text-indigo-700 px-1 py-0.5 rounded text-xs font-mono"
        >
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      const isMeridian = match[5] === "Meridian AI";
      parts.push(
        <span
          key={match.index}
          className={`px-1 py-0.5 rounded font-medium ${
            isMeridian
              ? "bg-indigo-600 text-white"
              : "bg-indigo-100 text-indigo-800"
          }`}
        >
          {isMeridian && (
            <Sparkles className="w-3 h-3 inline mr-0.5 -mt-0.5" />
          )}
          @{match[5]}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}
