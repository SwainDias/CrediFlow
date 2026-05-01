/**
 * AuditLog.js — CrediFlow
 * ========================
 * Component 5: full audit trace returned by the Audit Agent.
 *
 * Renders:
 *  - Timestamp and applicant summary bar
 *  - Expandable pretty-printed JSON viewer
 *  - Explanation section (which agent did what)
 */

import React, { useState } from "react";

export default function AuditLog({ data }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const { timestamp, application_summary, explanation } = data;

  // Format ISO timestamp to local readable string
  const readableTime = timestamp
    ? new Date(timestamp).toLocaleString()
    : "—";

  return (
    <div className="bg-white rounded-2xl shadow-md p-8 border border-indigo-100">
      <h2 className="text-xl font-bold text-indigo-700 mb-1">5 — Audit Log</h2>
      <p className="text-sm text-gray-500 mb-6">
        Full traceability record persisted to{" "}
        <code className="bg-indigo-50 px-1 rounded text-indigo-600">logs/audit_log.json</code>.
      </p>

      {/* Summary bar */}
      <div className="bg-indigo-50 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryItem label="Applicant"   value={application_summary?.applicant_name} />
        <SummaryItem label="Loan Amount" value={application_summary?.loan_amount
          ? `₹ ${Number(application_summary.loan_amount).toLocaleString()}`
          : "—"} />
        <SummaryItem label="PAN"         value={application_summary?.pan_number} />
        <SummaryItem label="Timestamp"   value={readableTime} />
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-semibold text-indigo-500 uppercase tracking-wide mb-2">
            Pipeline Explanation
          </h3>
          {Object.entries(explanation).map(([agent, desc]) => (
            <div key={agent} className="flex gap-3 text-sm">
              <span className="font-semibold text-indigo-600 w-24 shrink-0 capitalize">
                {agent}:
              </span>
              <span className="text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* JSON viewer toggle */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-indigo-600
                     hover:text-indigo-800 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? "Collapse" : "View"} Full Audit Record (JSON)
        </button>

        {expanded && (
          <div className="mt-4 bg-gray-900 rounded-xl p-5 overflow-auto max-h-96">
            <pre className="text-xs text-green-300 whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: small summary label+value cell
// ---------------------------------------------------------------------------
function SummaryItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-indigo-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value || "—"}</p>
    </div>
  );
}
