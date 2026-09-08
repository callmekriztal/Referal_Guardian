"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Clock,
  User,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { Timeline, TimelineEvent } from "@/components/Timeline";
import {
  RecommendationCard,
  Recommendation,
} from "@/components/RecommendationCard";
import { useAuth } from "@/lib/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CaseDetail {
  id: string;
  child_identifier: string;
  referral_type: string;
  status: string;
  coordinator_id?: string | null;
  current_bottleneck?: string | null;
  created_date?: string | null;
  days_open: number;
  followup_attempts: number;
  timeline?: TimelineEvent[];
  recommendation?: Recommendation | null;
}

interface AgentStateResponse {
  case_id: string;
  agent_status: string;
  current_node?: string | null;
  waiting_for_approval: boolean;
  bottleneck?: {
    type: string;
    description: string;
    severity?: string;
  } | null;
  recommendation?: Recommendation | null;
  action_result?: {
    status: string;
    action?: string;
    message?: string;
    error?: string;
    entity_id?: string;
  } | null;
  verification?: {
    success: boolean;
    status: string;
    reason?: string;
  } | null;
  error?: string | null;
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;
  const { profile } = useAuth();
  const isCoordinator = !profile || profile.role === "coordinator";

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [agentState, setAgentState] = useState<AgentStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentLoading, setAgentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchCase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}`);
      if (!res.ok) throw new Error("Failed to load case details.");
      const data = await res.json();
      setCaseData(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchAgentState = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/state`);
      if (res.ok) {
        const data = await res.json();
        setAgentState(data);
      }
    } catch {
      // optional/non-fatal if agent hasn't run yet
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchCase(), fetchAgentState()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [caseId]);

  const handleRunAgent = async () => {
    setAgentLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to trigger Referral Guardian agent.");
      }
      const data = await res.json();
      setAgentState(data);
      setFeedback("Referral Guardian evaluated case and paused for human decision.");
      await fetchCase();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleApprove = async () => {
    setAgentLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver_id: "staff-ui" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Approval failed.");
      }
      const data = await res.json();
      setAgentState(data);
      setFeedback("Action approved, executed, and verified!");
      await fetchCase();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleReject = async (reason?: string) => {
    setAgentLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "Rejected by coordinator" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Rejection failed.");
      }
      const data = await res.json();
      setAgentState(data);
      setFeedback("Recommendation rejected. Referral run completed.");
      await fetchCase();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleModify = async (action: string, reason?: string) => {
    setAgentLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}/agent/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Modification failed.");
      }
      const data = await res.json();
      setAgentState(data);
      setFeedback(`Action modified to ${action}, executed, and verified!`);
      await fetchCase();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-gray-500 font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          Loading referral case...
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Case Not Found</h2>
          <p className="text-sm text-gray-500 mt-1">
            Case ID {caseId} could not be retrieved from the database.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Choose the recommendation from agentState or fallback to caseData
  const activeRecommendation =
    agentState?.recommendation || caseData.recommendation || null;
  const activeBottleneck =
    agentState?.bottleneck ||
    (caseData.current_bottleneck
      ? { type: caseData.current_bottleneck, description: "" }
      : null);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              disabled={agentLoading}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-xs transition-colors"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${agentLoading ? "animate-spin" : ""}`}
              />
            </button>
            {isCoordinator && (
              <button
                onClick={handleRunAgent}
                disabled={agentLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                {agentLoading ? "Running Guardian..." : "Run Guardian Agent"}
              </button>
            )}
          </div>
        </div>

        {/* Alerts / Feedback */}
        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Case Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">
                  {caseData.id}
                </h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    caseData.status === "STUCK"
                      ? "bg-amber-100 text-amber-800"
                      : caseData.status === "ESCALATED"
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {caseData.status}
                </span>
                {agentState?.agent_status && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Agent: {agentState.agent_status}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Child Identifier:{" "}
                <strong className="text-gray-800">
                  {caseData.child_identifier}
                </strong>{" "}
                • Type:{" "}
                <strong className="text-gray-800">
                  {caseData.referral_type}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500 border-l border-gray-100 pl-6">
              <div>
                <span className="text-xs text-gray-400 block">Days Open</span>
                <span className="text-base font-bold text-gray-900">
                  {caseData.days_open}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Follow-ups</span>
                <span className="text-base font-bold text-gray-900">
                  {caseData.followup_attempts}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Execution Result & Verification Banner (if just executed) */}
        {agentState?.action_result && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Action Execution Outcome
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                  agentState.action_result.status === "SUCCESS" ||
                  agentState.action_result.status === "SIMULATED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {agentState.action_result.status}
              </span>
            </div>
            <p className="text-sm text-gray-800 font-medium">
              {agentState.action_result.message || agentState.action_result.error}
            </p>
            {agentState.verification && (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                <span>
                  Deterministic Verification:{" "}
                  <strong>{agentState.verification.status}</strong>
                </span>
                <span>{agentState.verification.reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Main Grid: Recommendation on Left (Coordinator only), Timeline on Right (Full width for Specialist) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: AI Recommendation */}
          {isCoordinator && (
            <div className="lg:col-span-5 space-y-6">
              <RecommendationCard
                recommendation={activeRecommendation}
                bottleneck={activeBottleneck}
                isCoordinator={isCoordinator}
                onApprove={handleApprove}
                onReject={handleReject}
                onModify={handleModify}
                isLoading={agentLoading}
              />
            </div>
          )}

          {/* Right Column: Case Timeline */}
          <div className={`${isCoordinator ? "lg:col-span-7" : "lg:col-span-12"} bg-white rounded-xl border border-gray-200 p-6 shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Referral Case Timeline
              </h3>
              <span className="text-xs text-gray-400">
                {caseData.timeline?.length || 0} events
              </span>
            </div>

            <Timeline events={caseData.timeline || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
