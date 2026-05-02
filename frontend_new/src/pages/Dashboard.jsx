import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowUpRight, FileCheck2, Clock4, CheckCircle2, XCircle, Plus, Activity } from "lucide-react";
import { getAuditLogs } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";
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

function fmtMoney(n) { return "$" + Number(n).toLocaleString("en-US"); }
function fmtRel(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function StatCard({ icon: Icon, label, value, delta, tone = "primary" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success-foreground",
    warning: "bg-magenta-soft text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="card-soft group p-5 transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {delta && <span className="font-mono text-[11px] uppercase tracking-wider text-body tnum">{delta}</span>}
      </div>
      <p className="mt-5 text-[28px] font-light leading-none tracking-tight text-heading tnum">{value}</p>
      <p className="mt-1.5 text-sm text-body">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    getAuditLogs()
      .then((d) => { if (!cancel) { setLogs(d.items || []); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const total = logs.length;
  const pending = logs.filter((l) => l.status === "Pending" || l.status === "Escalated").length;
  const approved = logs.filter((l) => l.status === "Approved").length;
  const rejected = logs.filter((l) => l.status === "Rejected").length;
  const statusData = [
    { name: "Approved", value: approved, color: "hsl(var(--success))" },
    { name: "Pending", value: pending, color: "hsl(var(--warning))" },
    { name: "Rejected", value: rejected, color: "hsl(var(--destructive))" },
  ].filter((item) => item.value > 0);

  const volumeData = (() => {
    const out = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        key,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: 0,
      });
    }

    const counts = out.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});

    logs.forEach((log) => {
      const key = new Date(log.submitted_at).toISOString().slice(0, 10);
      if (counts[key]) counts[key].count += 1;
    });

    return out;
  })();

  const recent = logs.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-blob absolute -left-32 top-10 h-72 w-72 rounded-full" aria-hidden />
        <div className="hero-blob absolute right-0 top-32 h-80 w-80 rounded-full" aria-hidden />
        <div className="container relative grid gap-12 pb-16 pt-20 md:grid-cols-[1.4fr,1fr] md:pt-28">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-sm border border-border-soft-purple bg-accent px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Multi-agent loan workflow
            </span>
            <h1 className="text-display-large mt-5 max-w-[18ch] text-heading md:text-display-hero">
              Loan decisions, <span className="text-primary">precisely</span> assessed.
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-body">
              CrediFlow AI orchestrates intake, KYC verification, risk scoring, and human review in
              a single, auditable pipeline — so your team approves with confidence and clarity.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-[15px] text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4" /> New application
              </Link>
              <Link
                to="/audit"
                className="inline-flex items-center gap-2 rounded-sm border border-border-purple px-4 py-2 text-[15px] text-primary transition-colors hover:bg-primary/5"
              >
                View audit log <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Decorative dashboard card */}
          <div className="card-elevated relative animate-fade-in-up p-5 md:mt-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive/70" />
                <div className="h-2 w-2 rounded-full bg-warning/70" />
                <div className="h-2 w-2 rounded-full bg-success/70" />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-body">live pipeline</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { agent: "Intake Agent", note: "OCR · 4 pages parsed", state: "Done", tone: "success" },
                { agent: "Verification Agent", note: "ID + sanctions clear", state: "Done", tone: "success" },
                { agent: "Risk Agent", note: "Scoring debt-to-income", state: "Running", tone: "pending" },
                { agent: "Audit Agent", note: "Awaiting upstream", state: "Queued", tone: "neutral" },
              ].map((s) => (
                <div key={s.agent} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
                  <div>
                    <p className="text-sm text-heading">{s.agent}</p>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-body">{s.note}</p>
                  </div>
                  <StatusBadge variant={s.tone}>{s.state}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container -mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={FileCheck2} label="Total applications" value={loading ? "—" : total} tone="primary" delta="ALL TIME" />
        <StatCard icon={Clock4} label="Pending review" value={loading ? "—" : pending} tone="warning" delta="QUEUE" />
        <StatCard icon={CheckCircle2} label="Approved" value={loading ? "—" : approved} tone="success" delta="DECISIONED" />
        <StatCard icon={XCircle} label="Rejected" value={loading ? "—" : rejected} tone="danger" delta="DECISIONED" />
      </section>

      {/* Charts */}
      <section className="container mt-10 grid gap-4 md:grid-cols-2">
        <div className="card-soft p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-subhead text-heading">7-day volume</h3>
            <span className="font-mono text-[11px] uppercase tracking-wider text-body">Applications/day</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--body))", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--body))", fontSize: 12 }} axisLine={false} tickLine={false} width={26} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent))" }}
                  contentStyle={{ borderColor: "hsl(var(--border))", borderRadius: 8 }}
                  formatter={(value) => [`${value}`, "Applications"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-subhead text-heading">Decision mix</h3>
            <span className="font-mono text-[11px] uppercase tracking-wider text-body">Live status</span>
          </div>
          <div className="h-64">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={96}
                    paddingAngle={3}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value, name) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-body">No decision data yet.</div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusData.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-label"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: <span className="tnum">{item.value}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="container mt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-section text-heading">Recent activity</h2>
            <p className="mt-1 text-sm text-body">Audit-grade trail of every applicant moving through the pipeline.</p>
          </div>
          <Link to="/audit" className="hidden text-sm text-primary hover:text-primary-hover md:inline-flex md:items-center md:gap-1">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="card-soft overflow-hidden">
          <ul className="divide-y divide-border">
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="shimmer h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3 w-1/3 rounded-sm" />
                  <div className="shimmer h-3 w-1/4 rounded-sm" />
                </div>
              </li>
            ))}
            {!loading && recent.map((l) => (
              <li key={l.application_id}>
                <Link
                  to={`/audit/${l.application_id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-heading">{l.applicant_name}</p>
                      <span className="font-mono text-[11px] text-body">·</span>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-body tnum">{l.application_id}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-body">{l.reviewer_notes}</p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-sm tnum text-heading">{fmtMoney(l.loan_amount)}</p>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-body">{fmtRel(l.submitted_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={l.status} dot />
                    <StatusBadge risk={l.risk_level} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Dark CTA section (Stripe-style brand-dark band) */}
      <section className="container mt-16">
        <div className="relative overflow-hidden rounded-xl bg-gradient-dark p-10 text-primary-foreground md:p-14">
          <div className="hero-blob absolute -right-20 -top-20 h-72 w-72 rounded-full" aria-hidden />
          <div className="relative grid gap-6 md:grid-cols-[1.6fr,1fr] md:items-center">
            <div>
              <h3 className="text-section text-primary-foreground">Built for compliance.<br />Designed for speed.</h3>
              <p className="mt-3 max-w-xl text-body-lg text-primary-foreground/70">
                Every decision is logged with the agents involved, the data they saw, and the reasoning
                behind their output — ready for audit on day one.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 rounded-sm bg-primary-foreground px-4 py-2 text-[15px] text-primary transition-transform hover:-translate-y-0.5"
              >
                Process an application <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
