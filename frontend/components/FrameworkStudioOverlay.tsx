"use client";

import { useState, useRef, useEffect } from "react";
import type { EngagementDimension } from "@/lib/types";
import { chatWithCopilot } from "@/lib/api";
import {
  ChevronRight, ChevronDown, Send, Loader2,
  X, Sparkles, Compass, Layers,
} from "lucide-react";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  engagementId: string;
  schoolName: string;
  engagementFramework: EngagementDimension[];
  onClose: () => void;
}

export default function FrameworkStudioOverlay({
  engagementId,
  schoolName,
  engagementFramework,
  onClose,
}: Props) {
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    {
      role: "assistant",
      content: `Welcome back to Framework Studio. This is your active framework with ${engagementFramework.length} dimensions and ${engagementFramework.reduce((s, d) => s + d.components.length, 0)} components. You can explore the tree on the right and ask me questions about any dimension, component, or criteria.`,
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedDims, setExpandedDims] = useState<Set<string>>(
    new Set(engagementFramework.map((d) => d.number))
  );
  const [expandedComps, setExpandedComps] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Prevent background scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const toggleDim = (num: string) => {
    setExpandedDims((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const toggleComp = (key: string) => {
    setExpandedComps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleChat = async () => {
    if (!userInput.trim() || chatLoading) return;
    const msg = userInput.trim();
    setUserInput("");
    setConversation((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);

    const historyForApi = conversation.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    historyForApi.push({ role: "user", content: msg });

    // Retry up to 2 times on transient failures
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await chatWithCopilot(engagementId, {
          message: msg,
          context: "framework_studio",
          conversation_history: historyForApi,
        });

        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: result.content },
        ]);
        setChatLoading(false);
        return;
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
          },
        ]);
      }
    }
    setChatLoading(false);
  };

  const totalComponents = engagementFramework.reduce(
    (s, d) => s + d.components.length,
    0
  );
  const totalCriteria = engagementFramework.reduce(
    (s, d) => s + d.components.reduce((cs, c) => cs + c.criteria.length, 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAFBFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Framework Studio</span>
          <span className="text-sm text-gray-400">{schoolName}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">
            {engagementFramework.length} dimensions, {totalComponents} components, {totalCriteria} criteria
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </header>

      {/* Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="w-[420px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">Framework Advisor</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Ask questions about your framework dimensions, components, and criteria
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                disabled={chatLoading}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ask about your framework..."
              />
              <button
                onClick={handleChat}
                disabled={chatLoading || !userInput.trim()}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Framework Tree */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-3">
            {engagementFramework.map((dim) => (
              <div
                key={dim.number}
                className="bg-white rounded-xl border border-gray-200 transition-all"
              >
                {/* Dimension header */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/50 rounded-t-xl"
                  onClick={() => toggleDim(dim.number)}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dim.color || "#6366F1" }}
                  />
                  {expandedDims.has(dim.number) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{dim.name}</span>
                      {dim.is_custom === 1 && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded">
                          Custom
                        </span>
                      )}
                    </div>
                    {dim.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{dim.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {dim.components.length} component{dim.components.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Components */}
                {expandedDims.has(dim.number) && (
                  <div className="border-t border-gray-100">
                    {dim.components.map((comp) => {
                      const compKey = `${dim.number}:${comp.code}`;
                      return (
                        <div key={comp.code} className="border-b border-gray-50 last:border-b-0">
                          <div
                            className="flex items-center gap-3 px-4 py-2.5 pl-10 cursor-pointer hover:bg-gray-50/50"
                            onClick={() => toggleComp(compKey)}
                          >
                            {expandedComps.has(compKey) ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            )}
                            <span className="text-xs font-mono text-gray-400 w-6 flex-shrink-0">{comp.code}</span>
                            <span className="text-sm text-gray-700 flex-1">{comp.name}</span>
                            {comp.is_custom === 1 && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded">
                                Custom
                              </span>
                            )}
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {comp.criteria.length} criteria
                            </span>
                          </div>

                          {/* Criteria */}
                          {expandedComps.has(compKey) && comp.criteria.length > 0 && (
                            <div className="px-4 pl-20 pb-3 space-y-1.5">
                              {comp.criteria.map((crit, ci) => (
                                <div key={ci} className="flex items-start gap-2">
                                  <span
                                    className={`mt-1 px-1 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                                      crit.criterion_type === "core_action"
                                        ? "bg-blue-50 text-blue-600"
                                        : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {crit.criterion_type === "core_action" ? "CA" : "PI"}
                                  </span>
                                  <span className="text-xs text-gray-500 leading-relaxed">{crit.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {engagementFramework.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400">No framework dimensions found for this engagement.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
