import PropTypes from "prop-types";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — Stripe-style colored pill.
 * variants: success | warning | danger | info | neutral | pending
 */
const VARIANT_STYLES = {
  success: "bg-success/15 text-success-foreground border-success/40",
  warning: "bg-magenta-soft text-warning border-magenta-soft",
  danger:  "bg-destructive/10 text-destructive border-destructive/30",
  info:    "bg-accent text-primary border-border-soft-purple",
  neutral: "bg-muted text-label border-border",
  pending: "bg-primary-soft/40 text-primary-deep border-border-soft-purple",
};

const RISK_TO_VARIANT = {
  Low: "success",
  Medium: "warning",
  High: "danger",
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
  "N/A": "neutral",
};
const STATUS_TO_VARIANT = {
  Approved: "success",
  Pending: "pending",
  Rejected: "danger",
  Escalated: "warning",
  Completed: "info",
  awaiting_human_review: "pending",
  completed: "info",
  rejected: "danger",
  verified: "success",
  manual_review: "pending",
  failed: "danger",
  unknown: "neutral",
};

export function StatusBadge({ children, variant, status, risk, dot = false, className }) {
  const v =
    variant ||
    (risk && RISK_TO_VARIANT[risk]) ||
    (status && STATUS_TO_VARIANT[status]) ||
    "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-normal leading-none tnum",
        VARIANT_STYLES[v],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children || risk || status}
    </span>
  );
}

StatusBadge.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(Object.keys(VARIANT_STYLES)),
  status: PropTypes.string,
  risk: PropTypes.string,
  dot: PropTypes.bool,
  className: PropTypes.string,
};

export default StatusBadge;
