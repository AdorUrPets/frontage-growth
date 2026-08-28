// Google OAuth2 (Authorization Code flow, offline access for a refresh
// token) — Search Console today, Analytics Data API can reuse this exact
// module later (just add its scope to SCOPES).

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/userinfo.email"];

function getEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth isn't configured — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI in .env.local."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces a refresh_token even on re-auth
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  const { clientId, clientSecret, redirectUri } = getEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Google token exchange failed (HTTP ${res.status}).`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresIn: data.expires_in };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Google token refresh failed (HTTP ${res.status}). You may need to reconnect.`);
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Just for showing "connected as you@example.com" in the UI — not required
// for Search Console calls to work, so a failure here is never fatal.
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.email === "string" ? data.email : null;
  } catch {
    return null;
  }
}
