"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  ArrowLeft,
  Edit3,
  RefreshCw,
  Plus,
  X,
  FileText,
  UserCheck,
  FastForward,
  RotateCcw,
  Zap,
} from "lucide-react";
import RouteGuard from "@/components/RouteGuard";
import { useAuth } from "@/lib/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ALLOWED_ACTIONS = [
  "CONTACT_PARENT",
  "REQUEST_DOCUMENT",
  "CONTACT_SPECIALIST",
  "FIND_ALTERNATIVE_SPECIALIST",
  "SCHEDULE_FOLLOWUP",
  "ESCALATE_CASE",
];

const COMMON_TIMELINE_EVENTS = [
  "SPECIALIST_CONTACTED",
  "NO_RESPONSE",
  "SPECIALIST_UNAVAILABLE",
  "DOCUMENT_REQUESTED",
  "DOCUMENT_RECEIVED",
  "PARENT_CONTACTED",
  "PARENT_UNREACHABLE",
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_DELAYED",
];

interface TimelineEvent {
  id: string;
  date: string;
  event: string;
  details?: string | null;
}

interface AIRecommendation {
  id: string;
  bottleneck: string;
  confidence: number;
  recommended_action: string;
  priority: string;
  reason: string;
  evidence_event_ids: string[];
  requires_human_approval: boolean;
}

