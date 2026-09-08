"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import RouteGuard from "@/components/RouteGuard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SpecialistItem {
  id: string;
  name: string;
  email?: string;
  specialization: string;
  availability_status: string;
}

interface CaseItem {
  id: string;
  child_id: string;
  referral_type: string;
  status: string;
  coordinator?: string;
  assigned_specialist_name?: string;
  assigned_specialist_email?: string;
  bottleneck: string | null;
  coordinator_notes?: string;
  diagnostic_details?: string;
  educator_summary?: string;
  days_open: number;
  followup_attempts: number;
}

export default function Dashboard() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [stats, setStats] = useState({
    active_cases: 0,
    stuck_cases: 0,
    pending_actions: 0,
    escalations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("ALL");

  // Create Case Modal state
  const [showModal, setShowModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("rit");
  const [newSerialNo, setNewSerialNo] = useState("5001");
  const [newReferralType, setNewReferralType] = useState("Speech-Language Evaluation");
  const [newStatus, setNewStatus] = useState("NEW");
  const [newBottleneck, setNewBottleneck] = useState("");
  const [newSpecialistId, setNewSpecialistId] = useState("");
  const [newSpecialistEmail, setNewSpecialistEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, casesRes, specsRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard`),
        fetch(`${API_BASE}/api/cases`),
        fetch(`${API_BASE}/api/specialists`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (casesRes.ok) {
        const rawCases = await casesRes.json();
        const mappedCases: CaseItem[] = rawCases.map((c: any) => ({
          id: c.id,
          child_id: c.child_identifier || c.child_id || "STU-UNKNOWN",
          referral_type: c.referral_type || "Evaluation",
          status: c.status || "NEW",
          coordinator: c.coordinator_id || c.coordinator || "Staff",
          assigned_specialist_name: c.assigned_specialist_name,
          assigned_specialist_email: c.assigned_specialist_email,
          bottleneck: c.current_bottleneck || null,
          coordinator_notes: c.coordinator_notes,
          diagnostic_details: c.diagnostic_details,
          educator_summary: c.educator_summary,
          days_open: c.days_open || 0,
          followup_attempts: c.followup_attempts || 0,
        }));
        setCases(mappedCases);
      }

      if (specsRes.ok) {
        const specsData = await specsRes.json();
        setSpecialists(specsData);
        if (specsData.length > 0 && !newSpecialistId) {
          setNewSpecialistId(specsData[0].id);
          if (specsData[0].email) {
            setNewSpecialistEmail(specsData[0].email);
          }
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSchool = (newSchoolName || "school").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanSerial = (newSerialNo || "5001").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const constructedId = `stu-${cleanSchool}-${cleanSerial}`;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_identifier: constructedId,
          custom_id: constructedId,
          referral_type: newReferralType,
          status: newStatus,
          current_bottleneck: newBottleneck || null,
          assigned_specialist_id: newSpecialistId || null,
          assigned_specialist_email: newSpecialistEmail || null,
          coordinator_notes: newNotes || null,
          initial_event_details: `Referral case initiated for ${constructedId} (School: ${newSchoolName || "RIT"}). Initial bottleneck: ${newBottleneck || "None"}.`,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setNewNotes("");
        setNewSpecialistEmail("");
        setNewStatus("NEW");
        setNewBottleneck("");
        await fetchData();
      } else {
        alert("Failed to create case");
      }
    } catch (err) {
      console.error("Create case error:", err);
      alert("Error creating case");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm(`Are you sure you want to delete case ${caseId}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/cases/${caseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCases(cases.filter((c) => c.id !== caseId));
      }
    } catch (err) {
      console.error("Delete case error:", err);
    }
  };

  const filteredCases = cases.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(term) ||
      c.child_id.toLowerCase().includes(term) ||
      c.referral_type.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (filter === "ALL") return true;
    if (filter === "STUCK") return c.status === "STUCK" || Boolean(c.bottleneck);
    if (filter === "ESCALATED") return c.status === "ESCALATED";
    return c.status === filter;
  });

  return (
    <RouteGuard allowedRoles={["coordinator"]}>
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinator Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time referral continuity, bottleneck detection & LangGraph agent oversight.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Referral Case</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Referrals</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.active_cases}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-xs bg-amber-50/30 flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Stuck Cases</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-amber-600">{stats.stuck_cases}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Action required</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-xs bg-indigo-50/30 flex flex-col justify-between">
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Pending Approvals</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-indigo-600">{stats.pending_actions}</span>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">AI Recommendation</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Escalations</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.escalations}</span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">High priority</span>
          </div>
        </div>
      </div>

      {/* Cases List with Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Referral Cases</h2>
            <span className="text-xs text-slate-500">Live cases monitored by Referral Guardian</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search case, child, type..."
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-52"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
              {["ALL", "STUCK", "ESCALATED"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    filter === mode
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredCases.map((c) => (
            <div key={c.id} className="p-6 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-900 text-base">{c.id}</span>
                  <span className="text-xs font-medium text-slate-500">({c.child_id})</span>
                  {c.status === "ESCALATED" ? (
                    <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-200">
                      ESCALATED
                    </span>
                  ) : c.status === "STUCK" || Boolean(c.bottleneck) ? (
                    <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                      STUCK
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                      {c.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-4 text-sm text-slate-600">
                  <span>Type: <strong className="text-slate-800">{c.referral_type}</strong></span>
                  <span>•</span>
                  <span>Days Open: <strong className="text-slate-800">{c.days_open} days</strong></span>
                  {(c.assigned_specialist_name || c.assigned_specialist_email) && (
                    <>
                      <span>•</span>
                      <span>
                        Specialist:{" "}
                        <strong className="text-purple-700">
                          {c.assigned_specialist_name || "Assigned Doctor"}
                        </strong>
                        {c.assigned_specialist_email && (
                          <span className="text-xs text-purple-600 font-mono ml-1.5 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                            {c.assigned_specialist_email}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {c.bottleneck && (
                  <div className="mt-2 text-xs flex items-center space-x-2 text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md w-fit">
                    <span className="font-semibold">Detected Bottleneck:</span>
                    <span>{c.bottleneck.replace(/_/g, " ")}</span>
                  </div>
                )}

                {c.diagnostic_details && (
                  <div className="mt-2 text-xs flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md w-fit max-w-2xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold shrink-0">Specialist Notes:</span>
                    <span className="truncate italic">"{c.diagnostic_details}"</span>
                  </div>
                )}

                {c.coordinator_notes && (
                  <p className="text-xs text-slate-500 italic mt-1">
                    Coordinator Notes: "{c.coordinator_notes}"
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Link
                  href={`/cases/${c.id}`}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-xs flex items-center space-x-2"
                >
                  <span>Review Case</span>
                  <span>→</span>
                </Link>

                <button
                  onClick={() => handleDeleteCase(c.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Delete case"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredCases.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-sm space-y-3">
              <p>No referral cases found.</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                Create New Referral Case
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Referral Case Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create New Referral Case</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RIT or Greenwood"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Serial No / Student ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5001"
                    value={newSerialNo}
                    onChange={(e) => setNewSerialNo(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 text-xs text-indigo-900 flex items-center justify-between">
                <span className="font-semibold">Generated Case Identifier:</span>
                <span className="font-mono font-bold text-indigo-700">
                  stu-{(newSchoolName || "school").toLowerCase().trim().replace(/[^a-z0-9]/g, "")}-{(newSerialNo || "5001").toLowerCase().trim().replace(/[^a-z0-9]/g, "")}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Referral Type *
                </label>
                <select
                  value={newReferralType}
                  onChange={(e) => setNewReferralType(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Speech-Language Evaluation">Speech-Language Evaluation</option>
                  <option value="IEP Behavioral Assessment">IEP Behavioral Assessment</option>
                  <option value="Occupational Therapy Evaluation">Occupational Therapy Evaluation</option>
                  <option value="Child Psychology Assessment">Child Psychology Assessment</option>
                  <option value="Physical Therapy Evaluation">Physical Therapy Evaluation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assign Specialist (Optional)
                  </label>
                  <select
                    value={newSpecialistId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNewSpecialistId(id);
                      const matched = specialists.find((s) => s.id === id);
                      if (matched?.email) {
                        setNewSpecialistEmail(matched.email);
                      }
                    }}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Assign later)</option>
                    {specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.availability_status}){s.email ? ` • ${s.email}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Status
                  </label>
                  <div className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-indigo-700 font-bold flex items-center justify-between">
                    <span>NEW (Day 0 Intake)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">Clean</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Doctor / Specialist Gmail ID</span>
                  <span className="text-[11px] font-normal text-indigo-600 font-sans">Used for Doctor Login</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. doctor@gmail.com"
                  value={newSpecialistEmail}
                  onChange={(e) => setNewSpecialistEmail(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  When the doctor logs into the Specialist Portal with this email, they will see this patient in their sorted caseload roster.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Coordinator Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Urgent review required for IEP meeting deadline..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Referral Case"}
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
