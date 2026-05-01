"""
Audit Agent — CrediFlow
========================
The final agent in the pipeline.

Responsibilities
----------------
1. Receive all intermediate outputs from every preceding agent.
2. Compose a complete audit record with full traceability.
3. Append the record to the persistent audit log (JSON Lines).
4. Return the record so the frontend can display it.

Agent interaction
-----------------
  Intake Agent  ┐
  Risk Agent    ├──→ [ Audit Agent ] → audit_log.json + API response
  Negotiation   ┘

Log format
----------
Each entry is a JSON object appended to logs/audit_log.json (one per line,
JSONL format) so the file can grow indefinitely without full re-parsing.

Future extension points
------------------------
- Stream audit events to a message queue (Kafka / Redis Streams) for
  real-time monitoring dashboards.
- Sign each record with a hash chain (SHA-256 of previous entry) to
  create an immutable tamper-evident audit trail.
- Export to a compliance reporting system (SOC-2, Basel III).
"""

import json
import os
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Path to the audit log file
# ---------------------------------------------------------------------------

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_PATH  = os.path.join(BASE_DIR, "logs", "audit_log.json")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_event(
    parsed_application: dict,
    risk_assessment:    dict,
    loan_terms:         dict,
) -> dict:
    """
    Create and persist an audit log entry.

    Parameters
    ----------
    parsed_application : dict
        Output from the Intake Agent.
    risk_assessment : dict
        Output from the Risk Assessment Agent.
    loan_terms : dict
        Output from the Negotiation Agent.

    Returns
    -------
    dict
        The complete audit record (timestamp included).
    """

    # ------------------------------------------------------------------
    # Build the audit record
    # ------------------------------------------------------------------
    record = {
        "timestamp":           datetime.now(tz=timezone.utc).isoformat(),
        "application_summary": {
            "applicant_name":  parsed_application.get("name"),
            "loan_amount":     parsed_application.get("loan_amount"),
            "annual_income":   parsed_application.get("annual_income"),
            "pan_number":      parsed_application.get("pan_number"),
            "ocr_confidence":  parsed_application.get("confidence"),
        },
        "parsed_application":  _sanitise(parsed_application),
        "risk_assessment":     risk_assessment,
        "loan_terms":          loan_terms,
        "explanation": {
            "intake":      "OCR + regex/spaCy field extraction",
            "risk":        "RandomForestClassifier (sklearn); features: "
                           "income, loan_amount, credit_score, existing_debt, "
                           "employment_years",
            "negotiation": "Rule-based interest / tenor / collateral engine (v1). "
                           "Future: RL agent trained on historical acceptance data.",
        },
    }

    # ------------------------------------------------------------------
    # Persist — append as a new line (JSONL)
    # ------------------------------------------------------------------
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    return record


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitise(application: dict) -> dict:
    """
    Remove bulky raw text from the log to keep file size manageable.
    The raw OCR text is useful for debugging but not for auditors.
    """
    cleaned = {k: v for k, v in application.items() if k != "raw_text"}
    return cleaned


def get_all_logs() -> list:
    """
    Read and return all audit log entries as a list of dicts.
    Returns an empty list if the log file does not exist yet.
    """
    if not os.path.exists(LOG_PATH):
        return []
    records = []
    with open(LOG_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records
