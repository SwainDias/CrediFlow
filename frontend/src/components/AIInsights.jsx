import PropTypes from "prop-types";
import StatusBadge from "@/components/StatusBadge";

/**
 * AIInsights — shows what the LLM layer added to each agent's result.
 *
 * `insights` is the `ai_insights` object returned by the backend
 * (POST /process-loan and POST /resume-review).
 * `compact` shows only what a human reviewer needs (KYC + risk + flags).
 */

const inr = (n) =>
  n === null || n === undefined || n === "" || Number.isNaN(Number(n))
    ? "—"
    : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function Block({ title, badge, children }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-body">{title}</p>
        {badge}
      </div>
      <div className="space-y-2 text-sm text-label">{children}</div>
    </div>
  );
}

Block.propTypes = { title: PropTypes.string.isRequired, badge: PropTypes.node, children: PropTypes.node };

function Bullets({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

Bullets.propTypes = { items: PropTypes.arrayOf(PropTypes.string) };

const SEVERITY_VARIANT = { low: "neutral", medium: "warning", high: "danger" };
const CONCERN_VARIANT = { low: "success", medium: "warning", high: "danger" };
const CHECK_VARIANT = { pass: "success", warn: "warning", fail: "danger" };

function sourceBadge(by) {
  return by === "llm" ? (
    <StatusBadge variant="info">Explained by AI</StatusBadge>
  ) : (
    <StatusBadge variant="neutral">Rule-based text</StatusBadge>
  );
}

export default function AIInsights({ insights, compact = false }) {
  if (!insights) {
    return <p className="text-sm text-body">AI insights are not available for this application.</p>;
  }

  const { intake, kyc, risk, negotiation, case_summary: memo, fraud_flags: flags = [], llm } = insights;
  const lowConfFields = intake
    ? Object.entries(intake.field_confidence || {})
      .filter(([, c]) => c < 0.7)
      .map(([f]) => f.replace(/_/g, " "))
    : [];
  const llmWorked = llm && llm.calls_succeeded > 0;

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {llm ? (
          <StatusBadge variant={llmWorked ? "info" : "warning"} dot>
            {llmWorked
              ? `${llm.calls_succeeded} of ${llm.calls_attempted} AI calls succeeded`
              : "AI explanations unavailable — rule-based results shown"}
          </StatusBadge>
        ) : null}
        {llmWorked && llm.models?.length > 0 && (
          <span className="font-mono text-[11px] text-body">{llm.models.join(" · ")}</span>
        )}
      </div>

      {/* Why is this case with a human? */}
      {risk?.review_reasons?.length > 0 && (
        <Block title="Why this case needs a human reviewer" badge={<StatusBadge variant="pending">Review</StatusBadge>}>
          <Bullets items={risk.review_reasons} />
        </Block>
      )}

      {/* Decision memo */}
      {!compact && memo && (
        <Block title="Decision memo" badge={sourceBadge(memo.written_by)}>
          <p className="text-heading">{memo.headline}</p>
          <p>{memo.decision_rationale}</p>
          <Bullets items={memo.key_factors} />
          {memo.human_review_note ? <p>{memo.human_review_note}</p> : null}
          {memo.compliance_notes?.length > 0 && (
            <div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-body">Compliance notes</p>
              <Bullets items={memo.compliance_notes} />
            </div>
          )}
          {memo.consistency_checks?.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {memo.consistency_checks.map((c) => (
                <li key={c.check} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="text-heading">{c.check}</span>
                    <span className="block text-xs text-body">{c.detail}</span>
                  </span>
                  <StatusBadge variant={CHECK_VARIANT[c.status] || "neutral"}>{c.status}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Block>
      )}

      {/* Document reading */}
      {(flags.length > 0 || (!compact && intake && (intake.notes?.length > 0 || intake.llm_used))) && (
        <Block
          title="Document reading"
          badge={intake?.document_type ? <StatusBadge variant="neutral">{intake.document_type.replace(/_/g, " ")}</StatusBadge> : null}
        >
          {flags.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <StatusBadge variant={SEVERITY_VARIANT[f.severity] || "neutral"}>{f.severity}</StatusBadge>
              <span>{f.description}</span>
            </div>
          ))}
          {!compact && intake?.notes?.length > 0 && <Bullets items={intake.notes} />}
          {!compact && lowConfFields.length > 0 && (
            <p className="text-body">Low-confidence fields (please double-check): {lowConfFields.join(", ")}.</p>
          )}
          {!compact && intake?.vision_used && <p className="text-body">A vision model read this scan because OCR could not.</p>}
        </Block>
      )}

      {/* KYC */}
      {kyc?.summary && (
        <Block
          title="KYC review"
          badge={
            <div className="flex gap-2">
              {kyc.concern_level && <StatusBadge variant={CONCERN_VARIANT[kyc.concern_level] || "neutral"}>{kyc.concern_level} concern</StatusBadge>}
              {sourceBadge(kyc.explained_by)}
            </div>
          }
        >
          <p className="text-heading">{kyc.summary}</p>
          <Bullets items={kyc.reasons} />
          {kyc.warnings?.length > 0 && (
            <div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-body">Warnings</p>
              <Bullets items={kyc.warnings} />
            </div>
          )}
          {kyc.applicant_message ? <p className="text-body">Message for the applicant: {kyc.applicant_message}</p> : null}
        </Block>
      )}

      {/* Risk */}
      {risk?.summary && (
        <Block title="Risk explanation" badge={sourceBadge(risk.explained_by)}>
          <p className="text-heading">{risk.summary}</p>
          {risk.key_drivers?.length > 0 && (
            <ul className="space-y-1.5">
              {risk.key_drivers.map((d) => (
                <li key={d.feature} className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={d.effect === "raises risk" ? "danger" : "success"}>{d.effect}</StatusBadge>
                  <span className="text-heading">{d.label}</span>
                  {d.explanation ? <span>— {d.explanation}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {risk.what_would_help?.length > 0 && (
            <div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-body">What would help</p>
              <Bullets items={risk.what_would_help} />
            </div>
          )}
          {risk.data_quality_note ? <p className="text-warning">{risk.data_quality_note}</p> : null}
          {!compact && risk.limitations?.length > 0 && (
            <details className="text-body">
              <summary className="cursor-pointer">Model limitations</summary>
              <Bullets items={risk.limitations} />
            </details>
          )}
        </Block>
      )}

      {/* Negotiation */}
      {!compact && negotiation?.rationale && (
        <Block
          title="Negotiation"
          badge={<StatusBadge variant={negotiation.mode === "llm" ? "info" : "neutral"}>{negotiation.mode === "llm" ? "AI underwriter" : negotiation.mode?.replace(/_/g, " ")}</StatusBadge>}
        >
          <p>{negotiation.rationale}</p>
          {negotiation.negotiation_tips?.length > 0 && (
            <div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-body">Tips for the applicant</p>
              <Bullets items={negotiation.negotiation_tips} />
            </div>
          )}
          {negotiation.scenarios?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-left text-xs">
                <thead className="font-mono uppercase tracking-wider text-body">
                  <tr>
                    <th className="py-1 pr-3">Option</th>
                    <th className="py-1 pr-3">Amount</th>
                    <th className="py-1 pr-3">Tenor</th>
                    <th className="py-1 pr-3">Default risk</th>
                    <th className="py-1 pr-3">EMI*</th>
                  </tr>
                </thead>
                <tbody>
                  {negotiation.scenarios.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-1 pr-3 text-heading">{s.name}</td>
                      <td className="py-1 pr-3 tnum">{inr(s.loan_amount)}</td>
                      <td className="py-1 pr-3 tnum">{s.tenor_months} mo</td>
                      <td className="py-1 pr-3 tnum">{(Number(s.risk_probability) * 100).toFixed(1)}% ({s.risk_label})</td>
                      <td className="py-1 pr-3 tnum">{inr(s.emi_at_baseline_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-body">*EMI at the baseline rule-based rate; final EMI is in the Loan Terms tab.</p>
            </div>
          )}
          {negotiation.guardrail_adjustments?.length > 0 && (
            <details className="text-body">
              <summary className="cursor-pointer">Guard-rail corrections ({negotiation.guardrail_adjustments.length})</summary>
              <Bullets items={negotiation.guardrail_adjustments} />
            </details>
          )}
        </Block>
      )}

      {/* LLM call log */}
      {!compact && llm?.calls?.length > 0 && (
        <details className="rounded-md border border-border p-4 text-sm text-body">
          <summary className="cursor-pointer">AI call log ({llm.calls.length})</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="font-mono uppercase tracking-wider">
                <tr>
                  <th className="py-1 pr-3">Agent</th>
                  <th className="py-1 pr-3">Model</th>
                  <th className="py-1 pr-3">Time</th>
                  <th className="py-1 pr-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {llm.calls.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1 pr-3 text-heading">{c.agent}</td>
                    <td className="py-1 pr-3">{c.model || "—"}</td>
                    <td className="py-1 pr-3 tnum">{c.used ? `${c.latency_ms} ms` : "—"}</td>
                    <td className="py-1 pr-3">{c.ok ? "ok" : c.used ? `failed: ${c.error || ""}` : `skipped: ${c.reason || ""}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

AIInsights.propTypes = {
  insights: PropTypes.object,
  compact: PropTypes.bool,
};