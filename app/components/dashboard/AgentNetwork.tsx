"use client";

import { useState } from "react";
import { AgentNode, type AgentNodeData } from "./AgentNode";
import { NetworkPaths, NET_H, NET_W } from "./NetworkPaths";
import { CommanderCore } from "./CommanderCore";
import { AGENT_META } from "./agentMeta";

export interface CommanderReadout {
  systemActive: boolean;
  agentsActive: number;
  tasksProcessing: number;
  uptimeLabel: string;
  demoTooltip?: string;
}

export function AgentNetwork({
  leftAgents,
  rightAgents,
  commander,
}: {
  leftAgents: AgentNodeData[];
  rightAgents: AgentNodeData[];
  commander: CommanderReadout;
}) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  return (
    <div className="relative mx-auto max-w-full" style={{ width: NET_W, height: NET_H }}>
      <NetworkPaths leftAgents={leftAgents} rightAgents={rightAgents} hoveredCode={hoveredCode} />

      <div className="relative grid h-full grid-cols-[268px_1fr_268px]">
        <div className="grid content-stretch" style={{ gridTemplateRows: `repeat(${Math.max(leftAgents.length, 1)}, 1fr)` }}>
          {leftAgents.map((a) => (
            <div key={a.id} className="flex items-center">
              <AgentNode
                agent={a}
                icon={AGENT_META[a.code]?.icon ?? AGENT_META.site_recon.icon}
                verb={AGENT_META[a.code]?.verb ?? "Working"}
                accent={AGENT_META[a.code]?.accent ?? "var(--fg-blue)"}
                align="left"
                hovered={hoveredCode === a.code}
                dimmed={hoveredCode !== null && hoveredCode !== a.code}
                onHover={() => setHoveredCode(a.code)}
                onLeave={() => setHoveredCode(null)}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center gap-3.5" title={commander.demoTooltip}>
          <div className="fg-cmdr-headline">
            <span className="fg-cmdr-system">
              <span className="fg-cmdr-system-dot" style={commander.systemActive ? undefined : { background: "var(--fg-red)", boxShadow: "0 0 8px var(--fg-glow-red)" }} />
              {commander.systemActive ? "SYSTEM ACTIVE" : "SYSTEM DEGRADED"}
            </span>
            <span className="fg-cmdr-title">GROWTH COMMANDER</span>
            <span className="fg-cmdr-subtitle">AI Mission Control Center</span>
          </div>

          <CommanderCore />

          <div className="fg-cmdr-stats">
            <span className="fg-cmdr-stat-primary">{commander.agentsActive} AGENTS ACTIVE</span>
            <span className="fg-cmdr-stat-secondary">PROCESSING {commander.tasksProcessing} TASKS</span>
            <span className="fg-cmdr-uptime">MISSION UPTIME&nbsp;·&nbsp;{commander.uptimeLabel}</span>
          </div>
        </div>

        <div className="grid content-stretch" style={{ gridTemplateRows: `repeat(${Math.max(rightAgents.length, 1)}, 1fr)` }}>
          {rightAgents.map((a) => (
            <div key={a.id} className="flex items-center">
              <AgentNode
                agent={a}
                icon={AGENT_META[a.code]?.icon ?? AGENT_META.conversion_agent.icon}
                verb={AGENT_META[a.code]?.verb ?? "Working"}
                accent={AGENT_META[a.code]?.accent ?? "var(--fg-cyan)"}
                align="right"
                hovered={hoveredCode === a.code}
                dimmed={hoveredCode !== null && hoveredCode !== a.code}
                onHover={() => setHoveredCode(a.code)}
                onLeave={() => setHoveredCode(null)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
