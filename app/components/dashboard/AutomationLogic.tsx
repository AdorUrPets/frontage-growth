import { Zap, Bot, ShieldCheck, Send } from "lucide-react";

// Fixed explainer of how the real pipeline is wired (every step gated by a
// human approval before going live) — not a live data widget.
const NODES = [
  { icon: Zap, title: "Trigger", sub: "New Opportunity", accent: "var(--fg-amber)" },
  { icon: Bot, title: "AI Agents", sub: "Execute Tasks", accent: "var(--fg-cyan)" },
  { icon: ShieldCheck, title: "Approval", sub: "If Required", accent: "var(--fg-green)" },
  { icon: Send, title: "Publish", sub: "Go Live", accent: "var(--fg-violet)" },
];

export function AutomationLogic() {
  return (
    <div className="fg-auto">
      <div className="fg-auto-title">Automation Logic</div>
      <div className="fg-auto-track">
        {NODES.map(({ icon: Icon, title, sub, accent }, i) => (
          <div key={title} className="contents">
            <div className="fg-auto-node" style={{ ["--fg-auto-accent" as string]: accent }}>
              <span className="fg-auto-node-icon">
                <Icon size={14} />
              </span>
              <span className="flex flex-col">
                <span className="fg-auto-node-title">{title}</span>
                <span className="fg-auto-node-sub">{sub}</span>
              </span>
            </div>
            {i < NODES.length - 1 ? <div className="fg-auto-arrow" /> : null}
          </div>
        ))}
      </div>
      <div className="fg-auto-return" aria-hidden="true" />
    </div>
  );
}
