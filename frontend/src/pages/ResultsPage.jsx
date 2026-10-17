import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Send, ShieldCheck, ShieldAlert, FileText, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import AIInsights from "@/components/AIInsights";
import { riskScoreFromProbability, normalizeImportance } from "@/lib/riskScore";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const TABS = [
  { id: "parsed", label: "Parsed Data", icon: FileText },
  { id: "kyc", label: "KYC Result", icon: ShieldCheck },
  { id: "risk", label: "Risk Assessment", icon: ShieldAlert },
  { id: "terms", label: "Loan Terms", icon: Layers },
  { id: "ai", label: "AI Insights", icon: Sparkles },
];

function fmtMoney(n) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function Field({ label, children }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-body">{label}</p>
      <p className="mt-1 text-sm text-heading tnum">{children}</p>
    </div>
  );
}

function ParsedDataTab({ data }) {
  const confidence = typeof data.confidence === "number" ? `${Math.round(data.confidence * 100)}%` : "—";
  return (
    <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
      <Field label="Applicant">{data.name || "—"}</Field>
      <Field label="Date of birth">{data.dob || "—"}</Field>
      <Field label="Annual income">{data.annual_income != null ? fmtMoney(data.annual_income) : "—"}</Field>
      <Field label="Loan amount">{data.loan_amount != null ? fmtMoney(data.loan_amount) : "—"}</Field>
      <Field label="Loan purpose">{data.loan_purpose || "—"}</Field>
      <Field label="PAN number">{data.pan_number || "—"}</Field>
      <Field label="Aadhaar number">{data.aadhaar_number || "—"}</Field>
      <Field label="OCR confidence">{confidence}</Field>
    </div>
  );
}

function KycTab({ kyc }) {
  const checks = [
    { name: "PAN validation", passed: kyc.pan_valid },
    { name: "Aadhaar validation", passed: kyc.aadhaar_valid },
    { name: "Name match", passed: kyc.name_match },
  ];
  const flags = checks.filter((c) => typeof c.passed === "boolean");
  const passedAll = flags.length ? flags.every((c) => c.passed) : null;
  const statusLabel = passedAll === null ? "Unknown" : passedAll ? "Verified" : "Failed";
  const statusVariant = passedAll === null ? "neutral" : passedAll ? "success" : "danger";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge variant={statusVariant} dot>{statusLabel}</StatusBadge>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-heading">{c.name}</span>
            {typeof c.passed === "boolean" ? (
              <StatusBadge variant={c.passed ? "success" : "danger"}>{c.passed ? "Pass" : "Fail"}</StatusBadge>
            ) : (
              <StatusBadge variant="neutral">Unknown</StatusBadge>
            )}
          </li>
        ))}
      </ul>
      {kyc.details && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-label">
          {kyc.details}
        </div>
      )}
    </div>
  );
}

