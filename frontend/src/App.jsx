/**
 * App.js — CrediFlow
 * ===================
 * Root application component.
 *
 * Orchestrates the full demo flow:
 *   1. UploadForm      → user selects a document
 *   2. processLoan()   → calls POST /process-loan
 *   3. ParsedData      → shows extracted fields
 *   4. RiskResult      → shows risk probability + chart
 *   5. LoanTerms       → shows proposed terms
 *   6. AuditLog        → shows full audit trace
 *
 * State is held here so that every child receives clean props.
 */

import React, { useState } from "react";
import { processLoan } from "./api";

import UploadForm  from "./components/UploadForm.jsx";
import ParsedData  from "./components/ParsedData.jsx";
import RiskResult  from "./components/RiskResult.jsx";
import LoanTerms   from "./components/LoanTerms.jsx";
import AuditLog    from "./components/AuditLog.jsx";

export default function App() {
  // Pipeline result state
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /**
   * handleUpload
   * ------------
   * Called by UploadForm when the user submits a file.
   * Runs the full backend pipeline and stores the response.
   */
  async function handleUpload(file) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await processLoan(file);
      setResult(data);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Unknown error — is the backend running?";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-indigo-800 tracking-tight">
          CrediFlow AI
        </h1>
        <p className="mt-2 text-indigo-500 text-lg font-medium">
          Autonomous Loan Processing 
        </p>
        <div className="mt-4 flex justify-center gap-3 text-sm text-indigo-400">
          <span className="bg-white border border-indigo-200 rounded-full px-3 py-1">OCR Intake</span>
          <span>→</span>
          <span className="bg-white border border-indigo-200 rounded-full px-3 py-1">Risk AI</span>
          <span>→</span>
          <span className="bg-white border border-indigo-200 rounded-full px-3 py-1">Negotiation</span>
          <span>→</span>
          <span className="bg-white border border-indigo-200 rounded-full px-3 py-1">Audit</span>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="max-w-5xl mx-auto space-y-8">

        {/* Step 1 — Upload */}
        <UploadForm onUpload={handleUpload} loading={loading} />

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-indigo-600"></div>
            <span className="ml-4 text-indigo-600 text-lg font-medium">
              Processing document…
            </span>
          </div>
        )}

        {/* Results — only shown after a successful response */}
        {result && (
          <>
            {/* Step 2 — Parsed fields */}
            <ParsedData data={result.parsed_application} />

            {/* Step 3 — Risk assessment */}
            <RiskResult data={result.risk_assessment} />

            {/* Step 4 — Loan terms */}
            <LoanTerms data={result.loan_terms} />

            {/* Step 5 — Audit log */}
            <AuditLog data={result.audit_record} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-indigo-300">
        CrediFlow v1.0 — Prototype. Not for production lending decisions.
      </footer>
    </div>
  );
}
