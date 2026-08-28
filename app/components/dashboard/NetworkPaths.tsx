import type { AgentNodeData } from "./AgentNode";

export const NET_W = 1080;
export const NET_H = 640;
const COL = 268;
const CENTER_X = NET_W / 2;
const CENTER_Y = 302;
const CORE_R = 98;

function pathFor(side: "left" | "right", y: number): string {
  if (side === "left") {
    const x1 = CENTER_X - CORE_R;
    const cx = COL + (x1 - COL) * 0.55;
    return `M ${COL} ${y} C ${cx} ${y}, ${cx} ${CENTER_Y}, ${x1} ${CENTER_Y}`;
  }
  const x0 = NET_W - COL;
  const x1 = CENTER_X + CORE_R;
  const cx = x0 - (x0 - x1) * 0.55;
  return `M ${x0} ${y} C ${cx} ${y}, ${cx} ${CENTER_Y}, ${x1} ${CENTER_Y}`;
}

const LEFT_GRADS = ["fg-net-l1", "fg-net-l2", "fg-net-l3"];
const RIGHT_GRADS = ["fg-net-r1", "fg-net-r2", "fg-net-r3"];
const LEFT_PULSE = ["var(--fg-blue)", "var(--fg-violet)", "#6c7bff"];
const RIGHT_PULSE = ["var(--fg-cyan)", "var(--fg-teal)", "var(--fg-green)"];

/**
 * Curved Bézier connectors merging every agent into the Growth Commander
 * core, with a soft glow underlay per path and light pulses traveling
 * toward the center. Pulses always run on paths whose agent is genuinely
 * running; two ambient pulses per side keep the network alive at rest.
 */
export function NetworkPaths({
  leftAgents,
  rightAgents,
  hoveredCode,
}: {
  leftAgents: AgentNodeData[];
  rightAgents: AgentNodeData[];
  hoveredCode: string | null;
}) {
  const AMBIENT_ROWS = [2, 6];

  function renderSide(agents: AgentNodeData[], side: "left" | "right") {
    const grads = side === "left" ? LEFT_GRADS : RIGHT_GRADS;
    const pulseColors = side === "left" ? LEFT_PULSE : RIGHT_PULSE;
    const anyRunning = agents.some((a) => a.status === "running");

    return agents.map((a, i) => {
      const y = ((i + 0.5) / agents.length) * NET_H;
      const d = pathFor(side, y);
      const grad = grads[i % grads.length];
      const pulseColor = pulseColors[i % pulseColors.length];
      const running = a.status === "running";
      const ambient = !anyRunning && AMBIENT_ROWS.includes(i);
      const hasPulse = running || ambient;

      return (
        <g key={a.id}>
          <path d={d} className="fg-network-path-glow" stroke={`url(#${grad})`} data-dim={hoveredCode !== null && hoveredCode !== a.code} />
          <path
            d={d}
            className="fg-network-path"
            stroke={`url(#${grad})`}
            data-highlight={hoveredCode === a.code}
            data-dim={hoveredCode !== null && hoveredCode !== a.code}
          />
          {hasPulse ? (
            <circle r={running ? 2.6 : 2} fill={pulseColor} opacity={running ? 0.95 : 0.6}>
              <animateMotion dur={`${running ? 2.8 : 5.5}s`} begin={`${(i % 4) * 0.9}s`} repeatCount="indefinite" path={d} />
            </circle>
          ) : null}
        </g>
      );
    });
  }

  return (
    <svg viewBox={`0 0 ${NET_W} ${NET_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="fg-net-l1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--fg-blue)" />
          <stop offset="100%" stopColor="var(--fg-violet)" />
        </linearGradient>
        <linearGradient id="fg-net-l2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--fg-violet)" />
          <stop offset="100%" stopColor="var(--fg-blue)" />
        </linearGradient>
        <linearGradient id="fg-net-l3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6c7bff" />
          <stop offset="100%" stopColor="var(--fg-cyan)" />
        </linearGradient>
        <linearGradient id="fg-net-r1" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--fg-cyan)" />
          <stop offset="100%" stopColor="var(--fg-teal)" />
        </linearGradient>
        <linearGradient id="fg-net-r2" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--fg-teal)" />
          <stop offset="100%" stopColor="var(--fg-green)" />
        </linearGradient>
        <linearGradient id="fg-net-r3" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--fg-green)" />
          <stop offset="100%" stopColor="var(--fg-cyan)" />
        </linearGradient>
      </defs>
      {renderSide(leftAgents, "left")}
      {renderSide(rightAgents, "right")}
    </svg>
  );
}