interface CaseDetails {
  id: string;
  child_id: string;
  referral_type: string;
  status: string;
  coordinator: string;
  assigned_specialist_name?: string;
  assigned_specialist_email?: string;
  bottleneck: string | null;
  coordinator_notes?: string;
  diagnostic_details?: string;
  days_open: number;
  followup_attempts: number;
  timeline: TimelineEvent[];
  recommendation: AIRecommendation | null;
  verification?: {
    success: boolean;
    status: string;
    reason?: string;
  } | null;
  action_result?: {
    status: string;
    action?: string;
    message?: string;
  } | null;
}

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = (params?.id as string) || "CASE-1042";
  const { profile } = useAuth();
  const isCoordinator = !profile || profile.role === "coordinator";

  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningAgent, setRunningAgent] = useState<boolean>(false);
  const [fastForwarding, setFastForwarding] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedAction, setModifiedAction] = useState("CONTACT_SPECIALIST");
  const [modifyReason, setModifyReason] = useState("");
  const [coordinatorNotesInput, setCoordinatorNotesInput] = useState("");

  // Add Event Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState("SPECIALIST_UNAVAILABLE");
  const [customEventDetails, setCustomEventDetails] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  const fetchCaseFromBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}`);
      if (!res.ok) throw new Error("Could not reach backend");
      const data = await res.json();

      const timeline: TimelineEvent[] = (data.timeline || []).map((t: any) => ({
        id: t.id,
        date: t.timestamp ? new Date(t.timestamp).toLocaleDateString() : (t.date || "Recent"),
        event: t.event_type || t.event || "EVENT",
        details: t.details,
      }));

      const rec: AIRecommendation | null = data.recommendation
        ? {
            id: data.recommendation.id,
            bottleneck: data.recommendation.bottleneck,
            confidence: data.recommendation.confidence,
            recommended_action: data.recommendation.recommended_action,
            priority: data.recommendation.priority,
            reason: data.recommendation.reason,
            evidence_event_ids: data.recommendation.evidence || [],
            requires_human_approval: true,
          }
        : null;

      setCaseData({
        id: data.id,
        child_id: data.child_identifier || "STU-8821",
        referral_type: data.referral_type || "Evaluation",
        status: data.status || "ACTIVE",
        coordinator: data.coordinator_id || "Dr. Smith",
        assigned_specialist_name: data.assigned_specialist_name,
        assigned_specialist_email: data.assigned_specialist_email,
        bottleneck: data.current_bottleneck || null,
        coordinator_notes: data.coordinator_notes,
        diagnostic_details: data.diagnostic_details,
        days_open: data.days_open || 0,
        followup_attempts: data.followup_attempts || 0,
        timeline,
        recommendation: rec,
      });
      if (data.coordinator_notes) {
        setCoordinatorNotesInput(data.coordinator_notes);
      }
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCaseFromBackend();
      setLoading(false);
    };
    init();
  }, [caseId]);

  const handleFastForward = async (days: number) => {
    setFastForwarding(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/fast-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        await fetchCaseFromBackend();
        if (days >= 20) {
          setActionSuccessMsg(`Fast-forwarded to Day ${days}: Statutory 20-day deadline exceeded! Flagged APPOINTMENT_DELAYED bottleneck.`);
        } else if (days === 0) {
          setActionSuccessMsg("Timeline reset to Day 0 intake.");
        } else {
          setActionSuccessMsg(`Fast-forwarded timeline to Day ${days}.`);
        }
      } else {
        setErrorMsg("Failed to fast-forward case timeline.");
      }
    } catch (err: any) {
      setErrorMsg("Network error during fast-forward: " + err.message);
    } finally {
      setFastForwarding(false);
    }
  };

  const handleRunAgent = async () => {
    setRunningAgent(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/run`, {
        method: "POST",
      });
      if (res.ok) {
        const agentData = await res.json();
        await fetchCaseFromBackend();
        if (agentData?.bottleneck) {
          setActionSuccessMsg("Referral Guardian analyzed case and paused for human approval.");
        } else {
          setActionSuccessMsg("Referral Guardian analyzed case: Specialist response confirmed! Case is active with no bottlenecks.");
        }
      } else {
        setErrorMsg("Failed to run agent.");
      }
    } catch (err: any) {
      setErrorMsg("Network error running agent: " + err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleApproveAction = async () => {
    if (!caseData || !caseData.recommendation) return;
    setRunningAgent(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approver_id: "staff",
          coordinator_notes: coordinatorNotesInput || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchCaseFromBackend();
        setActionSuccessMsg(
          data.action_result?.message || "Action approved, executed & verified successfully!"
        );
      } else {
        setErrorMsg("Failed to approve action.");
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleModifyAction = async () => {
    if (!caseData || !caseData.recommendation) return;
    setRunningAgent(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modifiedAction,
          reason: modifyReason,
          coordinator_notes: coordinatorNotesInput || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchCaseFromBackend();
        setIsModifying(false);
        setActionSuccessMsg(
          data.action_result?.message || `Modified action ${modifiedAction} executed & verified!`
        );
      } else {
        setErrorMsg("Failed to modify action.");
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleRejectAction = async () => {
    if (!caseData || !caseData.recommendation) return;
    setRunningAgent(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Coordinator chose not to proceed.",
          coordinator_notes: coordinatorNotesInput || undefined,
        }),
      });
      if (res.ok) {
        await fetchCaseFromBackend();
        setActionSuccessMsg("Recommendation rejected. Run ended.");
      }
    } catch (err: any) {
      setErrorMsg("Error rejecting recommendation: " + err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleAddTimelineEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingEvent(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: selectedEventType,
          details: customEventDetails.trim() || `Manual milestone: ${selectedEventType.replace(/_/g, " ")}`,
        }),
      });

      if (res.ok) {
        setShowEventModal(false);
        setCustomEventDetails("");
        await fetchCaseFromBackend();
        setActionSuccessMsg(
          isCoordinator
            ? `Added '${selectedEventType}' to timeline. You can now re-run the agent!`
            : `Added '${selectedEventType}' to timeline.`
        );
      } else {
        alert("Failed to add event");
      }
    } catch (err) {
      console.error("Add event error:", err);
    } finally {
      setAddingEvent(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
        <p className="text-sm text-slate-500 font-medium">Loading case details & timeline...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Case Not Found</h2>
        <Link href="/" className="text-indigo-600 text-sm font-semibold hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <RouteGuard>
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Cases Dashboard</span>
        </Link>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowEventModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Timeline Event</span>
          </button>
          <button
            onClick={fetchCaseFromBackend}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Refresh case"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Case Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900">{caseData.id}</h1>
              <span className="text-sm font-medium text-slate-500">({caseData.child_id})</span>
              {caseData.status === "ESCALATED" ? (
                <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-200">
                  ESCALATED
                </span>
              ) : caseData.status === "STUCK" ? (
                <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                  STUCK
                </span>
              ) : caseData.status === "ACTIVE" ? (
                <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  ACTIVE
                </span>
              ) : caseData.status === "RESOLVED" ? (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  RESOLVED
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                  {caseData.status}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Referral Type: <strong className="text-slate-800">{caseData.referral_type}</strong></span>
              <span>•</span>
              <span>Coordinator: <strong className="text-slate-800">{caseData.coordinator}</strong></span>
              {(caseData.assigned_specialist_name || caseData.assigned_specialist_email) && (
                <>
                  <span>•</span>
                  <span>
                    Specialist: <strong className="text-purple-700">{caseData.assigned_specialist_name || "Assigned"}</strong>
                    {caseData.assigned_specialist_email && (
                      <span className="font-mono text-purple-600 ml-1 text-xs">({caseData.assigned_specialist_email})</span>
                    )}
                  </span>
                </>
              )}
            </p>
          </div>

          {isCoordinator && (
            <button
              onClick={handleRunAgent}
              disabled={runningAgent}
              className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:from-purple-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${runningAgent ? "animate-spin" : ""}`} />
              <span>{runningAgent ? "Evaluating Graph..." : "Run Referral Guardian AI"}</span>
            </button>
          )}
        </div>

        {/* Highlighted Alerts */}
        {caseData.bottleneck && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-0.5">
              <span className="font-bold uppercase tracking-wider">Active Bottleneck Detected:</span>
              <p className="font-semibold text-amber-800">{caseData.bottleneck.replace(/_/g, " ")}</p>
            </div>
          </div>
        )}

        {caseData.coordinator_notes && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start space-x-3">
            <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <span className="font-bold text-slate-900">Coordinator Notes: </span>
              <span>"{caseData.coordinator_notes}"</span>
            </div>
          </div>
        )}

        {caseData.diagnostic_details && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3.5 flex items-start space-x-3">
            <UserCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900">
              <span className="font-bold">Special Educator Findings: </span>
              <span>"{caseData.diagnostic_details}"</span>
            </div>
          </div>
        )}

        {/* Statutory 20-Day Timeline Simulator (Coordinator only) */}
        {isCoordinator && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Statutory 20-Day IDEA Timeline Simulator
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Simulate time-warp to test statutory deadline compliance & bottleneck triggers.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">
                  Current Age: <span className={caseData.days_open >= 20 ? "text-rose-600 font-extrabold" : "text-indigo-600 font-extrabold"}>{caseData.days_open} Days</span> / 20 Max
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  caseData.days_open >= 20
                    ? "bg-rose-500"
                    : caseData.days_open >= 15
                    ? "bg-amber-500"
                    : "bg-indigo-600"
                }`}
                style={{ width: `${Math.min((caseData.days_open / 20) * 100, 100)}%` }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Fast-Forward:</span>
              <button
                onClick={() => handleFastForward(5)}
                disabled={fastForwarding}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium transition shadow-2xs disabled:opacity-50"
              >
                <FastForward className="w-3 h-3 text-indigo-500" />
                <span>+5 Days</span>
              </button>
              <button
                onClick={() => handleFastForward(15)}
                disabled={fastForwarding}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium transition shadow-2xs disabled:opacity-50"
              >
                <FastForward className="w-3 h-3 text-amber-500" />
                <span>+15 Days</span>
              </button>
              <button
                onClick={() => handleFastForward(21)}
                disabled={fastForwarding}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition shadow-2xs disabled:opacity-50"
              >
                <FastForward className="w-3 h-3 text-rose-600" />
                <span>+21 Days (Overdue)</span>
              </button>
              <button
                onClick={() => handleFastForward(0)}
                disabled={fastForwarding}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded text-xs font-medium transition shadow-2xs ml-auto disabled:opacity-50"
                title="Reset case age back to Day 0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Day 0</span>
              </button>
            </div>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-800 font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 text-xs text-rose-800 font-semibold">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Main Grid: AI Recommendation Card (2 cols for coordinator) vs Timeline (1 col for coordinator, 3 cols for specialist) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: AI Recommendation & Human Approval (Coordinator only) */}
        {isCoordinator && (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-800 text-lg">AI Recommendation & Human Approval</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                LangGraph State
              </span>
            </div>

            <div className="p-6">
              {caseData.recommendation ? (
                <div className="space-y-5">
                  {/* Recommendation Summary */}
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                        Proposed Next Best Action
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                        {caseData.recommendation.priority} Priority ({Math.round(caseData.recommendation.confidence * 100)}% Confidence)
                      </span>
                    </div>

                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {caseData.recommendation.recommended_action.replace(/_/g, " ")}
                    </div>
                  </div>

                  {/* Operational Reasoning */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Agent Operational Reasoning
                    </h4>
                    <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-relaxed">
                      "{caseData.recommendation.reason}"
                    </p>
                  </div>

                  {/* Evidence */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Evidence from Timeline
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                      {caseData.recommendation.evidence_event_ids.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Coordinator Notes Input for Handoff */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Coordinator Instructions / Notes for Special Educator (Handoff)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Add notes to accompany this action and hand off to the Special Educator..."
                      value={coordinatorNotesInput}
                      onChange={(e) => setCoordinatorNotesInput(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Modification Mode */}
                  {isModifying && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 uppercase">Override Recommended Action</span>
                        <button onClick={() => setIsModifying(false)} className="text-xs text-amber-700 hover:underline">
                          Cancel
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-amber-800 font-medium mb-1">Select Replacement Action</label>
                        <select
                          className="w-full text-xs font-mono bg-white border border-amber-300 rounded p-2 text-slate-800"
                          value={modifiedAction}
                          onChange={(e) => setModifiedAction(e.target.value)}
                        >
                          {ALLOWED_ACTIONS.map((a) => (
                            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-amber-800 font-medium mb-1">Reason for override</label>
                        <input
                          type="text"
                          placeholder="e.g. Coordinator prefers alternative specialist first..."
                          className="w-full text-xs bg-white border border-amber-300 rounded p-2 text-slate-800"
                          value={modifyReason}
                          onChange={(e) => setModifyReason(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleModifyAction}
                        disabled={runningAgent}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition"
                      >
                        Confirm & Execute Modified Action
                      </button>
                    </div>
                  )}

                  {/* Approval Action Buttons */}
                  {!isModifying && (
                    isCoordinator ? (
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          onClick={handleApproveAction}
                          disabled={runningAgent}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition shadow-xs flex items-center space-x-2 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>APPROVE & EXECUTE</span>
                        </button>
                        <button
                          onClick={() => setIsModifying(true)}
                          disabled={runningAgent}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-3 rounded-lg transition shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>MODIFY</span>
                        </button>
                        <button
                          onClick={handleRejectAction}
                          disabled={runningAgent}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm px-5 py-3 rounded-lg transition disabled:opacity-50"
                        >
                          REJECT
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 font-medium">
                        ℹ️ Pending review & approval by the Referral Coordinator.
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="py-10 text-center space-y-3">
                  {caseData.diagnostic_details ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <Sparkles className="w-10 h-10 text-indigo-400 mx-auto" />
                  )}
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      {caseData.diagnostic_details
                        ? "Specialist Response Received"
                        : "No Pending Recommendations"}
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                      {caseData.diagnostic_details
                        ? 'Clinical findings have been logged by the specialist. The referral is active with no bottlenecks.'
                        : isCoordinator
                        ? 'Click "Run Referral Guardian AI" to evaluate case history, detect bottlenecks, and propose next actions.'
                        : 'No pending recommendation. The case is progressing normally.'}
                    </p>
                  </div>
                  {isCoordinator && (
                    <button
                      onClick={handleRunAgent}
                      disabled={runningAgent}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-2 mt-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{caseData.diagnostic_details ? "Re-Evaluate Case" : "Run Agent Now"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Right Column: Case Timeline (Enlarged to 3 cols for Specialist, 1 col for Coordinator) */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6 ${isCoordinator ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>Case Timeline</span>
            </h2>
            <button
              onClick={() => setShowEventModal(true)}
              className="text-xs text-indigo-600 hover:underline font-semibold"
            >
              + Add Event
            </button>
          </div>

          <div className={`relative border-l-2 border-slate-200 ml-3 space-y-6 overflow-y-auto pr-2 ${isCoordinator ? "max-h-[500px]" : "max-h-[750px]"}`}>
            {caseData.timeline.map((evt) => (
              <div key={evt.id} className="ml-6 relative">
                <div className="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white ring-4 ring-slate-100" />
                <div>
                  <span className="text-xs font-semibold text-slate-400">{evt.date}</span>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {evt.event.replace(/_/g, " ")}
                  </div>
                  {evt.details && (
                    <p className="text-[11px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                      {evt.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Add Event Modal for Testing Bottlenecks */}
      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Timeline Event</h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTimelineEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Event Type
                </label>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  {COMMON_TIMELINE_EVENTS.map((evt) => (
                    <option key={evt} value={evt}>{evt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Event Details / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Specialist Dr. Vance reported 0 openings this month..."
                  value={customEventDetails}
                  onChange={(e) => setCustomEventDetails(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEvent}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-xs disabled:opacity-50"
                >
                  {addingEvent ? "Adding..." : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </RouteGuard>
  );
}
