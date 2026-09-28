// v1 of the SEO-to-code writer only supports static-HTML checkouts — a site
// with no cms set, or an explicit "html"/"static" cms. Anything else (a
// framework, a CMS with generated markup) is declined rather than guessed at,
// since a wrong file match would silently corrupt a live client repo.

import fs from "fs";
import path from "path";

const STATIC_HTML_CMS_VALUES = new Set(["", "html", "static", "static-html", "static_html"]);

export function isStaticHtmlSite(cms: string | null): boolean {
  return cms === null || STATIC_HTML_CMS_VALUES.has(cms.trim().toLowerCase());
}

// Resolves a page's real on-disk HTML file inside repoLocalPath, or null if
// none of the conventional candidates exist. Every candidate is checked to
// still resolve inside repoLocalPath (defense against a pathname like
// "../../etc/passwd" ever reaching the filesystem).
export function resolveHtmlFile(repoLocalPath: string, pageUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    pathname = pageUrl.startsWith("/") ? pageUrl : `/${pageUrl}`;
  }
  pathname = pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  const repoRoot = path.resolve(repoLocalPath);
  const candidates =
    pathname === ""
      ? [path.join(repoRoot, "index.html")]
      : [
          pathname.endsWith(".html") ? path.join(repoRoot, pathname) : null,
          path.join(repoRoot, `${pathname}.html`),
          path.join(repoRoot, pathname, "index.html"),
        ].filter((c): c is string => c !== null);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const rel = path.relative(repoRoot, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue; // outside the repo — never touch it
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return null;
}
