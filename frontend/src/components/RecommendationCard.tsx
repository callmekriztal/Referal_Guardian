"use client";

import React, { useState } from "react";
import { Check, X, Edit3, ShieldAlert, Sparkles, AlertCircle } from "lucide-react";

export interface Recommendation {
  id: string;
  bottleneck: string;
  confidence: number;
  recommended_action: string;
  priority: string;
  reason: string;
  evidence: string[];
  status: string;
  requires_human_approval: boolean;
  created_at?: string | null;
}

interface RecommendationCardProps {
  recommendation: Recommendation | null;
  bottleneck?: {
    type: string;
    description: string;
    severity?: string;
  } | null;
  isCoordinator?: boolean;
  onApprove: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onModify: (action: string, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

const ALLOWED_ACTIONS = [
  "CONTACT_PARENT",
  "REQUEST_DOCUMENT",
  "CONTACT_SPECIALIST",
  "FIND_ALTERNATIVE_SPECIALIST",
  "SCHEDULE_FOLLOWUP",
  "ESCALATE_CASE",
];

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  bottleneck,
  isCoordinator = true,
  onApprove,
  onReject,
  onModify,
  isLoading = false,
}) => {
  const [isModifying, setIsModifying] = useState(false);
  const [selectedAction, setSelectedAction] = useState(
    recommendation?.recommended_action || "CONTACT_SPECIALIST"
  );
  const [modifyReason, setModifyReason] = useState("");

  if (!recommendation && !bottleneck) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-5 h-5" />
        </div>
        <h4 className="text-base font-semibold text-emerald-900">
          Referral is on track
        </h4>
        <p className="text-sm text-emerald-700 mt-1">
          No bottlenecks detected. The Referral Guardian agent is monitoring.
        </p>
      </div>
    );
  }

  const confidencePct = recommendation ? Math.round(recommendation.confidence * 100) : null;

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-300" />
            <span className="text-xs font-bold tracking-wider uppercase text-indigo-200">
              Referral Guardian Recommendation
            </span>
          </div>
          {confidencePct !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-200">Confidence:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-700 text-indigo-100 border border-indigo-500">
                {confidencePct}%
              </span>
            </div>
          )}
        </div>

        {/* Bottleneck Display */}
        <div className="mt-4 p-3 bg-indigo-950/50 rounded-lg border border-indigo-700/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-amber-200 uppercase">
                Detected Bottleneck
              </span>
              <p className="text-sm font-medium text-white mt-0.5">
                {(bottleneck?.type || recommendation?.bottleneck || "UNKNOWN").replace(/_/g, " ")}
              </p>
              {bottleneck?.description && (
                <p className="text-xs text-indigo-200 mt-1">
                  {bottleneck.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {recommendation ? (
          <>
            {/* Recommended Action */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Recommended Next-Best Action
              </h4>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {recommendation.recommended_action.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                  Priority: {recommendation.priority}
                </span>
              </div>
            </div>

            {/* Why */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Why
              </h4>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200/60 leading-relaxed">
                {recommendation.reason}
              </p>
            </div>

            {/* Evidence */}
            {recommendation.evidence && recommendation.evidence.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Evidence
                </h4>
                <ul className="space-y-1.5">
                  {recommendation.evidence.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-gray-600 flex items-start gap-2 bg-blue-50/50 p-2 rounded border border-blue-100"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modification form if user opened Modify */}
            {isModifying && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <h5 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  Override Recommended Action
                </h5>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    Select Alternative Action
                  </label>
                  <select
                    className="w-full text-sm bg-white border border-amber-300 rounded-lg p-2 font-mono text-gray-900 focus:ring-2 focus:ring-amber-500"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                  >
                    {ALLOWED_ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {act.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    Reason for Override (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Parent prefers direct specialist outreach..."
                    className="w-full text-sm bg-white border border-amber-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-amber-500"
                    value={modifyReason}
                    onChange={(e) => setModifyReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={isLoading}
                    onClick={() => {
                      onModify(selectedAction, modifyReason);
                      setIsModifying(false);
                    }}
                    className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    Confirm & Execute Modified Action
                  </button>
                  <button
                    onClick={() => setIsModifying(false)}
                    className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Approval Action Buttons */}
            {recommendation.status === "PENDING" && !isModifying && (
              <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                <button
                  disabled={isLoading}
                  onClick={onApprove}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve Action
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => setIsModifying(true)}
                  className="flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  <Edit3 className="w-4 h-4" />
                  Modify
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => onReject()}
                  className="flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            )}

            {recommendation.status !== "PENDING" && (
              <div className="p-3 bg-gray-100 rounded-lg text-center text-xs font-semibold text-gray-600">
                Action Status: {recommendation.status}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">
              {isCoordinator ? (
                <>Bottleneck identified. Click <strong>Run Guardian Agent</strong> to generate an AI recommendation.</>
              ) : (
                <>Bottleneck identified. Agent evaluations and approvals are coordinated by the case coordinator.</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
