# Frontage Growth

Internal tool for Frontage — SEO, organic traffic and customer acquisition mission control for
every client website after it's built and sold. Not a CRM, not a lead-gen tool (those already
exist) — this starts *after* the sale. Sibling app to `A:\lead-finder`, same stack and
conventions. Runs locally on your own machine.

## Status

AI provider infrastructure (Ollama/Gemini/OpenRouter/SerpApi key vault, model registry, routing
rules, health board), the full SEO/Traffic/Content approval-gated protocol pipeline, Google Search
Console, and Shopify publishing are all live. See `Settings → AI Models` for provider status, and
any nav section marked "isn't built yet" for what's still ahead (Google Analytics, non-Shopify
publishing, conversion tracking, social auto-posting).

## One-time setup

```
npm install
npm run dev
```

Open http://localhost:3920. The SQLite database (`frontage-growth.db`) and a
`FRONTAGE_GROWTH_MASTER_KEY` are created automatically on first run (see `.env.local`) — back that
key up somewhere safe, it encrypts every stored provider API key.

Add your Gemini / OpenRouter / SerpApi keys from **Settings → AI Models** (not `.env.local` — that
file only holds an optional fallback pool, same `PRIMARY` / `_BACKUP` / `_KEYS` convention as
`lead-finder`). Ollama is auto-discovered from `http://localhost:11434` if you have `ollama serve`
running locally — no key needed.

## How it's organized

- `lib/db/` — SQLite schema and per-domain query modules.
- `lib/crypto/vault.ts` — AES-256-GCM encryption for stored provider keys, Google/Shopify tokens.
- `lib/ai/` — provider clients (Ollama/Gemini/OpenRouter/SerpApi), the key-pool rotation layer, and
  the central `routeTask(taskType, messages)` router every agent calls.
- `lib/agents/` — the 18 implemented specialist agents; `lib/missions/runner.ts` drives the
  protocol pipeline (SEO/Traffic/Content) and standalone on-demand agents.
- `lib/integrations/` — Google OAuth/Search Console and Shopify OAuth/Admin API.
- `app/settings/ai-models/` — key vault, model registry, routing editor, usage log, health board.
