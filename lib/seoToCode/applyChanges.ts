// The SEO-to-code writer (v1, static HTML only): takes seo_changes that a
// human has already approved via the existing approvals queue and have not
// yet been applied, edits the real files on disk, and commits locally —
// never pushes. Schema (JSON-LD) and other on-page copy are out of scope for
// v1; only title / meta_description / h1 are supported, matching what
// resolveHtmlFile + cheerio can safely target without guessing at markup.

import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { getDb, newId } from "../db/client";
import { isStaticHtmlSite, resolveHtmlFile } from "./htmlMapper";
import { stage, commit, currentHead, status as gitStatus } from "../git/localRepo";

export interface ApprovedChangeRow {
  id: string;
  page_id: string;
  page_url: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
}

interface SkippedChange {
  id: string;
  pageUrl: string;
  field: string;
  reason: string;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  applied: { id: string; pageUrl: string; field: string; file: string }[];
  skipped: SkippedChange[];
  commitSha?: string;
  deploymentId?: string;
}

const SUPPORTED_FIELDS = new Set(["title", "meta_description", "h1"]);

function applyFieldToDocument($: cheerio.CheerioAPI, field: string, value: string): boolean {
  if (field === "title") {
    const title = $("title").first();
    if (title.length === 0) return false;
    title.text(value);
    return true;
  }
  if (field === "meta_description") {
    let meta = $('meta[name="description"]').first();
    if (meta.length === 0) {
      const head = $("head").first();
      if (head.length === 0) return false;
      head.append(`<meta name="description">`);
      meta = $('meta[name="description"]').first();
    }
    meta.attr("content", value);
    return true;
  }
  if (field === "h1") {
    const h1 = $("h1").first();
    if (h1.length === 0) return false;
    h1.text(value);
    return true;
  }
  return false;
}

export async function applySeoChangesToCode(siteId: string): Promise<ApplyResult> {
  const db = getDb();
  const site = db.prepare(`SELECT id, cms, repo_local_path FROM sites WHERE id = ?`).get(siteId) as
    | { id: string; cms: string | null; repo_local_path: string | null }
    | undefined;
  if (!site) return { ok: false, error: "Site not found.", applied: [], skipped: [] };
  if (!site.repo_local_path) {
    return { ok: false, error: "This site has no repo_local_path configured yet.", applied: [], skipped: [] };
  }
  if (!isStaticHtmlSite(site.cms)) {
    return {
      ok: false,
      error: `SEO-to-code isn't supported for cms "${site.cms}" yet — static HTML only in this version.`,
      applied: [],
      skipped: [],
    };
  }

  const repoRoot = site.repo_local_path;
  let statusBefore: string;
  try {
    statusBefore = gitStatus(repoRoot);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), applied: [], skipped: [] };
  }
  if (statusBefore.trim().length > 0) {
    return {
      ok: false,
      error: "The repo checkout has uncommitted changes already — refusing to mix them with an automated commit. Clean or commit them first.",
      applied: [],
      skipped: [],
    };
  }

  const rows = db
    .prepare(
      `SELECT sc.id, sc.page_id, p.url as page_url, sc.field, sc.before_value, sc.after_value
       FROM seo_changes sc
       JOIN pages p ON p.id = sc.page_id
       JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
       WHERE p.site_id = ? AND ap.status = 'approved' AND sc.applied_at IS NULL
       ORDER BY sc.created_at ASC`
    )
    .all(siteId) as ApprovedChangeRow[];

  if (rows.length === 0) {
    return { ok: true, applied: [], skipped: [], error: undefined };
  }

  const applied: ApplyResult["applied"] = [];
  const skipped: SkippedChange[] = [];
  const touchedFiles = new Map<string, string>(); // absolute path -> relative path

  // Group by file so multiple field edits to the same page's file only load/save it once.
  const byFile = new Map<string, ApprovedChangeRow[]>();
  const unresolved: { row: ApprovedChangeRow; reason: string }[] = [];

  for (const row of rows) {
    if (!SUPPORTED_FIELDS.has(row.field)) {
      unresolved.push({ row, reason: `Field "${row.field}" isn't supported by the static-HTML writer yet.` });
      continue;
    }
    if (typeof row.after_value !== "string" || row.after_value.length === 0) {
      unresolved.push({ row, reason: "No after_value to apply." });
      continue;
    }
    const file = resolveHtmlFile(repoRoot, row.page_url);
    if (!file) {
      unresolved.push({ row, reason: `No matching HTML file found on disk for ${row.page_url}.` });
      continue;
    }
    const list = byFile.get(file) ?? [];
    list.push(row);
    byFile.set(file, list);
  }

  for (const { row, reason } of unresolved) {
    skipped.push({ id: row.id, pageUrl: row.page_url, field: row.field, reason });
  }

  for (const [file, changes] of byFile) {
    const original = fs.readFileSync(file, "utf-8");
    const $ = cheerio.load(original);
    let anyApplied = false;

    for (const row of changes) {
      const okApplied = applyFieldToDocument($, row.field, row.after_value as string);
      if (okApplied) {
        applied.push({ id: row.id, pageUrl: row.page_url, field: row.field, file: path.relative(repoRoot, file) });
        anyApplied = true;
      } else {
        skipped.push({ id: row.id, pageUrl: row.page_url, field: row.field, reason: `Could not find a "${row.field}" element to edit in this file.` });
      }
    }

    if (anyApplied) {
      fs.writeFileSync(file, $.html(), "utf-8");
      touchedFiles.set(file, path.relative(repoRoot, file));
    }
  }

  if (applied.length === 0) {
    return { ok: true, applied: [], skipped, error: undefined };
  }

  const previousHead = currentHead(repoRoot);
  const relFiles = Array.from(touchedFiles.values());

  try {
    stage(repoRoot, relFiles);
    const summaryLines = applied.map((a) => `- ${a.field} on ${a.pageUrl} (${a.file})`).join("\n");
    const message =
      `Frontage Growth: apply ${applied.length} approved SEO change(s)\n\n${summaryLines}\n\n` +
      `Local commit only — not pushed. Pushing is a separate, human-authorized step in Pentest Mission Control.\n\n` +
      `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`;
    const sha = commit(repoRoot, message);

    const depId = newId();
    db.prepare(
      `INSERT INTO deployments (id, site_id, adapter, status, summary, rollback_ref, deployed_at)
       VALUES (?, ?, 'git', 'committed', ?, ?, datetime('now'))`
    ).run(depId, siteId, `${applied.length} SEO change(s) committed locally (${sha.slice(0, 8)}).`, previousHead);

    const updateStmt = db.prepare(`UPDATE seo_changes SET applied_at = datetime('now'), deployment_id = ? WHERE id = ?`);
    const tx = db.transaction(() => {
      for (const a of applied) updateStmt.run(depId, a.id);
    });
    tx();

    return { ok: true, applied, skipped, commitSha: sha, deploymentId: depId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), applied, skipped };
  }
}
