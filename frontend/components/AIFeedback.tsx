"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { createAIFeedback } from "@/lib/api";

interface AIFeedbackProps {
  engagementId: string;
  targetType: string;
  targetId: string;
  /** Pre-existing rating from server, if any */
  existingRating?: "up" | "down" | null;
  /** Only render for consultants -- pass false for school_admin */
  visible?: boolean;
}

/**
 * Small inline thumbs-up/down feedback widget for AI-generated content.
 * Appears as subtle icons next to AI text blocks. Only visible to consultants.
 */
export default function AIFeedback({
  engagementId,
  targetType,
  targetId,
  existingRating = null,
  visible = true,
}: AIFeedbackProps) {
  const [rating, setRating] = useState<"up" | "down" | null>(existingRating);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const handleRate = async (newRating: "up" | "down") => {
    if (saving) return;
    const nextRating = rating === newRating ? null : newRating;
    setSaving(true);
    try {
      if (nextRating) {
        await createAIFeedback(engagementId, {
          target_type: targetType,
          target_id: targetId,
          rating: nextRating,
        });
      }
      setRating(nextRating);
    } catch (e) {
      console.error("Feedback failed:", e);
    }
    setSaving(false);
  };

  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); handleRate("up"); }}
        disabled={saving}
        className={`p-0.5 rounded transition-all ${
          rating === "up"
            ? "text-emerald-600"
            : "text-gray-300 hover:text-emerald-500"
        } ${rating === "down" ? "opacity-30" : ""} disabled:pointer-events-none`}
        title="Helpful"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleRate("down"); }}
        disabled={saving}
        className={`p-0.5 rounded transition-all ${
          rating === "down"
            ? "text-red-500"
            : "text-gray-300 hover:text-red-400"
        } ${rating === "up" ? "opacity-30" : ""} disabled:pointer-events-none`}
        title="Not helpful"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </span>
  );
}
