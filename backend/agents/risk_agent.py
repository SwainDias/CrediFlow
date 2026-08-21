"""
Risk Assessment Agent — CrediFlow
===================================
The second agent in the pipeline.

Responsibilities
----------------
1. Load the pre-trained RandomForestClassifier from models/risk_model.pkl.
   Training happens separately in CrediFlowAi/model_training.ipynb.
2. Accept parsed application data from the Intake Agent.
3. Predict default risk probability.
4. Return feature-importance explanations.

Agent interaction
-----------------
  Intake Agent → [ Risk Agent ] → Negotiation Agent → Audit Agent

IMPORTANT
---------
Run  CrediFlowAi/model_training.ipynb  cell-by-cell before starting the server.
The final cell saves the trained model to backend/models/risk_model.pkl.
The server will refuse to start if that file is missing.

Future extension points
------------------------
- Replace RandomForest with a GNN-based fraud-detection model that
  leverages transaction-graph relationships between applicants.
- Add SHAP TreeExplainer for per-sample Shapley explanations.
- Load from an MLflow / BentoML model registry instead of a local .pkl.
"""

import os
import numpy as np
import joblib

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "risk_model.pkl")
FEATURES   = [
    "RevolvingUtilizationOfUnsecuredLines",
    "age",
    "NumberOfTime30-59DaysPastDueNotWorse",
    "DebtRatio",
    "MonthlyIncome",
    "NumberOfOpenCreditLinesAndLoans",
    "NumberOfTimes90DaysLate",
    "NumberRealEstateLoansOrLines",
    "NumberOfTime60-89DaysPastDueNotWorse",
    "NumberOfDependents",
]


# ---------------------------------------------------------------------------
# Load model at import time — fail fast with a clear message if missing
# ---------------------------------------------------------------------------

def _load_model() -> tuple:
    # Check for the GMSC model if risk_model.pkl is not found
    fallback_path = os.path.join(BASE_DIR, "models", "best_model_gmsc_lightgbm_+_smote.pkl")
    path_to_load = MODEL_PATH
    if not os.path.exists(MODEL_PATH) and os.path.exists(fallback_path):
        path_to_load = fallback_path

    if not os.path.exists(path_to_load):
        raise FileNotFoundError(
            f"\n\n[RiskAgent] Model file not found: {MODEL_PATH}\n"
            "Please run  CrediFlowAi/model_training.ipynb  cell-by-cell first.\n"
            "The final cell saves the trained model to backend/models/risk_model.pkl.\n"
        )
    
    bundle = joblib.load(path_to_load)
    print(f"[RiskAgent] Model loaded from {path_to_load}")
    
    if isinstance(bundle, dict) and "model" in bundle:
        return bundle["model"], bundle.get("scaler")
    return bundle, None


