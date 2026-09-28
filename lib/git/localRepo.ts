// Local-only git wrapper for the SEO-to-code writer — status/diff/stage/commit,
// nothing that touches a remote. Modeled on pentest-agent's discipline of a
// local-commit boundary with push handled entirely elsewhere (by a human, in
// pentest-mission-control's single gated Authorize-push action).

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export class LocalRepoError extends Error {}

function assertRealRepo(repoPath: string): void {
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new LocalRepoError(`Repo path does not exist: ${repoPath}`);
  }
  if (!fs.existsSync(path.join(repoPath, ".git"))) {
    throw new LocalRepoError(`Not a git repository (no .git found): ${repoPath}`);
  }
}

function git(repoPath: string, args: string[]): string {
  assertRealRepo(repoPath);
  try {
    return execFileSync("git", args, { cwd: repoPath, encoding: "utf-8", timeout: 30000 });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detail = err.stderr ? err.stderr.toString() : err.message ?? String(e);
    throw new LocalRepoError(`git ${args.join(" ")} failed: ${detail}`);
  }
}

export function status(repoPath: string): string {
  return git(repoPath, ["status", "--porcelain"]);
}

export function diff(repoPath: string): string {
  return git(repoPath, ["diff"]);
}

export function currentHead(repoPath: string): string | null {
  try {
    return git(repoPath, ["rev-parse", "HEAD"]).trim();
  } catch {
    return null; // no commits yet
  }
}

// Stages only the specific real files that were actually edited — never a
// blanket `git add .`, so nothing unrelated in a client's working tree can
// ride along on this commit.
export function stage(repoPath: string, relativeFilePaths: string[]): void {
  if (relativeFilePaths.length === 0) return;
  for (const rel of relativeFilePaths) {
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new LocalRepoError(`Refusing to stage a path outside the repo: ${rel}`);
    }
  }
  git(repoPath, ["add", "--", ...relativeFilePaths]);
}

export function commit(repoPath: string, message: string): string {
  git(repoPath, ["commit", "-m", message]);
  const sha = currentHead(repoPath);
  if (!sha) throw new LocalRepoError("Commit appeared to succeed but HEAD could not be resolved.");
  return sha;
}
