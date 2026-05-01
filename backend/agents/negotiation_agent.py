"""
Negotiation Agent — CrediFlow
==============================
The third agent in the pipeline.

Responsibilities
----------------
1. Accept risk probability from the Risk Assessment Agent.
2. Apply deterministic business rules to propose loan terms.
3. Return a structured loan-terms proposal.

Agent interaction
-----------------
  Risk Agent → [ Negotiation Agent ] → Audit Agent → Response

Rule set (v1 — rule-based)
---------------------------
  Interest rate:
    risk < 0.2  →  8.5 %   (Prime / low-risk)
    0.2–0.5     → 11.0 %   (Standard)
    > 0.5       → 15.0 %   (Sub-prime)

  Tenor:
    annual_income > 3 × loan_amount  →  36 months
    else                             →  60 months

  Collateral:
    risk < 0.3  →  None
    0.3–0.6     →  Optional
    > 0.6       →  Mandatory

Future extension points
------------------------
- Replace static rules with a Reinforcement Learning (RL) agent that
  learns optimal terms from historical acceptance/default outcomes.
- Integrate a lender profit calculator to balance risk vs. yield.
- Add multi-offer generation (3 tiers) so the UI can present choices.
"""


def propose_terms(parsed_application: dict, risk_probability: float) -> dict:
    """
    Propose loan terms based on risk probability and applicant profile.

    Parameters
    ----------
    parsed_application : dict
        Structured output from the Intake Agent.
    risk_probability : float
        Default risk probability (0–1) from the Risk Agent.

    Returns
    -------
    dict
        {
          "recommended_interest_rate": float,
          "tenor_months":              int,
          "collateral_required":       str,
          "decision":                  str,
          "notes":                     str
        }
    """

    # ------------------------------------------------------------------
    # Helper: safe numeric conversion
    # ------------------------------------------------------------------
    def _safe_float(val, default):
        try:
            return float(str(val).replace(",", ""))
        except (ValueError, TypeError):
            return default

    # ------------------------------------------------------------------
    # Interest rate rule
    # ------------------------------------------------------------------
    if risk_probability < 0.2:
        interest_rate = 8.5
        rate_tier     = "Prime"
    elif risk_probability <= 0.5:
        interest_rate = 11.0
        rate_tier     = "Standard"
    else:
        interest_rate = 15.0
        rate_tier     = "Sub-prime"

    # ------------------------------------------------------------------
    # Tenor rule
    # ------------------------------------------------------------------
    annual_income = _safe_float(parsed_application.get("annual_income"), 500_000)
    loan_amount   = _safe_float(parsed_application.get("loan_amount"),   200_000)

    if annual_income > 3 * loan_amount:
        tenor_months = 36
    else:
        tenor_months = 60

    # ------------------------------------------------------------------
    # Collateral rule
    # ------------------------------------------------------------------
    if risk_probability < 0.3:
        collateral = "None"
    elif risk_probability <= 0.6:
        collateral = "Optional"
    else:
        collateral = "Mandatory"

    # ------------------------------------------------------------------
    # Overall decision
    # ------------------------------------------------------------------
    if risk_probability > 0.75:
        decision = "Refer to Senior Underwriter"
    elif risk_probability > 0.5:
        decision = "Approved with Conditions"
    else:
        decision = "Pre-Approved"

    notes = (
        f"Rate tier: {rate_tier}. "
        f"EMI will be calculated at {interest_rate}% p.a. over {tenor_months} months. "
        f"Collateral status: {collateral}."
    )

    return {
        "recommended_interest_rate": interest_rate,
        "tenor_months":              tenor_months,
        "collateral_required":       collateral,
        "decision":                  decision,
        "notes":                     notes,
    }
