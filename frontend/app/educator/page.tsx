"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  FileText, 
  RefreshCw, 
  Calendar, 
  AlertCircle,
  Stethoscope,
  Sparkles,
  UserCheck,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import RouteGuard from "@/components/RouteGuard";
import { useAuth } from "@/lib/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Specialist {
  id: string;
  name: string;
  email?: string;
  specialization: string;
  location?: string;
  availability_status: string;
  next_available_date?: string | null;
  active: boolean;
}

interface CaseItem {
  id: string;
  child_identifier: string;
  referral_type: string;
  status: string;
  coordinator_id?: string;
  assigned_specialist_id?: string;
  assigned_specialist_name?: string;
  assigned_specialist_email?: string;
  current_bottleneck?: string;
  coordinator_notes?: string;
  diagnostic_details?: string;
  educator_summary?: string;
  days_open: number;
  last_activity?: string;
  recommendation?: {
    recommended_action: string;
    confidence: number;
    priority: string;
    reason: string;
  } | null;
  timeline?: Array<{
    id: string;
    event_type: string;
    details?: string;
    timestamp?: string;
  }>;
}

export default function SpecialEducatorPortal() {
  const { profile } = useAuth();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingSpecialist, setUpdatingSpecialist] = useState<string | null>(null);
  const [filterAssignedOnly, setFilterAssignedOnly] = useState(true);
  const [sortBy, setSortBy] = useState("urgency");

  // Diagnostic form modal state
  const [activeCaseForDiag, setActiveCaseForDiag] = useState<CaseItem | null>(null);
  const [diagnosticText, setDiagnosticText] = useState("");
  const [educatorName, setEducatorName] = useState(profile?.fullName || "");
  const [submittingDiag, setSubmittingDiag] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAssignedOnly && profile?.email) {
        params.append("email", profile.email);
      }
      if (sortBy) {
        params.append("sort_by", sortBy);
      }
      const qs = params.toString() ? `?${params.toString()}` : "";

      const [specsRes, casesRes] = await Promise.all([
        fetch(`${API_BASE}/api/specialists`),
        fetch(`${API_BASE}/api/educator/cases${qs}`),
      ]);

      if (specsRes.ok) {
        setSpecialists(await specsRes.json());
      }
      if (casesRes.ok) {
        setCases(await casesRes.json());
      }
    } catch (err) {
      console.error("Educator portal fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.email, filterAssignedOnly, sortBy]);

  const handleToggleAvailability = async (specialist: Specialist) => {
    setUpdatingSpecialist(specialist.id);
    const newStatus = specialist.availability_status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
    try {
      const res = await fetch(`${API_BASE}/api/educator/specialists/${specialist.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability_status: newStatus,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSpecialists((prev) =>
          prev.map((s) => (s.id === specialist.id ? { ...s, availability_status: updated.availability_status } : s))
        );
        setSuccessBanner(`Updated ${specialist.name} status to ${newStatus}. Agent will use this in routing!`);
      }
    } catch (err) {
      console.error("Toggle availability error:", err);
    } finally {
      setUpdatingSpecialist(null);
    }
  };

  const handleSubmitDiagnostics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaseForDiag || !diagnosticText.trim()) return;

    setSubmittingDiag(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/${activeCaseForDiag.id}/diagnostics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnostic_details: diagnosticText.trim(),
          educator_name: educatorName,
        }),
      });

      if (res.ok) {
        const updatedCase = await res.json();
        setCases((prev) =>
          prev.map((c) => (c.id === activeCaseForDiag.id ? { ...c, ...updatedCase } : c))
        );
        setSuccessBanner(`Diagnostic evaluation recorded for ${activeCaseForDiag.id}!`);
        setActiveCaseForDiag(null);
        setDiagnosticText("");
      }
    } catch (err) {
      console.error("Submit diagnostics error:", err);
    } finally {
      setSubmittingDiag(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["special_educator"]}>
    <div className="space-y-8">
      {/* Portal Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-6 h-6 text-purple-300" />
            <h1 className="text-2xl font-bold tracking-tight">Special Educator & Clinical Portal</h1>
          </div>
          <p className="text-purple-200 text-xs sm:text-sm">
            Review Referral Guardian agent handoff summaries, coordinator notes, submit diagnostic findings, and manage clinical availability.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-purple-800/80 border border-purple-600/70 px-3 py-1.5 rounded-lg text-xs">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Doctor: <strong className="text-white">{profile?.fullName || "Specialist"}</strong>{" "}
              <span className="text-purple-300 font-mono">({profile?.email || "No email"})</span>
            </span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-xs font-semibold text-purple-100 transition border border-purple-600/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Specialist Availability Management Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-purple-600" />
              <span>Specialist Availability & Caseload Roster</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The Referral Guardian AI checks these real-time statuses when diagnosing <code className="text-purple-700 bg-purple-50 px-1 rounded">SPECIALIST_UNAVAILABLE</code> bottlenecks and matching alternatives.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {specialists.map((spec) => (
            <div
              key={spec.id}
              className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                spec.availability_status === "AVAILABLE"
                  ? "bg-emerald-50/40 border-emerald-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{spec.name}</span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      spec.availability_status === "AVAILABLE"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {spec.availability_status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  <strong>Specialization:</strong> {spec.specialization}
                </div>
                {spec.location && (
                  <div className="text-xs text-slate-500">
                    <strong>Clinic:</strong> {spec.location}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleToggleAvailability(spec)}
                disabled={updatingSpecialist === spec.id}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition border ${
                  spec.availability_status === "AVAILABLE"
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                }`}
              >
                {updatingSpecialist === spec.id
                  ? "Updating..."
                  : spec.availability_status === "AVAILABLE"
                  ? "Mark Unavailable (Simulate Bottleneck)"
                  : "Mark Available (Enable Matching)"}
              </button>
            </div>
          ))}

          {specialists.length === 0 && (
            <div className="col-span-3 text-center py-6 text-xs text-slate-500">
              No specialists registered yet.
            </div>
          )}
        </div>
      </div>

      {/* Referrals Requiring Special Educator Review */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Assigned Referral Pipeline & Clinical Handoffs</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cases routed to specialists with agent analysis summaries, urgency scoring, and clinical directives.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle: My Patients vs All Referrals */}
            <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setFilterAssignedOnly(true)}
                className={`px-3 py-1 rounded-md transition ${
                  filterAssignedOnly
                    ? "bg-white text-purple-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Patients ({filterAssignedOnly ? cases.length : "Filtered"})
              </button>
              <button
                onClick={() => setFilterAssignedOnly(false)}
                className={`px-3 py-1 rounded-md transition ${
                  !filterAssignedOnly
                    ? "bg-white text-purple-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Referrals
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-slate-500 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="urgency">Urgency / Bottlenecks</option>
                <option value="days_open">Longest Open</option>
                <option value="last_activity">Recent Activity</option>
                <option value="id">Student ID</option>
              </select>
            </div>

            <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-3 py-1 rounded-full border border-purple-200">
              {cases.length} Patients
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {cases.map((c) => (
            <div key={c.id} className="p-6 hover:bg-slate-50/70 transition space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-900 text-base">{c.id}</span>
                    <span className="text-xs font-mono text-slate-500 font-semibold">({c.child_identifier})</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {c.status}
                    </span>
                    {c.current_bottleneck && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠️ {c.current_bottleneck.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                    <span>Referral Type: <strong className="text-slate-800">{c.referral_type}</strong></span>
                    <span>•</span>
                    <span>
                      Assigned Specialist:{" "}
                      <strong className="text-purple-700">{c.assigned_specialist_name || "Unassigned"}</strong>
                      {c.assigned_specialist_email && (
                        <span className="font-mono text-purple-600 ml-1">({c.assigned_specialist_email})</span>
                      )}
                    </span>
                    {profile?.email && c.assigned_specialist_email && c.assigned_specialist_email.toLowerCase() === profile.email.toLowerCase() && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold px-2 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Assigned to You
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setActiveCaseForDiag(c);
                      setDiagnosticText(c.diagnostic_details || "");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>{c.diagnostic_details ? "Update Diagnostics" : "+ Log Diagnostics"}</span>
                  </button>
                  <Link
                    href={`/cases/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition p-1.5"
                  >
                    <span>Full History</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* AI Clinical & Operational Referral Handoff Summary */}
              {c.educator_summary ? (
                <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/90 border border-purple-200/80 rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>AI Referral Handoff Summary</span>
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-medium pl-6">
                    {c.educator_summary}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-500 italic flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>No AI summary generated yet. The referral handoff brief will appear here once the coordinator executes the agent.</span>
                </div>
              )}

              {/* Agent Recommendation Summary Card */}
              {c.recommendation && (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-900 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Agent Proposed Action: {c.recommendation.recommended_action.replace(/_/g, " ")}</span>
                    </span>
                    <span className="font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      {Math.round(c.recommendation.confidence * 100)}% Confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{c.recommendation.reason}"
                  </p>
                </div>
              )}

              {/* Coordinator Notes / Directive */}
              {c.coordinator_notes && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs text-slate-800 flex items-start space-x-2">
                  <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-900">Coordinator Directive / Notes: </strong>
                    <span>"{c.coordinator_notes}"</span>
                  </div>
                </div>
              )}

              {/* Diagnostic Evaluation Details */}
              {c.diagnostic_details && (
                <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-purple-950">Current Diagnostic Assessment: </strong>
                    <span>"{c.diagnostic_details}"</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {cases.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-50 text-purple-600 text-xl mx-auto">
                👨‍⚕️
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {filterAssignedOnly
                  ? `No patients currently assigned to ${profile?.email || "your account"}`
                  : "No active referrals in the system"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {filterAssignedOnly
                  ? "When coordinators create or assign cases to your Gmail ID, they will appear here in sorted clinical order."
                  : "New referrals created by school coordinators will appear here."}
              </p>
              {filterAssignedOnly && (
                <button
                  onClick={() => setFilterAssignedOnly(false)}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 underline cursor-pointer"
                >
                  View all system referrals instead →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostic Details Submission Modal */}
      {activeCaseForDiag && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Log Diagnostic Evaluation: {activeCaseForDiag.id}
                </h3>
                <span className="text-xs text-slate-500 font-mono">Child Identifier: {activeCaseForDiag.child_identifier}</span>
              </div>
              <button
                onClick={() => setActiveCaseForDiag(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDiagnostics} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Clinician / Special Educator Name
                </label>
                <input
                  type="text"
                  required
                  value={educatorName}
                  onChange={(e) => setEducatorName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Diagnostic Findings & Follow-up Plan *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter clinical assessment findings, standardized test scores (e.g. CELF-5), recommended therapy frequency, or follow-up IEP needs..."
                  value={diagnosticText}
                  onChange={(e) => setDiagnosticText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveCaseForDiag(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDiag}
                  className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-xs disabled:opacity-50"
                >
                  {submittingDiag ? "Saving..." : "Save Diagnostic Assessment"}
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
