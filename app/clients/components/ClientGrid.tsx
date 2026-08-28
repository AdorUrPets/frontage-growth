"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Trash2 } from "lucide-react";
import type { ClientWithSite } from "@/lib/db/clients";

export function ClientGrid({ initialClients }: { initialClients: ClientWithSite[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This removes every crawl, finding, key, mission and change history stored for it. This can't be undone.`)) {
      return;
    }
    setDeletingId(id);
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  if (clients.length === 0) {
    return (
      <div className="fg-panel fg-panel-body">
        <p className="text-xs text-[var(--fg-text-dim)]">
          Add the first client website to initialise growth tracking for it.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => (
        <div key={c.id} className="fg-panel">
          <div className="fg-panel-header">
            <Link href={`/clients/${c.id}`} className="fg-panel-title min-w-0 flex-1 truncate">
              <Globe size={13} />
              {c.name}
            </Link>
            <button
              className="fg-btn fg-btn--danger !px-2 !py-1"
              onClick={() => handleDelete(c.id, c.name)}
              disabled={deletingId === c.id}
              title="Delete client"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <Link href={`/clients/${c.id}`} className="fg-panel-body block">
            <div className="flex flex-col gap-1 text-xs text-[var(--fg-text-dim)]">
              <span>{c.business_name ?? "—"}</span>
              <span className="truncate text-[var(--fg-text-faint)]">{c.site?.url ?? "no site"}</span>
              <span>{c.primary_location ?? ""}</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
