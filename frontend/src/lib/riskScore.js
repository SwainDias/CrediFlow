/**
 * Risk score helpers — CrediFlow
 *
 * The ML model outputs a DEFAULT PROBABILITY (for example 0.185 = 18.5%).
 * Real probabilities are small, so showing "18" out of 100 for a High Risk
 * applicant is confusing.  This file converts the probability into a 0-100
 * RISK SCORE that lines up with the model's own Low / Medium / High labels
 * (cut-offs 7% and 18%, taken from backend/agents/risk_agent.py):
 *
 *     probability below 7%      ->  score  0 - 34   (Low Risk)
 *     probability 7% - 18%      ->  score 35 - 70   (Medium Risk)
 *     probability 18% and above ->  score 71 - 100  (High Risk, reaches 100 at 50%)
 *
 * It is only a display scale: the probability and the label are still the
 * values the system uses for decisions.
 */

export const LOW_MAX = 0.07;
export const MEDIUM_MAX = 0.18;
export const SATURATE_AT = 0.5;

export function riskScoreFromProbability(probability) {
  const p = Number(probability);
  if (probability === null || probability === undefined || !Number.isFinite(p) || p < 0) return null;

  if (p < LOW_MAX) {
    return Math.min(34, Math.round((35 * p) / LOW_MAX));
  }
  if (p < MEDIUM_MAX) {
    const s = 35 + Math.round((35 * (p - LOW_MAX)) / (MEDIUM_MAX - LOW_MAX));
    return Math.max(35, Math.min(70, s));
  }
  const t = Math.min(1, (p - MEDIUM_MAX) / (SATURATE_AT - MEDIUM_MAX));
  return 71 + Math.round(29 * t);
}

/** Short names for the model's input features (short so chart labels never wrap or overlap). */
export const FEATURE_LABELS = {
  RevolvingUtilizationOfUnsecuredLines: "Credit utilisation",
  age: "Age",
  "NumberOfTime30-59DaysPastDueNotWorse": "Late 30-59 days",
  DebtRatio: "Debt-to-income",
  MonthlyIncome: "Monthly income",
  NumberOfOpenCreditLinesAndLoans: "Open credit lines",
  NumberOfTimes90DaysLate: "Late 90+ days",
  NumberRealEstateLoansOrLines: "Real-estate loans",
  "NumberOfTime60-89DaysPastDueNotWorse": "Late 60-89 days",
  NumberOfDependents: "Dependents",
};

/**
 * Turn the raw feature_importance object into a sorted list of
 * { feature, value } where value is each feature's SHARE of the total, in percent.
 */
export function normalizeImportance(importance) {
  const entries = Object.entries(importance || {})
    .map(([key, value]) => [key, Number(value)])
    .filter(([, v]) => Number.isFinite(v) && v >= 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return entries
    .map(([key, v]) => ({
      feature: FEATURE_LABELS[key] || key.replace(/_/g, " "),
      value: total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}