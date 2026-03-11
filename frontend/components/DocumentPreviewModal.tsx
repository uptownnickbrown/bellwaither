"use client";

import { useEffect, useState, useCallback } from "react";
import type { Evidence, Extraction, EvidenceMapping, Dimension } from "@/lib/types";
import { getExtractions, getEvidenceMappings, getFramework } from "@/lib/api";
import {
  X, FileText, FileSpreadsheet, Image, Mic, Calendar,
  HardDrive, Tag, Sparkles, ChevronDown, ChevronUp,
  GitBranch,
} from "lucide-react";

interface Props {
  evidence: Evidence;
  engagementId: string;
  onClose: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: Image,
  interview: Mic,
};

export default function DocumentPreviewModal({ evidence, engagementId, onClose }: Props) {
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [mappings, setMappings] = useState<EvidenceMapping[]>([]);
  const [components, setComponents] = useState<Record<string, { code: string; name: string }>>({});
  const [aiSectionOpen, setAiSectionOpen] = useState(true);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [exts, maps, dims] = await Promise.all([
          getExtractions(engagementId, evidence.id),
          getEvidenceMappings(engagementId, evidence.id),
          getFramework(),
        ]);
        setExtraction(exts[0] || null);
        setMappings(maps);

        // Build component lookup from framework dimensions
        const compMap: Record<string, { code: string; name: string }> = {};
        dims.forEach((dim: Dimension) => {
          dim.components.forEach((comp) => {
            compMap[comp.id] = { code: comp.code, name: comp.name };
          });
        });
        setComponents(compMap);
      } catch (err) {
        console.error("Failed to load preview data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [engagementId, evidence.id]);

  const Icon = TYPE_ICONS[evidence.evidence_type] || FileText;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Document preview"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ${
          visible ? "scale-100" : "scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {evidence.title || evidence.filename}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <FileText className="w-3.5 h-3.5" />
                {evidence.filename}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Tag className="w-3.5 h-3.5" />
                {evidence.file_type}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(evidence.uploaded_at)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <HardDrive className="w-3.5 h-3.5" />
                {formatFileSize(evidence.file_size)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                {evidence.evidence_type}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* AI Summary & Key Findings (collapsible) */}
              {extraction && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setAiSectionOpen(!aiSectionOpen)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-800">AI Summary & Key Findings</span>
                    {extraction.model_used && (
                      <span className="text-[10px] text-indigo-500 ml-1">({extraction.model_used})</span>
                    )}
                    <span className="ml-auto">
                      {aiSectionOpen
                        ? <ChevronUp className="w-4 h-4 text-indigo-400" />
                        : <ChevronDown className="w-4 h-4 text-indigo-400" />
                      }
                    </span>
                  </button>

                  {aiSectionOpen && (
                    <div className="p-4 space-y-4">
                      {/* Summary */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Summary</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{extraction.summary}</p>
                      </div>

                      {/* Key Findings */}
                      {extraction.key_findings && extraction.key_findings.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Key Findings</h4>
                          <ul className="space-y-2">
                            {extraction.key_findings.map((finding, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Component Mappings */}
              {mappings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-gray-400" />
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mapped Components</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mappings.map((m) => {
                      const comp = components[m.component_id];
                      return (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200"
                          title={m.rationale || undefined}
                        >
                          <span className="text-indigo-600 font-semibold">{comp?.code || "?"}</span>
                          {comp?.name || "Unknown Component"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Document Content */}
              {extraction?.raw_text ? (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Document Content</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
                      {extraction.raw_text}
                    </pre>
                  </div>
                </div>
              ) : !extraction ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                  <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    {evidence.processing_status === "processing"
                      ? "Document is still being processed..."
                      : evidence.processing_status === "failed"
                        ? "Document processing failed."
                        : "No content extraction available."}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
