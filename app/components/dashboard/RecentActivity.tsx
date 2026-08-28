import Link from "next/link";
import { Panel } from "../hud/Panel";
import { Lightbulb, Wrench, UploadCloud, LineChart, Bot } from "lucide-react";
import { AGENT_META } from "./agentMeta";
import { DEMO_ACTIVITY, DEMO_TOOLTIP } from "./demoData";

export interface ActivityItem {
  id: string;
  agentName: string;
  agentCode: string | null;
  clientName: string | null;
  clientId: string | null;
  status: string;
  description: string;
  whenLabel: string;
}

const DEMO_ICONS: Record<string, typeof Bot> = {
  blue: Lightbulb,
  cyan: Wrench,
  green: UploadCloud,
  amber: LineChart,
};
const DEMO_TONES: Record<string, string> = {
  blue: "var(--fg-blue)",
  cyan: "var(--fg-cyan)",
  green: "var(--fg-green)",
  amber: "var(--fg-amber)",
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Panel title="Recent Mission Activity" right={<Link href="/missions" className="fg-view-all">View All</Link>}>
      {items.length === 0 ? (
        // Simulated preview rows until real agent runs exist.
        <div className="flex flex-col gap-2" title={DEMO_TOOLTIP}>
          {DEMO_ACTIVITY.map((d) => {
            const Icon = DEMO_ICONS[d.tone] ?? Bot;
            return (
              <div key={d.id} className="fg-rail-row" style={{ ["--fg-feed" as string]: DEMO_TONES[d.tone] }}>
                <span className="fg-feed-icon">
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold text-[var(--fg-text)]">{d.agentName}</div>
                  <div className="truncate text-[10px] text-[var(--fg-text-dim)]">{d.description}</div>
                </div>
                <span className="flex-shrink-0 self-start text-[9px] text-[var(--fg-text-faint)]">{d.when}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const meta = item.agentCode ? AGENT_META[item.agentCode] : undefined;
            const Icon = meta?.icon ?? Bot;
            const tone =
              item.status === "failed" ? "var(--fg-red)" : meta?.accent ?? "var(--fg-cyan)";
            const row = (
              <div className="fg-rail-row" style={{ ["--fg-feed" as string]: tone }}>
                <span className="fg-feed-icon">
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[11px] font-bold text-[var(--fg-text)]">{item.agentName}</span>
                    {item.clientName ? (
                      <span className="flex-shrink-0 text-[9px] text-[var(--fg-text-faint)]">· {item.clientName}</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[10px] text-[var(--fg-text-dim)]">{item.description}</div>
                </div>
                <span className="flex-shrink-0 self-start text-[9px] text-[var(--fg-text-faint)]">{item.whenLabel}</span>
              </div>
            );
            return item.clientId ? (
              <Link key={item.id} href={`/clients/${item.clientId}`}>
                {row}
              </Link>
            ) : (
              <div key={item.id}>{row}</div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
