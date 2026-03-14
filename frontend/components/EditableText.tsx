"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, Pencil } from "lucide-react";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  /** Show a small "edited" badge if the text was manually changed */
  edited?: boolean;
  /** When true, renders plain text with no editing affordances */
  readOnly?: boolean;
}

/**
 * Fluid in-place editing component.
 *
 * Default: looks like normal display text.
 * Hover: subtle pencil icon + faint background.
 * Click: transitions to editable with a soft focus ring.
 * Save: blur, Enter (single-line), or Cmd/Ctrl+Enter (multi-line).
 * Cancel: Escape.
 */
export default function EditableText({
  value,
  onSave,
  multiline = false,
  className = "",
  placeholder = "Click to edit...",
  edited = false,
  readOnly = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Sync when the external value changes (e.g. after a re-fetch)
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Auto-focus + select when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // For textareas move cursor to end; for inputs select all
      if (multiline) {
        const el = inputRef.current as HTMLTextAreaElement;
        el.selectionStart = el.selectionEnd = el.value.length;
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && multiline && inputRef.current) {
      const el = inputRef.current as HTMLTextAreaElement;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [draft, isEditing, multiline]);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      // Revert on failure
      setDraft(value);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (multiline && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  // ---- Read-only state: plain text, no editing affordances ----
  if (readOnly) {
    const displayValue = value || placeholder;
    const isEmpty = !value;
    return (
      <span className={isEmpty ? "text-gray-400 italic " + className : className}>
        {displayValue}
      </span>
    );
  }

  // ---- Editing state ----
  if (isEditing) {
    const sharedClasses =
      "w-full bg-white border border-indigo-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700 leading-relaxed " +
      "outline-none ring-2 ring-indigo-200 transition-all duration-150 " +
      className;

    return (
      <div className="relative group">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={sharedClasses + " resize-none overflow-hidden min-h-[2.5rem]"}
            placeholder={placeholder}
            disabled={saving}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={sharedClasses}
            placeholder={placeholder}
            disabled={saving}
          />
        )}
        <span className="absolute -bottom-5 right-0 text-[10px] text-gray-400 select-none">
          {multiline ? "Cmd+Enter to save" : "Enter to save"} · Esc to cancel
        </span>
      </div>
    );
  }

  // ---- Display state ----
  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={
        "group relative cursor-text rounded-md px-2.5 py-1.5 -mx-2.5 -my-1.5 " +
        "transition-all duration-150 " +
        "hover:bg-gray-50 " +
        "border border-transparent hover:border-gray-200 " +
        className
      }
      title="Click to edit"
    >
      <span className={isEmpty ? "text-gray-400 italic" : ""}>
        {displayValue}
      </span>

      {/* Hover pencil icon */}
      <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Pencil className="w-3 h-3 text-gray-400" />
      </span>

      {/* Just-saved checkmark */}
      {justSaved && (
        <span className="absolute top-1.5 right-1.5 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        </span>
      )}

      {/* Edited badge */}
      {edited && !justSaved && (
        <span className="absolute -top-1.5 -right-1 text-[9px] font-medium text-indigo-500 bg-indigo-50 px-1 rounded select-none">
          edited
        </span>
      )}
    </div>
  );
}

// --- Variant for list items (string[]) ---

interface EditableListItemProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  className?: string;
  edited?: boolean;
  readOnly?: boolean;
}

export function EditableListItem({
  value,
  onSave,
  className = "",
  edited = false,
  readOnly = false,
}: EditableListItemProps) {
  return (
    <EditableText
      value={value}
      onSave={onSave}
      multiline={false}
      className={className}
      edited={edited}
      readOnly={readOnly}
    />
  );
}
