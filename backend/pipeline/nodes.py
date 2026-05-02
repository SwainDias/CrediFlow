"""
Pipeline Node Functions — CrediFlow
=====================================

Each function in this module is a **LangGraph node**: it accepts the
shared ``LoanApplicationState`` and returns a partial dict of the fields
it wants to update.

These are thin wrappers around the existing agent implementations in
``agents/``.  The wrappers translate between the graph's state dict and
each agent's existing function signature, keeping the agents themselves
unchanged and independently testable.

Node summary
-------------
    intake_agent        – OCR + extraction → parsed_application
    verification_agent  – KYC validation   → kyc_passed, kyc_result
    risk_agent          – ML risk model    → risk_probability, shap, etc.
    negotiation_agent   – rule engine      → loan_offers
    audit_agent         – persist trail    → audit_record
    human_review        – NOOP placeholder – graph pauses here via interrupt
"""

from __future__ import annotations

from typing import Any, Dict

from pipeline.state import LoanApplicationState

# ── Import existing agent functions ──────────────────────────────────────
from agents.intake_agent        import process_document
from agents.verification_agent  import verify_kyc
from agents.risk_agent          import assess_risk
from agents.negotiation_agent   import propose_terms
from agents.audit_agent         import log_event


# ---------------------------------------------------------------------------
# 1 — Intake Agent Node
# ---------------------------------------------------------------------------

def intake_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    OCR the uploaded document and extract structured application fields.

    Reads
    -----
    document_bytes, content_type

    Writes
    ------
    raw_ocr_text, parsed_application, extraction_confidence
    """
    file_bytes   = state["document_bytes"]
    content_type = state["content_type"]

    parsed = process_document(file_bytes, content_type)

    return {
        "raw_ocr_text":          parsed.pop("raw_text", ""),
        "parsed_application":    parsed,
        "extraction_confidence": parsed.get("confidence", 0.0),
        "pipeline_status":       "in_progress",
    }


# ---------------------------------------------------------------------------
# 2 — Verification Agent Node (KYC)
# ---------------------------------------------------------------------------

def verification_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Validate identity documents (PAN, Aadhaar, name cross-check).

    Reads
    -----
    parsed_application

    Writes
    ------
    kyc_passed, kyc_result, rejection_reason (if failed)
    """
    parsed = state["parsed_application"]
    result = verify_kyc(parsed)

    updates: Dict[str, Any] = {
        "kyc_passed": result["kyc_passed"],
        "kyc_result": result["kyc_result"],
    }

    if not result["kyc_passed"]:
        updates["rejection_reason"] = (
            f"KYC verification failed: {result['kyc_result']['details']}"
        )
        updates["pipeline_status"] = "rejected"

    return updates


# ---------------------------------------------------------------------------
# 3 — Risk Agent Node
# ---------------------------------------------------------------------------

def risk_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Run the ML risk model and produce explainability artifacts.

    Reads
    -----
    parsed_application

    Writes
    ------
    risk_probability, risk_label, risk_calibrated_score,
    feature_importance, shap_values, counterfactuals,
    fraud_score, fraud_flags, needs_human_review
    """
    parsed     = state["parsed_application"]
    assessment = assess_risk(parsed)

    risk_prob  = assessment["risk_probability"]
    risk_label = assessment["risk_label"]

    # ── Determine whether a human reviewer is needed ──
    # High-confidence low-risk: proceed automatically
    # Borderline (medium risk) or high risk: flag for human review
    needs_human = risk_label in ("Medium Risk", "High Risk")

    return {
        "risk_probability":      risk_prob,
        "risk_label":            risk_label,
        "risk_calibrated_score": risk_prob,      # placeholder for Platt scaling
        "feature_importance":    assessment["feature_importance"],
        "shap_values":           [],             # TODO: integrate SHAP TreeExplainer
        "counterfactuals":       [],             # TODO: generate DiCE counterfactuals
        "fraud_score":           0.0,            # TODO: integrate fraud sub-model
        "fraud_flags":           [],
        "needs_human_review":    needs_human,
    }


# ---------------------------------------------------------------------------
# 4 — Negotiation Agent Node
# ---------------------------------------------------------------------------

def negotiation_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Generate one or more loan offer options.

    Reads
    -----
    parsed_application, risk_probability

    Writes
    ------
    loan_offers
    """
    parsed    = state["parsed_application"]
    risk_prob = state["risk_probability"]

    terms = propose_terms(parsed, risk_prob)

    # Wrap in a list — future versions may return multiple offers
    return {
        "loan_offers": [terms],
    }


# ---------------------------------------------------------------------------
# 5 — Audit Agent Node
# ---------------------------------------------------------------------------

def audit_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Persist a complete audit trail and mark the pipeline as complete.

    Reads
    -----
    parsed_application, risk_probability, risk_label,
    feature_importance, loan_offers, kyc_result,
    human_decision, human_comment, rejection_reason

    Writes
    ------
    audit_record, pipeline_status
    """
    parsed = state.get("parsed_application", {})

    # Build risk_assessment dict expected by the existing log_event()
    risk_assessment = {
        "risk_probability":   state.get("risk_probability", 0.0),
        "risk_label":         state.get("risk_label", "N/A"),
        "feature_importance": state.get("feature_importance", {}),
        "input_features":     {},
    }

    # Use the first loan offer (or empty dict)
    offers     = state.get("loan_offers", [])
    loan_terms = offers[0] if offers else {}

    audit_record = log_event(parsed, risk_assessment, loan_terms)

    # Enrich audit record with KYC + human review info
    audit_record["kyc_result"]      = state.get("kyc_result")
    audit_record["human_decision"]  = state.get("human_decision")
    audit_record["human_comment"]   = state.get("human_comment")
    audit_record["rejection_reason"] = state.get("rejection_reason")

    # Final pipeline status
    status = state.get("pipeline_status", "completed")
    if status != "rejected":
        status = "completed"

    return {
        "audit_record":    audit_record,
        "pipeline_status": status,
    }


# ---------------------------------------------------------------------------
# 6 — Human Review Node (NOOP — graph pauses before this node)
# ---------------------------------------------------------------------------

def human_review(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Placeholder node that the graph **pauses before** via
    ``interrupt_before=["human_review"]``.

    When the graph resumes, the caller will have injected
    ``human_decision`` and ``human_comment`` into the state.
    This node simply passes those values through.

    Reads
    -----
    human_decision, human_comment

    Writes
    ------
    (passes through existing state — no new fields)
    """
    return {
        "human_decision": state.get("human_decision", "pending"),
        "human_comment":  state.get("human_comment", ""),
    }
