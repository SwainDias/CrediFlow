/**
 * UploadForm.js — CrediFlow
 * ==========================
 * Component 1: file uploader.
 *
 * Accepts PDF, JPEG, PNG documents.
 * Calls the onUpload callback prop when the user submits.
 * Shows drag-and-drop zone + file-type / size validation.
 */

import React, { useState, useCallback } from "react";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE_MB    = 10;

export default function UploadForm({ onUpload, loading }) {
  const [file,      setFile]      = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [fileError, setFileError] = useState(null);

  // ------------------------------------------------------------------
  // Validate file type and size
  // ------------------------------------------------------------------
  function validate(f) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return `Unsupported file type: ${f.type}. Please upload PDF, JPEG, or PNG.`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  function handleFileSelect(f) {
    const err = validate(f);
    if (err) { setFileError(err); setFile(null); return; }
    setFileError(null);
    setFile(f);
  }

  // ------------------------------------------------------------------
  // Drag & drop handlers
  // ------------------------------------------------------------------
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, []); // eslint-disable-line

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true);  };
  const handleDragLeave = ()  => setDragOver(false);

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  function handleSubmit(e) {
    e.preventDefault();
    if (file && !loading) onUpload(file);
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-8 border border-indigo-100">
      <h2 className="text-xl font-bold text-indigo-700 mb-1">1 — Upload Loan Document</h2>
      <p className="text-sm text-gray-500 mb-6">
        Supported formats: <strong>PDF, JPEG, PNG</strong> (max {MAX_SIZE_MB} MB)
      </p>

      <form onSubmit={handleSubmit}>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
            ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-indigo-200 bg-gray-50"}
            hover:border-indigo-400`}
          onClick={() => document.getElementById("file-input").click()}
        >
          <svg className="mx-auto h-10 w-10 text-indigo-400 mb-3" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
          <p className="text-indigo-500 font-medium">
            {file ? file.name : "Drag & drop or click to browse"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : "PDF, JPEG, PNG"}
          </p>
        </div>

        {/* Hidden input */}
        <input
          id="file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
        />

        {/* Validation error */}
        {fileError && (
          <p className="mt-3 text-sm text-red-600">{fileError}</p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!file || loading}
          className={`mt-6 w-full py-3 px-6 rounded-xl font-semibold text-white transition-all
            ${!file || loading
              ? "bg-indigo-300 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"}`}
        >
          {loading ? "Processing…" : "Analyse Document"}
        </button>
      </form>
    </div>
  );
}
