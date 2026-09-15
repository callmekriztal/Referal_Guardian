"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
          bottleneck: c.bottleneck || c.current_bottleneck || null,
          coordinator_notes: c.coordinator_notes,
          diagnostic_details: c.diagnostic_details,
          educator_summary: c.educator_summary,
          days_open: typeof c.days_open === "number" ? c.days_open : 0,
          followup_attempts: c.followup_attempts || 0,
        }));
        setCases(mappedCases);
      }

      if (specsRes.ok) {
        const specData = await specsRes.json();
        setSpecialists(specData);
      }
    } catch (err) {
      console.error("Failed to load dashboard records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const childIdentifier = `stu-${newSchoolName.toLowerCase().trim() || "rit"}-${newSerialNo.trim() || "5001"}`;
      const payload: any = {
        child_identifier: childIdentifier,
        referral_type: newReferralType,
        status: newStatus,
        coordinator_notes: newNotes,
      };

      if (newBottleneck) payload.bottleneck = newBottleneck;
      if (newSpecialistId) payload.assigned_specialist_id = newSpecialistId;
      if (newSpecialistEmail) payload.assigned_specialist_email = newSpecialistEmail;

      const res = await fetch(`${API_BASE}/api/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        setNewNotes("");
        setNewSpecialistEmail("");
        setNewBottleneck("");
        fetchData();
      }
    } catch (err) {
      console.error("Failed to create referral file:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete case ${id}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/cases/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete referral file:", err);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.child_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.referral_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.assigned_specialist_name && c.assigned_specialist_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filter === "STUCK") return matchesSearch && (c.status === "STUCK" || Boolean(c.bottleneck));
    if (filter === "ACTIVE") return matchesSearch && c.status === "ACTIVE";
    if (filter === "COMPLETED") return matchesSearch && c.status === "COMPLETED";
    if (filter === "OVERDUE") return matchesSearch && c.days_open >= 20;
    return matchesSearch;
  });

  return (
    <RouteGuard allowedRoles={["coordinator"]}>
      <div className="space-y-6">
        {/* Page Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-[#D8D4CA] gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[#12243D] tracking-tight">
              Referral Cases
            </h1>
            <p className="text-xs text-[#526070] mt-0.5">
              Tracking 20-day evaluation timelines for student assessments.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 text-xs font-medium text-[#12243D] bg-white border border-[#D8D4CA] rounded hover:bg-[#F5F4F0] transition"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-[#A6790C] border border-[#8C660A] rounded hover:bg-[#8C660A] transition"
            >
              New Referral Case
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded border border-[#D8D4CA]">
            <div className="text-xs text-[#526070]">Active Cases</div>
            <div className="text-2xl font-semibold text-[#12243D] mt-1 tabular-nums">
              {stats.active_cases}
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-[#D8D4CA]">
            <div className="text-xs text-[#526070]">Delayed</div>
            <div className="text-2xl font-semibold text-[#9C6B14] mt-1 tabular-nums">
              {stats.stuck_cases}
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-[#D8D4CA]">
            <div className="text-xs text-[#526070]">Action Required</div>
            <div className="text-2xl font-semibold text-[#A6790C] mt-1 tabular-nums">
              {stats.pending_actions}
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-[#D8D4CA]">
            <div className="text-xs text-[#526070]">Overdue (20+ Days)</div>
            <div className="text-2xl font-semibold text-[#8C3B2E] mt-1 tabular-nums">
              {cases.filter((c) => c.days_open >= 20).length}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded border border-[#D8D4CA] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by student ID, referral type, or specialist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[#526070]">Filter:</span>
            {["ALL", "ACTIVE", "STUCK", "OVERDUE", "COMPLETED"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded transition text-xs ${
                  filter === f
                    ? "bg-[#12243D] text-white font-medium"
                    : "bg-[#F5F4F0] text-[#12243D] hover:bg-[#EBE8DF] border border-[#D8D4CA]"
                }`}
              >
                {f === "ALL"
                  ? "All"
                  : f === "STUCK"
                  ? "Delayed"
                  : f === "OVERDUE"
                  ? "Overdue"
                  : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Case Register Table */}
        <div className="bg-white rounded border border-[#D8D4CA] overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#526070]">
              Loading referral cases...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="font-serif text-base font-semibold text-[#12243D]">
                No referral cases found
              </div>
              <p className="text-xs text-[#526070] max-w-sm mx-auto">
                No referral cases match your search criteria. Create a new case or clear filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12243D] text-white uppercase text-[11px] font-semibold tracking-normal">
                  <tr>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Evaluation Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Days Open</th>
                    <th className="py-3 px-4">Specialist</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D4CA]">
                  {filteredCases.map((c) => {
                    const isBreach = c.days_open >= 20;
                    const isApproaching = c.days_open >= 15 && c.days_open < 20;

                    return (
                      <tr key={c.id} className="hover:bg-[#F5F4F0] transition">
                        <td className="py-3.5 px-4 font-semibold text-[#12243D] font-mono">
                          {c.child_id}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#12243D]">
                          {c.referral_type}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.status === "COMPLETED" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium">
                              Completed
                            </span>
                          ) : c.bottleneck || c.status === "STUCK" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] font-medium">
                              Delayed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isBreach ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] font-semibold tabular-nums">
                              Day {c.days_open} (Overdue)
                            </span>
                          ) : isApproaching ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FDF8EC] text-[#9C6B14] border border-[#F4E3B9] font-medium tabular-nums">
                              Day {c.days_open} (Day 15-20)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium tabular-nums">
                              Day {c.days_open}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#526070]">
                          <div>
                            <span className="font-medium text-[#12243D]">
                              {c.assigned_specialist_name || c.assigned_specialist_email?.split("@")[0] || "Unassigned"}
                            </span>
                            {c.assigned_specialist_email && (
                              <div className="text-[10px] text-[#526070]">
                                {c.assigned_specialist_email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              href={`/cases/${c.id}`}
                              className="px-3 py-1 bg-[#12243D] hover:bg-[#1E324D] text-white rounded text-xs font-medium transition"
                            >
                              View
                            </Link>
                            <button
                              onClick={(e) => handleDeleteCase(c.id, e)}
                              className="px-2 py-1 text-xs text-[#8C3B2E] hover:bg-[#FBEBE8] rounded border border-transparent hover:border-[#F3C4BD] transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: New Referral Case */}
        {showModal && (
          <div className="fixed inset-0 bg-[#12243D]/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded border border-[#D8D4CA] max-w-md w-full overflow-hidden shadow-lg">
              <div className="bg-[#12243D] text-white p-4 flex items-center justify-between">
                <h3 className="font-serif text-base font-semibold text-white">
                  New Referral Case
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[#D8D4CA] hover:text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateCase} className="p-5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#12243D] mb-1">
                      School Prefix
                    </label>
                    <input
                      type="text"
                      required
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                      className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#12243D] mb-1">
                      Student ID Number
                    </label>
                    <input
                      type="text"
                      required
                      value={newSerialNo}
                      onChange={(e) => setNewSerialNo(e.target.value)}
                      className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#12243D] mb-1">
                    Evaluation Type
                  </label>
                  <select
                    value={newReferralType}
                    onChange={(e) => setNewReferralType(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D]"
                  >
                    <option value="Speech-Language Evaluation">Speech-Language Evaluation</option>
                    <option value="Psychological & Learning Assessment">Psychological & Learning Assessment</option>
                    <option value="Occupational Therapy Evaluation">Occupational Therapy Evaluation</option>
                    <option value="Pediatric Neurological Screening">Pediatric Neurological Screening</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#12243D] mb-1">
                    Assigned Specialist Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. doctor@clinic.org"
                    value={newSpecialistEmail}
                    onChange={(e) => setNewSpecialistEmail(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#12243D] mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter notes..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#D8D4CA]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[#526070] hover:bg-[#F5F4F0] rounded border border-[#D8D4CA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 text-xs font-medium bg-[#A6790C] hover:bg-[#8C660A] text-white rounded border border-[#8C660A] disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Case"}
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
