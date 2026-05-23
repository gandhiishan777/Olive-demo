# Olive V0 — Build Plan

Source: [BUILD_SPEC.md](../BUILD_SPEC.md)
Owner: Claude (CEO + founding engineer for this build)
Sprint: 2 weeks
North star: Paradise Biryani owner calls a phone number, places a real order, sees it in the dashboard, says "yeah, this could work."

---

## Phase 0 — Plan & approve (pre-code) ← we are here

- [x] Web-research voice stack (May 2026)
- [ ] Write `docs/STACK_DECISION.md` (stack + rationale)
- [ ] Write `docs/API_CONTRACT.md` (REST + agent tool mapping)
- [ ] **GATE: user approves stack + contract before any code is written**

## Phase 1 — Vertical slice (Days 1–3)

Goal: founders can dial **574-626-6385**, place an order against the placeholder menu, see it appear in the dashboard.

- [ ] Scaffold monorepo (pnpm workspaces: `backend/`, `dashboard/`, `agent/`, `seed/`)
- [ ] `.env.example` listing every key
- [ ] Backend (SQLite + Hono) with all endpoints from contract
- [ ] Placeholder menu seed (8–10 Indian items, with 1–2 pre-86'd)
- [ ] Dashboard SPA: live orders + menu/86 toggle + (optional) live transcript
- [ ] SSE stream for live dashboard updates
- [ ] ElevenLabs agent config (`agent/system_prompt.md` + `agent/tools.json`)
- [ ] ngrok wired; ElevenLabs temp number reaches local backend
- [ ] Manual call test: order → dashboard → done

## Phase 2 — Depth & robustness (Days 4–10)

- [ ] Menu ingest pipeline (text / JSON / CSV / photo via vision)
- [ ] `npm run seed:menu /path/to/menu.json` one-command swap
- [ ] Allergen / ingredient / spice-level / prep-time Q&A flows tested
- [ ] Mid-order modification flows tested (delete, change quantity, modifiers)
- [ ] Read-back-before-submit hardened
- [ ] 86 toggle propagates to agent within 5s (webhook + agent menu refresh tool)
- [ ] Rate limits & safety rails (max call length, max tokens/turn)
- [ ] Noise test harness: kitchen, TV, driving, background-voice samples
- [ ] Tune VAD + endpointing against noise samples until ≥85% order accuracy

## Phase 3 — Demo polish (Days 11–14)

- [ ] Swap to Twilio number (when account is ready) — config change only
- [ ] Real Paradise Biryani menu loaded
- [ ] `make demo` single-command stack start
- [ ] Dashboard visual polish (cream + burgundy)
- [ ] Code review pass (own work) + security review
- [ ] 10 consecutive call test without restart
- [ ] README setup instructions Ryan can follow without me

## Definition of Done

Mirror of the spec's DoD checklist. Every box must be green before declaring demo-ready.

---

## Lessons (updated as we go)

(captured to `tasks/lessons.md` after corrections)
