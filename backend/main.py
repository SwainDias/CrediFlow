"""
CrediFlow — FastAPI Backend
============================

Entry point for the autonomous loan-processing system.
Now powered by a **LangGraph** pipeline with shared state, conditional
routing, and human-in-the-loop review.

Endpoints
---------
POST /process-loan
    Accept a loan document (PDF / image) and run the LangGraph pipeline:
      Intake → Verification (KYC) → Risk → Negotiation → Audit
    If the application is borderline/high-risk, the graph pauses at
    ``human_review`` and returns the current state with a thread_id
    so the reviewer can resume later.

POST /resume-review
    Resume a paused pipeline after the human reviewer has made a decision.
    Accepts ``thread_id``, ``human_decision``, and ``human_comment``.

GET  /audit-logs
    Return all historical audit log entries.

GET  /health
    Liveness probe.

LangGraph pipeline
-------------------
  UploadForm (UI)
       │
       ▼  multipart/form-data
  [ Intake Agent ]       ← OCR + regex + LLM extraction (cross-checked)
       │
       ▼
  [ Verification Agent ] ← KYC (PAN + Aadhaar + age) + LLM explanation
       │
       ├── KYC failed ──────────────────────── [ Audit Agent ] → rejected
       │
       ▼  KYC passed
  [ Risk Agent ]         ← ML risk model + SHAP + LLM explanation
       │
       ├── Low risk (fast-track) ──────────── [ Negotiation Agent ]
       │                                              │
       ├── Borderline / High risk ──── ⏸ PAUSE ── [ Human Review ]
       │                                              │
       │                                              ▼
       │                               [ Negotiation Agent ]
       │                                              │
       └──────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                              [ Audit Agent ]
                                                      │
                                                      ▼
                                               JSON response
"""

import sys
import os
import uuid

# Make the backend package importable when running from its own directory
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

from pipeline.graph import build_graph
from pipeline.state import LoanApplicationState
from agents.audit_agent import get_all_logs
from utils.llm_client import llm_status

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

api = FastAPI(
    title="CrediFlow — Autonomous Loan Processing API",
    version="2.0.0",
    description=(
        "AI-powered loan intake, KYC verification, risk scoring, "
        "term negotiation & auditing — orchestrated by LangGraph."
    ),
)

# Allow the React dev-server (localhost:3000) as well as any production origin
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# LangGraph pipeline — compiled with a PostgresSaver checkpointer so that
# paused graphs survive across HTTP requests and container restarts.
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crediflow_user:crediflow_password@localhost:5432/crediflow")

# Initialize the checkpointer tables using a dedicated autocommit connection
# This fixes the "CREATE INDEX CONCURRENTLY cannot run inside a transaction" error
import psycopg
with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
    PostgresSaver(conn).setup()

# Create a connection pool for the actual application
pool = ConnectionPool(conninfo=DATABASE_URL)
checkpointer = PostgresSaver(pool)

pipeline = build_graph(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@api.get("/health", tags=["System"])
def health():
    """Liveness probe — returns OK when the server is running."""
    return {
        "status": "ok",
        "service": "CrediFlow API",
        "pipeline": "LangGraph v2",
        "llm": llm_status(),      # shows whether Groq is configured (never shows the key)
    }


# ---------------------------------------------------------------------------
# Main pipeline endpoint
# ---------------------------------------------------------------------------

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
}


def _serialize_state(state: dict) -> dict:
    """
    Convert a LoanApplicationState to a JSON-safe dict.
    Removes binary fields and ensures all values are serializable.
    """
    cleaned = {}
    for key, value in state.items():
        if key == "document_bytes":
            # Don't send binary data back to the client
            cleaned[key] = f"<{len(value)} bytes>" if value else None
        else:
            cleaned[key] = value
    cleaned["ai_insights"] = _ai_insights(state)
    return cleaned


def _ai_insights(state: dict) -> dict:
    """Collect everything the LLM layer produced into one object for the frontend."""
    kyc = state.get("kyc_result") or {}
    trace = state.get("llm_trace") or []
    used = [t for t in trace if t.get("used")]
    ok = [t for t in used if t.get("ok")]
    return {
        "intake":       state.get("intake_insights"),
        "kyc": {k: kyc.get(k) for k in (
            "summary", "reasons", "concern_level", "recommended_action",
            "applicant_message", "warnings", "explained_by", "pan_type", "aadhaar_qr")},
        "risk":         state.get("risk_insights"),
        "shap_values":  state.get("shap_values", []),
        "counterfactuals": state.get("counterfactuals", []),
        "negotiation":  state.get("negotiation_insights"),
        "case_summary": state.get("case_summary"),
        "fraud_flags":  state.get("fraud_flags", []),
        "llm": {
            "calls_attempted": len(trace),
            "calls_succeeded": len(ok),
            "total_latency_ms": sum(int(t.get("latency_ms") or 0) for t in used),
            "models": sorted({t.get("model") for t in ok if t.get("model")}),
            "calls": trace,
        },
    }


