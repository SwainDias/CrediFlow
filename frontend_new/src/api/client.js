// Centralized API client for CrediFlow AI.
// Uses fetch with timeout against the FastAPI backend.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TIMEOUT_MS = 120_000;

/** Fetch with timeout */
async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function tryRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await withTimeout(fetch(url, options), TIMEOUT_MS);
  if (!res.ok) {
    const data = await safeJson(res);
    let msg = (data && (data.detail || data.message || data.error)) || `Request failed (${res.status})`;
    if (typeof msg !== "string") msg = JSON.stringify(msg);
    const err = new Error(msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return safeJson(res);
}

/** Simulate processing latency for the UI stage tracker */
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- POST /process-loan ----------
export async function processLoan(file, { onStage } = {}) {
  // Stage progression for UI
  const stages = ["intake", "verification", "risk", "audit"];
  const tickStages = async () => {
    for (const s of stages) {
      onStage?.(s);
      await delay(900);
    }
  };

  try {
    const fd = new FormData();
    fd.append("file", file);
    const stagePromise = tickStages();
    const result = await tryRequest("/process-loan", { method: "POST", body: fd });
    await stagePromise;
    return result;
  } catch (err) {
    throw err;
  }
}

// ---------- GET /audit-logs ----------
export async function getAuditLogs() {
  const data = await tryRequest("/audit-logs");
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const items = logs.map((log, index) => normalizeAuditLog(log, index));
  return { items, total: items.length };
}

// ---------- POST /resume-review ----------
export async function resumeReview({ thread_id, human_decision, human_comment }) {
  return await tryRequest("/resume-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id, human_decision, human_comment }),
  });
}

export const apiBaseUrl = BASE_URL;

function normalizeRiskLabel(label) {
  if (!label) return "N/A";
  if (label === "Low" || label === "Medium" || label === "High") return label;
  if (label.endsWith(" Risk")) return label.replace(" Risk", "");
  return label;
}

function deriveStatusFromLog(log) {
  if (log.rejection_reason) return "Rejected";
  const decision = log.human_decision;
  if (decision === "approve") return "Approved";
  if (decision === "reject") return "Rejected";
  if (decision === "escalate") return "Escalated";
  const termsDecision = log.loan_terms?.decision || "";
  if (termsDecision.toLowerCase().includes("refer")) return "Escalated";
  return termsDecision ? "Approved" : "Pending";
}

function makeApplicationId(timestamp, index) {
  const ms = Date.parse(timestamp || "");
  if (Number.isFinite(ms)) return `APP-${ms.toString(36).toUpperCase()}`;
  return `APP-${String(index + 1).padStart(4, "0")}`;
}

function normalizeAuditLog(log, index) {
  const applicant_name =
    log.application_summary?.applicant_name ||
    log.parsed_application?.name ||
    "Unknown applicant";
  const amount = Number(
    log.application_summary?.loan_amount ?? log.parsed_application?.loan_amount ?? 0
  );
  const loan_amount = Number.isFinite(amount) ? amount : 0;
  const risk_label = log.risk_assessment?.risk_label || "N/A";
  const risk_level = normalizeRiskLabel(risk_label);
  const status = deriveStatusFromLog(log);
  const reviewer_notes =
    log.human_comment ||
    log.rejection_reason ||
    log.loan_terms?.notes ||
    "—";

  return {
    application_id: makeApplicationId(log.timestamp, index),
    thread_id: log.thread_id || "—",
    applicant_name,
    submitted_at: log.timestamp,
    status,
    risk_level,
    loan_amount,
    reviewer: log.human_decision ? "Reviewer" : "—",
    reviewer_notes,
    timeline: [
      {
        agent: "Audit Agent",
        action: status,
        at: log.timestamp,
      },
    ],
    raw: log,
  };
}
