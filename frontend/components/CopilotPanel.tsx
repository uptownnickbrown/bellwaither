"use client";

import { useState, useRef, useEffect } from "react";
import { chatWithCopilot } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { Sparkles, Send, X, Loader2, User, Bot } from "lucide-react";

interface Props {
  engagementId: string;
  schoolName: string;
  context: string;
  role: UserRole;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What evidence do we have about teacher retention?",
  "Which components still need more evidence?",
  "Summarize our strongest findings so far",
  "What are the biggest gaps in our assessment?",
  "Draft a follow-up request for PD data",
  "Show me contradictions in the evidence",
];

export default function CopilotPanel({ engagementId, schoolName, context, role, onClose }: Props) {
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
      setMessages((prev) => [...prev, { role: "assistant", content: result.content }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
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
            <h3 className="text-sm font-semibold text-gray-800">AI Copilot</h3>
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
              <p className="text-xs text-gray-400 mt-1">Ask about evidence, findings, or get help with your assessment.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Try asking:</p>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
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
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
              msg.role === "user"
                ? "bg-indigo-600 text-white"
                : "bg-gray-50 text-gray-700"
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
            placeholder="Ask the AI Copilot..."
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