def _build_result(final_state: dict, thread_id: str, include_human: bool = False) -> dict:
    """Compose the JSON returned when the pipeline has finished."""
    parsed = final_state.get("parsed_application", {})
    offers = final_state.get("loan_offers", []) or []
    loan_terms = offers[0] if offers else {}

    risk_assessment = {
        "risk_probability":   final_state.get("risk_probability", 0.0),
        "risk_label":         final_state.get("risk_label", "N/A"),
        "feature_importance": final_state.get("feature_importance", {}),
        "input_features":     final_state.get("risk_input_features", {}),
    }
    clean_application = {k: v for k, v in parsed.items() if k != "raw_text"}

    result = {
        "status":             final_state.get("pipeline_status", "completed"),
        "parsed_application": clean_application,
        "risk_assessment":    risk_assessment,
        "loan_terms":         loan_terms,
        "alternative_offers": offers[1:],
        "audit_record":       final_state.get("audit_record", {}),
        "kyc_result":         final_state.get("kyc_result"),
        "ai_insights":        _ai_insights(final_state),
        "thread_id":          thread_id,
    }
    if include_human:
        result["human_decision"] = final_state.get("human_decision")
        result["human_comment"] = final_state.get("human_comment")
    return result


@api.post("/process-loan", tags=["Pipeline"])
async def process_loan(file: UploadFile = File(...)):
    """
    Full autonomous loan-processing pipeline (LangGraph).

    1. Intake Agent       — OCR + field extraction
    2. Verification Agent — KYC (PAN, Aadhaar, name cross-check)
    3. Risk Agent         — ML risk prediction + feature importance
    4. Negotiation Agent  — LLM-planned offers checked by guard-rails
    5. Audit Agent        — Persist & return full trace record

    If the application is flagged for human review (borderline/high risk),
    the response will include ``awaiting_human_review: true`` and a
    ``thread_id`` that must be used with ``POST /resume-review``.

    Accepts: PDF, JPEG, PNG, TIFF
    Returns: JSON with full pipeline state or partial state + thread_id
    """
    # ------------------------------------------------------------------
    # Validate file type
    # ------------------------------------------------------------------
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. "
                   f"Accepted: PDF, JPEG, PNG, TIFF.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ------------------------------------------------------------------
    # Prepare initial state
    # ------------------------------------------------------------------
    initial_state: LoanApplicationState = {
        "document_bytes": file_bytes,
        "content_type":   content_type,
    }

    # Unique thread ID for this pipeline run (used for checkpointing)
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # ------------------------------------------------------------------
    # Invoke the LangGraph pipeline
    # ------------------------------------------------------------------
    try:
        final_state = pipeline.invoke(initial_state, config=config)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline execution failed: {exc}",
        )

    # ------------------------------------------------------------------
    # Check whether the graph paused for human review
    # ------------------------------------------------------------------
    snapshot = pipeline.get_state(config)
    is_paused = bool(snapshot.next)  # non-empty .next means graph is waiting

    serialized = _serialize_state(final_state)

    if is_paused:
        # Graph paused at human_review — return partial state + thread_id
        return {
            "status":                "awaiting_human_review",
            "thread_id":             thread_id,
            "awaiting_human_review": True,
            "message": (
                "This application has been flagged for human review. "
                "Use POST /resume-review with the thread_id to submit "
                "a decision and resume the pipeline."
            ),
            "current_state": serialized,
        }

    # ------------------------------------------------------------------
    # Pipeline completed fully — compose backward-compatible response
    # ------------------------------------------------------------------
    return _build_result(final_state, thread_id)


# ---------------------------------------------------------------------------
# Human review resume endpoint
# ---------------------------------------------------------------------------

class ResumeReviewRequest(BaseModel):
    """Request body for resuming a paused pipeline after human review."""
    thread_id:      str = Field(..., description="The thread_id returned by /process-loan")
    human_decision: str = Field(..., description="One of: 'approve', 'reject', 'escalate'")
    human_comment:  str = Field("", description="Optional reviewer comment")


@api.post("/resume-review", tags=["Pipeline"])
async def resume_review(body: ResumeReviewRequest):
    """
    Resume a pipeline that is paused at human_review.

    After a loan application is flagged for human review, call this
    endpoint with the ``thread_id`` and the reviewer's decision to
    continue the pipeline through negotiation and audit.

    Parameters
    ----------
    thread_id : str
        The unique ID returned by ``POST /process-loan``.
    human_decision : str
        One of ``approve``, ``reject``, or ``escalate``.
    human_comment : str
        Free-text comment from the reviewer (optional).
    """
    config = {"configurable": {"thread_id": body.thread_id}}

    # ------------------------------------------------------------------
    # Verify the graph is actually paused
    # ------------------------------------------------------------------
    try:
        snapshot = pipeline.get_state(config)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail=f"No pipeline found for thread_id: {body.thread_id}",
        )

    if not snapshot.next:
        raise HTTPException(
            status_code=409,
            detail="This pipeline is not awaiting human review. "
                   "It may have already been completed or does not exist.",
        )

    # ------------------------------------------------------------------
    # Inject the human decision into the graph state
    # ------------------------------------------------------------------
    pipeline.update_state(
        config,
        values={
            "human_decision": body.human_decision,
            "human_comment":  body.human_comment,
        },
    )

    # ------------------------------------------------------------------
    # Resume the pipeline — it will continue from human_review onward
    # ------------------------------------------------------------------
    try:
        final_state = pipeline.invoke(None, config=config)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline resume failed: {exc}",
        )

    # ------------------------------------------------------------------
    # Compose response
    # ------------------------------------------------------------------
    return _build_result(final_state, body.thread_id, include_human=True)


# ---------------------------------------------------------------------------
# Audit log viewer
# ---------------------------------------------------------------------------

@api.get("/audit-logs", tags=["Audit"])
def audit_logs():
    """Return all historical audit log entries (newest first)."""
    logs = get_all_logs()
    return {"count": len(logs), "logs": list(reversed(logs))}


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:api", host="0.0.0.0", port=8000, reload=False)
