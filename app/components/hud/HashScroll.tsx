"use client";

import { useEffect } from "react";

/**
 * Most result panels on the client page render only after their data has
 * been fetched client-side, so a `#anchor` arriving from the dashboard has
 * nothing to scroll to at navigation time and the browser silently does
 * nothing. This waits for the target to actually exist, then scrolls to it
 * and gives it a brief highlight so it's obvious what you were sent to.
 */
export function HashScroll({ timeoutMs = 8000 }: { timeoutMs?: number }) {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    let settled = false;
    const started = Date.now();

    const tryScroll = () => {
      if (settled) return;
      const el = document.getElementById(hash);
      if (el) {
        settled = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("fg-anchor-flash");
        window.setTimeout(() => el.classList.remove("fg-anchor-flash"), 2000);
        observer.disconnect();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        settled = true;
        observer.disconnect();
      }
    };

    // Panels appear as their fetches resolve — watch the tree rather than polling.
    const observer = new MutationObserver(tryScroll);
    observer.observe(document.body, { childList: true, subtree: true });
    tryScroll();

    return () => observer.disconnect();
  }, [timeoutMs]);

  return null;
}
