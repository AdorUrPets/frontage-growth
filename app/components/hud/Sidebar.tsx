"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Search,
  Activity,
  Target,
  Bot,
  BarChart3,
  FileText,
  Settings,
  ChevronRight,
  PlusCircle,
  Hash,
  Lightbulb,
  Wrench,
  MapPin,
} from "lucide-react";
import { FrontageEmblem } from "./FrontageEmblem";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/seo", label: "SEO", icon: Search, chevron: true },
  { href: "/traffic", label: "Traffic", icon: Activity },
  { href: "/conversions", label: "Conversions", icon: Target },
  { href: "/missions", label: "AI Missions", icon: Bot, badged: true },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Each shortcut points at the panel that actually holds that result on the
// client page; `anchor: null` means the destination isn't client-scoped.
const SHORTCUTS = [
  { label: "Add New Mission", icon: PlusCircle, anchor: "pipeline", fallback: "/clients" },
  { label: "Keyword Research", icon: Hash, anchor: "keywords", fallback: "/clients" },
  { label: "Content Brief", icon: Lightbulb, anchor: "content-opportunities", fallback: "/clients" },
  { label: "Technical Audit", icon: Wrench, anchor: "technical-findings", fallback: "/clients" },
  { label: "Rank Tracking", icon: MapPin, anchor: "agent-performance_analyst", fallback: "/clients" },
];

export function Sidebar({
  activeMissionsCount,
  systemsOperational,
  primaryClientId,
}: {
  activeMissionsCount: number;
  systemsOperational: boolean;
  primaryClientId: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="fg-sidebar">
      <Link href="/" className="fg-sidebar-brand">
        <span className="fg-brand-mark">
          <FrontageEmblem size={19} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-[var(--fg-text)]">FRONTAGE</span>
          <span className="text-[7.5px] font-bold tracking-[0.22em] text-[var(--fg-text-faint)]">GROWTH MISSION CONTROL</span>
        </span>
      </Link>

      <nav className="fg-sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon, chevron, badged }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={label} href={href} className="fg-sidebar-link" data-active={active}>
              <Icon size={15} />
              {label}
              {badged && activeMissionsCount > 0 ? (
                <span className="fg-sidebar-badge">{activeMissionsCount}</span>
              ) : null}
              {chevron ? <ChevronRight size={13} className="ml-auto text-[var(--fg-text-faint)]" /> : null}
            </Link>
          );
        })}

        <div className="fg-sidebar-section">Shortcuts</div>
        {SHORTCUTS.map(({ label, icon: Icon, anchor, fallback }) => (
          <Link
            key={label}
            href={primaryClientId ? `/clients/${primaryClientId}#${anchor}` : fallback}
            className="fg-sidebar-link"
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="fg-sidebar-status">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: systemsOperational ? "var(--fg-green)" : "var(--fg-amber)",
              boxShadow: systemsOperational ? "0 0 8px var(--fg-glow-green)" : "0 0 8px rgba(246,177,60,0.5)",
            }}
          />
          <span className="font-bold" style={{ color: systemsOperational ? "var(--fg-green)" : "var(--fg-amber)" }}>
            {systemsOperational ? "All Systems Operational" : "Provider Attention Needed"}
          </span>
        </div>
        <div className="mt-1 pl-4 text-[9.5px] text-[var(--fg-text-faint)]">Updated just now</div>
      </div>
    </aside>
  );
}
