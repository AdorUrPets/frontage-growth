import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/integrations/googleAuth";
import { saveGoogleConnection } from "@/lib/db/googleAuth";

function safeReturnPath(state: string | null): string {
  // state is an in-app path we generated ourselves in /connect — but never
  // trust it blindly, only allow a same-app relative path.
  if (state && state.startsWith("/") && !state.startsWith("//")) return state;
  return "/settings/integrations/google";
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const backTo = origin + safeReturnPath(searchParams.get("state"));

  if (oauthError) {
    return NextResponse.redirect(`${backTo}?google=error&message=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${backTo}?google=error&message=${encodeURIComponent("Missing authorization code.")}`);
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      return NextResponse.redirect(
        `${backTo}?google=error&message=${encodeURIComponent("Google didn't return a refresh token — remove Frontage Growth's access in your Google Account's third-party app settings and try connecting again.")}`
      );
    }
    const email = await fetchGoogleEmail(accessToken);
    saveGoogleConnection(refreshToken, email);
    return NextResponse.redirect(`${backTo}?google=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google token exchange failed.";
    return NextResponse.redirect(`${backTo}?google=error&message=${encodeURIComponent(message)}`);
  }
}
