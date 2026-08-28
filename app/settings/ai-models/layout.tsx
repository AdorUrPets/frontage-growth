"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/ai-models/ollama", label: "Ollama" },
  { href: "/settings/ai-models/gemini", label: "Gemini" },
  { href: "/settings/ai-models/openrouter", label: "OpenRouter" },
  { href: "/settings/ai-models/serpapi", label: "SerpApi" },
  { href: "/settings/ai-models/routing", label: "Routing" },
  { href: "/settings/ai-models/usage", label: "Usage" },
  { href: "/settings/ai-models/health", label: "Health" },
];

export default function AiModelsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 border-b border-[var(--fg-border)] pb-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="fg-nav-link" data-active={pathname === t.href}>
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