_model, _scaler = _load_model()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assess_risk(parsed_application: dict) -> dict:
    """
    Predict default risk for a parsed loan application.

    Parameters
    ----------
    parsed_application : dict
        Output from the Intake Agent.  Uses 'annual_income' and 'loan_amount';
        remaining features are set to conservative defaults when unavailable.

    Returns
    -------
    dict
        {
          "risk_probability": float,
          "risk_label":       str,
          "feature_importance": {feature: importance, ...},
          "input_features":   {feature: value, ...}
        }
    """
    # ------------------------------------------------------------------
    # Build feature vector for GMSC Model
    # NOTE: The GMSC model was trained on USD values from US applicants.
    # We normalise INR → USD-scale (÷85) so the model's learned boundaries
    # remain meaningful.
    # ------------------------------------------------------------------
    import re as _re

    def _safe_float(val, default):
        try:
            return float(str(val).replace(",", ""))
        except (ValueError, TypeError):
            return default

    INR_TO_USD = 85.0   # approximate conversion factor

    annual_income_inr = _safe_float(parsed_application.get("annual_income"),  600_000)  # Rs.6L default
    loan_amount_inr   = _safe_float(parsed_application.get("loan_amount"),    200_000)
    existing_debt_inr = _safe_float(parsed_application.get("existing_debt"),   50_000)

    # Convert to USD-scale so the model sees numbers it was trained on
    annual_income_usd = annual_income_inr / INR_TO_USD
    monthly_income_usd = annual_income_usd / 12.0
    existing_debt_usd  = existing_debt_inr / INR_TO_USD
    loan_amount_usd    = loan_amount_inr / INR_TO_USD

    # ── GMSC Feature: RevolvingUtilizationOfUnsecuredLines ───────────────
    # Ratio of total revolving balance to revolving credit limit.
    # Approximate: existing_debt / (existing_debt + loan_requested)
    total_credit = existing_debt_usd + loan_amount_usd
    revol_util = existing_debt_usd / max(total_credit, 1.0)  # 0–1+ range

    # ── GMSC Feature: DebtRatio ───────────────────────────────────────────
    # Monthly debt payments / Monthly gross income
    # Approximate monthly debt obligations as existing_debt / 24 (2-yr payoff)
    monthly_debt_payment = existing_debt_usd / 24.0
    debt_ratio = monthly_debt_payment / max(monthly_income_usd, 1.0)

    # ── Age from DOB ──────────────────────────────────────────────────────
    age = 40  # conservative default
    dob_str = str(parsed_application.get("dob", ""))
    if dob_str and "Not found" not in dob_str:
        years = _re.findall(r'\b(19\d\d|20\d\d)\b', dob_str)
        if years:
            age = max(18, 2024 - int(years[0]))

    # ── Past-due proxy ────────────────────────────────────────────────────
    # If DebtRatio is very high we infer past-due risk; else 0.
    # This is a rough heuristic — replace with actual data when available.
    inferred_past_due_30_59 = 1 if debt_ratio > 0.5 else 0
    inferred_past_due_90    = 1 if debt_ratio > 1.5 else 0

    features_dict = {
        "RevolvingUtilizationOfUnsecuredLines":  round(revol_util, 4),
        "age":                                   age,
        "NumberOfTime30-59DaysPastDueNotWorse":  inferred_past_due_30_59,
        "DebtRatio":                             round(debt_ratio, 4),
        "MonthlyIncome":                         round(monthly_income_usd, 2),
        "NumberOfOpenCreditLinesAndLoans":        2,
        "NumberOfTimes90DaysLate":               inferred_past_due_90,
        "NumberRealEstateLoansOrLines":           0,
        "NumberOfTime60-89DaysPastDueNotWorse":  0,
        "NumberOfDependents":                    0,
    }

    X = np.array([[
        features_dict["RevolvingUtilizationOfUnsecuredLines"],
        features_dict["age"],
        features_dict["NumberOfTime30-59DaysPastDueNotWorse"],
        features_dict["DebtRatio"],
        features_dict["MonthlyIncome"],
        features_dict["NumberOfOpenCreditLinesAndLoans"],
        features_dict["NumberOfTimes90DaysLate"],
        features_dict["NumberRealEstateLoansOrLines"],
        features_dict["NumberOfTime60-89DaysPastDueNotWorse"],
        features_dict["NumberOfDependents"],
    ]])

    if _scaler is not None:
        X_scaled = _scaler.transform(X)
    else:
        X_scaled = X

    # ------------------------------------------------------------------
    # Debug logging — visible in docker logs
    # ------------------------------------------------------------------
    print(f"[RiskAgent] Input from parsed_application:")
    print(f"  annual_income  = {parsed_application.get('annual_income')!r}")
    print(f"  loan_amount    = {parsed_application.get('loan_amount')!r}")
    print(f"  existing_debt  = {parsed_application.get('existing_debt')!r}")
    print(f"  dob            = {parsed_application.get('dob')!r}")
    print(f"[RiskAgent] Computed features:")
    for k, v in features_dict.items():
        print(f"  {k:45s} = {v}")
    print(f"[RiskAgent] X array = {X.tolist()}")

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    risk_prob = float(_model.predict_proba(X_scaled)[0][1])

    # Thresholds calibrated for the GMSC model (base default rate ≈ 6.7%).
    # A PD of 7%  is ~1.0× the base rate → borderline (Low Risk upper bound).
    # A PD of 18% is ~2.7× the base rate → concerning (Medium Risk).
    # Above 18%   is ~3×+  the base rate → dangerous  (High Risk).
    if risk_prob < 0.07:
        risk_label = "Low Risk"
    elif risk_prob < 0.18:
        risk_label = "Medium Risk"
    else:
        risk_label = "High Risk"

    print(f"[RiskAgent] risk_prob={risk_prob:.4f}  →  {risk_label}")

    # ------------------------------------------------------------------
    # Feature importance (Gini-based from Random Forest)
    # Future: swap for SHAP TreeExplainer for per-sample explanations.
    # ------------------------------------------------------------------
    importances = _model.feature_importances_
    feature_importance = {
        feat: round(float(imp), 4)
        for feat, imp in zip(FEATURES, importances)
    }

    return {
        "risk_probability":   round(risk_prob, 4),
        "risk_label":         risk_label,
        "feature_importance": feature_importance,
        "input_features":     features_dict,
    }
