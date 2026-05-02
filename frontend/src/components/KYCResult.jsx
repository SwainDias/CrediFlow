import React from "react";

export default function KYCResult({ data }) {
  if (!data) return null;

  const { pan_valid, aadhaar_valid, name_match, details } = data;
  const passedAll = pan_valid && aadhaar_valid && name_match;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          KYC Verification
        </h2>
        {passedAll ? (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
            VERIFIED
          </span>
        ) : (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
            FAILED
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-500 mb-1">PAN Validation</span>
            <span className={`text-sm font-semibold ${pan_valid ? "text-green-600" : "text-red-600"}`}>
              {pan_valid ? "✓ Valid Format" : "✗ Invalid"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-500 mb-1">Aadhaar Validation</span>
            <span className={`text-sm font-semibold ${aadhaar_valid ? "text-green-600" : "text-red-600"}`}>
              {aadhaar_valid ? "✓ Valid Checksum" : "✗ Invalid"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-500 mb-1">Name Consistency</span>
            <span className={`text-sm font-semibold ${name_match ? "text-green-600" : "text-red-600"}`}>
              {name_match ? "✓ Match" : "✗ Mismatch"}
            </span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600">
          <strong>Details:</strong> {details}
        </div>
      </div>
    </section>
  );
}
