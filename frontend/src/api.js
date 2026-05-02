/**
 * api.js — CrediFlow Frontend
 * ============================
 * Centralised Axios configuration.
 *
 * All backend calls go through this file so that the base URL and
 * default headers are managed in a single place.
 *
 * Future extension: add an Axios interceptor here to attach JWT tokens
 * for authenticated endpoints once auth is added to the backend.
 */

import axios from "axios";

// Change this to your production URL when deploying.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000, // 2 minutes — OCR on large PDFs can be slow
});

/**
 * processLoan
 * -----------
 * POST the uploaded file to /process-loan.
 *
 * @param {File} file - The file selected by the user (PDF / JPEG / PNG).
 * @returns {Promise<object>} Full pipeline response from the backend.
 */
export async function processLoan(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/process-loan", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

/**
 * fetchAuditLogs
 * --------------
 * GET all historical audit records from /audit-logs.
 *
 * @returns {Promise<object[]>} Array of audit log records.
 */
export async function fetchAuditLogs() {
  const response = await api.get("/audit-logs");
  return response.data;
}

/**
 * resumeReview
 * ------------
 * POST the human reviewer's decision back to the paused LangGraph pipeline.
 *
 * @param {string} threadId - The unique ID of the paused graph.
 * @param {string} decision - 'approve', 'reject', or 'escalate'.
 * @param {string} comment - Optional reviewer comment.
 * @returns {Promise<object>} The final pipeline response.
 */
export async function resumeReview(threadId, decision, comment = "") {
  const response = await api.post("/resume-review", {
    thread_id: threadId,
    human_decision: decision,
    human_comment: comment,
  });
  return response.data;
}

export default api;
