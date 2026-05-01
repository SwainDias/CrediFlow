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
FEATURES   = ["annual_income", "loan_amount", "credit_score",
              "existing_debt", "employment_years"]


# ---------------------------------------------------------------------------
# Load model at import time — fail fast with a clear message if missing
# ---------------------------------------------------------------------------

def _load_model() -> tuple:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"\n\n[RiskAgent] Model file not found: {MODEL_PATH}\n"
            "Please run  CrediFlowAi/model_training.ipynb  cell-by-cell first.\n"
            "The final cell saves the trained model to backend/models/risk_model.pkl.\n"
        )
    bundle = joblib.load(MODEL_PATH)
    print(f"[RiskAgent] Model loaded from {MODEL_PATH}")
    return bundle["model"], bundle["scaler"]


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
    # Build feature vector — fall back to safe defaults for missing fields
    # ------------------------------------------------------------------
    def _safe_float(val, default):
        try:
            return float(str(val).replace(",", ""))
        except (ValueError, TypeError):
            return default

    annual_income   = _safe_float(parsed_application.get("annual_income"),   500_000)
    loan_amount     = _safe_float(parsed_application.get("loan_amount"),      200_000)
    credit_score    = _safe_float(parsed_application.get("credit_score"),     650)
    existing_debt   = _safe_float(parsed_application.get("existing_debt"),    0)
    employment_years = _safe_float(parsed_application.get("employment_years"), 5)

    features_dict = {
        "annual_income":    annual_income,
        "loan_amount":      loan_amount,
        "credit_score":     credit_score,
        "existing_debt":    existing_debt,
        "employment_years": employment_years,
    }

    X = np.array([[annual_income, loan_amount, credit_score,
                   existing_debt, employment_years]])
    X_scaled = _scaler.transform(X)

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    risk_prob = float(_model.predict_proba(X_scaled)[0][1])

    if risk_prob < 0.3:
        risk_label = "Low Risk"
    elif risk_prob < 0.6:
        risk_label = "Medium Risk"
    else:
        risk_label = "High Risk"

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
