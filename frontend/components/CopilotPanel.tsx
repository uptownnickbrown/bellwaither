"use client";

import { useState, useRef, useEffect } from "react";
import { chatWithCopilot } from "@/lib/api";
import type { UserRole, CopilotToolResult } from "@/lib/types";
import { Sparkles, Send, X, Loader2, User, Bot, FileText, AlertCircle, Calendar, Flag, UserCircle, ArrowUpRight } from "lucide-react";
import AIMarkdown from "@/components/AIMarkdown";

interface Props {
  engagementId: string;
  schoolName: string;
  context: string;
  role: UserRole;
  onClose: () => void;
  onNavigate?: (tab: string, id?: string) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolResults?: CopilotToolResult[] | null;
}

const PRIORITY_STYLES: Record<string, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-red-100 text-red-700" },
  medium: { label: "Medium", classes: "bg-amber-100 text-amber-700" },
  low: { label: "Low", classes: "bg-gray-100 text-gray-600" },
};

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  dashboard: [
    "Give me a quick summary of where this assessment stands",
    "Which dimensions need the most attention right now?",
    "What should our team focus on this week?",
    "How much of the framework have we covered so far?",
  ],
  framework: [
    "Which dimensions have the least component coverage?",
    "Explain the rubric criteria for Talent Management",
    "How many components still have no evidence mapped?",
    "What does 'Meeting Expectations' look like for Instructional Rigor?",
    "List all components under the Culture & Climate dimension",
  ],
  evidence: [
    "Summarize the key findings from our most recent uploads",
    "What types of evidence are we still missing?",
    "Which documents map to the most components?",
    "Are there any uploaded documents that haven't been processed yet?",
    "What evidence do we have about teacher retention?",
  ],
  requests: [
    "What data requests are still outstanding?",
    "Create a data request for the school's PD logs",
    "Which requests are past their due date?",
    "Draft a follow-up reminder for pending requests",
    "What data should we request next based on our gaps?",
  ],
  scoring: [
    "Which components have the lowest confidence scores?",
    "Compare ratings across the Talent Management dimension",
    "Are there any components rated without sufficient evidence?",
    "What are our strongest-rated areas so far?",
    "Which scores might need revisiting based on new evidence?",
  ],
  actions: [
    "What are the highest-priority action items right now?",
    "Suggest next steps based on our lowest-rated components",
    "Which action items are coming due this month?",
    "Draft an action plan for improving Instructional Rigor",
    "Summarize progress on existing action items",
  ],
  messages: [
    "Summarize the most recent message threads",
    "Draft a message to the school requesting curriculum documents",
    "Are there any unanswered messages from the school?",
    "Write a progress update to share with the school team",
  ],
  activity: [
    "What changes were made in the last week?",
    "Who has been most active on this engagement?",
    "Show me a timeline of recent scoring updates",
    "Have any component ratings changed recently?",
  ],
  default: [
    "What evidence do we have about teacher retention?",
    "Which components still need more evidence?",
    "Summarize our strongest findings so far",
    "Create a data request for the school's PD logs",
    "What are the biggest gaps in our assessment?",
  ],
};

function DataRequestCard({ result, onNavigate }: { result: CopilotToolResult; onNavigate?: (tab: string, id?: string) => void }) {
  if (result.status === "error") {
    return (
      <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-red-700 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          Failed to create data request
        </div>
        <p className="text-xs text-red-600 mt-1">{result.error}</p>
      </div>
    );
  }

  const data = result.data;
  if (!data) return null;

  const priorityStyle = PRIORITY_STYLES[data.priority] || PRIORITY_STYLES.medium;

  return (
    <div className="mt-2 border border-indigo-200 bg-indigo-50/50 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-xs font-semibold text-indigo-900">Data Request Created</span>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityStyle.classes}`}>
          {priorityStyle.label}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-900">{data.title}</p>
        {data.description && (
          <p className="text-xs text-gray-600 leading-relaxed">{data.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {data.assigned_to && (
          <span className="flex items-center gap-1">
            <UserCircle className="w-3 h-3" />
            {data.assigned_to}
          </span>
        )}
        {data.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(data.due_date).toLocaleDateString()}
          </span>
        )}
        {data.component_code && (
          <span className="flex items-center gap-1">
            <Flag className="w-3 h-3" />
            Component {data.component_code}
          </span>
        )}
        <span className="text-indigo-500 font-medium">Pending</span>
      </div>

      <button
        onClick={() => onNavigate?.("requests", data.id)}
        className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition mt-1"
      >
        View in Data Requests
        <ArrowUpRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function CopilotPanel({ engagementId, schoolName, context, role, onClose, onNavigate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await chatWithCopilot(engagementId, {
        message: msg,
        context,
        role: role === "consultant" ? "consultant" : "school_admin",
        conversation_history: [...messages, userMsg].map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.content,
          toolResults: result.tool_results,
        },
      ]);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Unknown error";
      console.error("Copilot error:", detail);
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I encountered an error. ${detail}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Copilot</h3>
            <p className="text-[10px] text-gray-400">Context: {context} · {schoolName}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 text-indigo-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">How can I help?</p>
              <p className="text-xs text-gray-400 mt-1">Ask about evidence, findings, or create data requests directly.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Try asking:</p>
              {(SUGGESTED_PROMPTS[context] || SUGGESTED_PROMPTS.default).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
              <div className={`rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-50 text-gray-700"
              }`}>
                {msg.role === "assistant" ? (
                  <AIMarkdown content={msg.content} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {/* Render tool result cards for assistant messages */}
              {msg.role === "assistant" && msg.toolResults && msg.toolResults.length > 0 && (
                <div className="space-y-2">
                  {msg.toolResults.map((tr, j) => (
                    <DataRequestCard key={j} result={tr} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            placeholder="Ask Meridian..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
