"""
Pipeline Node Functions — CrediFlow  (agentic version)
=======================================================

Each function in this module is a **LangGraph node**: it accepts the
shared ``LoanApplicationState`` and returns a partial dict of the fields
it wants to update.

These are thin wrappers around the agent implementations in ``agents/``.

Node summary
-------------
    intake_agent        – OCR + regex + LLM extraction, cross-checked   → parsed_application
    verification_agent  – KYC checks + LLM explanation                  → kyc_passed, kyc_result
    risk_agent          – ML model (unchanged) + SHAP + LLM explanation → risk_*, risk_insights
    negotiation_agent   – LLM planner/underwriter + guard-rails         → loan_offers
    audit_agent         – consistency checks + LLM memo + persist       → audit_record
    human_review        – NOOP placeholder – graph pauses here via interrupt

Every node records its LLM calls in ``llm_trace`` (model, latency, tokens, ok/fallback).
If the LLM is down, every node still works with its rule-based logic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pipeline.state import LoanApplicationState

# ── Import agent functions ───────────────────────────────────────────────
from agents.intake_agent        import process_document
from agents.verification_agent  import verify_kyc
from agents.risk_agent          import assess_risk
from agents.risk_explainer      import explain_risk
from agents.negotiation_agent   import negotiate_terms
from agents.audit_agent         import log_event, build_case_summary, consistency_checks
from utils.pii_utils            import mask_aadhaar, mask_pan


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_trace(state: LoanApplicationState, *metas: Any) -> List[Dict[str, Any]]:
    """Return the existing llm_trace plus the new call records."""
    trace = list(state.get("llm_trace") or [])
    for m in metas:
        if isinstance(m, list):
            trace.extend(x for x in m if x)
        elif m:
            trace.append(m)
    return trace


_SEVERITY_SCORE = {"low": 0.2, "medium": 0.5, "high": 0.9}


# ---------------------------------------------------------------------------
# 1 — Intake Agent Node
# ---------------------------------------------------------------------------

def intake_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    OCR the uploaded document and extract structured application fields
    (regex + LLM, cross-checked).

    Writes
    ------
    raw_ocr_text, parsed_application, extraction_confidence,
    intake_insights, fraud_flags, fraud_score, llm_trace
    """
    file_bytes   = state["document_bytes"]
    content_type = state["content_type"]

    parsed = process_document(file_bytes, content_type)
    raw_text = parsed.pop("raw_text", "")
    meta = parsed.pop("intake_meta", {}) or {}

    flags = meta.get("red_flags", [])
    fraud_score = max([_SEVERITY_SCORE.get(f.get("severity"), 0.2) for f in flags], default=0.0)

    return {
        "raw_ocr_text":          raw_text,
        "parsed_application":    parsed,
        "extraction_confidence": parsed.get("confidence", 0.0),
        "intake_insights": {
            "document_type":    meta.get("document_type", "unknown"),
            "field_sources":    meta.get("field_sources", {}),
            "field_confidence": meta.get("field_confidence", {}),
            "notes":            meta.get("notes", []),
            "llm_used":         meta.get("llm_used", False),
            "vision_used":      meta.get("vision_used", False),
        },
        "fraud_flags":           flags,
        "fraud_score":           fraud_score,
        "llm_trace":             _add_trace(state, meta.get("trace", [])),
        "pipeline_status":       "in_progress",
    }


# ---------------------------------------------------------------------------
# 2 — Verification Agent Node (KYC)
# ---------------------------------------------------------------------------

