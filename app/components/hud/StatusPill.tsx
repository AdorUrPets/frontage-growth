const VARIANT_BY_STATUS: Record<string, string> = {
  online: "fg-pill--online",
  ready: "fg-pill--online",
  active: "fg-pill--online",
  complete: "fg-pill--online",
  approved: "fg-pill--online",
  degraded: "fg-pill--warn",
  cooldown: "fg-pill--warn",
  rate_limited: "fg-pill--warn",
  busy: "fg-pill--warn",
  running: "fg-pill--warn",
  awaiting_approval: "fg-pill--warn",
  error: "fg-pill--error",
  failed: "fg-pill--error",
  rejected: "fg-pill--error",
  disabled: "fg-pill--idle",
  skipped: "fg-pill--idle",
  untested: "fg-pill--idle",
  unconfigured: "fg-pill--idle",
  unknown: "fg-pill--idle",
  idle: "fg-pill--idle",
  pending: "fg-pill--idle",
  queued: "fg-pill--idle",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const variant = VARIANT_BY_STATUS[status] ?? "fg-pill--idle";
  return (
    <span className={`fg-pill ${variant}`}>
      <span className="fg-pill-dot" />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
