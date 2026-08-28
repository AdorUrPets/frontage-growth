"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export interface AgentNodeData {
  id: string;
  code: string;
  name: string;
  status: "running" | "failed" | "complete" | "idle";
  detail: string;
  runtimeLabel: string | null;
  /** deep link to the client-page panel holding this agent's real output */
  href: string;
}

const STATUS_WORD: Record<AgentNodeData["status"], string | null> = {
  running: null, // uses the agent's own verb (Scanning, Writing, …)
  complete: "Complete",
  failed: "Failed",
  idle: null, // shows the verb dimmed, matching the reference cards
};

export function AgentNode({
  agent,
  icon: Icon,
  verb,
  accent,
  align,
  hovered,
  dimmed,
  onHover,
  onLeave,
}: {
  agent: AgentNodeData;
  icon: LucideIcon;
  verb: string;
  accent: string;
  align: "left" | "right";
  hovered: boolean;
  dimmed: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const statusWord = STATUS_WORD[agent.status] ?? verb;
  const live = agent.status === "running";

  return (
    <Link
      href={agent.href}
      className="fg-agent-node"
      data-status={agent.status}
      data-hovered={hovered}
      data-dim={dimmed}
      style={{ ["--fg-agent-accent" as string]: accent, flexDirection: align === "right" ? "row-reverse" : "row" }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      title={`${agent.name} — ${agent.detail} · click to open its results`}
    >
      <span className="fg-agent-node-icon">
        {live ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col" style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
        <span className="fg-agent-node-name">{agent.name}</span>
        <span className="fg-agent-node-sub" style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}>
          <em style={{ opacity: agent.status === "idle" ? 0.65 : 1 }}>{statusWord}</em>
          <span className="fg-wave" data-live={live} aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>
          {agent.runtimeLabel ? <span className="fg-agent-runtime">{agent.runtimeLabel}</span> : null}
        </span>
      </div>

      <span className="fg-agent-node-led" />
    </Link>
  );
}
