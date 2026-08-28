import Link from "next/link";
import { Panel } from "../components/hud/Panel";
import { Cpu, Sparkles, Waypoints, Radar, Route, Activity, HeartPulse, Search } from "lucide-react";

const AI_SECTIONS = [
  { href: "/settings/ai-models/ollama", label: "Ollama", desc: "Local model registry, discovery, GPU status.", icon: Cpu },
  { href: "/settings/ai-models/gemini", label: "Gemini", desc: "Key pool, models.", icon: Sparkles },
  { href: "/settings/ai-models/openrouter", label: "OpenRouter", desc: "Key pool, model registry.", icon: Waypoints },
  { href: "/settings/ai-models/serpapi", label: "SerpApi", desc: "Live search key pool (serpapi.com) — keyword & SERP research.", icon: Radar },
  { href: "/settings/ai-models/routing", label: "Routing", desc: "Task → provider fallback chains.", icon: Route },
  { href: "/settings/ai-models/usage", label: "Usage", desc: "Requests, failures, fallback events.", icon: Activity },
  { href: "/settings/ai-models/health", label: "Health", desc: "Live provider health board.", icon: HeartPulse },
];

const INTEGRATION_SECTIONS = [
  { href: "/settings/integrations/google", label: "Google", desc: "Search Console (Analytics next) — connect once, use across every client.", icon: Search },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Settings</h1>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--fg-text-faint)]">AI Models</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_SECTIONS.map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <Panel title={label} icon={<Icon size={13} />}>
                <p className="text-xs text-[var(--fg-text-dim)]">{desc}</p>
              </Panel>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--fg-text-faint)]">Integrations</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATION_SECTIONS.map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <Panel title={label} icon={<Icon size={13} />}>
                <p className="text-xs text-[var(--fg-text-dim)]">{desc}</p>
              </Panel>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
