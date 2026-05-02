"""
Audit Agent — CrediFlow
========================
The final agent in the pipeline.

Responsibilities
----------------
1. Receive all intermediate outputs from every preceding agent.
2. Compose a complete audit record with full traceability.
3. Append the record to the persistent audit log (PostgreSQL).
4. Return the record so the frontend can display it.
"""

import json
import os
from datetime import datetime, timezone
import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crediflow_user:crediflow_password@localhost:5432/crediflow")

def _init_db():
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    applicant_name TEXT,
                    loan_amount NUMERIC,
                    annual_income NUMERIC,
                    pan_number TEXT,
                    record_data JSONB
                )
            """)
        conn.commit()

# Ensure table exists when the module is loaded
try:
    _init_db()
except Exception as e:
    print(f"Warning: Could not initialize audit_logs table: {e}")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_event(
    parsed_application: dict,
    risk_assessment:    dict,
    loan_terms:         dict,
) -> dict:
    """
    Create and persist an audit log entry in PostgreSQL.
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
    # Persist — Insert into PostgreSQL
    # ------------------------------------------------------------------
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs (
                        timestamp, applicant_name, loan_amount, annual_income, pan_number, record_data
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s
                    )
                    """,
                    (
                        record["timestamp"],
                        record["application_summary"]["applicant_name"],
                        record["application_summary"]["loan_amount"],
                        record["application_summary"]["annual_income"],
                        record["application_summary"]["pan_number"],
                        json.dumps(record, ensure_ascii=False)
                    )
                )
            conn.commit()
    except Exception as e:
        print(f"Error persisting audit log to DB: {e}")

    return record


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitise(application: dict) -> dict:
    """
    Remove bulky raw text from the log to keep size manageable.
    """
    cleaned = {k: v for k, v in application.items() if k != "raw_text"}
    return cleaned


def get_all_logs() -> list:
    """
    Read and return all audit log entries from PostgreSQL.
    """
    records = []
    try:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT record_data FROM audit_logs ORDER BY timestamp ASC")
                for row in cur.fetchall():
                    if isinstance(row["record_data"], str):
                        records.append(json.loads(row["record_data"]))
                    else:
                        records.append(row["record_data"])
    except Exception as e:
        print(f"Error reading audit logs from DB: {e}")
    return records

