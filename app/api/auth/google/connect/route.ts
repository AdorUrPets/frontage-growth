import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/integrations/googleAuth";

// One Google login, reusable across every client — not tied to a specific
// site. `returnTo` (a path within this app) travels through as the OAuth
// `state` param so the callback knows where to send the operator back.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("returnTo") || "/settings/integrations/google";

  try {
    const url = getGoogleAuthUrl(returnTo);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to build Google auth URL." }, { status: 500 });
  }
}
