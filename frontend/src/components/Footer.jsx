export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-background">
      <div className="container flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:items-center">
        <p className="text-xs text-body">
          © {new Date().getFullYear()} CrediFlow AI · Multi-agent loan processing & risk assessment.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-body">
          Connected to backend
        </p>
      </div>
    </footer>
  );
}
