import { getDb, newId } from "./client";

export interface ApprovalRow {
  id: string;
  site_id: string;
  category: string;
  subject_type: string;
  subject_id: string;
  summary: string | null;
  status: string;
  decided_at: string | null;
  decided_by: string | null;
}

export function getApprovalFor(subjectType: string, subjectId: string): ApprovalRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM approvals WHERE subject_type = ? AND subject_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(subjectType, subjectId) as ApprovalRow | undefined;
  return row ?? null;
}

export function decide(input: {
  siteId: string;
  category: string;
  subjectType: string;
  subjectId: string;
  status: "approved" | "rejected";
  summary?: string;
}): ApprovalRow {
  const db = getDb();
  const existing = getApprovalFor(input.subjectType, input.subjectId);
  const id = existing?.id ?? newId();

  if (existing) {
    db.prepare(`UPDATE approvals SET status = ?, summary = ?, decided_at = datetime('now'), decided_by = 'operator' WHERE id = ?`).run(
      input.status,
      input.summary ?? existing.summary,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO approvals (id, site_id, category, subject_type, subject_id, summary, status, decided_at, decided_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'operator')`
    ).run(id, input.siteId, input.category, input.subjectType, input.subjectId, input.summary ?? null, input.status);
  }

  return getApprovalFor(input.subjectType, input.subjectId)!;
}
