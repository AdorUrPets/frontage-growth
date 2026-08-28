import Link from "next/link";
import { listClients } from "@/lib/db/clients";
import { ClientGrid } from "./components/ClientGrid";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const clients = listClients(q);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--fg-text)]">Clients</h1>
          <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
            {q ? `Matching "${q}" — ${clients.length} result(s).` : "Every website Frontage Growth manages post-sale."}
          </p>
        </div>
        <Link href="/clients/new" className="fg-btn fg-btn--primary">
          <Plus size={14} /> Add Client
        </Link>
      </div>

      <ClientGrid initialClients={clients} />
    </div>
  );
}
