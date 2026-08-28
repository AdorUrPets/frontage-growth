import { Hourglass } from "lucide-react";

export function ComingLater({ section, phase }: { section: string; phase: string }) {
  return (
    <div className="fg-panel flex flex-col items-center gap-3 py-16 text-center">
      <Hourglass size={22} className="text-[var(--fg-text-faint)]" />
      <div className="text-sm font-bold text-[var(--fg-text)]">{section} isn&apos;t built yet</div>
      <div className="max-w-md text-xs text-[var(--fg-text-dim)]">
        This lands in {phase} of the Frontage Growth build. Phase 1 is the foundation — AI
        infrastructure, key vault, routing, and client records.
      </div>
    </div>
  );
}