def verification_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Validate identity documents (PAN, Aadhaar, age, name) and explain the result.

    Writes
    ------
    kyc_passed, kyc_result, kyc_flagged_for_review, rejection_reason (if failed), llm_trace
    """
    parsed = state["parsed_application"]

    low_conf = [f for f, c in (state.get("intake_insights", {}).get("field_confidence", {}) or {}).items() if c < 0.7]
    intake_context = {
        "document_type":     state.get("intake_insights", {}).get("document_type"),
        "low_confidence_fields": low_conf,
        "document_red_flags": [f.get("description") for f in state.get("fraud_flags", [])][:4],
    }

    result = verify_kyc(
        parsed,
        document_bytes=state.get("document_bytes"),
        content_type=state.get("content_type"),
        intake_context=intake_context,
    )

    updates: Dict[str, Any] = {
        "kyc_passed":             result["kyc_passed"],
        "kyc_result":             result["kyc_result"],
        "kyc_flagged_for_review": result["flag_for_review"],
        "llm_trace":              _add_trace(state, result.get("llm_meta")),
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
    Run the ML risk model (unchanged), then add SHAP, what-if scenarios and
    an LLM explanation.

    Writes
    ------
    risk_probability, risk_label, risk_calibrated_score, feature_importance,
    shap_values, counterfactuals, risk_input_features, risk_insights,
    needs_human_review, llm_trace
    """
    parsed     = state["parsed_application"]
    assessment = assess_risk(parsed)

    risk_prob  = assessment["risk_probability"]
    risk_label = assessment["risk_label"]

    explanation = explain_risk(
        parsed, assessment,
        kyc_summary=(state.get("kyc_result") or {}).get("summary"),
    )

    # ── Does a human need to look at this? ──
    #  * Medium / High risk
    #  * KYC passed but the KYC reviewer / QR cross-check was worried
    #  * The intake step found a HIGH severity red flag (e.g. prompt injection)
    high_flag = any(f.get("severity") == "high" for f in state.get("fraud_flags", []))
    needs_human = (
        risk_label in ("Medium Risk", "High Risk")
        or bool(state.get("kyc_flagged_for_review"))
        or high_flag
    )

    insights = {k: explanation[k] for k in (
        "summary", "key_drivers", "what_would_help", "data_quality_note",
        "confidence_in_estimate", "explained_by", "limitations", "data_gaps",
    )}
    insights["review_reasons"] = [
        r for r, hit in (
            (f"Risk label is {risk_label}", risk_label in ("Medium Risk", "High Risk")),
            ("KYC checks raised a concern", bool(state.get("kyc_flagged_for_review"))),
            ("A high-severity document red flag was raised", high_flag),
        ) if hit
    ]

    return {
        "risk_probability":      risk_prob,
        "risk_label":            risk_label,
        "risk_calibrated_score": risk_prob,      # placeholder for Platt scaling
        "feature_importance":    assessment["feature_importance"],
        "shap_values":           explanation["shap_values"],
        "counterfactuals":       explanation["counterfactuals"],
        "risk_input_features":   assessment.get("input_features", {}),
        "risk_insights":         insights,
        "needs_human_review":    needs_human,
        "llm_trace":             _add_trace(state, explanation.get("llm_meta")),
    }


# ---------------------------------------------------------------------------
# 4 — Negotiation Agent Node
# ---------------------------------------------------------------------------

