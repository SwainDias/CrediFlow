import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, X, AlertTriangle, ArrowLeft } from "lucide-react";
import { resumeReview } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const DECISIONS = [
  { id: "approve", label: "Approve", icon: Check, classes: "bg-success/15 text-success-foreground border-success/40 hover:bg-success/25" },
  { id: "reject", label: "Reject", icon: X, classes: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20" },
  { id: "escalate", label: "Escalate", icon: AlertTriangle, classes: "bg-magenta-soft text-warning border-magenta-soft hover:brightness-95" },
];

const REVIEWER = { name: "Alex Reviewer", role: "Senior Underwriter" };

export default function ReviewPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const result = state?.result;
  const pipelineState = result?.current_state || result;
  const parsed = pipelineState?.parsed_application || {};
  const risk = pipelineState?.risk_assessment || {
    risk_probability: pipelineState?.risk_probability,
    risk_label: pipelineState?.risk_label,
    feature_importance: pipelineState?.feature_importance,
  };
  const kyc = pipelineState?.kyc_result || {};
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!result) navigate("/upload", { replace: true });
  }, [result, navigate]);

  const ts = useMemo(() => new Date().toLocaleString(), []);

  if (!result) return null;

  const kycFlags = [kyc.pan_valid, kyc.aadhaar_valid, kyc.name_match].filter((v) => typeof v === "boolean");
  const kycPassed = kycFlags.length ? kycFlags.every(Boolean) : null;
  const kycStatus = kycPassed === null ? "unknown" : kycPassed ? "verified" : "failed";
  const riskLabel = risk.risk_label || "N/A";
  const riskProbability = Number.isFinite(Number(risk.risk_probability)) ? Number(risk.risk_probability) : null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await resumeReview({
        thread_id: result.thread_id,
        human_decision: decision,
        human_comment: comment,
      });
      toast.success("Decision recorded.");
      navigate("/results", { replace: true, state: { result: res } });
    } catch (e) {
      toast.error(e.message || "Submission failed.");
    } finally {
      setSubmitting(false);
      setConfirm(false);
    }
  };

  return (
    <section className="container max-w-5xl py-12 md:py-16">
      <Link to="/results" state={{ result }} className="inline-flex items-center gap-1 text-sm text-body hover:text-heading">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to results
      </Link>
      <h1 className="text-section mt-3 text-heading">Human review</h1>
      <p className="mt-1 text-sm text-body">
        Confirm or override the AI's recommendation. Your decision is logged with the audit trail.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        {/* Summary */}
        <div className="card-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-body tnum">{result.thread_id}</p>
              <p className="mt-1 text-subhead text-heading">{parsed.name || "Unknown applicant"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge risk={riskLabel} dot />
              <StatusBadge status={kycStatus} dot />
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Loan amount</dt>
              <dd className="mt-1 text-heading tnum">${Number(parsed.loan_amount || 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Annual income</dt>
              <dd className="mt-1 text-heading tnum">${Number(parsed.annual_income || 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Risk label</dt>
              <dd className="mt-1 text-heading">{riskLabel}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Risk probability</dt>
              <dd className="mt-1 text-heading tnum">{riskProbability === null ? "—" : `${(riskProbability * 100).toFixed(1)}%`}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-body">Top factors</p>
            <ul className="mt-2 space-y-1.5 text-sm text-label">
              {Object.entries(risk.feature_importance || {}).slice(0, 4).map(([label, value]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span>{label.replace(/_/g, " ")}</span>
                  <span className="tnum text-body">{(Number(value) * 100).toFixed(1)}%</span>
                </li>
              ))}
              {Object.keys(risk.feature_importance || {}).length === 0 && (
                <li className="text-body">No feature importance available.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Decision form */}
        <div className="card-soft p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground">
              {REVIEWER.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <p className="text-sm text-heading">{REVIEWER.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-body">{REVIEWER.role} · {ts}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm text-label">Decision</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DECISIONS.map((d) => {
                const Icon = d.icon;
                const active = decision === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDecision(d.id)}
                    className={cn(
                      "inline-flex flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-xs transition-all",
                      d.classes,
                      active ? "ring-2 ring-offset-2 ring-current" : "opacity-90"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="comment" className="text-sm text-label">Reviewer comments</label>
            <textarea
              id="comment"
              rows={5}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Document your reasoning, conditions, or follow-ups…"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-heading placeholder:text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            onClick={() => decision ? setConfirm(true) : toast.error("Choose a decision first.")}
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Submit decision
          </button>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {decision} decision?</AlertDialogTitle>
            <AlertDialogDescription>
              This is logged to the audit trail and notifies downstream systems. You can't undo this from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
