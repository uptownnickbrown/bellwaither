"use client";

import { useEffect, useState, useCallback } from "react";
import type { Evidence, Extraction, EvidenceMapping, UserRole } from "@/lib/types";
import { getEvidence, getExtractions, getEvidenceMappings, uploadEvidence, getEvidenceDownloadUrl, updateExtraction, getComponentEvidenceIds, deleteEvidence, updateEvidence } from "@/lib/api";
import EditableText, { EditableListItem } from "@/components/EditableText";
import {
  FileText, Upload, Search, Filter, ChevronDown,
  CheckCircle2, Clock, AlertCircle, X, Sparkles,
  FileSpreadsheet, Image, Mic, Eye, Download, ArrowUpRight,
  FolderDown, Loader2, Trash2,
} from "lucide-react";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Props {
  engagementId: string;
  role: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: Image,
  interview: Mic,
};

export default function EvidenceView({ engagementId, role, onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [mappings, setMappings] = useState<EvidenceMapping[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; status: "pending" | "uploading" | "done" | "failed" }[]>([]);
  const [search, setSearch] = useState("");
  const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [componentFilter, setComponentFilter] = useState<{ id: string; label: string; evidenceIds: string[] } | null>(null);
  const [evidenceToDelete, setEvidenceToDelete] = useState<Evidence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadEvidence = useCallback(() => {
    getEvidence(engagementId).then(setEvidence);
  }, [engagementId]);

  useEffect(() => { loadEvidence(); }, [loadEvidence]);

  // Handle incoming navigation target
  useEffect(() => {
    if (navTargetId && evidence.length > 0) {
      if (navTargetId.startsWith("component:")) {
        const compId = navTargetId.slice("component:".length);
        getComponentEvidenceIds(engagementId, compId).then((ids) => {
          setComponentFilter({ id: compId, label: "", evidenceIds: ids });
          // Auto-select first matching evidence
          const first = evidence.find((e) => ids.includes(e.id));
          if (first) setSelectedEvidence(first);
        });
      } else {
        const target = evidence.find((e) => e.id === navTargetId);
        if (target) {
          setSelectedEvidence(target);
        }
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, evidence, engagementId, onNavTargetConsumed]);

  useEffect(() => {
    if (selectedEvidence) {
      getExtractions(engagementId, selectedEvidence.id)
        .then((exts) => setExtraction(exts[0] || null));
      getEvidenceMappings(engagementId, selectedEvidence.id)
        .then(setMappings)
        .catch(() => setMappings([]));
    }
  }, [selectedEvidence, engagementId]);

  const getEvidenceType = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return "spreadsheet";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) return "image";
    return "document";
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const uploadedBy = role === "consultant" ? "Sarah Chen" : "Dr. Angela Rivera";
    const queue = files.map((f) => ({ name: f.name, status: "pending" as const }));
    setUploadQueue(queue);
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      setUploadQueue((prev) => prev.map((item, j) => j === i ? { ...item, status: "uploading" } : item));
      try {
        await uploadEvidence(engagementId, files[i], getEvidenceType(files[i].name), uploadedBy);
        setUploadQueue((prev) => prev.map((item, j) => j === i ? { ...item, status: "done" } : item));
        loadEvidence();
      } catch {
        setUploadQueue((prev) => prev.map((item, j) => j === i ? { ...item, status: "failed" } : item));
      }
    }
    setUploading(false);
    setTimeout(() => setUploadQueue([]), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    await processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleDownload = (ev: Evidence) => {
    const url = getEvidenceDownloadUrl(engagementId, ev.id);
    const link = document.createElement("a");
    link.href = url;
    link.download = ev.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!evidenceToDelete) return;
    setDeleting(true);
    try {
      const result = await deleteEvidence(engagementId, evidenceToDelete.id);
      if (selectedEvidence?.id === evidenceToDelete.id) {
        setSelectedEvidence(null);
        setExtraction(null);
        setMappings([]);
      }
      loadEvidence();
      const staleCount = result.stale_scores?.length || 0;
      toast(
        `Deleted "${evidenceToDelete.title || evidenceToDelete.filename}"${staleCount > 0 ? `. ${staleCount} score${staleCount !== 1 ? "s" : ""} marked as stale.` : ""}`,
        "success"
      );
    } catch {
      toast("Failed to delete evidence", "error");
    } finally {
      setDeleting(false);
      setEvidenceToDelete(null);
    }
  };

  const filtered = evidence.filter((ev) => {
    if (componentFilter && !componentFilter.evidenceIds.includes(ev.id)) return false;
    if (search && !(ev.title || ev.filename).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      className="max-w-7xl mx-auto relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-indigo-50/90 border-2 border-dashed border-indigo-400 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-indigo-700">Drop files here to upload</p>
            <p className="text-sm text-indigo-500 mt-1">Each file will be processed as a separate evidence item</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Evidence Repository</h1>
          <p className="text-sm text-gray-500">{evidence.length} documents uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          {role === "consultant" && (
            <a
              href="/api/demo-documents"
              download
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              <FolderDown className="w-4 h-4" />
              Sample Documents
            </a>
          )}
          <label className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4" />
            {uploading ? "Processing..." : "Upload Evidence"}
            <input type="file" multiple className="hidden" onChange={handleUpload} accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.csv,.md" />
          </label>
        </div>
      </div>

      {/* Upload progress queue */}
      {uploadQueue.length > 0 && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
          <div className="text-xs font-semibold text-gray-600 mb-1">Uploading {uploadQueue.length} files</div>
          {uploadQueue.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {item.status === "uploading" && <Loader2 className="w-3 h-3 text-indigo-600 animate-spin flex-shrink-0" />}
              {item.status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
              {item.status === "failed" && <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
              {item.status === "pending" && <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />}
              <span className={item.status === "done" ? "text-gray-500" : item.status === "failed" ? "text-red-600" : "text-gray-700"}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Component filter banner */}
      {componentFilter && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
          <Filter className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-sm text-indigo-800">
            Showing <strong>{componentFilter.evidenceIds.length}</strong> evidence item{componentFilter.evidenceIds.length !== 1 ? "s" : ""} mapped to this component
          </span>
          <button
            onClick={() => { setComponentFilter(null); }}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
          >
            <X className="w-3.5 h-3.5" />
            Show All
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Evidence List */}
        <div className="col-span-5">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
            {filtered.map((ev) => {
              const Icon = TYPE_ICONS[ev.evidence_type] || FileText;
              return (
                <div
                  key={ev.id}
                  className={`group w-full text-left p-4 hover:bg-gray-50 transition cursor-pointer ${
                    selectedEvidence?.id === ev.id ? "bg-indigo-50/50" : ""
                  }`}
                  onClick={() => setSelectedEvidence(ev)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800 truncate">{ev.title || ev.filename}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{ev.uploaded_by}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{new Date(ev.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="hidden group-hover:flex items-center gap-1 mr-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewEvidence(ev); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Preview document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(ev); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {role === "consultant" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEvidenceToDelete(ev); }}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete evidence"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <StatusBadge status={ev.processing_status} />
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{search ? "No matching evidence" : "No evidence uploaded yet"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Evidence Detail + Extraction */}
        <div className="col-span-7">
          {selectedEvidence ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  {role === "consultant" ? (
                    <EditableText
                      value={selectedEvidence.title || selectedEvidence.filename}
                      className="text-base font-semibold text-gray-900"
                      onSave={async (v) => {
                        await updateEvidence(engagementId, selectedEvidence.id, { title: v });
                        const updated = { ...selectedEvidence, title: v };
                        setSelectedEvidence(updated);
                        setEvidence((prev) => prev.map((e) => e.id === updated.id ? updated : e));
                      }}
                    />
                  ) : (
                    <h2 className="text-base font-semibold text-gray-900">{selectedEvidence.title || selectedEvidence.filename}</h2>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewEvidence(selectedEvidence)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      title="Preview document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(selectedEvidence)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {role === "consultant" && (
                      <button
                        onClick={() => setEvidenceToDelete(selectedEvidence)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete evidence"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setSelectedEvidence(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-400">Type: {selectedEvidence.evidence_type}</span>
                  <span className="text-xs text-gray-400">Format: {selectedEvidence.file_type}</span>
                  <span className="text-xs text-gray-400">Uploaded: {new Date(selectedEvidence.uploaded_at).toLocaleString()}</span>
                </div>
              </div>

              {extraction ? (
                <div className="p-5 space-y-5">
                  {/* Extraction Badge */}
                  <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-medium text-indigo-700">Extracted Summary</span>
                  </div>

                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
                    <EditableText
                      value={extraction.summary}
                      multiline
                      className="text-sm text-gray-700 leading-relaxed"
                      readOnly={role === "school_admin"}
                      onSave={async (v) => {
                        await updateExtraction(engagementId, selectedEvidence.id, extraction.id, { summary: v });
                        setExtraction({ ...extraction, summary: v });
                      }}
                    />
                  </div>

                  {/* Key Findings */}
                  {extraction.key_findings && extraction.key_findings.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Findings</h3>
                      <ul className="space-y-2">
                        {extraction.key_findings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <EditableListItem
                              value={finding}
                              className="text-sm text-gray-600 flex-1"
                              readOnly={role === "school_admin"}
                              onSave={async (v) => {
                                const updated = [...(extraction.key_findings || [])];
                                updated[i] = v;
                                await updateExtraction(engagementId, selectedEvidence.id, extraction.id, { key_findings: updated });
                                setExtraction({ ...extraction, key_findings: updated });
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mapped Components */}
                  {mappings.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mapped Components</h3>
                      <div className="flex flex-wrap gap-2">
                        {mappings.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onNavigate?.("framework", m.component_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 hover:underline transition"
                          >
                            {m.component_code ? `${m.component_code}: ${m.component_name}` : `Component ${m.component_id.slice(0, 8)}`}
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  {selectedEvidence.processing_status === "processing" ? (
                    <>
                      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Processing this document...</p>
                    </>
                  ) : selectedEvidence.processing_status === "failed" ? (
                    <>
                      <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
                      <p className="text-sm text-red-500">Processing failed. Please try re-uploading.</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">No extraction available yet.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-1">Select evidence to view details</h3>
              <p className="text-xs text-gray-400">Click on any document to see extracted findings and metadata.</p>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewEvidence && (
        <DocumentPreviewModal
          evidence={previewEvidence}
          engagementId={engagementId}
          onClose={() => setPreviewEvidence(null)}
        />
      )}

      <ConfirmDialog
        open={!!evidenceToDelete}
        onClose={() => setEvidenceToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Evidence"
        description={`This will permanently delete "${evidenceToDelete?.title || evidenceToDelete?.filename}" and its AI extractions. Any component scores that rely on this evidence will be marked as stale.`}
        loading={deleting}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    completed: { icon: CheckCircle2, color: "#059669", bg: "#ECFDF5" },
    processing: { icon: Clock, color: "#F59E0B", bg: "#FFFBEB" },
    failed: { icon: AlertCircle, color: "#EF4444", bg: "#FEF2F2" },
    pending: { icon: Clock, color: "#9CA3AF", bg: "#F9FAFB" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}
