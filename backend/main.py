"""
CrediFlow — FastAPI Backend
============================

Entry point for the autonomous loan-processing system.

Endpoints
---------
POST /process-loan
    Accept a loan document (PDF / image) and run the full pipeline:
      Intake → Risk → Negotiation → Audit

GET  /audit-logs
    Return all historical audit log entries.

GET  /health
    Liveness probe.

Agent pipeline
--------------
  UploadForm (UI)
       │
       ▼  multipart/form-data
  [ Intake Agent ]   ← OCR + field extraction
       │
       ▼  parsed_application dict
  [ Risk Agent ]     ← RandomForest risk model
       │
       ▼  risk_assessment dict
  [ Negotiation Agent ] ← rule-based loan terms
       │
       ▼  loan_terms dict
  [ Audit Agent ]    ← persist + return full record
       │
       ▼  JSON response → React frontend
"""

import sys
import os

# Make the backend package importable when running from its own directory
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agents.intake_agent      import process_document
from agents.risk_agent        import assess_risk
from agents.negotiation_agent import propose_terms
from agents.audit_agent       import log_event, get_all_logs

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CrediFlow — Autonomous Loan Processing API",
    version="1.0.0",
    description="AI-powered loan intake, risk scoring, term negotiation & auditing.",
)

# Allow the React dev-server (localhost:3000) as well as any production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
def health():
    """Liveness probe — returns OK when the server is running."""
    return {"status": "ok", "service": "CrediFlow API"}


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

@app.post("/process-loan", tags=["Pipeline"])
async def process_loan(file: UploadFile = File(...)):
    """
    Full autonomous loan-processing pipeline.

    1. Intake Agent  — OCR + field extraction
    2. Risk Agent    — ML risk prediction + feature importance
    3. Negotiation   — Rule-based loan term proposal
    4. Audit Agent   — Persist & return full trace record

    Accepts: PDF, JPEG, PNG, TIFF
    Returns: JSON with parsed_application, risk_assessment,
             loan_terms, audit_record
    """
    # ------------------------------------------------------------------
    # Validate file type
    # ------------------------------------------------------------------
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. "
                   f"Accepted: PDF, JPEG, PNG.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ------------------------------------------------------------------
    # Agent 1 — Intake (OCR + extraction)
    # ------------------------------------------------------------------
    parsed_application = process_document(file_bytes, content_type)

    # ------------------------------------------------------------------
    # Agent 2 — Risk Assessment
    # ------------------------------------------------------------------
    risk_assessment = assess_risk(parsed_application)

    # ------------------------------------------------------------------
    # Agent 3 — Negotiation (term proposal)
    # ------------------------------------------------------------------
    loan_terms = propose_terms(parsed_application, risk_assessment["risk_probability"])

    # ------------------------------------------------------------------
    # Agent 4 — Audit (log & return trace)
    # ------------------------------------------------------------------
    audit_record = log_event(parsed_application, risk_assessment, loan_terms)

    # ------------------------------------------------------------------
    # Compose response (exclude raw_text to keep payload lean)
    # ------------------------------------------------------------------
    clean_application = {k: v for k, v in parsed_application.items()
                         if k != "raw_text"}

    return {
        "status":             "success",
        "parsed_application": clean_application,
        "risk_assessment":    risk_assessment,
        "loan_terms":         loan_terms,
        "audit_record":       audit_record,
    }


# ---------------------------------------------------------------------------
# Audit log viewer
# ---------------------------------------------------------------------------

@app.get("/audit-logs", tags=["Audit"])
def audit_logs():
    """Return all historical audit log entries (newest first)."""
    logs = get_all_logs()
    return {"count": len(logs), "logs": list(reversed(logs))}


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
