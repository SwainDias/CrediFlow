/**
 * ParsedData.js — CrediFlow
 * ==========================
 * Component 2: display extracted document fields.
 *
 * Shows a clean card grid of every field returned by the Intake Agent,
 * including the OCR confidence score visualised as a progress bar.
 */

import React from "react";

const FIELD_LABELS = {
  name:           "Applicant Name",
  dob:            "Date of Birth",
  annual_income:  "Annual Income (₹)",
  loan_amount:    "Loan Amount (₹)",
  loan_purpose:   "Loan Purpose",
  pan_number:     "PAN Number",
  aadhaar_number: "Aadhaar Number",
};

export default function ParsedData({ data }) {
  if (!data) return null;

  const confidencePct = Math.round((data.confidence || 0) * 100);

  // Colour the confidence bar
  const barColour =
    confidencePct >= 75 ? "bg-green-500" :
    confidencePct >= 50 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="bg-white rounded-2xl shadow-md p-8 border border-indigo-100">
      <h2 className="text-xl font-bold text-indigo-700 mb-1">2 — Extracted Document Fields</h2>
      <p className="text-sm text-gray-500 mb-6">
        Fields parsed from OCR text via regex + spaCy NER.
      </p>

      {/* Field grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {Object.entries(FIELD_LABELS).map(([key, label]) => (
          <div key={key} className="bg-indigo-50 rounded-xl p-4">
            <p className="text-xs text-indigo-400 uppercase font-semibold mb-1">{label}</p>
            <p className={`text-sm font-medium ${
              data[key] === "Not found" ? "text-red-400 italic" : "text-gray-800"
            }`}>
              {data[key] || "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Confidence score */}
      <div className="border-t border-indigo-50 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-indigo-600">OCR Extraction Confidence</span>
          <span className="text-sm font-bold text-indigo-800">{confidencePct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${barColour}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Based on {Math.round(confidencePct / 100 * 7)} of 7 fields successfully extracted.
        </p>
      </div>
    </div>
  );
}
