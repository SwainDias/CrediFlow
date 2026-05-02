import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getAuditLogs } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

const STATUSES = ["All", "Pending", "Approved", "Rejected", "Escalated"];
const PAGE_SIZE = 8;

function fmtMoney(n) { return "$" + Number(n).toLocaleString("en-US"); }
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const COLUMNS = [
  { id: "application_id", label: "ID" },
  { id: "applicant_name", label: "Applicant" },
  { id: "submitted_at", label: "Submitted" },
  { id: "loan_amount", label: "Amount", numeric: true },
  { id: "status", label: "Status" },
  { id: "risk_level", label: "Risk" },
  { id: "reviewer_notes", label: "Notes" },
];

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState({ key: "submitted_at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getAuditLogs()
      .then((d) => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let r = items;
    if (status !== "All") r = r.filter((i) => i.status === status);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((i) =>
        i.applicant_name.toLowerCase().includes(s) ||
        i.application_id.toLowerCase().includes(s)
      );
    }
    r = [...r].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return r;
  }, [items, q, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  return (
    <section className="container py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-section text-heading">Audit log</h1>
          <p className="mt-1 text-sm text-body">Every decision, every agent, every reviewer comment — searchable.</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary-hover"
        >
          + New application
        </Link>
      </div>

      {/* Filters */}
      <div className="card-soft mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-body" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by applicant or ID…"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-heading placeholder:text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs transition-colors",
                  status === s ? "bg-accent text-primary" : "text-label hover:bg-muted"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    onClick={() => toggleSort(c.id)}
                    className={cn(
                      "cursor-pointer select-none px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-body",
                      c.numeric && "text-right"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sort.key === c.id && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.id} className="px-4 py-3"><div className="shimmer h-3 w-3/4 rounded-sm" /></td>
                  ))}
                </tr>
              ))}
              {!loading && pageItems.map((row) => {
                const isOpen = !!expanded[row.application_id];
                return (
                  <tr key={row.application_id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-[12px] text-primary tnum">
                      <Link to={`/audit/${row.application_id}`} className="hover:underline">{row.application_id}</Link>
                    </td>
                    <td className="px-4 py-3 text-heading">{row.applicant_name}</td>
                    <td className="px-4 py-3 tnum text-body">{fmtDate(row.submitted_at)}</td>
                    <td className="px-4 py-3 text-right tnum text-heading">{fmtMoney(row.loan_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} dot /></td>
                    <td className="px-4 py-3"><StatusBadge risk={row.risk_level} /></td>
                    <td className="px-4 py-3 max-w-[320px] text-body">
                      <span className={cn(!isOpen && "line-clamp-1")}>{row.reviewer_notes}</span>
                      {row.reviewer_notes.length > 60 && (
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [row.application_id]: !isOpen }))}
                          className="ml-2 text-xs text-primary hover:underline"
                        >
                          {isOpen ? "less" : "more"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && pageItems.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-sm text-body">No applications match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-body tnum">
            {filtered.length} result{filtered.length === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border text-label hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border text-label hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
