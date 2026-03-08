"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { MessageThread, Message, UserRole } from "@/lib/types";
import { getThreads, getMessages, sendMessage } from "@/lib/api";
import { MessageSquare, Send, Hash, ClipboardList, BarChart3, Target } from "lucide-react";

interface Props {
  engagementId: string;
  role: UserRole;
}

const THREAD_ICONS: Record<string, React.ElementType> = {
  general: Hash,
  data_request: ClipboardList,
  component: BarChart3,
  action_item: Target,
};

export default function MessagingView({ engagementId, role }: Props) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getThreads(engagementId).then((t) => {
      setThreads(t);
      const general = t.find((th) => th.thread_type === "general");
      if (general) setSelectedThread(general);
      else if (t.length > 0) setSelectedThread(t[0]);
    });
  }, [engagementId]);

  useEffect(() => {
    if (selectedThread) {
      getMessages(engagementId, selectedThread.id).then(setMessages);
    }
  }, [selectedThread, engagementId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    const author = role === "consultant" ? "Sarah Chen" : "Dr. Angela Rivera";
    await sendMessage(engagementId, selectedThread.id, {
      author,
      role: role === "consultant" ? "consultant" : "school_leader",
      content: newMessage,
    });
    setNewMessage("");
    getMessages(engagementId, selectedThread.id).then(setMessages);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-500">Collaborate with your team through threaded discussions</p>
      </div>

      <div className="grid grid-cols-12 gap-6" style={{ height: "calc(100vh - 240px)" }}>
        {/* Thread List */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase">Channels</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {threads.map((thread) => {
                const Icon = THREAD_ICONS[thread.thread_type] || MessageSquare;
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThread(thread)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center gap-2 ${
                      selectedThread?.id === thread.id ? "bg-indigo-50/50" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-700 truncate">{thread.title || thread.thread_type}</div>
                      <div className="text-[10px] text-gray-400">{thread.thread_type}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="col-span-9 flex flex-col">
          <div className="bg-white rounded-xl border border-gray-200 flex-1 flex flex-col overflow-hidden">
            {/* Thread Header */}
            {selectedThread && (
              <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">{selectedThread.title || selectedThread.thread_type}</h2>
              </div>
            )}

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => {
                const isConsultant = msg.role === "consultant" || msg.role === "analyst";
                const initials = msg.author.split(" ").map((n) => n[0]).join("");
                return (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isConsultant ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">{msg.author}</span>
                        <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={`Message as ${role === "consultant" ? "Sarah Chen" : "Dr. Angela Rivera"}...`}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
