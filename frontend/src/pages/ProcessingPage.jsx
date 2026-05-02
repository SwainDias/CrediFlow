import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { processLoan } from "@/api/client";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "intake", label: "Intake Agent", note: "Extracting form fields with OCR" },
  { id: "verification", label: "Verification Agent", note: "Running KYC, sanctions & PEP screening" },
  { id: "risk", label: "Risk Agent", note: "Scoring credit risk and policy fit" },
  { id: "audit", label: "Audit Agent", note: "Compiling decision packet" },
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const file = state?.file;
  const [current, setCurrent] = useState(null); // current stage id
  const [done, setDone] = useState([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!file) {
      navigate("/upload", { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const result = await processLoan(file, {
          onStage: (s) => {
            if (cancelled) return;
            setCurrent((prev) => {
              if (prev && prev !== s) setDone((d) => (d.includes(prev) ? d : [...d, prev]));
              return s;
            });
          },
        });
        if (cancelled) return;
        setDone(STAGES.map((s) => s.id));
        toast.success("Application processed.");
        navigate("/results", { replace: true, state: { result } });
      } catch (err) {
        if (cancelled) return;
        toast.error(err.message || "Processing failed.");
        navigate("/upload", { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [file, navigate]);

  return (
    <section className="container max-w-3xl py-16 md:py-24">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-sm border border-border-soft-purple bg-accent px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-primary">
          Step 2 of 3 · Processing
        </span>
        <h1 className="text-display-large mt-5 text-heading">Working on it…</h1>
        <p className="mt-4 text-body-lg text-body">
          Our multi-agent pipeline is reviewing the document. Estimated time: <span className="text-heading tnum">~90 seconds</span>.
        </p>
      </div>

      <ol className="card-soft mt-12 divide-y divide-border overflow-hidden">
        {STAGES.map((s, i) => {
          const isDone = done.includes(s.id);
          const isCurrent = current === s.id && !isDone;
          const isPending = !isDone && !isCurrent;
          return (
            <li key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className="relative flex-shrink-0">
                <div
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border tnum",
                    isDone && "border-success/40 bg-success/15 text-success-foreground",
                    isCurrent && "border-primary/40 bg-primary text-primary-foreground",
                    isPending && "border-border bg-muted text-body"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> :
                    isCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    <span className="text-xs">{i + 1}</span>}
                  {isCurrent && <span className="pulse-dot absolute inset-0 rounded-full text-primary" />}
                </div>
              </div>
              <div className="flex-1">
                <p className={cn("text-sm", isPending ? "text-body" : "text-heading")}>{s.label}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-body">{s.note}</p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-body tnum">
                {isDone ? "Done" : isCurrent ? "Running" : "Queued"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
