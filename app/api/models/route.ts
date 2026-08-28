import { NextResponse } from "next/server";
import { listModels, upsertModel, setModelEnabled, removeModel } from "@/lib/db/providers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? undefined;
  return NextResponse.json({ models: listModels(provider) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const providerCode = typeof body.providerCode === "string" ? body.providerCode : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  if (!providerCode || !modelId) {
    return NextResponse.json({ error: "providerCode and modelId are required." }, { status: 400 });
  }
  upsertModel({
    providerCode,
    modelId,
    displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
    useCase: typeof body.useCase === "string" ? body.useCase.trim() : undefined,
    priority: typeof body.priority === "number" ? body.priority : undefined,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (typeof body.enabled === "boolean") setModelEnabled(body.id, body.enabled);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  removeModel(id);
  return NextResponse.json({ ok: true });
}
