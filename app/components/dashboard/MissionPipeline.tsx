import { Inbox, ScanSearch, ClipboardList, Cog, Eye, Send } from "lucide-react";

export const PIPELINE_STAGES = [
  { label: "Intake", icon: Inbox },
  { label: "Analyze", icon: ScanSearch },
  { label: "Plan", icon: ClipboardList },
  { label: "Execute", icon: Cog },
  { label: "Review", icon: Eye },
  { label: "Publish", icon: Send },
] as const;

/**
 * The canonical six-stage mission pipeline rendered under the Growth
 * Commander core. `activeIndex` marks the stage the live mission is in
 * (stages before it show complete); null renders the whole track at rest.
 */
export function MissionPipeline({
  activeIndex,
  missionLabel,
  clientName,
}: {
  activeIndex: number | null;
  missionLabel?: string;
  clientName?: string;
}) {
  return (
    <div className="fg-pipe w-fit">
      <div className="flex items-baseline justify-between gap-6">
        <div className="fg-pipe-title">Mission Pipeline</div>
        {missionLabel ? (
          <div className="text-[9px] font-semibold text-[var(--fg-text-faint)]">
            {missionLabel}
            {clientName ? ` · ${clientName}` : ""}
          </div>
        ) : null}
      </div>
      <div className="fg-pipe-track">
        {PIPELINE_STAGES.map(({ label, icon: Icon }, i) => {
          const state =
            activeIndex === null ? "pending" : i < activeIndex ? "complete" : i === activeIndex ? "active" : "pending";
          return (
            <div key={label} className="contents">
              <div className="fg-pipe-stage" data-state={state}>
                <div className="fg-pipe-node">
                  <Icon size={14} />
                </div>
                <span className="fg-pipe-label">{label}</span>
              </div>
              {i < PIPELINE_STAGES.length - 1 ? <div className="fg-pipe-connector" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
