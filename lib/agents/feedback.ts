import { getDb } from "../db/client";

interface DecidedChange {
  field: string;
  after_value: string | null;
  status: string;
  summary: string | null;
  decided_at: string | null;
}

// Every AI-reasoning agent calls this before proposing anything new. It's
// the concrete, bounded form of "learning" this system uses: agents don't
// act with more freedom over time, they just see what the operator actually
// approved or rejected last time and are told not to repeat rejected
// patterns. No model weights change, no autonomous behavior — just better
// input built from real decisions already on record.
export function getFeedbackContext(siteId: string): string {
  const db = getDb();
  const changes = db
    .prepare(
      `SELECT sc.field, sc.after_value, ap.status, ap.summary, ap.decided_at
       FROM seo_changes sc
       JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
       WHERE sc.page_id IN (SELECT id FROM pages WHERE site_id = ?) AND ap.status IN ('approved', 'rejected')
       ORDER BY ap.decided_at DESC LIMIT 25`
    )
    .all(siteId) as DecidedChange[];

  if (changes.length === 0) return "";

  const approved = changes.filter((c) => c.status === "approved");
  const rejected = changes.filter((c) => c.status === "rejected");

  const lines: string[] = [];
  if (approved.length > 0) {
    lines.push("Previously APPROVED by the operator (this style/approach worked — lean into it):");
    for (const c of approved.slice(0, 10)) lines.push(`  - ${c.field}: "${c.after_value}"`);
  }
  if (rejected.length > 0) {
    lines.push("Previously REJECTED by the operator (do NOT repeat this pattern):");
    for (const c of rejected.slice(0, 10)) lines.push(`  - ${c.field}: "${c.after_value}"${c.summary ? ` — reason given: ${c.summary}` : ""}`);
  }
  return lines.join("\n");
}
