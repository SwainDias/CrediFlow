import { Link, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/upload", label: "New Application" },
  { to: "/audit", label: "Audit Log" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-brand text-primary-foreground shadow-ambient">
        <span className="absolute inset-0 rounded-md bg-gradient-ruby-magenta opacity-30" aria-hidden />
        <Sparkles className="relative h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-medium tracking-tight text-heading">
        CrediFlow <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <header className="nav-blur sticky top-0 z-50 w-full border-b border-border">
      <div className="container flex h-14 items-center justify-between">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive ? "bg-accent text-primary" : "text-label hover:text-heading hover:bg-muted"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/upload"
            className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-sm font-normal text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start now →
          </Link>
        </div>

        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-label hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container flex flex-col gap-1 py-3">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  loc.pathname === n.to ? "bg-accent text-primary" : "text-label hover:bg-muted"
                )}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/upload"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-sm bg-primary px-3 py-2 text-center text-sm text-primary-foreground"
            >
              Start now →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
