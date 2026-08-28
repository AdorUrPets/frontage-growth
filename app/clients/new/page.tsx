"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "../../components/hud/Panel";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessName, websiteUrl, primaryLocation, notes }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add client.");
      return;
    }
    router.push(`/clients/${data.client.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <Panel title="Add Client">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="fg-field-label">Client Name *</label>
            <input className="fg-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="fg-field-label">Website URL *</label>
            <input
              className="fg-input"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.co.nz"
              required
            />
          </div>
          <div>
            <label className="fg-field-label">Business Name</label>
            <input className="fg-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div>
            <label className="fg-field-label">Primary Location</label>
            <input
              className="fg-input"
              value={primaryLocation}
              onChange={(e) => setPrimaryLocation(e.target.value)}
              placeholder="Tauranga, NZ"
            />
          </div>
          <div>
            <label className="fg-field-label">Notes</label>
            <textarea className="fg-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <p className="text-xs text-[var(--fg-red)]">{error}</p> : null}
          <button type="submit" className="fg-btn fg-btn--primary" disabled={submitting}>
            {submitting ? "Adding…" : "Initialise Growth System"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
