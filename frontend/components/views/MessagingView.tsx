"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { MessageThread, Message, UserRole } from "@/lib/types";
import { getThreads, getMessages, sendMessage, createThread } from "@/lib/api";
import {
  MessageSquare, Send, Hash, ClipboardList, BarChart3, Target,
  Plus, X, ArrowUpRight, Users,
} from "lucide-react";

interface Props {
  engagementId: string;
  role: UserRole;
  onNavigate?: (tab: string, id?: string) => void;
  navTargetId?: string | null;
  onNavTargetConsumed?: () => void;
}

// ── Hardcoded engagement members for @mention ────────────────────────────
const ENGAGEMENT_MEMBERS = [
  "Sarah Chen",
  "Marcus Johnson",
  "Dr. Angela Rivera",
  "Tom Nakamura",
];

// ── Thread type icon map ──────────────────────────────────────────────────
const THREAD_ICONS: Record<string, React.ElementType> = {
  general: Hash,
  data_request: ClipboardList,
  component: BarChart3,
  action_item: Target,
};

// ── Relative timestamp helper ─────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Day label for date separators ─────────────────────────────────────────
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Render message content with @mention highlighting ─────────────────────
function renderContent(content: string) {
  // Match @FirstName LastName (with optional "Dr. " prefix)
  const mentionRegex = /@((?:Dr\.\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded font-medium"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts.length > 0 ? parts : content;
}

// ── Extract mentions from message text ────────────────────────────────────
function extractMentions(text: string): string[] {
  const mentionRegex = /@((?:Dr\.\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g;
  const mentions: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mentionRegex.exec(text)) !== null) {
    if (ENGAGEMENT_MEMBERS.includes(m[1]) && !mentions.includes(m[1])) {
      mentions.push(m[1]);
    }
  }
  return mentions;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════
export default function MessagingView({ engagementId, role, onNavigate, navTargetId, onNavTargetConsumed }: Props) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── New channel creation state ──────────────────────────────────────────
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const newChannelInputRef = useRef<HTMLInputElement>(null);

  // ── @mention dropdown state ─────────────────────────────────────────────
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);

  // ── Polling for live-feel updates ───────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadThreads = useCallback(() => {
    getThreads(engagementId).then((t) => {
      setThreads(t);
      setSelectedThread((prev) => {
        if (prev) {
          const updated = t.find((th) => th.id === prev.id);
          if (updated) return updated;
        }
        const general = t.find((th) => th.thread_type === "general");
        return general || t[0] || null;
      });
    });
  }, [engagementId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Handle incoming navigation target
  useEffect(() => {
    if (navTargetId && threads.length > 0) {
      const target = threads.find((t) => t.id === navTargetId || t.reference_id === navTargetId);
      if (target) {
        setSelectedThread(target);
      }
      onNavTargetConsumed?.();
    }
  }, [navTargetId, threads, onNavTargetConsumed]);

  useEffect(() => {
    if (selectedThread) {
      getMessages(engagementId, selectedThread.id).then(setMessages);
    }
  }, [selectedThread, engagementId]);

  // Poll messages every 8s for the selected thread
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedThread) {
      pollRef.current = setInterval(() => {
        getMessages(engagementId, selectedThread.id).then(setMessages);
      }, 8000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedThread, engagementId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus new-channel input when it appears
  useEffect(() => {
    if (showNewChannel) newChannelInputRef.current?.focus();
  }, [showNewChannel]);

  // ── Sorted / grouped threads ────────────────────────────────────────────
  const channelThreads = useMemo(
    () =>
      threads
        .filter((t) => t.thread_type !== "data_request")
        .sort((a, b) => {
          const aTime = a.last_activity || a.created_at;
          const bTime = b.last_activity || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }),
    [threads]
  );
  const dataRequestThreads = useMemo(
    () =>
      threads
        .filter((t) => t.thread_type === "data_request")
        .sort((a, b) => {
          const aTime = a.last_activity || a.created_at;
          const bTime = b.last_activity || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }),
    [threads]
  );

  // ── Mention helpers ─────────────────────────────────────────────────────
  const filteredMembers = useMemo(
    () =>
      ENGAGEMENT_MEMBERS.filter((m) =>
        m.toLowerCase().includes(mentionQuery.toLowerCase())
      ),
    [mentionQuery]
  );

  const closeMention = useCallback(() => {
    setMentionActive(false);
    setMentionQuery("");
    setMentionIndex(0);
  }, []);

  const insertMention = useCallback(
    (member: string) => {
      const before = newMessage.slice(0, mentionStartPos);
      const after = newMessage.slice(
        mentionStartPos + mentionQuery.length + 1 // +1 for the "@"
      );
      const updated = `${before}@${member} ${after}`;
      setNewMessage(updated);
      closeMention();
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [newMessage, mentionStartPos, mentionQuery, closeMention]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    // Detect @ trigger
    const cursorPos = e.target.selectionStart || val.length;
    const textUpToCursor = val.slice(0, cursorPos);
    const lastAt = textUpToCursor.lastIndexOf("@");

    if (lastAt !== -1) {
      const charBefore = lastAt > 0 ? textUpToCursor[lastAt - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || lastAt === 0) {
        const query = textUpToCursor.slice(lastAt + 1);
        if (!query.includes(" ") || query.split(" ").length <= 2) {
          // Could still be typing a name
          setMentionActive(true);
          setMentionQuery(query);
          setMentionStartPos(lastAt);
          setMentionIndex(0);
          return;
        }
      }
    }
    closeMention();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionActive && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    if (e.key === "Enter" && !mentionActive) {
      handleSend();
    }
  };

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    const author = role === "consultant" ? "Sarah Chen" : "Dr. Angela Rivera";
    const mentions = extractMentions(newMessage);
    await sendMessage(engagementId, selectedThread.id, {
      author,
      role: role === "consultant" ? "consultant" : "school_leader",
      content: newMessage,
      ...(mentions.length > 0 ? { mentions } : {}),
    });
    setNewMessage("");
    closeMention();
    getMessages(engagementId, selectedThread.id).then(setMessages);
    loadThreads(); // refresh last_activity
  };

  // ── Create channel ──────────────────────────────────────────────────────
  const handleCreateChannel = async () => {
    const name = newChannelName.trim();
    if (!name) return;
    try {
      const newThread = await createThread(engagementId, { title: name, thread_type: "general" });
      setShowNewChannel(false);
      setNewChannelName("");
      await loadThreads();
      setSelectedThread(newThread);
    } catch {
      // silently ignore for demo
    }
  };

  // ── Build grouped messages with day separators ──────────────────────────
  const groupedMessages = useMemo(() => {
    const groups: Array<
      | { type: "day_separator"; label: string }
      | { type: "message"; msg: Message; showAuthor: boolean }
      | { type: "system"; msg: Message }
    > = [];
    let lastDay = "";
    let lastAuthor = "";

    for (const msg of messages) {
      const msgDay = new Date(msg.created_at).toDateString();

      // System messages
      if (msg.role === "system") {
        if (msgDay !== lastDay) {
          groups.push({ type: "day_separator", label: dayLabel(msg.created_at) });
          lastDay = msgDay;
        }
        groups.push({ type: "system", msg });
        lastAuthor = "";
        continue;
      }

      // Day separator
      if (msgDay !== lastDay) {
        groups.push({ type: "day_separator", label: dayLabel(msg.created_at) });
        lastDay = msgDay;
        lastAuthor = "";
      }

      const showAuthor = msg.author !== lastAuthor;
      groups.push({ type: "message", msg, showAuthor });
      lastAuthor = msg.author;
    }
    return groups;
  }, [messages]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const renderThreadItem = (thread: MessageThread) => {
    const Icon = THREAD_ICONS[thread.thread_type] || MessageSquare;
    const isSelected = selectedThread?.id === thread.id;
    const lastActivity = thread.last_activity || thread.created_at;
    const count = thread.message_count ?? 0;

    return (
      <button
        key={thread.id}
        onClick={() => setSelectedThread(thread)}
        className={`w-full text-left px-3 py-2 rounded-lg transition group flex items-center gap-2.5 ${
          isSelected
            ? "bg-indigo-600 text-white"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon
          className={`w-4 h-4 flex-shrink-0 ${
            isSelected ? "text-indigo-200" : "text-gray-400"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-sm font-medium truncate ${
                isSelected ? "text-white" : "text-gray-800"
              }`}
            >
              {thread.title || thread.thread_type}
            </span>
            {count > 0 && (
              <span
                className={`text-[10px] font-semibold rounded-full min-w-[18px] text-center px-1.5 py-0.5 flex-shrink-0 ${
                  isSelected
                    ? "bg-indigo-400/40 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </div>
          <p
            className={`text-[11px] truncate mt-0.5 ${
              isSelected ? "text-indigo-200" : "text-gray-400"
            }`}
          >
            {lastActivity ? relativeTime(lastActivity) : "No activity"}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-500">
          Collaborate with your team through threaded discussions
        </p>
      </div>

      <div
        className="grid grid-cols-12 gap-0"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {/* ────────── Thread Sidebar ────────── */}
        <div className="col-span-3 bg-gray-50 rounded-l-xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                Meridian Messages
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
            {/* ── Channels Section ── */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Channels
                </h3>
                <button
                  onClick={() => {
                    setShowNewChannel(!showNewChannel);
                    setNewChannelName("");
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
                  title="Create channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline new-channel form */}
              {showNewChannel && (
                <div className="mx-1 mb-1">
                  <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg px-2 py-1.5 shadow-sm">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <input
                      ref={newChannelInputRef}
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateChannel();
                        if (e.key === "Escape") {
                          setShowNewChannel(false);
                          setNewChannelName("");
                        }
                      }}
                      placeholder="channel-name"
                      className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400 min-w-0"
                    />
                    <button
                      onClick={() => {
                        setShowNewChannel(false);
                        setNewChannelName("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 px-1">
                    Enter to create, Escape to cancel
                  </p>
                </div>
              )}

              <div className="space-y-0.5">
                {channelThreads.map(renderThreadItem)}
              </div>
            </div>

            {/* ── Data Requests Section ── */}
            {dataRequestThreads.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-1">
                  <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Data Requests
                  </h3>
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                    {dataRequestThreads.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dataRequestThreads.map((thread) => {
                    const isSelected = selectedThread?.id === thread.id;
                    const lastActivity = thread.last_activity || thread.created_at;
                    const count = thread.message_count ?? 0;

                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition group flex items-start gap-2.5 ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <ClipboardList
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            isSelected ? "text-indigo-200" : "text-amber-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-medium truncate ${
                                isSelected ? "text-white" : "text-gray-800"
                              }`}
                            >
                              {thread.title || "Data Request"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!isSelected && (
                              <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 rounded px-1 py-0.5">
                                Data Request
                              </span>
                            )}
                            <span
                              className={`text-[10px] ${
                                isSelected ? "text-indigo-200" : "text-gray-400"
                              }`}
                            >
                              {relativeTime(lastActivity)}
                            </span>
                            {count > 0 && (
                              <span
                                className={`text-[10px] font-semibold rounded-full min-w-[18px] text-center px-1.5 py-0.5 ${
                                  isSelected
                                    ? "bg-indigo-400/40 text-white"
                                    : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ────────── Message Pane ────────── */}
        <div className="col-span-9 flex flex-col">
          <div className="bg-white rounded-r-xl border border-l-0 border-gray-200 flex-1 flex flex-col overflow-hidden">
            {/* Thread Header */}
            {selectedThread && (
              <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon =
                      THREAD_ICONS[selectedThread.thread_type] || MessageSquare;
                    return (
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    );
                  })()}
                  <h2 className="text-sm font-semibold text-gray-800">
                    {selectedThread.title || selectedThread.thread_type}
                  </h2>
                  {selectedThread.thread_type === "data_request" && (
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 ml-1">
                      Data Request
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {selectedThread.message_count ?? 0} messages
                  </span>
                </div>
              </div>
            )}

            {/* Data Request banner */}
            {selectedThread?.thread_type === "data_request" && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-shrink-0">
                <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs text-amber-700">
                  This conversation is about data request:{" "}
                  <span className="font-semibold">
                    {selectedThread.title || "Untitled"}
                  </span>
                </span>
                <button
                  onClick={() => onNavigate?.("requests", selectedThread.reference_id || undefined)}
                  className="ml-auto flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition"
                >
                  View in Data Requests
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Message List */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {groupedMessages.map((item, idx) => {
                if (item.type === "day_separator") {
                  return (
                    <div
                      key={`sep-${idx}`}
                      className="flex items-center gap-3 my-5"
                    >
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[11px] font-semibold text-gray-400 px-2">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  );
                }

                if (item.type === "system") {
                  return (
                    <div
                      key={item.msg.id}
                      className="text-center py-2 my-1"
                    >
                      <span className="text-xs text-gray-400 italic">
                        {item.msg.content}
                      </span>
                    </div>
                  );
                }

                // Regular message
                const { msg, showAuthor } = item;
                const isConsultant =
                  msg.role === "consultant" || msg.role === "analyst";
                const initials = msg.author
                  .split(" ")
                  .map((n) => n[0])
                  .filter((c) => c && c === c.toUpperCase())
                  .join("");

                if (!showAuthor) {
                  // Continuation message (same author, grouped)
                  return (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 group hover:bg-gray-50 rounded-lg -mx-2 px-2"
                    >
                      {/* invisible spacer to align with avatar */}
                      <div className="w-9 flex-shrink-0 flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {renderContent(msg.content)}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 mt-4 first:mt-0 group hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isConsultant
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {msg.author}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {relativeTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed mt-0.5">
                        {renderContent(msg.content)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    No messages yet. Start the conversation.
                  </p>
                </div>
              )}
            </div>

            {/* ── Input Area ── */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0 relative">
              {/* @mention dropdown */}
              {mentionActive && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-4 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-1.5 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">
                      Members
                    </span>
                  </div>
                  {filteredMembers.map((member, i) => {
                    const initials = member
                      .split(" ")
                      .map((n) => n[0])
                      .filter((c) => c && c === c.toUpperCase())
                      .join("");
                    return (
                      <button
                        key={member}
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur
                          insertMention(member);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition ${
                          i === mentionIndex
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                          {initials}
                        </div>
                        {member}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-300 transition">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  onBlur={() => {
                    // Delay to allow dropdown click
                    setTimeout(() => closeMention(), 150);
                  }}
                  placeholder={`Message #${
                    selectedThread?.title || "general"
                  }   ·   Type @ to mention`}
                  className="flex-1 px-4 py-2.5 bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="w-9 h-9 mr-1 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
