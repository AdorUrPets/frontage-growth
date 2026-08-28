import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/hud/Sidebar";
import { TopHeader } from "./components/hud/TopHeader";
import { getDb } from "@/lib/db/client";
import { listProviderHealth } from "@/lib/db/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Frontage — Growth Mission Control",
  description: "Autonomous SEO, organic traffic and customer acquisition system for Frontage clients.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const db = getDb();
  const activeMissionsCount = (
    db.prepare(`SELECT COUNT(*) as n FROM missions WHERE status IN ('running', 'awaiting_approval')`).get() as { n: number }
  ).n;
  const pendingApprovals =
    (db.prepare(`SELECT COUNT(*) as n FROM missions WHERE status = 'awaiting_approval'`).get() as { n: number }).n +
    (db.prepare(`SELECT COUNT(*) as n FROM seo_changes WHERE approval_id IS NULL`).get() as { n: number }).n;
  const health = listProviderHealth();
  const systemsOperational = health.every((h) => h.status !== "error");

  // Sidebar shortcuts deep-link into the panels that hold the real results,
  // so they land on actual data rather than a section placeholder.
  const primaryClientId =
    (
      db
        .prepare(
          `SELECT c.id FROM clients c
           LEFT JOIN sites s ON s.client_id = c.id
           LEFT JOIN missions m ON m.site_id = s.id
           GROUP BY c.id ORDER BY COUNT(m.id) DESC, c.created_at DESC LIMIT 1`
        )
        .get() as { id: string } | undefined
    )?.id ?? null;

  return (
    <html lang="en" className={inter.variable}>
      <body className="fg-grid-bg min-h-screen">
        <div className="fg-shell">
          <Sidebar
            activeMissionsCount={activeMissionsCount}
            systemsOperational={systemsOperational}
            primaryClientId={primaryClientId}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopHeader pendingApprovals={pendingApprovals} />
            <main className="mx-auto w-full max-w-[1720px] px-5 pb-14 pt-5">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
