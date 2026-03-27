"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { School, OnboardingDimension, OnboardingComponent } from "@/lib/types";
import { onboardingRespond } from "@/lib/api";
import {
  ChevronRight, ChevronDown, Send, Loader2, Check,
  Plus, X, Sparkles, ArrowLeft, Compass, GripVertical, Info,
} from "lucide-react";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  school: School;
  dimensions: OnboardingDimension[];
  rationale: string;
  conversation: ConversationMessage[];
  onFinalize: (framework: { dimensions: OnboardingDimension[] }) => void;
  onBack: () => void;
  loading: boolean;
}

export default function FrameworkStudio({
  school,
  dimensions: initialDimensions,
  rationale,
  conversation: initialConversation,
  onFinalize,
  onBack,
  loading: externalLoading,
}: Props) {
  const [dimensions, setDimensions] = useState<OnboardingDimension[]>(initialDimensions);
  const [conversation, setConversation] = useState<ConversationMessage[]>(initialConversation);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set(initialDimensions.map((d) => d.number)));
  const [expandedComps, setExpandedComps] = useState<Set<string>>(new Set());
  const [highlightedDim, setHighlightedDim] = useState<string | null>(null);
  const [highlightedComp, setHighlightedComp] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const highlightDimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightCompTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Add studio intro only if conversation doesn't already have a transition message
  useEffect(() => {
    const lastMsg = initialConversation[initialConversation.length - 1];
    const alreadyHasIntro = lastMsg?.role === "assistant" && lastMsg.content.includes("framework");
    if (!alreadyHasIntro) {
      setConversation((prev) => [...prev, {
        role: "assistant",
        content: `Here's your framework with ${dimensions.length} dimensions and ${dimensions.reduce((s, d) => s + d.components.length, 0)} components. Explore the tree on the right, or ask me to explain or change anything.`,
      }]);
    }
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

  // --- Bidirectional highlighting helpers ---

  // Build a set of all component codes for chat message parsing
  const allCompCodes = useMemo(() => {
    const codes: string[] = [];
    for (const dim of dimensions) {
      for (const comp of dim.components) {
        codes.push(comp.code);
      }
    }
    return codes;
  }, [dimensions]);

  // Build a map from dimension name (lowercase) to dimension number
  const dimNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const dim of dimensions) {
      map.set(dim.name.toLowerCase(), dim.number);
    }
    return map;
  }, [dimensions]);

  // Highlight a dimension in the tree (scroll + ring, auto-clear after 2s)
  const flashHighlightDim = useCallback((dimNumber: string) => {
    if (highlightDimTimerRef.current) clearTimeout(highlightDimTimerRef.current);
    setHighlightedDim(dimNumber);
    // Expand it so it's visible
    setExpandedDims((prev) => {
      const next = new Set(prev);
      next.add(dimNumber);
      return next;
    });
    // Scroll into view
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-dim-id="${dimNumber}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    highlightDimTimerRef.current = setTimeout(() => setHighlightedDim(null), 2000);
  }, []);

  // Highlight a component in the tree (scroll + ring, auto-clear after 2s)
  const flashHighlightComp = useCallback((compCode: string) => {
    if (highlightCompTimerRef.current) clearTimeout(highlightCompTimerRef.current);
    setHighlightedComp(compCode);
    // Find the parent dimension and expand it
    const parentDim = dimensions.find((d) => d.components.some((c) => c.code === compCode));
    if (parentDim) {
      setExpandedDims((prev) => {
        const next = new Set(prev);
        next.add(parentDim.number);
        return next;
      });
    }
    // Scroll into view
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-comp-id="${compCode}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    highlightCompTimerRef.current = setTimeout(() => setHighlightedComp(null), 2000);
  }, [dimensions]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (highlightDimTimerRef.current) clearTimeout(highlightDimTimerRef.current);
      if (highlightCompTimerRef.current) clearTimeout(highlightCompTimerRef.current);
    };
  }, []);

  // Info button handler: tree node -> chat message
  const handleDimInfo = (dim: OnboardingDimension) => {
    const compList = dim.components.map((c) => c.name).join(", ");
    const msg: ConversationMessage = {
      role: "assistant",
      content: `**${dim.name}** covers ${dim.components.length} components: ${compList}. ${dim.description || ""}`.trim(),
    };
    setConversation((prev) => [...prev, msg]);
  };

  const handleCompInfo = (comp: OnboardingComponent) => {
    const coreActions = comp.criteria.filter((c) => c.criterion_type === "core_action").length;
    const progressIndicators = comp.criteria.filter((c) => c.criterion_type === "progress_indicator").length;
    const msg: ConversationMessage = {
      role: "assistant",
      content: `**${comp.code}: ${comp.name}** — ${comp.description || "No description"}. It has ${comp.criteria.length} success criteria (${coreActions} core actions, ${progressIndicators} progress indicators).`,
    };
    setConversation((prev) => [...prev, msg]);
  };

  // Parse assistant message content and make component codes / dimension names clickable
  const renderLinkedMessage = useCallback((content: string) => {
    // Build regex for component codes (\b\d+[A-Z]\b) and dimension names
    const dimNames = Array.from(dimNameMap.keys());
    // Sort dimension names by length (longest first) for greedy matching
    dimNames.sort((a, b) => b.length - a.length);
    // Escape regex special chars in dimension names
    const escapedDimNames = dimNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const compCodePattern = "\\b(\\d+[A-Z])\\b";
    const dimNamePattern = escapedDimNames.length > 0 ? `(${escapedDimNames.join("|")})` : null;

    const parts: string[] = [compCodePattern];
    if (dimNamePattern) parts.push(dimNamePattern);
    const combinedRegex = new RegExp(parts.join("|"), "gi");

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(content)) !== null) {
      const matchText = match[0];
      const matchStart = match.index;

      // Add text before the match
      if (matchStart > lastIndex) {
        segments.push(content.slice(lastIndex, matchStart));
      }

      // Determine if it's a component code or dimension name
      const compCodeMatch = matchText.match(/^\d+[A-Z]$/);
      if (compCodeMatch && allCompCodes.includes(matchText)) {
        segments.push(
          <button
            key={`comp-${matchStart}`}
            onClick={() => flashHighlightComp(matchText)}
            className="text-indigo-600 font-medium underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 cursor-pointer transition-colors"
          >
            {matchText}
          </button>
        );
      } else {
        // Check if it's a dimension name (case-insensitive)
        const dimNum = dimNameMap.get(matchText.toLowerCase());
        if (dimNum) {
          segments.push(
            <button
              key={`dim-${matchStart}`}
              onClick={() => flashHighlightDim(dimNum)}
              className="text-indigo-600 font-medium underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 cursor-pointer transition-colors"
            >
              {matchText}
            </button>
          );
        } else {
          segments.push(matchText);
        }
      }

      lastIndex = matchStart + matchText.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push(content.slice(lastIndex));
    }

    return segments;
  }, [allCompCodes, dimNameMap, flashHighlightComp, flashHighlightDim]);

  const removeDimension = (num: string) => {
    const dim = dimensions.find((d) => d.number === num);
    setDimensions((prev) => prev.filter((d) => d.number !== num));
    if (dim) {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Removed "${dim.name}" and its ${dim.components.length} components from your framework.`,
        },
      ]);
    }
  };

  const removeComponent = (dimNum: string, compCode: string) => {
    setDimensions((prev) =>
      prev.map((d) =>
        d.number === dimNum
          ? { ...d, components: d.components.filter((c) => c.code !== compCode) }
          : d
      ).filter((d) => d.components.length > 0)
    );
  };

  const handleChat = async () => {
    if (!userInput.trim() || chatLoading) return;
    const msg = userInput.trim();
    setUserInput("");
    setConversation((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);

    try {
      const result = await onboardingRespond(school.id, msg);
      const aiResp = result.ai_response;

      if (aiResp.status === "proposal" && aiResp.framework) {
        setDimensions(aiResp.framework.dimensions);
        setConversation((prev) => [
          ...prev,
          { role: "assistant" as const, content: aiResp.rationale || "I've updated the framework based on your feedback." },
        ]);
      } else if (aiResp.message) {
        setConversation((prev) => [...prev, { role: "assistant" as const, content: aiResp.message! }]);
      }
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: "I had trouble with that. Try asking in a different way." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const totalComponents = dimensions.reduce((s, d) => s + d.components.length, 0);
  const totalCriteria = dimensions.reduce(
    (s, d) => s + d.components.reduce((cs, c) => cs + c.criteria.length, 0),
    0
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 mr-3">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Framework Studio</span>
          <span className="text-sm text-gray-400">{school.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">
            {dimensions.length} dimensions, {totalComponents} components, {totalCriteria} criteria
          </div>
          <button
            onClick={() => onFinalize({ dimensions })}
            disabled={externalLoading || dimensions.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {externalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Finalize Framework
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
            <p className="text-xs text-gray-400 mt-0.5">Ask questions or request changes to your framework</p>
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
                  {msg.role === "assistant" ? renderLinkedMessage(msg.content) : msg.content}
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
        <div className="flex-1 overflow-y-auto p-6" ref={treeRef}>
          <div className="max-w-3xl mx-auto space-y-3">
            {dimensions.map((dim) => (
              <div
                key={dim.number}
                data-dim-id={dim.number}
                className={`bg-white rounded-xl border transition-all duration-300 ${
                  highlightedDim === dim.number
                    ? "border-indigo-400 ring-2 ring-indigo-200"
                    : "border-gray-200"
                }`}
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
                      {dim.is_custom && (
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDimInfo(dim);
                    }}
                    className="p-1 text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                    title="Explain dimension in chat"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDimension(dim.number);
                    }}
                    className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Remove dimension"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Components */}
                {expandedDims.has(dim.number) && (
                  <div className="border-t border-gray-100">
                    {dim.components.map((comp) => {
                      const compKey = `${dim.number}:${comp.code}`;
                      return (
                        <div
                          key={comp.code}
                          data-comp-id={comp.code}
                          className={`border-b border-gray-50 last:border-b-0 transition-all duration-300 ${
                            highlightedComp === comp.code
                              ? "bg-indigo-50/60 ring-2 ring-inset ring-indigo-200"
                              : ""
                          }`}
                        >
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
                            {comp.is_custom && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded">
                                Custom
                              </span>
                            )}
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {comp.criteria.length} criteria
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompInfo(comp);
                              }}
                              className="p-0.5 text-gray-200 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                              title="Explain component in chat"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeComponent(dim.number, comp.code);
                              }}
                              className="p-0.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
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

            {dimensions.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400">No dimensions in framework. Use the chat to add dimensions.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
