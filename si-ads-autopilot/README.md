# SI Ads Autopilot

An AI media buyer for Meta (Facebook/Instagram) Ads: automated monitoring,
a no-code rule engine, and layered safety guardrails on top of the Meta
Marketing API. Built with Next.js 16 (App Router), TypeScript, Prisma 7 +
PostgreSQL, BullMQ + Redis, and NextAuth.

This lives alongside the existing ATMO Commission System (the Flask app at
the repo root) as an independent project — nothing outside this directory
was touched.

## What's real vs. not yet built

Every number this app shows comes from a real Meta Graph API sync stored in
Postgres — there is no mock/fixture ad data anywhere, by design (see
`src/services/meta/capabilities.ts` for the one feature the adapter
currently can't do — hourly ad-set dayparting schedules — and how it's
surfaced as unavailable rather than faked).

**Fully implemented, end-to-end:**
- Meta OAuth connection, sync (campaigns/ad sets/ads/creatives + daily and
  trailing-7-day hourly insights), and adapter-layer writes (pause/resume,
  budget edit, duplicate, schedule start/end)
- No-code automation rule engine (IF/AND/THEN) with a rule builder UI
- Safety guardrails: spend/budget caps, cooldowns, rate limits, kill switch,
  data-freshness gating, idempotency keys — all enforced server-side before
  any Meta API write
- ROAS Guard, Smart Scaling settings, Winner scoring formulas
  (`src/services/automation/winnerScore.ts`)
- AI Command Center action feed, Campaign Explorer (tree + quick actions),
  Budget Control Center, Dayparting heatmap, Tracking Health, Creative
  Performance + fatigue detection, Audience Discovery (heuristic candidates
  verified against Meta's real targeting-search endpoint), Alerts, Daily
  Reports, Activity Log (audit trail), Settings (members/roles, product
  economics/profit formulas), 6-step onboarding wizard
- Background workers (BullMQ) for sync / rule evaluation / alerts / daily
  report generation, decoupled from the web process (`src/workers/`)

**Not built in this pass** (routes exist for everything that is built; there
are no dead links, but these specific spec items are out of scope for now):
- A dedicated Winner Detection page with 🔥/✅/🟡/🔴 badges (the scoring
  function exists and is used by the daily report; it isn't surfaced as its
  own screen)
- Audience Testing Lab (test-matrix budget planner)
- Simulation Mode summary screen and Rule Backtesting (SIMULATED actions are
  logged and visible in the Action Feed; the "replay last N days" backtest
  UI itself isn't built)
- Free-form AI Insights chat assistant (the daily report's winners/losers
  are real, grounded numbers; there's no conversational Q&A panel)
- Actual Email/LINE/Slack/Telegram alert delivery (alerts are modeled with
  a `channels` field and shown in-app; only in-app delivery is wired up)

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npx prisma migrate dev --name init
npm run db:seed        # creates the first Owner login
npm run dev
```

Sign in with the seeded owner account, then either:
- Go to **Settings → Connect Meta Account** (requires `META_APP_ID` /
  `META_APP_SECRET` in `.env`, from a Meta app with the Marketing API
  product and `http://localhost:3000/api/meta/oauth/callback` registered
  as a valid OAuth redirect), or
- Explore the UI with an empty workspace — every page explicitly says when
  there's no data yet rather than showing anything fabricated.

Run the background workers (needs Redis):

```bash
npm run worker        # one-shot
npm run worker:dev    # restarts on file change
```

## Project layout

- `src/services/meta/` — the Meta API adapter layer (`adapter.ts`,
  `client.ts` for retry/rate-limit handling, `capabilities.ts` for what's
  available vs. not, `sync.ts` for the DB sync)
- `src/services/automation/` — metrics, the rule engine, safety guardrails,
  idempotency, and the execute/evaluate pipeline
- `src/services/economics/`, `src/services/analytics/`,
  `src/services/creative/`, `src/services/audience/`, `src/services/budget/`,
  `src/services/reports/`, `src/services/alerts/` — one module per feature
  area, each with a disclosed formula (see code comments) instead of a
  black-box number
- `src/workers/` — BullMQ queue/worker definitions, run as a separate
  process from the Next.js server
- `prisma/schema.prisma` — full data model
