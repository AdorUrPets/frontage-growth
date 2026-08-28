import Link from "next/link";
import { Panel } from "../hud/Panel";
import { DEMO_MISSION, DEMO_TOOLTIP } from "./demoData";

export interface MissionDetailsData {
  clientId: string | null;
  clientName: string;
  label: string;
  progressPct: number;
  tasksDone: number;
  tasksTotal: number;
  etaLabel: string;
}

export function MissionDetails({ mission }: { mission: MissionDetailsData | null }) {
  // No live mission → simulated preview so the panel reads as designed.
  const demo = mission === null;
  const m: MissionDetailsData = mission ?? {
    clientId: null,
    clientName: DEMO_MISSION.clientName,
    label: DEMO_MISSION.label,
    progressPct: DEMO_MISSION.progressPct,
    tasksDone: DEMO_MISSION.tasksDone,
    tasksTotal: DEMO_MISSION.tasksTotal,
    etaLabel: DEMO_MISSION.eta,
  };

  return (
    <Panel title="Mission Details">
      <div className="flex flex-col gap-3" title={demo ? DEMO_TOOLTIP : undefined}>
        <div className="flex items-start gap-2.5">
          <span
            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--fg-cyan)]"
            style={{ boxShadow: "0 0 8px var(--fg-glow-cyan)", animation: "fg-pulse-dot 2s ease-in-out infinite" }}
          />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--fg-text-faint)]">Active Mission</div>
            <div className="truncate text-[12.5px] font-bold text-[var(--fg-text)]">{m.label}</div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="text-[var(--fg-text-faint)]">Client</span>
          <span className="truncate text-right font-semibold text-[var(--fg-text)]">{m.clientName}</span>

          <span className="text-[var(--fg-text-faint)]">Progress</span>
          <span className="flex items-center gap-2">
            <span className="fg-activity-track flex-1" style={{ ["--fg-prov" as string]: "var(--fg-cyan)" }}>
              <span className="fg-activity-fill block" style={{ width: `${Math.max(3, Math.min(100, m.progressPct))}%` }} />
            </span>
            <span className="font-bold text-[var(--fg-text)]">{m.progressPct}%</span>
          </span>

          <span className="text-[var(--fg-text-faint)]">Tasks</span>
          <span className="text-right font-semibold text-[var(--fg-text)]">
            {m.tasksDone} / {m.tasksTotal}
          </span>

          <span className="text-[var(--fg-text-faint)]">ETA</span>
          <span className="text-right font-semibold text-[var(--fg-text)]">{m.etaLabel}</span>
        </div>

        {/* Always clickable: with a live mission it opens that mission's
            pipeline, otherwise it goes to the mission board rather than
            being a dead control. */}
        <Link
          href={m.clientId ? `/clients/${m.clientId}#pipeline` : "/missions"}
          className="fg-view-all justify-center border-t border-[var(--fg-border)] pt-3 !text-[10.5px]"
          style={{ display: "flex" }}
          title={demo ? "No live mission yet — opens the AI Mission Board." : undefined}
        >
          {demo ? "View Mission Board →" : "View Mission Dashboard →"}
        </Link>
      </div>
    </Panel>
  );
}
