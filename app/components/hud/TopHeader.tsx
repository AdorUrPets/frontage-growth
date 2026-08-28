"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Bell, ChevronDown, Zap, Plus, ThumbsUp, User } from "lucide-react";
import Link from "next/link";

export function TopHeader({ pendingApprovals }: { pendingApprovals: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/clients?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="fg-header">
      <form onSubmit={submitSearch} className="fg-search">
        <Search size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients, missions, keywords, pages..." />
        <kbd className="rounded border border-[var(--fg-border)] px-1.5 py-0.5 text-[9px] text-[var(--fg-text-faint)]">/</kbd>
      </form>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="relative">
          <button className="fg-btn !px-3.5 !py-2 !text-[11.5px]" onClick={() => setActionsOpen((v) => !v)}>
            <Zap size={13} className="text-[var(--fg-accent)]" /> Quick Actions <ChevronDown size={12} />
          </button>
          {actionsOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-40 flex w-52 flex-col gap-1 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel)] p-2 shadow-xl"
              onMouseLeave={() => setActionsOpen(false)}
            >
              <Link href="/clients/new" className="fg-nav-link" onClick={() => setActionsOpen(false)}>
                <Plus size={13} /> Add Client
              </Link>
              <Link href="/#approvals" className="fg-nav-link" onClick={() => setActionsOpen(false)}>
                <ThumbsUp size={13} /> Review Approvals
              </Link>
            </div>
          ) : null}
        </div>

        <Link href="/#approvals" className="fg-icon-btn" title={`${pendingApprovals} item(s) awaiting your approval`}>
          <Bell size={15} />
          {pendingApprovals > 0 ? <span className="fg-icon-btn-badge">{pendingApprovals}</span> : null}
        </Link>

        <button className="flex items-center gap-2.5 rounded-xl border border-[var(--fg-border)] bg-[color-mix(in_srgb,var(--fg-panel-raised)_80%,transparent)] py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-[var(--fg-border-bright)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--fg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--fg-accent)_12%,transparent)] text-[var(--fg-accent)]">
            <User size={14} />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-bold text-[var(--fg-text)]">Louis</span>
            <span className="text-[8.5px] font-semibold tracking-wide text-[var(--fg-text-faint)]">Mission Commander</span>
          </span>
          <ChevronDown size={12} className="text-[var(--fg-text-faint)]" />
        </button>
      </div>
    </header>
  );
}
