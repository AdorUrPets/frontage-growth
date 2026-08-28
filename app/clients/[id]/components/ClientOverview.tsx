"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "../../../components/hud/Panel";
import { Pencil, Trash2, Save, X, Eraser } from "lucide-react";
import type { ClientWithSite } from "@/lib/db/clients";

export function ClientOverview({ client: initial }: { client: ClientWithSite }) {
  const router = useRouter();
  const [client, setClient] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(client.name);
  const [businessName, setBusinessName] = useState(client.business_name ?? "");
  const [primaryLocation, setPrimaryLocation] = useState(client.primary_location ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(client.site?.url ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");

  function startEdit() {
    setName(client.name);
    setBusinessName(client.business_name ?? "");
    setPrimaryLocation(client.primary_location ?? "");
    setWebsiteUrl(client.site?.url ?? "");
    setNotes(client.notes ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessName, primaryLocation, websiteUrl, notes }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save changes.");
      return;
    }
    setClient(data.client);
    setEditing(false);
    router.refresh();
  }

  async function clearReports() {
    if (
      !window.confirm(
        `Clear all reports and findings for "${client.name}"? This deletes every crawl, finding, keyword, content draft, mission and business profile on file for this site — it can't be undone. The site connection itself (URL, Search Console) is kept, and you can rescan from scratch afterwards.`
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    const res = await fetch(`/api/clients/${client.id}/reset`, { method: "POST" });
    setClearing(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to clear reports and findings.");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${client.name}"? This removes every crawl, finding, key, mission and change history stored for it. This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/clients");
      router.refresh();
    } else {
      setDeleting(false);
      setError("Failed to delete client.");
    }
  }

  return (
    <Panel
      title="Overview"
      right={
        editing ? (
          <div className="flex gap-2">
            <button className="fg-btn" onClick={() => setEditing(false)} disabled={saving}>
              <X size={13} /> Cancel
            </button>
            <button className="fg-btn fg-btn--primary" onClick={save} disabled={saving}>
              <Save size={13} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="fg-btn" onClick={startEdit}>
              <Pencil size={13} /> Edit
            </button>
            {client.site ? (
              <button className="fg-btn" onClick={clearReports} disabled={clearing}>
                <Eraser size={13} /> {clearing ? "Clearing…" : "Clear Reports & Findings"}
              </button>
            ) : null}
            <button className="fg-btn fg-btn--danger" onClick={remove} disabled={deleting}>
              <Trash2 size={13} /> {deleting ? "Deleting…" : "Delete Client"}
            </button>
          </div>
        )
      }
    >
      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}

      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="fg-field-label">Client Name</label>
              <input className="fg-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="fg-field-label">Website URL</label>
              <input className="fg-input" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </div>
            <div>
              <label className="fg-field-label">Business Name</label>
              <input className="fg-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <label className="fg-field-label">Primary Location</label>
              <input className="fg-input" value={primaryLocation} onChange={(e) => setPrimaryLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="fg-field-label">Notes</label>
            <textarea className="fg-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <div className="fg-field-label">Business Name</div>
              <div className="text-[var(--fg-text)]">{client.business_name ?? "—"}</div>
            </div>
            <div>
              <div className="fg-field-label">Primary Location</div>
              <div className="text-[var(--fg-text)]">{client.primary_location ?? "—"}</div>
            </div>
            <div>
              <div className="fg-field-label">Status</div>
              <div className="text-[var(--fg-text)]">{client.status}</div>
            </div>
            <div>
              <div className="fg-field-label">Added</div>
              <div className="text-[var(--fg-text)]">{new Date(client.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          {client.notes ? <p className="mt-4 text-xs text-[var(--fg-text-dim)]">{client.notes}</p> : null}
        </>
      )}
    </Panel>
  );
}
