import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { getAuditLogs } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";

function fmtMoney(n) { return "$" + Number(n).toLocaleString("en-US"); }
function fmtDate(iso) { return new Date(iso).toLocaleString(); }

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [log, setLog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAuditLogs()
      .then((data) => {
        if (cancelled) return;
        const match = data.items.find((x) => x.application_id === id) || null;
        setLog(match);
      })
      .catch(() => {
        if (!cancelled) setLog(null);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (!log) {
    return (
      <section className="container py-20 text-center">
        <p className="text-body">Application not found.</p>
        <Link to="/audit" className="mt-4 inline-block text-sm text-primary hover:underline">Back to audit log</Link>
      </section>
    );
  }

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${log.application_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="container max-w-5xl py-12 md:py-16">
      <Link to="/audit" className="inline-flex items-center gap-1 text-sm text-body hover:text-heading">
        <ArrowLeft className="h-3.5 w-3.5" /> Audit log
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-body tnum">{log.application_id}</p>
          <h1 className="text-section mt-1 text-heading">{log.applicant_name}</h1>
          <p className="mt-1 text-sm text-body tnum">Submitted {fmtDate(log.submitted_at)} · {fmtMoney(log.loan_amount)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={log.status} dot />
          <StatusBadge risk={log.risk_level} dot />
          <button
            onClick={downloadReport}
            className="inline-flex items-center gap-2 rounded-sm border border-border-purple px-3 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        {/* Decision history */}
        <div className="card-soft p-6">
          <h2 className="text-subhead text-heading">Timeline</h2>
          <ol className="mt-5 space-y-4 border-l border-border pl-5">
            {log.timeline.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-primary/40 bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <p className="text-sm text-heading">{t.agent}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-body">{t.action}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-body tnum">{fmtDate(t.at)}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Reviewer notes + summary */}
        <div className="space-y-6">
          <div className="card-soft p-6">
            <h2 className="text-subhead text-heading">Reviewer notes</h2>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground text-sm">
                {log.reviewer === "—" ? "?" : log.reviewer.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="text-sm text-heading">{log.reviewer}</p>
                <p className="mt-1 text-sm text-label">{log.reviewer_notes}</p>
              </div>
            </div>
          </div>

          <div className="card-soft p-6">
            <h2 className="text-subhead text-heading">Summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Status</dt>
                <dd className="mt-1"><StatusBadge status={log.status} dot /></dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Risk</dt>
                <dd className="mt-1"><StatusBadge risk={log.risk_level} dot /></dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Loan amount</dt>
                <dd className="mt-1 text-heading tnum">{fmtMoney(log.loan_amount)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-body">Thread ID</dt>
                <dd className="mt-1 font-mono text-xs text-body tnum">{log.thread_id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
