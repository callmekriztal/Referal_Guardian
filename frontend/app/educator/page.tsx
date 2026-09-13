"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      const [specRes, caseRes] = await Promise.all([
        fetch(`${API_BASE}/api/specialists`),
        fetch(`${API_BASE}/api/cases`),
      ]);

      if (specRes.ok) {
        const specData = await specRes.json();
        setSpecialists(specData);
      }

      if (caseRes.ok) {
        const caseData = await caseRes.json();
        setCases(caseData);
      }
    } catch (err) {
      console.error("Failed to load specialist roster:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (profile?.fullName) {
      setEducatorName(profile.fullName);
    }
  }, [profile]);

  const handleToggleAvailability = async (specId: string, currentStatus: string) => {
    setUpdatingSpecialist(specId);
    const newStatus = currentStatus === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";

    try {
      const res = await fetch(`${API_BASE}/api/specialists/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability_status: newStatus,
          next_available_date: newStatus === "UNAVAILABLE" ? "2026-10-01" : null,
        }),
      });

      if (res.ok) {
        setSpecialists((prev) =>
          prev.map((s) =>
            s.id === specId
              ? {
                  ...s,
                  availability_status: newStatus,
                  next_available_date: newStatus === "UNAVAILABLE" ? "2026-10-01" : null,
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Failed to update specialist status:", err);
    } finally {
      setUpdatingSpecialist(null);
    }
  };

  const handleOpenDiagnosticModal = (c: CaseItem) => {
    setActiveCaseForDiag(c);
    setDiagnosticText(c.diagnostic_details || "");
    setSuccessBanner(null);
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
          diagnostic_details: diagnosticText,
          educator_name: educatorName || profile?.fullName || "Specialist Evaluator",
        }),
      });

      if (res.ok) {
        setSuccessBanner(`Evaluation report submitted for ${activeCaseForDiag.child_identifier}. Statutory assessment timeline cleared.`);
        setActiveCaseForDiag(null);
        setDiagnosticText("");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to submit diagnostic findings:", err);
    } finally {
      setSubmittingDiag(false);
    }
  };

  const currentSpecialistProfile = specialists.find(
    (s) => s.email?.toLowerCase() === profile?.email?.toLowerCase()
  );

  const displayedCases = cases.filter((c) => {
    if (!filterAssignedOnly) return true;
    if (currentSpecialistProfile) {
      return c.assigned_specialist_id === currentSpecialistProfile.id || c.assigned_specialist_email === profile?.email;
    }
    return c.assigned_specialist_email?.toLowerCase() === profile?.email?.toLowerCase();
  });

  const sortedCases = [...displayedCases].sort((a, b) => {
    if (sortBy === "urgency") {
      const aUrgent = a.days_open >= 15 || Boolean(a.current_bottleneck);
      const bUrgent = b.days_open >= 15 || Boolean(b.current_bottleneck);
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return b.days_open - a.days_open;
    }
    if (sortBy === "days") return b.days_open - a.days_open;
    return a.child_identifier.localeCompare(b.child_identifier);
  });

  return (
    <RouteGuard allowedRoles={["special_educator", "coordinator"]}>
      <div className="space-y-8">
        {/* Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#D8D4CA] gap-4">
          <div>
            <div className="text-xs font-semibold text-[#526070] mb-1">
              RCI-Certified Specialist Evaluator Portal
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#12243D] tracking-tight">
              Clinical Assessment Worklist
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Logged in as: <span className="font-semibold text-[#12243D]">{profile?.fullName}</span> ({profile?.email})
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 text-xs font-medium text-[#12243D] bg-white border border-[#D8D4CA] rounded hover:bg-[#F5F4F0] transition focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            >
              Refresh worklist
            </button>
          </div>
        </div>

        {successBanner && (
          <div className="bg-[#EBF3ED] border border-[#BBD5C0] p-4 rounded text-xs text-[#4B6A52] font-medium flex items-center justify-between">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="text-[#4B6A52] font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Clinical Roster Summary Cards */}
        <div className="bg-white p-6 rounded border border-[#D8D4CA] shadow-2xs space-y-4">
          <div className="border-b border-[#D8D4CA] pb-3 flex items-center justify-between">
            <h2 className="font-serif text-base font-semibold text-[#12243D]">
              Specialist Availability Roster
            </h2>
            <span className="text-xs text-[#526070]">
              Toggle availability to update referral intake status
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialists.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded border border-[#D8D4CA] bg-[#F5F4F0] space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-[#12243D] text-xs">{s.name}</div>
                    <div className="text-[11px] text-[#526070]">{s.specialization}</div>
                  </div>
                  {s.availability_status === "AVAILABLE" ? (
                    <span className="px-2 py-0.5 rounded bg-[#EBF3ED] text-[#4B6A52] border border-[#BBD5C0] text-[10px] font-semibold">
                      Available
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-[#FBEBE8] text-[#8C3B2E] border border-[#F3C4BD] text-[10px] font-semibold">
                      Unavailable
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-[#D8D4CA] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#526070]">
                    {s.availability_status === "UNAVAILABLE" && s.next_available_date
                      ? `Reopens: ${s.next_available_date}`
                      : "Open for clinical referrals"}
                  </span>

                  <button
                    onClick={() => handleToggleAvailability(s.id, s.availability_status)}
                    disabled={updatingSpecialist === s.id}
                    className="px-2.5 py-1 text-xs font-medium bg-white text-[#12243D] hover:bg-[#EBE8DF] rounded border border-[#D8D4CA] transition disabled:opacity-50"
                  >
                    {updatingSpecialist === s.id
                      ? "Updating..."
                      : s.availability_status === "AVAILABLE"
                      ? "Mark unavailable"
                      : "Mark available"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Assessment Case Roster */}
        <div className="bg-white rounded border border-[#D8D4CA] shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8D4CA] bg-[#F5F4F0] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-base font-semibold text-[#12243D]">
                Assigned Student Referral Cases ({sortedCases.length})
              </h2>
              <p className="text-xs text-[#526070]">
                Submitting diagnostic notes automatically resets statutory bottleneck timers.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <label className="flex items-center space-x-2 text-[#12243D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterAssignedOnly}
                  onChange={(e) => setFilterAssignedOnly(e.target.checked)}
                  className="rounded border-[#D8D4CA] text-[#12243D] focus:ring-[#12243D]"
                />
                <span className="font-medium">Show only cases assigned to me</span>
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="p-1.5 bg-white border border-[#D8D4CA] rounded text-xs text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
              >
                <option value="urgency">Sort by statutory urgency</option>
                <option value="days">Sort by days open</option>
                <option value="id">Sort by student ID</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#526070]">
              Loading clinical evaluation worklist...
            </div>
          ) : sortedCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="font-serif text-base font-semibold text-[#12243D]">
                No assigned cases found
              </div>
              <p className="text-xs text-[#526070] max-w-sm mx-auto">
                No active student evaluation files are assigned to your specialist roster. Uncheck "assigned to me" to view all active referrals.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12243D] text-white uppercase text-[11px] font-semibold tracking-normal">
                  <tr>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Evaluation Type</th>
                    <th className="py-3 px-4">Statutory Counter</th>
                    <th className="py-3 px-4">Coordinator Instructions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D4CA]">
                  {sortedCases.map((c) => {
                    const isBreach = c.days_open >= 20;
                    const isApproaching = c.days_open >= 15 && c.days_open < 20;

                    return (
                      <tr key={c.id} className="hover:bg-[#F5F4F0] transition">
                        <td className="py-3.5 px-4 font-semibold text-[#12243D] font-mono">
                          {c.child_identifier}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#12243D]">
                          {c.referral_type}
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
                          {c.coordinator_notes ? (
                            <p className="line-clamp-2">{c.coordinator_notes}</p>
                          ) : (
                            <span className="italic">Standard evaluation protocol</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenDiagnosticModal(c)}
                            className="px-3.5 py-1.5 bg-[#A6790C] hover:bg-[#8C660A] text-white rounded text-xs font-semibold border border-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C]"
                          >
                            Submit evaluation report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Diagnostic Form Submission Modal */}
        {activeCaseForDiag && (
          <div className="fixed inset-0 bg-[#12243D]/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded border border-[#D8D4CA] max-w-lg w-full overflow-hidden shadow-lg">
              <div className="bg-[#12243D] text-white p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-white">
                    Submit Clinical Evaluation Report
                  </h3>
                  <p className="text-xs text-[#D8D4CA] mt-0.5 font-mono">
                    Student Registration: {activeCaseForDiag.child_identifier}
                  </p>
                </div>
                <button
                  onClick={() => setActiveCaseForDiag(null)}
                  className="text-[#D8D4CA] hover:text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSubmitDiagnostics} className="p-6 space-y-4 text-xs">
                <p className="text-[11px] text-[#526070] italic pb-2 border-b border-[#D8D4CA]">
                  Submitting clinical evaluation findings updates the student's statutory record, sets status to ACTIVE, and resets the 20-day evaluation timer back to Day 0.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#12243D] mb-1">
                    Evaluating specialist name
                  </label>
                  <input
                    type="text"
                    required
                    value={educatorName}
                    onChange={(e) => setEducatorName(e.target.value)}
                    className="w-full p-2 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#12243D] mb-1">
                    Clinical diagnostic findings & support recommendations
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Enter speech-language, psychological, or occupational evaluation diagnostic findings and recommended classroom support plan..."
                    value={diagnosticText}
                    onChange={(e) => setDiagnosticText(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#D8D4CA]">
                  <button
                    type="button"
                    onClick={() => setActiveCaseForDiag(null)}
                    className="px-4 py-2 text-xs font-medium text-[#526070] hover:bg-[#F5F4F0] rounded border border-[#D8D4CA] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDiag}
                    className="px-4 py-2 text-xs font-medium bg-[#A6790C] hover:bg-[#8C660A] text-white rounded border border-[#8C660A] transition disabled:opacity-50"
                  >
                    {submittingDiag ? "Submitting report..." : "Submit diagnostic evaluation report"}
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
