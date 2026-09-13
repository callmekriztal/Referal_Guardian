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
    if (!confirm(`Are you sure you want to delete case file ${id}?`)) return;

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
      <div className="space-y-8">
        {/* Page Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-[#D8D4CA] gap-4">
          <div>
            <div className="text-xs font-semibold text-[#526070] mb-1">
              Inclusive Education Coordinator Workspace
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#12243D] tracking-tight">
              Statutory Evaluation Register
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Monitoring 20-day statutory assessment deadlines under Chapter III of the RPwD Act 2016.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 text-xs font-medium text-[#12243D] bg-white border border-[#D8D4CA] rounded hover:bg-[#F5F4F0] transition focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            >
              Refresh register
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-[#A6790C] border border-[#8C660A] rounded hover:bg-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C]"
            >
              Register new referral file
            </button>
          </div>
        </div>

        {/* Executive Summary Summary Ledger */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded border border-[#D8D4CA] shadow-2xs">
            <div className="text-xs font-medium text-[#526070]">Active Referral Cases</div>
            <div className="text-2xl font-semibold text-[#12243D] mt-2 font-sans tabular-nums">
              {stats.active_cases}
            </div>
            <div className="text-[11px] text-[#526070] mt-1">Currently under evaluation</div>
          </div>

          <div className="bg-white p-5 rounded border border-[#D8D4CA] shadow-2xs">
            <div className="text-xs font-medium text-[#526070]">Delayed Evaluations</div>
            <div className="text-2xl font-semibold text-[#9C6B14] mt-2 font-sans tabular-nums">
              {stats.stuck_cases}
            </div>
            <div className="text-[11px] text-[#9C6B14] mt-1">Requires coordinator action</div>
          </div>

          <div className="bg-white p-5 rounded border border-[#D8D4CA] shadow-2xs">
            <div className="text-xs font-medium text-[#526070]">Pending Action Reviews</div>
            <div className="text-2xl font-semibold text-[#A6790C] mt-2 font-sans tabular-nums">
              {stats.pending_actions}
            </div>
            <div className="text-[11px] text-[#A6790C] mt-1">Awaiting coordinator review</div>
          </div>

          <div className="bg-white p-5 rounded border border-[#D8D4CA] shadow-2xs">
            <div className="text-xs font-medium text-[#526070]">Statutory Breaches (20+ Days)</div>
            <div className="text-2xl font-semibold text-[#8C3B2E] mt-2 font-sans tabular-nums">
              {cases.filter((c) => c.days_open >= 20).length}
            </div>
            <div className="text-[11px] text-[#8C3B2E] font-medium mt-1">Exceeded legal timeline</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded border border-[#D8D4CA] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Filter by student ID, referral type, or specialist name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3.5 py-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className="text-[#526070]">Filter status:</span>
            {["ALL", "ACTIVE", "STUCK", "OVERDUE", "COMPLETED"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded transition text-xs ${
                  filter === f
                    ? "bg-[#12243D] text-white font-semibold"
                    : "bg-[#F5F4F0] text-[#12243D] hover:bg-[#EBE8DF] border border-[#D8D4CA]"
                }`}
              >
                {f === "ALL"
                  ? "All Files"
                  : f === "STUCK"
                  ? "Delayed"
                  : f === "OVERDUE"
                  ? "Statutory Breach"
                  : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Case Register Table */}
        <div className="bg-white rounded border border-[#D8D4CA] shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8D4CA] flex items-center justify-between bg-[#F5F4F0]">
            <h2 className="font-serif text-base font-semibold text-[#12243D]">
              Referral Evaluation Cases ({filteredCases.length})
            </h2>
            <span className="text-xs text-[#526070]">
              Showing records matching criteria
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#526070]">
              Loading evaluation register records...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="font-serif text-base font-semibold text-[#12243D]">
                No matching referral cases found
              </div>
              <p className="text-xs text-[#526070] max-w-sm mx-auto">
                No active or historical referral records match your search criteria. Register a new referral file or clear filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12243D] text-white uppercase text-[11px] font-semibold tracking-normal">
                  <tr>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Evaluation Type</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4">20-Day Statutory Counter</th>
                    <th className="py-3 px-4">Assigned Specialist</th>
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
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium">
                              Completed Evaluation
                            </span>
                          ) : c.bottleneck || c.status === "STUCK" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] font-semibold">
                              Delayed: {c.bottleneck || "Action Pending"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium">
                              Active Evaluation
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isBreach ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] font-semibold tabular-nums">
                              Day {c.days_open} of 20 (Statutory Breach)
                            </span>
                          ) : isApproaching ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FDF8EC] text-[#9C6B14] border border-[#F4E3B9] font-medium tabular-nums">
                              Day {c.days_open} of 20 (Approaching Limit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] font-medium tabular-nums">
                              Day {c.days_open} of 20 (On Schedule)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#526070]">
                          {c.assigned_specialist_name ? (
                            <div>
                              <div className="font-medium text-[#12243D]">{c.assigned_specialist_name}</div>
                              {c.assigned_specialist_email && (
                                <div className="text-[11px] text-[#526070]">{c.assigned_specialist_email}</div>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-[#526070]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              href={`/cases/${c.id}`}
                              className="px-3 py-1 bg-[#12243D] hover:bg-[#1E324D] text-white rounded text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                            >
                              Open case file
                            </Link>
                            <button
                              onClick={(e) => handleDeleteCase(c.id, e)}
                              className="px-2 py-1 text-xs text-[#8C3B2E] hover:bg-[#FBEBE8] rounded border border-transparent hover:border-[#F3C4BD] transition"
                              title="Delete file"
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

        {/* Modal: Register New Referral File */}
        {showModal && (
          <div className="fixed inset-0 bg-[#12243D]/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded border border-[#D8D4CA] max-w-lg w-full overflow-hidden shadow-lg">
              <div className="bg-[#12243D] text-white p-5 flex items-center justify-between border-b border-[#12243D]">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-white">
                    Register New Referral File
                  </h3>
                  <p className="text-xs text-[#D8D4CA] mt-0.5">
                    Establishes an official student evaluation file under 20-day statutory tracking.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[#D8D4CA] hover:text-white font-bold text-sm px-2 py-1"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateCase} className="p-6 space-y-4 text-xs">
                <p className="text-[11px] text-[#526070] italic pb-2 border-b border-[#D8D4CA]">
                  All fields required unless marked optional.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#12243D] mb-1">
                      School identifier prefix
                    </label>
                    <input
                      type="text"
                      required
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                      className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12243D] mb-1">
                      Student registration number
                    </label>
                    <input
                      type="text"
                      required
                      value={newSerialNo}
                      onChange={(e) => setNewSerialNo(e.target.value)}
                      className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12243D] mb-1">
                    Evaluation type
                  </label>
                  <select
                    value={newReferralType}
                    onChange={(e) => setNewReferralType(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  >
                    <option value="Speech-Language Evaluation">Speech-Language Evaluation</option>
                    <option value="Psychological & Learning Assessment">Psychological & Learning Assessment</option>
                    <option value="Occupational Therapy Evaluation">Occupational Therapy Evaluation</option>
                    <option value="Pediatric Neurological Screening">Pediatric Neurological Screening</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12243D] mb-1">
                    Assigned specialist email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. dr.vance@clinic.org"
                    value={newSpecialistEmail}
                    onChange={(e) => setNewSpecialistEmail(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12243D] mb-1">
                    Initial coordinator notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter referral intake details or specific evaluation requirements..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#D8D4CA]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-medium text-[#526070] hover:bg-[#F5F4F0] rounded border border-[#D8D4CA] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-medium bg-[#A6790C] hover:bg-[#8C660A] text-white rounded border border-[#8C660A] transition disabled:opacity-50"
                  >
                    {submitting ? "Registering..." : "Save case file"}
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
