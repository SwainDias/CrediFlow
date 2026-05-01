/**
 * RiskResult.js — CrediFlow
 * ==========================
 * Component 3: risk probability and feature-importance bar chart.
 *
 * Displays:
 *  - Risk probability gauge (colour-coded)
 *  - Risk label badge
 *  - Horizontal bar chart of feature importances (Chart.js)
 */

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Risk label → colour mapping
const RISK_COLOURS = {
  "Low Risk":    { bg: "bg-green-100",  text: "text-green-700",  bar: "bg-green-500"  },
  "Medium Risk": { bg: "bg-yellow-100", text: "text-yellow-700", bar: "bg-yellow-500" },
  "High Risk":   { bg: "bg-red-100",    text: "text-red-700",    bar: "bg-red-500"    },
};

export default function RiskResult({ data }) {
  if (!data) return null;

  const { risk_probability, risk_label, feature_importance } = data;
  const riskPct = Math.round(risk_probability * 100);
  const colours = RISK_COLOURS[risk_label] || RISK_COLOURS["Medium Risk"];

  // Build Chart.js dataset from feature_importance object
  const featureLabels = Object.keys(feature_importance).map((k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
  const featureValues = Object.values(feature_importance);

  const chartData = {
    labels: featureLabels,
    datasets: [
      {
        label: "Feature Importance",
        data:  featureValues,
        backgroundColor: [
          "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe",
        ],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    indexAxis: "y",   // horizontal bars
    responsive: true,
    plugins: {
      legend: { display: false },
      title:  { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${(ctx.parsed.x * 100).toFixed(1)} %`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: Math.max(...featureValues) * 1.2,
        ticks: { callback: (v) => `${(v * 100).toFixed(0)}%` },
        grid: { color: "#e0e7ff" },
      },
      y: { grid: { display: false } },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-8 border border-indigo-100">
      <h2 className="text-xl font-bold text-indigo-700 mb-1">3 — Risk Assessment</h2>
      <p className="text-sm text-gray-500 mb-6">
        RandomForestClassifier trained on 500 synthetic records.
      </p>

      {/* Risk score + label */}
      <div className="flex items-center gap-6 mb-8">
        {/* Circular gauge */}
        <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center
          border-4 ${colours.text.replace("text", "border")} ${colours.bg} shadow`}>
          <span className="text-2xl font-extrabold">{riskPct}%</span>
          <span className="text-xs font-medium">Risk</span>
        </div>

        <div>
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold
            ${colours.bg} ${colours.text}`}>
            {risk_label}
          </span>
          <p className="mt-2 text-sm text-gray-500">
            Default probability predicted by the ML model.
          </p>
        </div>
      </div>

      {/* Feature importance chart */}
      <div>
        <h3 className="text-sm font-semibold text-indigo-500 mb-3 uppercase tracking-wide">
          Feature Importance (Gini)
        </h3>
        <div className="bg-indigo-50 rounded-xl p-4">
          <Bar data={chartData} options={chartOptions} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Relative contribution of each feature to the model prediction.
          Future: SHAP TreeExplainer for per-applicant explanations.
        </p>
      </div>
    </div>
  );
}