def negotiation_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Plan, evaluate and choose loan offers (LLM + real risk model + guard-rails).

    Reads
    -----
    parsed_application, risk_probability, risk_label, shap_values,
    human_decision, human_comment, kyc_result

    Writes
    ------
    loan_offers (first item = recommended offer), negotiation_insights, llm_trace
    """
    result = negotiate_terms(
        state["parsed_application"],
        state["risk_probability"],
        state.get("risk_label", "Medium Risk"),
        shap_values=state.get("shap_values"),
        human_decision=state.get("human_decision"),
        human_comment=state.get("human_comment"),
        kyc_summary=(state.get("kyc_result") or {}).get("summary"),
    )

    return {
        "loan_offers":          result["offers"],
        "negotiation_insights": result["insights"],
        "llm_trace":            _add_trace(state, result["metas"]),
    }


# ---------------------------------------------------------------------------
# 5 — Audit Agent Node
# ---------------------------------------------------------------------------

def _trace_summary(trace: List[Dict[str, Any]]) -> Dict[str, Any]:
    used = [t for t in trace if t.get("used")]
    ok = [t for t in used if t.get("ok")]
    return {
        "calls_attempted": len(trace),
        "calls_succeeded": len(ok),
        "calls_skipped_or_failed": len(trace) - len(ok),
        "total_latency_ms": sum(int(t.get("latency_ms") or 0) for t in used),
        "total_tokens": sum(int(t.get("prompt_tokens") or 0) + int(t.get("completion_tokens") or 0) for t in used),
        "models": sorted({t.get("model") for t in ok if t.get("model")}),
        "calls": trace,
    }


def audit_agent(state: LoanApplicationState) -> Dict[str, Any]:
    """
    Run consistency checks, write the LLM decision memo and persist the audit trail.

    Writes
    ------
    audit_record, case_summary, pipeline_status, llm_trace
    """
    parsed = state.get("parsed_application", {})
    offers = state.get("loan_offers", []) or []
    primary = offers[0] if offers else {}
    kyc = state.get("kyc_result") or {}
    risk_ins = state.get("risk_insights") or {}
    neg_ins = state.get("negotiation_insights") or {}
    intake_ins = state.get("intake_insights") or {}

    # Final pipeline status
    status = state.get("pipeline_status", "completed")
    if status != "rejected":
        status = "completed"

    # ── Deterministic cross-agent checks ──
    checks = consistency_checks({
        "kyc_passed":           state.get("kyc_passed"),
        "risk_label":           state.get("risk_label"),
        "offers":               offers,
        "human_decision":       state.get("human_decision"),
        "guardrail_adjustments": neg_ins.get("guardrail_adjustments"),
        "red_flag_count":       len(state.get("fraud_flags", []) or []),
    })

    # ── LLM decision memo (masked identifiers only) ──
    memo_ctx = {
        "pipeline_status": status,
        "applicant": {
            "name": parsed.get("name"),
            "loan_amount_requested": parsed.get("loan_amount"),
            "annual_income": parsed.get("annual_income"),
            "loan_purpose": parsed.get("loan_purpose"),
            "pan": mask_pan(parsed.get("pan_number")),
            "aadhaar": mask_aadhaar(parsed.get("aadhaar_number")),
        },
        "intake": {"document_type": intake_ins.get("document_type"), "notes": intake_ins.get("notes", [])[:3]},
        "kyc_passed": state.get("kyc_passed"),
        "kyc_summary": kyc.get("summary") or kyc.get("details"),
        "kyc_warnings": (kyc.get("warnings") or [])[:3],
        "risk_label": state.get("risk_label"),
        "risk_probability": state.get("risk_probability"),
        "risk_summary": risk_ins.get("summary"),
        "risk_data_gaps": risk_ins.get("data_gaps", []),
        "risk_limitations": risk_ins.get("limitations", []),
        "recommended_offer": {k: primary.get(k) for k in (
            "decision", "loan_amount_offered", "recommended_interest_rate", "tenor_months",
            "collateral_required", "guarantor_required", "emi_monthly", "emi_to_income_ratio",
        )} if primary else None,
        "alternative_offer_count": max(0, len(offers) - 1),
        "negotiation_rationale": neg_ins.get("rationale"),
        "guardrail_adjustments": neg_ins.get("guardrail_adjustments", []),
        "human_decision": state.get("human_decision"),
        "human_comment": state.get("human_comment"),
        "rejection_reason": state.get("rejection_reason"),
        "red_flags": [f.get("description") for f in state.get("fraud_flags", [])][:4],
        "consistency_checks": checks,
    }
    memo, memo_meta = build_case_summary(memo_ctx)
    memo["consistency_checks"] = checks

    trace = _add_trace(state, memo_meta)

    # ── Build the record that goes into the database ──
    risk_assessment = {
        "risk_probability":   state.get("risk_probability", 0.0),
        "risk_label":         state.get("risk_label", "N/A"),
        "feature_importance": state.get("feature_importance", {}),
        "input_features":     state.get("risk_input_features", {}),
        "shap_values":        state.get("shap_values", []),
        "counterfactuals":    state.get("counterfactuals", []),
    }
    loan_terms = primary if primary else {}

    extras = {
        "kyc_result":       state.get("kyc_result"),
        "human_decision":   state.get("human_decision"),
        "human_comment":    state.get("human_comment"),
        "rejection_reason": state.get("rejection_reason"),
        "alternative_offers": offers[1:],
        "fraud_flags":      state.get("fraud_flags", []),
        "ai_insights": {
            "intake":      intake_ins,
            "kyc":         {k: kyc.get(k) for k in (
                               "summary", "reasons", "concern_level", "recommended_action",
                               "applicant_message", "warnings", "explained_by")},
            "risk":        risk_ins,
            "negotiation": {k: neg_ins.get(k) for k in (
                               "mode", "rationale", "negotiation_tips", "planner_reasoning",
                               "scenarios", "guardrail_adjustments")},
        },
        "case_summary": memo,
        "ai_trace":     _trace_summary(trace),
    }

    audit_record = log_event(parsed, risk_assessment, loan_terms, extras=extras)

    return {
        "audit_record":    audit_record,
        "case_summary":    memo,
        "pipeline_status": status,
        "llm_trace":       trace,
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
    """
    return {
        "human_decision": state.get("human_decision", "pending"),
        "human_comment":  state.get("human_comment", ""),
    }
