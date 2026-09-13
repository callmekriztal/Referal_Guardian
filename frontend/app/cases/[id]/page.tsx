"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ALLOWED_ACTIONS = [
  { value: "CONTACT_PARENT", label: "Contact parent for consent or screening records" },
  { value: "REQUEST_DOCUMENT", label: "Request pending medical/school documentation" },
  { value: "CONTACT_SPECIALIST", label: "Send formal outreach to assigned clinical specialist" },
  { value: "FIND_ALTERNATIVE_SPECIALIST", label: "Reassign evaluation to available clinical specialist" },
  { value: "SCHEDULE_FOLLOWUP", label: "Schedule mandatory evaluation follow-up" },
  { value: "ESCALATE_CASE", label: "Escalate statutory breach to School Board & DEIC" },
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
  educator_summary?: string;
  days_open: number;
  followup_attempts: number;
  timeline: TimelineEvent[];
  recommendation: AIRecommendation | null;
}

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);

  // Approval / Modify / Reject state
  const [selectedAction, setSelectedAction] = useState("");
  const [coordinatorNote, setCoordinatorNote] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fast-Forward Simulator state
  const [simulatingDays, setSimulatingDays] = useState(false);

  // Add Manual Timeline Event modal
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState("SPECIALIST_CONTACTED");
  const [newEventDetails, setNewEventDetails] = useState("");

  const fetchCaseDetails = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData({
          id: data.id,
          child_id: data.child_identifier || data.child_id || caseId,
          referral_type: data.referral_type || "Evaluation",
          status: data.status || "ACTIVE",
          coordinator: data.coordinator_id || "Staff",
          assigned_specialist_name: data.assigned_specialist_name,
          assigned_specialist_email: data.assigned_specialist_email,
          bottleneck: data.bottleneck || data.current_bottleneck || null,
          coordinator_notes: data.coordinator_notes,
          diagnostic_details: data.diagnostic_details,
          educator_summary: data.educator_summary,
          days_open: typeof data.days_open === "number" ? data.days_open : 0,
          followup_attempts: data.followup_attempts || 0,
          timeline: data.timeline || [],
          recommendation: data.recommendation || null,
        });

        if (data.recommendation) {
          setSelectedAction(data.recommendation.recommended_action);
        }
      }
    } catch (err) {
      console.error("Failed to load case file details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/run`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to run compliance evaluation:", err);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleApproveAction = async () => {
    setSubmittingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinator_notes: coordinatorNote }),
      });
      if (res.ok) {
        setIsModifying(false);
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to approve evaluation action:", err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleModifyAction = async () => {
    setSubmittingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modified_action: selectedAction,
          coordinator_notes: coordinatorNote,
        }),
      });
      if (res.ok) {
        setIsModifying(false);
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to modify evaluation action:", err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectAction = async () => {
    if (!confirm("Are you sure you want to dismiss this recommendation?")) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/reject`, {
        method: "POST",
      });
      if (res.ok) {
        setIsModifying(false);
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to dismiss evaluation action:", err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleFastForward = async (days: number) => {
    setSimulatingDays(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/fast-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to fast forward case timeline:", err);
    } finally {
      setSimulatingDays(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: newEventName,
          details: newEventDetails,
        }),
      });
      if (res.ok) {
        setShowAddEventModal(false);
        setNewEventDetails("");
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error("Failed to log timeline event:", err);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-[#526070]">
        Loading student case file records...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="font-serif text-lg font-semibold text-[#12243D]">Case file not found</div>
        <p className="text-xs text-[#526070]">
          The requested student referral registration does not exist or has been removed from the register.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-[#12243D] text-white text-xs font-medium rounded hover:bg-[#1E324D] transition"
        >
          Return to evaluation register
        </Link>
      </div>
    );
  }

  const isBreach = caseData.days_open >= 20;
  const isApproaching = caseData.days_open >= 15 && caseData.days_open < 20;

  return (
    <RouteGuard allowedRoles={["coordinator"]}>
      <div className="space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-xs text-[#526070] hover:text-[#12243D] font-medium transition"
          >
            Return to evaluation register
          </Link>
        </div>

        {/* Official Case File Header Card */}
        <div className="bg-[#12243D] text-white p-6 rounded-md border border-[#12243D] shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#253D5C] pb-4">
            <div>
              <div className="text-xs font-medium text-[#D8D4CA]">
                Student Referral Registration File
              </div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-white font-mono mt-0.5">
                {caseData.child_id}
              </h1>
              <div className="text-xs text-[#D8D4CA] mt-1">
                Evaluation Type: <span className="text-white font-medium">{caseData.referral_type}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              {isBreach ? (
                <span className="px-3 py-1.5 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] text-xs font-semibold tabular-nums">
                  Day {caseData.days_open} of 20 (Statutory Breach)
                </span>
              ) : isApproaching ? (
                <span className="px-3 py-1.5 rounded bg-[#FDF8EC] text-[#9C6B14] border border-[#F4E3B9] text-xs font-medium tabular-nums">
                  Day {caseData.days_open} of 20 (Approaching Limit)
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] text-xs font-medium tabular-nums">
                  Day {caseData.days_open} of 20 (On Schedule)
                </span>
              )}

              <button
                onClick={handleRunAgent}
                disabled={runningAgent}
                className="px-4 py-2 bg-[#A6790C] hover:bg-[#8C660A] text-white text-xs font-medium rounded border border-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50"
              >
                {runningAgent ? "Evaluating case..." : "Evaluate statutory compliance"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <span className="text-[#D8D4CA] block text-[11px]">Current File Status</span>
              <span className="font-semibold text-white">{caseData.status}</span>
            </div>
            <div>
              <span className="text-[#D8D4CA] block text-[11px]">Assigned Specialist</span>
              <span className="font-semibold text-white">
                {caseData.assigned_specialist_name || "Unassigned"}
              </span>
            </div>
            <div>
              <span className="text-[#D8D4CA] block text-[11px]">Follow-up Outreach Attempts</span>
              <span className="font-semibold text-white">{caseData.followup_attempts}</span>
            </div>
            <div>
              <span className="text-[#D8D4CA] block text-[11px]">Statutory Cause Flag</span>
              <span className="font-semibold text-white">
                {caseData.bottleneck || "None (On Schedule)"}
              </span>
            </div>
          </div>
        </div>

        {/* Assessment Timeline Simulator Control Panel */}
        <div className="bg-white p-5 rounded border border-[#D8D4CA] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#12243D]">
                Assessment Timeline Simulator (Days Open)
              </h3>
              <p className="text-xs text-[#526070]">
                Advance or reset the statutory evaluation clock to test statutory breach detection and action plans.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => handleFastForward(5)}
              disabled={simulatingDays}
              className="px-3 py-1.5 text-xs font-medium text-[#12243D] bg-[#F5F4F0] hover:bg-[#EBE8DF] border border-[#D8D4CA] rounded transition disabled:opacity-50"
            >
              Advance to Day 5 (Normal progress)
            </button>
            <button
              onClick={() => handleFastForward(15)}
              disabled={simulatingDays}
              className="px-3 py-1.5 text-xs font-medium text-[#9C6B14] bg-[#FDF8EC] hover:bg-[#F9F0D9] border border-[#F4E3B9] rounded transition disabled:opacity-50"
            >
              Advance to Day 15 (Caution window)
            </button>
            <button
              onClick={() => handleFastForward(21)}
              disabled={simulatingDays}
              className="px-3 py-1.5 text-xs font-semibold text-[#8C3B2E] bg-[#FBEBE8] hover:bg-[#F7D8D3] border border-[#F3C4BD] rounded transition disabled:opacity-50"
            >
              Advance to Day 21 (Statutory Breach)
            </button>
            <button
              onClick={() => handleFastForward(0)}
              disabled={simulatingDays}
              className="px-3 py-1.5 text-xs font-medium text-[#526070] bg-white hover:bg-[#F5F4F0] border border-[#D8D4CA] rounded transition disabled:opacity-50"
            >
              Reset timeline to Day 0
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* THE SINGLE BOLD ELEMENT: Statutory Compliance Action Review Card    */}
        {/* ------------------------------------------------------------------ */}
        {caseData.recommendation ? (
          <div className="bg-[#12243D] text-white p-6 rounded-md border-2 border-[#A6790C] shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-[#253D5C] pb-4">
              <div>
                <span className="text-xs font-semibold text-[#A6790C] uppercase tracking-normal block">
                  Statutory Action Review & Coordinator Approval
                </span>
                <h2 className="font-serif text-xl font-semibold text-white mt-1">
                  Recommended Coordinator Unblocking Plan
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#D8D4CA] block">Assessment Confidence</span>
                <span className="text-lg font-bold text-[#A6790C] font-mono">
                  {Math.round(caseData.recommendation.confidence * 100)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#1E324D] p-4 rounded border border-[#253D5C]">
                <span className="text-[#D8D4CA] block text-[11px] font-medium mb-1">
                  Identified Statutory Bottleneck
                </span>
                <span className="font-semibold text-white text-sm">
                  {caseData.recommendation.bottleneck}
                </span>
              </div>

              <div className="bg-[#1E324D] p-4 rounded border border-[#253D5C] md:col-span-2">
                <span className="text-[#D8D4CA] block text-[11px] font-medium mb-1">
                  Proposed Administrative Action
                </span>
                <span className="font-semibold text-white text-sm">
                  {ALLOWED_ACTIONS.find((a) => a.value === caseData.recommendation?.recommended_action)?.label ||
                    caseData.recommendation.recommended_action}
                </span>
              </div>
            </div>

            <div className="bg-[#1E324D] p-4 rounded border border-[#253D5C] space-y-2 text-xs">
              <div className="font-semibold text-[#D8D4CA]">Statutory Evaluation Rationale</div>
              <p className="text-white leading-relaxed">{caseData.recommendation.reason}</p>
            </div>

            {/* Coordinator Action Form Controls */}
            <div className="pt-2 space-y-4 border-t border-[#253D5C]">
              {isModifying && (
                <div className="space-y-3 bg-[#1E324D] p-4 rounded border border-[#253D5C]">
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Select replacement coordinator action
                    </label>
                    <select
                      value={selectedAction}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className="w-full p-2 bg-[#12243D] border border-[#253D5C] rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#A6790C]"
                    >
                      {ALLOWED_ACTIONS.map((act) => (
                        <option key={act.value} value={act.value}>
                          {act.label} ({act.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Coordinator instructions / override rationale
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Add specific instructions for school staff or specialist..."
                      value={coordinatorNote}
                      onChange={(e) => setCoordinatorNote(e.target.value)}
                      className="w-full p-2 bg-[#12243D] border border-[#253D5C] rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#A6790C]"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {!isModifying ? (
                  <>
                    <button
                      onClick={handleApproveAction}
                      disabled={submittingAction}
                      className="px-5 py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white text-xs font-semibold rounded border border-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50"
                    >
                      {submittingAction ? "Executing..." : "Approve evaluation recommendation"}
                    </button>
                    <button
                      onClick={() => setIsModifying(true)}
                      className="px-4 py-2.5 bg-[#1E324D] hover:bg-[#253D5C] text-white text-xs font-medium rounded border border-[#253D5C] transition"
                    >
                      Modify action plan
                    </button>
                    <button
                      onClick={handleRejectAction}
                      disabled={submittingAction}
                      className="px-4 py-2.5 bg-transparent hover:bg-rose-950/40 text-rose-300 text-xs font-medium rounded border border-rose-900/60 transition"
                    >
                      Reject recommendation
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleModifyAction}
                      disabled={submittingAction}
                      className="px-5 py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white text-xs font-semibold rounded border border-[#8C660A] transition disabled:opacity-50"
                    >
                      {submittingAction ? "Saving..." : "Confirm modified action plan"}
                    </button>
                    <button
                      onClick={() => setIsModifying(false)}
                      className="px-4 py-2.5 bg-[#1E324D] text-white text-xs font-medium rounded border border-[#253D5C]"
                    >
                      Cancel modification
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded border border-[#D8D4CA] shadow-2xs text-center space-y-3">
            <h3 className="font-serif text-base font-semibold text-[#12243D]">
              No Action Currently Required
            </h3>
            <p className="text-xs text-[#526070] max-w-md mx-auto">
              This referral evaluation is progressing normally within statutory timeline limits. Run a compliance check if new clinical delays occur.
            </p>
            <button
              onClick={handleRunAgent}
              disabled={runningAgent}
              className="px-4 py-2 bg-[#12243D] hover:bg-[#1E324D] text-white text-xs font-medium rounded transition disabled:opacity-50"
            >
              {runningAgent ? "Evaluating..." : "Run compliance check"}
            </button>
          </div>
        )}

        {/* Clinical Diagnostic Notes Section (If submitted by Specialist) */}
        {caseData.diagnostic_details && (
          <div className="bg-[#EBF3ED] p-5 rounded border border-[#BBD5C0] space-y-2 text-xs">
            <div className="font-semibold text-[#4B6A52] flex items-center justify-between">
              <span>Submitted Specialist Clinical Findings</span>
              <span className="text-[11px] font-normal">Logged via Specialist Portal</span>
            </div>
            <p className="text-[#12243D] leading-relaxed font-medium">
              {caseData.diagnostic_details}
            </p>
          </div>
        )}

        {/* Chronological Case History Ledger */}
        <div className="bg-white rounded border border-[#D8D4CA] shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8D4CA] bg-[#F5F4F0] flex items-center justify-between">
            <h3 className="font-serif text-base font-semibold text-[#12243D]">
              Chronological Case File Ledger ({caseData.timeline.length} events)
            </h3>
            <button
              onClick={() => setShowAddEventModal(true)}
              className="px-3 py-1 text-xs font-medium text-[#12243D] bg-white border border-[#D8D4CA] hover:bg-[#F5F4F0] rounded transition"
            >
              Log manual milestone
            </button>
          </div>

          {caseData.timeline.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#526070]">
              No chronological events recorded in case file.
            </div>
          ) : (
            <div className="divide-y divide-[#D8D4CA]">
              {caseData.timeline.map((ev, idx) => (
                <div key={ev.id || idx} className="p-4 hover:bg-[#F5F4F0] transition text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#12243D] font-mono">
                      {ev.event}
                    </span>
                    <span className="text-[11px] text-[#526070] font-mono">
                      {ev.date ? new Date(ev.date).toLocaleDateString("en-IN") : "Date recorded"}
                    </span>
                  </div>
                  {ev.details && (
                    <p className="text-[#526070] leading-relaxed pl-2 border-l-2 border-[#D8D4CA]">
                      {ev.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Log Manual Milestone */}
        {showAddEventModal && (
          <div className="fixed inset-0 bg-[#12243D]/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded border border-[#D8D4CA] max-w-md w-full overflow-hidden shadow-lg">
              <div className="bg-[#12243D] text-white p-4 flex items-center justify-between">
                <h4 className="font-serif text-sm font-semibold text-white">
                  Log Official Milestone Event
                </h4>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="text-[#D8D4CA] hover:text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#12243D] mb-1">
                    Milestone event type
                  </label>
                  <select
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  >
                    <option value="SPECIALIST_CONTACTED">SPECIALIST_CONTACTED</option>
                    <option value="DOCUMENT_REQUESTED">DOCUMENT_REQUESTED</option>
                    <option value="DOCUMENT_RECEIVED">DOCUMENT_RECEIVED</option>
                    <option value="PARENT_CONTACTED">PARENT_CONTACTED</option>
                    <option value="APPOINTMENT_REQUESTED">APPOINTMENT_REQUESTED</option>
                    <option value="APPOINTMENT_DELAYED">APPOINTMENT_DELAYED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#12243D] mb-1">
                    Event details & notes
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter details of correspondence, consent received, or evaluation progress..."
                    value={newEventDetails}
                    onChange={(e) => setNewEventDetails(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEventModal(false)}
                    className="px-3 py-1.5 text-xs text-[#526070] border border-[#D8D4CA] rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-[#A6790C] hover:bg-[#8C660A] text-white rounded font-medium border border-[#8C660A]"
                  >
                    Log milestone
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
