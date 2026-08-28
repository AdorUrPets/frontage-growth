import Link from "next/link";
import { Panel } from "../hud/Panel";
import { Cpu, Sparkles, Waypoints, Search } from "lucide-react";
import type { ProviderHealthRow } from "@/lib/types";
import type { OllamaHealth } from "@/lib/ai/health";
import { DEMO_PROVIDER_SUB, DEMO_TOOLTIP } from "./demoData";

const PROVIDER_ROWS: { code: string; name: string; type: string; icon: typeof Cpu; colorVar: string }[] = [
  { code: "ollama", name: "Ollama", type: "Local Models", icon: Cpu, colorVar: "var(--fg-ollama)" },
  { code: "gemini", name: "Gemini", type: "Model Pool", icon: Sparkles, colorVar: "var(--fg-gemini)" },
  { code: "openrouter", name: "OpenRouter", type: "Model Pool", icon: Waypoints, colorVar: "var(--fg-openrouter)" },
  { code: "serpapi", name: "Serper", type: "Search Pool", icon: Search, colorVar: "var(--fg-serpapi)" },
];

function healthTone(status: string): { label: string; tone: "ok" | "warn" | "error" | "idle" } {
  if (status === "online" || status === "ready") return { label: "HEALTHY", tone: "ok" };
  if (status === "degraded" || status === "cooldown" || status === "rate_limited") return { label: "DEGRADED", tone: "warn" };
  if (status === "error") return { label: "OFFLINE", tone: "error" };
  return { label: "STANDBY", tone: "idle" };
}

export function AiInfrastructurePanel({ ollama, health }: { ollama: OllamaHealth; health: ProviderHealthRow[] }) {
  const byCode = (code: string) => health.find((h) => h.provider_code === code);

  return (
    <Panel title="AI Infrastructure" right={<Link href="/settings/ai-models" className="fg-view-all">View All →</Link>}>
      <div className="flex flex-col gap-2">
        {PROVIDER_ROWS.map(({ code, name, type, icon: Icon, colorVar }) => {
          let status: string;
          let pct: number | null;
          let note: string;
          let demo = false;

          if (code === "ollama") {
            status = ollama.online ? "online" : "error";
            pct = ollama.online ? 100 : 0;
            note = ollama.online ? `${ollama.models.length} MODELS ACTIVE` : ollama.error?.toUpperCase() ?? "OFFLINE";
          } else {
            const row = byCode(code);
            const configured = row?.configured_count ?? 0;
            const available = row?.available_count ?? 0;
            status = row?.status ?? "unknown";
            pct = configured > 0 ? Math.round((available / configured) * 100) : null;
            note = configured > 0 ? `${available} OF ${configured} KEYS AVAILABLE` : "";
            if (configured === 0) {
              // no keys configured yet — simulated preview so the pool reads as intended
              demo = true;
              status = "online";
              pct = DEMO_PROVIDER_SUB[code].pct;
              note = DEMO_PROVIDER_SUB[code].note;
            }
          }

          const { label, tone } = healthTone(status);
          return (
            <div key={code} className="fg-rail-row !items-start" style={{ ["--fg-prov" as string]: colorVar }} title={demo ? DEMO_TOOLTIP : undefined}>
              <span className="fg-provider-icon">
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] font-bold text-[var(--fg-text)]">{name}</span>
                  <span className="fg-health-badge" data-tone={tone === "ok" ? undefined : tone}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold text-[var(--fg-text-faint)]">{type}</span>
                  {pct !== null ? <span className="text-[10px] font-bold text-[var(--fg-text-dim)]">{pct}%</span> : null}
                </div>
                {pct !== null ? (
                  <div className="fg-activity-track mt-1.5">
                    <div className="fg-activity-fill" style={{ width: `${Math.max(4, pct)}%` }} />
                  </div>
                ) : null}
                {note ? <div className="mt-1.5 text-[8.5px] font-bold tracking-[0.08em] text-[var(--fg-text-faint)]">{note}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
