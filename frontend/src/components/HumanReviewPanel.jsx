import React, { useState } from "react";

export default function HumanReviewPanel({ threadId, onSubmit, loading }) {
  const [decision, setDecision] = useState("approve");
  const [comment, setComment] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(threadId, decision, comment);
  };

  return (
    <section className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 overflow-hidden mt-6">
      <div className="bg-amber-100 border-b border-amber-200 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Human Review Required
        </h2>
        <span className="bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
          ACTION NEEDED
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <p className="text-sm text-amber-800 mb-6 font-medium">
          This application has been flagged for human review due to borderline or high risk assessment. Please review the extracted data and risk factors above, then submit your decision.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-amber-900 mb-2">
            Decision
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="decision" 
                value="approve" 
                checked={decision === "approve"} 
                onChange={(e) => setDecision(e.target.value)}
                className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-amber-300"
              />
              <span className="text-sm font-medium text-amber-900">Approve</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="decision" 
                value="reject" 
                checked={decision === "reject"} 
                onChange={(e) => setDecision(e.target.value)}
                className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-amber-300"
              />
              <span className="text-sm font-medium text-amber-900">Reject</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="decision" 
                value="escalate" 
                checked={decision === "escalate"} 
                onChange={(e) => setDecision(e.target.value)}
                className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-amber-300"
              />
              <span className="text-sm font-medium text-amber-900">Escalate</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-amber-900 mb-2">
            Reviewer Comment (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-md border-amber-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-3 bg-white"
            rows="3"
            placeholder="Add any notes about this decision..."
          ></textarea>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded-lg transition-colors focus:ring-4 focus:ring-amber-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              "Submit Decision"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
