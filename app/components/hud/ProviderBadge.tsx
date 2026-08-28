import { Cpu, Sparkles, Waypoints, Radar } from "lucide-react";

const ICON_BY_PROVIDER: Record<string, typeof Cpu> = {
  ollama: Cpu,
  gemini: Sparkles,
  openrouter: Waypoints,
  serpapi: Radar,
};

export function ProviderBadge({ provider, model }: { provider: string; model?: string | null }) {
  const Icon = ICON_BY_PROVIDER[provider] ?? Cpu;
  return (
    <span className={`fg-provider-badge fg-provider-badge--${provider}`}>
      <Icon size={11} />
      {provider}
      {model ? <span className="opacity-70 normal-case">· {model}</span> : null}
    </span>
  );
}
