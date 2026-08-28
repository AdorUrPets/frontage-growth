"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";
import { Panel } from "../hud/Panel";
import { DEMO_APPROVALS, DEMO_TOOLTIP } from "./demoData";

export interface ApprovalItem {
  kind: "mission" | "seo_change";
  id: string;
  clientId: string;
  clientName: string;
  summary: string;
  sinceLabel: string;
}

async function approveOne(item: ApprovalItem) {
  if (item.kind === "mission") {
    await fetch(`/api/missions/${item.id}/approve`, { method: "POST" });
  } else {
    await fetch(`/api/seo-changes/${item.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
  }
}

export function ApprovalsQueue({ items, viewAllHref }: { items: ApprovalItem[]; viewAllHref: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(item: ApprovalItem, status: "approved" | "rejected") {
    setBusyId(item.id);
    if (status === "approved") {
      await approveOne(item);
    } else {
      await fetch(`/api/seo-changes/${item.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }
    setBusyId(null);
    router.refresh();
  }

  const badge =
    items.length > 0 ? (
      <span className="inline-flex h-4 min-w-[17px] items-center justify-center rounded-full bg-[var(--fg-red)] px-1 text-[9px] font-extrabold text-[#180407] shadow-[0_0_8px_var(--fg-glow-red)]">
        {items.length}
      </span>
    ) : null;

  return (
    <Panel title="Approvals Queue" icon={badge}>
      <div id="approvals" className="scroll-mt-24" />

      {items.length === 0 ? (
        // Simulated preview rows — controls disabled until real approvals arrive.
        <div className="flex flex-col gap-2" title={DEMO_TOOLTIP}>
          {DEMO_APPROVALS.map((d) => (
            <div key={d.id} className="fg-appr-row opacity-90">
              <div className="truncate text-[11px] font-bold text-[var(--fg-text)]">{d.title}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="fg-prio" data-level={d.priority}>{d.priority}</span>
                  <span className="text-[9px] text-[var(--fg-text-faint)]">{d.when}</span>
                </span>
                <span className="flex gap-1.5">
                  <button className="fg-btn-approve" disabled title={DEMO_TOOLTIP}>
                    <Check size={11} /> Approve
                  </button>
                  <button className="fg-btn-reject" disabled title={DEMO_TOOLTIP}>
                    <X size={11} /> Reject
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="fg-scroll flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/clients/${item.clientId}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/clients/${item.clientId}`);
              }}
              className="fg-appr-row cursor-pointer"
            >
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-[var(--fg-text)]">
                  {item.clientName}: {item.summary}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="fg-prio" data-level={item.kind === "mission" ? "high" : "medium"}>
                    {item.kind === "mission" ? "High" : "Medium"}
                  </span>
                  <span className="text-[9px] text-[var(--fg-text-faint)]">{item.sinceLabel}</span>
                </span>
                <span className="flex gap-1.5">
                  <button
                    className="fg-btn-approve"
                    disabled={busyId === item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      act(item, "approved");
                    }}
                  >
                    {busyId === item.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                  </button>
                  {item.kind === "seo_change" ? (
                    <button
                      className="fg-btn-reject"
                      disabled={busyId === item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        act(item, "rejected");
                      }}
                    >
                      <X size={11} /> Reject
                    </button>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href={viewAllHref} className="fg-view-all mt-3 justify-center !text-[10.5px]" style={{ display: "flex" }}>
        View All Approvals →
      </Link>
    </Panel>
  );
}