function RiskTab({ risk }) {
  const riskLabel = risk.risk_label || "N/A";
  // No risk assessment exists when the application was stopped before the risk step (for example KYC failed)
  const hasAssessment = riskLabel !== "N/A" && risk.risk_probability !== null && risk.risk_probability !== undefined;
  const riskProbability = hasAssessment && Number.isFinite(Number(risk.risk_probability)) ? Number(risk.risk_probability) : null;
  const riskScore = riskScoreFromProbability(riskProbability);
  // The donut follows the 0-100 risk SCORE: red = risk, green = the rest of the scale
  const probabilityData = riskScore === null
    ? []
    : [
      { name: "Risk score", value: riskScore, color: "hsl(var(--destructive))" },
      { name: "Remaining to 100", value: 100 - riskScore, color: "hsl(var(--success))" },
    ];
  const featureData = normalizeImportance(risk.feature_importance);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">Risk score</p>
          <p className="mt-1 text-[40px] font-light leading-none text-heading tnum">
            {riskScore === null ? "—" : riskScore}
            {riskScore !== null && <span className="ml-1 text-base text-body">/ 100</span>}
          </p>
          <p className="mt-2 text-[11px] text-body">0-34 Low · 35-70 Medium · 71-100 High</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">Risk label</p>
          <div className="mt-2"><StatusBadge risk={riskLabel} dot /></div>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">PD (12-mo)</p>
          <p className="mt-1 text-[28px] font-light leading-none text-heading tnum">
            {riskProbability === null ? "—" : `${(riskProbability * 100).toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr]">
        <div className="rounded-md border border-border p-4">
          <p className="mb-3 text-sm text-label">Risk score split (out of 100)</p>
          <div className="relative h-80">
            {probabilityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={probabilityData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2}>
                    {probabilityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value, name) => [`${Number(value).toFixed(0)} pts`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-body">No risk score available.</div>
            )}
            {riskScore !== null && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-light text-heading tnum">{riskScore}</span>
                <span className="text-xs text-body">/ 100</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border p-4">
          <p className="mb-3 text-sm text-label">Feature importance (model-wide, same for every applicant)</p>
          <div className="h-80">
            {featureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--body))", fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={130}
                    interval={0}
                    tick={{ fill: "hsl(var(--body))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Importance"]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-body">No feature importance available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, title }) {
  return (
    <div className="space-y-5">
      {title && <p className="text-sm text-heading">{title}</p>}
      <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
        <Field label="Decision">{offer.decision || "—"}</Field>
        <Field label="Amount offered">{offer.loan_amount_offered != null ? fmtMoney(offer.loan_amount_offered) : "—"}</Field>
        <Field label="Interest rate">{offer.recommended_interest_rate != null ? `${offer.recommended_interest_rate}%` : "—"}</Field>
        <Field label="Tenor">{offer.tenor_months != null ? `${offer.tenor_months} months` : "—"}</Field>
        <Field label="Monthly EMI">{offer.emi_monthly != null ? fmtMoney(offer.emi_monthly) : "—"}</Field>
        <Field label="EMI burden">{offer.emi_to_income_ratio != null ? `${Math.round(offer.emi_to_income_ratio * 100)}% of monthly income` : "—"}</Field>
        <Field label="Collateral">{offer.collateral_required || "—"}</Field>
        <Field label="Guarantor">{offer.guarantor_required ? "Required" : "Not required"}</Field>
      </div>
      {offer.collateral_options?.length > 0 && (
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">Suggested collateral / guarantee</p>
          <ul className="mt-2 space-y-1.5 text-sm text-label">
            {offer.collateral_options.map((c) => (
              <li key={c.type}>
                <span className="text-heading">{c.type}</span>
                {c.reason ? <span> — {c.reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {offer.conditions?.length > 0 && (
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">Conditions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-label">
            {offer.conditions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {offer.notes && <p className="text-sm text-label">{offer.notes}</p>}
    </div>
  );
}

function TermsTab({ terms, alternatives = [] }) {
  const isEmpty = !terms || Object.keys(terms).length === 0;
  if (isEmpty) {
    return <p className="text-sm text-body">Loan terms are not available for this application.</p>;
  }
  return (
    <div className="space-y-8">
      <OfferCard offer={terms} title={terms.name ? `Recommended offer — ${terms.name}` : "Recommended offer"} />
      {alternatives.length > 0 && (
        <div className="space-y-6 border-t border-border pt-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body">Alternative offers</p>
          {alternatives.map((alt) => (
            <div key={alt.scenario_id} className="rounded-md border border-border p-4">
              <OfferCard offer={alt} title={alt.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("parsed");
  const result = state?.result;
  const pipelineState = result?.current_state || result;
  const parsed = pipelineState?.parsed_application || {};
  const kyc = pipelineState?.kyc_result || {};
  const risk = pipelineState?.risk_assessment || {
    risk_probability: pipelineState?.risk_probability,
    risk_label: pipelineState?.risk_label,
    feature_importance: pipelineState?.feature_importance,
  };
  const terms = pipelineState?.loan_terms || {};
  const alternatives = pipelineState?.alternative_offers || [];
  const aiInsights = pipelineState?.ai_insights;

  useEffect(() => {
    if (!result) navigate("/upload", { replace: true });
  }, [result, navigate]);

  if (!result) return null;

  const kycFlags = [kyc.pan_valid, kyc.aadhaar_valid, kyc.name_match].filter((v) => typeof v === "boolean");
  const kycPassed = kycFlags.length ? kycFlags.every(Boolean) : null;
  const kycStatus = kycPassed === null ? "unknown" : kycPassed ? "verified" : "failed";
  const riskLabel = risk.risk_label || "N/A";

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.thread_id || "application"}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded.");
  };

  return (
    <section className="container max-w-6xl py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-body hover:text-heading">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <h1 className="text-section mt-2 text-heading">Decision packet</h1>
          <p className="mt-1 text-sm text-body">
            <span className="font-mono uppercase tracking-wider tnum">{result.thread_id}</span>
            <span className="mx-2">·</span>
            {parsed.name || "Unknown applicant"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge risk={riskLabel} dot />
          <StatusBadge status={kycStatus} dot />
        </div>
      </div>

      {/* Tabs */}
      <div className="card-soft mt-8 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-border">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-sm transition-colors",
                  active ? "text-primary" : "text-label hover:text-heading"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="p-6 md:p-8">
          {tab === "parsed" && <ParsedDataTab data={parsed} />}
          {tab === "kyc" && <KycTab kyc={kyc} />}
          {tab === "risk" && <RiskTab risk={risk} />}
          {tab === "terms" && <TermsTab terms={terms} alternatives={alternatives} />}
          {tab === "ai" && <AIInsights insights={aiInsights} />}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-label hover:bg-muted"
        >
          Back to home
        </Link>
        <button
          onClick={downloadReport}
          className="inline-flex items-center gap-2 rounded-sm border border-border-purple px-4 py-2 text-sm text-primary hover:bg-primary/5"
        >
          <Download className="h-4 w-4" /> Download report
        </button>
        {result.status === "awaiting_human_review" ? (
          <Link
            to="/review"
            state={{ result }}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-hover"
          >
            <Send className="h-4 w-4" /> Start review
          </Link>
        ) : (
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-hover"
          >
            View audit log
          </Link>
        )}
      </div>
    </section>
  );
}