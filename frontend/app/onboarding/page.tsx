"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startOnboarding, onboardingRespond, startOnboardingBuild, pollOnboardingBuild, finalizeOnboarding, getCanonicalSQF } from "@/lib/api";
import type { School, OnboardingAIResponse, OnboardingDimension, OnboardingLearned, BuildProgress, Amendment } from "@/lib/types";
import FrameworkStudio from "@/components/FrameworkStudio";
import {
  Compass, ArrowRight, ArrowLeft, Loader2, Send,
  School as SchoolIcon, Lightbulb, Target, AlertTriangle,
  Sparkles, BookOpen, XCircle,
} from "lucide-react";

type Phase = "profile" | "interview" | "studio";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("profile");

  // Profile form state
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");

  // Interview state
  const [school, setSchool] = useState<School | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [learned, setLearned] = useState<OnboardingLearned>({});
  const [turnCount, setTurnCount] = useState(0);

  // Merge learned data cumulatively — never lose information from earlier turns
  const mergeLearned = (prev: OnboardingLearned, next: OnboardingLearned): OnboardingLearned => {
    const mergeArrays = (a?: string[], b?: string[]) => {
      if (!b || b.length === 0) return a;
      if (!a || a.length === 0) return b;
      // Deduplicate while preserving order, preferring newer entries
      const seen = new Set<string>();
      const result: string[] = [];
      for (const item of [...b, ...a]) {
        const key = item.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    };
    return {
      identity: next.identity && next.identity.length > (prev.identity?.length || 0)
        ? next.identity
        : prev.identity || next.identity,
      programs: mergeArrays(prev.programs, next.programs),
      priorities: mergeArrays(prev.priorities, next.priorities),
      challenges: mergeArrays(prev.challenges, next.challenges),
      custom_needs: mergeArrays(prev.custom_needs, next.custom_needs),
      skip_candidates: mergeArrays(prev.skip_candidates, next.skip_candidates),
    };
  };
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [readyToBuild, setReadyToBuild] = useState(false);
  const [proposedFramework, setProposedFramework] = useState<OnboardingDimension[] | null>(null);
  const [proposalRationale, setProposalRationale] = useState("");
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [buildError, setBuildError] = useState<string | null>(null);
  const studioEditsRef = useRef(false); // tracks if user has made studio chat edits
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, loading]);

  // Focus input after AI responds
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleStartOnboarding = async () => {
    if (!schoolName.trim()) return;
    setLoading(true);
    try {
      const result = await startOnboarding({
        name: schoolName,
        school_type: schoolType || undefined,
        grade_levels: gradeLevel || undefined,
        enrollment: enrollment || undefined,
        district: district || undefined,
        state: state || undefined,
      });
      setSchool(result.school);
      const aiResp = result.ai_response;
      if (aiResp.status === "interviewing" && aiResp.message) {
        setConversation([{ role: "assistant", content: aiResp.message }]);
        if (aiResp.learned) setLearned((prev) => mergeLearned(prev, aiResp.learned!));
        if (aiResp.turn) setTurnCount(aiResp.turn);
      }
      setPhase("interview");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start onboarding");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !school || loading) return;
    const msg = userInput.trim();
    setUserInput("");
    setConversation((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const result = await onboardingRespond(school.id, msg);
      const aiResp = result.ai_response;
      if (aiResp.message) {
        setConversation((prev) => [...prev, { role: "assistant" as const, content: aiResp.message! }]);
      }
      if (aiResp.learned) setLearned((prev) => mergeLearned(prev, aiResp.learned!));
      if (aiResp.turn) setTurnCount(aiResp.turn);
      if (aiResp.ready_to_build) setReadyToBuild(true);
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try sending your message again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildFramework = async () => {
    if (!school) return;
    setBuildError(null);
    setBuildProgress({ status: "building", step: 0, step_label: "Loading framework...", dimensions_total: 0, dimensions_completed: 0 });

    try {
      // Load canonical SQF + start build in parallel
      const [sqfTree, { job_id }] = await Promise.all([
        getCanonicalSQF(),
        startOnboardingBuild(school.id, learned),
      ]);

      // Enter studio immediately with the real SQF
      setProposedFramework(sqfTree);
      setConversation((prev) => [
        ...prev,
        { role: "assistant" as const, content: "Here's the School Quality Framework. I'm customizing it for your school now..." },
      ]);
      setPhase("studio");

      // Poll every 3 seconds until the build completes
      const maxPolls = 80; // 4 minutes max
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const job = await pollOnboardingBuild(school.id, job_id);
          setBuildProgress(job);

          if (job.status === "complete" && job.ai_response) {
            const aiResp = job.ai_response;
            if (aiResp.framework) {
              // Only replace the framework if the user hasn't made studio chat edits
              if (!studioEditsRef.current) {
                setProposedFramework(aiResp.framework.dimensions);
              }
              setProposalRationale(aiResp.rationale || "");
              if (job.amendments) setAmendments(job.amendments);
              setConversation((prev) => [
                ...prev,
                { role: "assistant" as const, content: `Framework customized with ${job.amendments?.length || 0} amendments. Review the changes and finalize when ready.` },
              ]);
              setBuildProgress(null);
              return;
            }
          } else if (job.status === "error") {
            setBuildProgress(null);
            setBuildError(job.detail || "Framework customization failed. You can still edit the base framework manually.");
            return;
          }
        } catch {
          // Poll request failed — keep trying (transient network error)
        }
      }
      // Timed out
      setBuildProgress(null);
      setBuildError("Framework customization is taking too long. You can still edit the base framework manually.");
    } catch {
      setBuildProgress(null);
      setBuildError("Failed to start framework customization. Please try again.");
      setPhase("interview");
    }
  };

  const handleFinalize = async (framework: { dimensions: OnboardingDimension[] }) => {
    if (!school) return;
    setLoading(true);
    try {
      const result = await finalizeOnboarding(school.id, {
        framework,
        engagement_name: `${school.name} - Assessment`,
        strategic_priorities: learned.priorities || [],
        programs: learned.programs || [],
        amendments: amendments.length > 0 ? amendments : undefined,
      });
      router.push(`/?engagement=${result.engagement_id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to finalize framework");
    } finally {
      setLoading(false);
    }
  };

  // ---- Profile Phase ----
  if (phase === "profile") {
    return (
      <div className="min-h-screen bg-[#FAFBFC]">
        <header className="bg-white border-b border-gray-200 px-8 h-16 flex items-center">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mr-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900 tracking-tight">Meridian</span>
            <span className="text-sm text-gray-400 ml-2">New Assessment</span>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-8 py-16">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SchoolIcon className="w-7 h-7 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Tell us about your school</h1>
            <p className="text-gray-500">We'll use this to tailor your assessment framework.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name *</label>
              <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Lincoln Innovation Academy" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">School Type</label>
                <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select...</option>
                  <option value="Charter">Charter</option>
                  <option value="Traditional">Traditional Public</option>
                  <option value="Private">Private</option>
                  <option value="Faith-Based">Faith-Based</option>
                  <option value="Magnet">Magnet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade Levels</label>
                <input type="text" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="K-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Enrollment</label>
                <input type="text" value={enrollment} onChange={(e) => setEnrollment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="420" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="MN" maxLength={2} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">District</label>
              <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Metro City Public Schools" />
            </div>
          </div>

          <button onClick={handleStartOnboarding} disabled={!schoolName.trim() || loading}
            className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Continue to Interview
          </button>
        </div>
      </div>
    );
  }

  // ---- Interview Phase ----
  if (phase === "interview") {
    const hasIdentity = !!learned.identity;
    const hasPrograms = learned.programs && learned.programs.length > 0;
    const hasPriorities = learned.priorities && learned.priorities.length > 0;
    const hasChallenges = learned.challenges && learned.challenges.length > 0;
    const hasCustomNeeds = learned.custom_needs && learned.custom_needs.length > 0;
    const hasSkipCandidates = learned.skip_candidates && learned.skip_candidates.length > 0;
    const hasAnyContext = hasIdentity || hasPrograms || hasPriorities || hasChallenges || hasCustomNeeds || hasSkipCandidates;

    return (
      <div className="h-screen flex flex-col bg-[#FAFBFC]">
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase("profile")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 mr-3">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Framework Interview</span>
            <span className="text-sm text-gray-400">{school?.name}</span>
          </div>
          <div className="flex items-center gap-3" />
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-2xl mx-auto space-y-4">
                {conversation.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-gray-200 bg-white px-6 py-4">
              <div className="max-w-2xl mx-auto">
                {buildError && (
                  <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {buildError}
                  </div>
                )}
                {readyToBuild && !loading ? (
                  <div className="flex gap-3">
                    <button onClick={handleBuildFramework}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Build My Framework
                    </button>
                    <button onClick={() => { setReadyToBuild(false); inputRef.current?.focus(); }}
                      className="px-4 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                      Keep talking
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      disabled={loading}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Type your response..."
                    />
                    <button onClick={handleSendMessage} disabled={loading || !userInput.trim()}
                      className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Context sidebar */}
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">School Profile</h3>
            </div>

            <div className="px-5 py-4 space-y-1.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SchoolIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900">{school?.name}</span>
              </div>
              {(school?.school_type || school?.grade_levels) && (
                <p className="text-xs text-gray-500 pl-6">
                  {[school?.school_type, school?.grade_levels, school?.enrollment ? `${school.enrollment} students` : null, school?.state].filter(Boolean).join(" \u00b7 ")}
                </p>
              )}
            </div>

            {hasAnyContext && (
              <>
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">What I've Learned</h3>
                </div>

                <div className="px-5 py-3 space-y-4">
                  {hasIdentity && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-gray-600">Identity</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{learned.identity}</p>
                    </div>
                  )}

                  {hasPrograms && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-gray-600">Programs</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {learned.programs!.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasPriorities && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-medium text-gray-600">Priorities</span>
                      </div>
                      <ul className="space-y-1">
                        {learned.priorities!.map((p, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                            <span className="text-indigo-400 mt-0.5">-</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasChallenges && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-gray-600">Challenges</span>
                      </div>
                      <ul className="space-y-1">
                        {learned.challenges!.map((c, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5">-</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasCustomNeeds && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-medium text-gray-600">Custom Framework Needs</span>
                      </div>
                      <ul className="space-y-1">
                        {learned.custom_needs!.map((c, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                            <span className="text-purple-400 mt-0.5">+</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasSkipCandidates && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <XCircle className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">May Skip</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {learned.skip_candidates!.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full line-through">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!hasAnyContext && (
              <div className="px-5 py-8 text-center">
                <Sparkles className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Context will appear here as we talk about your school</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Framework Studio Phase ----
  if (phase === "studio" && proposedFramework) {
    return (
      <FrameworkStudio
        school={school!}
        dimensions={proposedFramework}
        rationale={proposalRationale}
        conversation={conversation}
        onFinalize={handleFinalize}
        onBack={() => setPhase("interview")}
        loading={loading}
        onStudioEdit={() => { studioEditsRef.current = true; }}
        buildProgress={buildProgress}
        buildError={buildError}
        learned={learned}
        amendments={amendments}
      />
    );
  }

  return null;
}
