# Demo Day Morning Runbook — Paradise Biryani

**Owner:** Founder running the demo
**Use this:** The morning of the call, top to bottom.
**Companion docs:** `TELEPHONY.md`, `TUNNELING.md`, `INCIDENT_RUNBOOK.md`.

If anything in this runbook fails — STOP and consult `INCIDENT_RUNBOOK.md`. Do not improvise.

---

## T-30 min — Boot the stack

1. Open a terminal in the repo root.
2. Confirm `.env` exists and has:
   - `ANTHROPIC_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `OLIVE_AGENT_TOKEN`
   - `NGROK_DOMAIN=olive-demo.ngrok.app` (or whatever was reserved)
3. Run:
   ```bash
   make demo
   ```
   This should bring up: backend (`:8787`), dashboard (`:5173`), and ngrok tunnel.
4. Verify in three browser tabs / panes:
   - `http://localhost:8787/healthz` → `{"ok": true}`
   - `http://localhost:5173` → Dashboard loads, "Live Orders" panel visible.
   - `http://localhost:4040` → ngrok inspector showing the tunnel is connected.
5. Verify ngrok shows the **stable domain** (not a random subdomain). If it's random, your `NGROK_DOMAIN` env var didn't load — fix before continuing.

**Checkpoint:** All three URLs respond. Tunnel is on the stable domain.

---

## T-25 min — Confirm ElevenLabs config

1. Open https://elevenlabs.io/app/conversational-ai in a browser.
2. Open the Olive agent.
3. Confirm the tool base URL is `https://olive-demo.ngrok.app` (matches `NGROK_DOMAIN`).
4. Confirm `X-Olive-Token` header matches `OLIVE_AGENT_TOKEN` in `.env`.
5. If anything is wrong → fix it, save, **re-test** before moving on.

**Checkpoint:** Agent base URL and token both match local env.

---

## T-20 min — End-to-end smoke call

1. Pick up a second phone (NOT the one the owner will call from).
2. Dial **574-626-6385**.
3. Walk through a real order. Suggested script:
   - "Hi, I'd like to place an order."
   - Order 1× chicken biryani (or whatever's in the seeded menu).
   - Add 1× garlic naan.
   - Let the agent read back the order. Confirm.
   - Hang up.
4. While the call runs, watch the dashboard:
   - "Live Call" panel should show streaming transcript.
   - "Live Orders" panel should show the new order appear and update line-by-line.
   - After `submit_order`, order moves to "Submitted" state with an order number + ETA.
5. Click **Mark Complete** on the order. Confirm it leaves the active list.

**Checkpoint:** All five behaviors above worked: greeting plays, menu fetches, order completes, dashboard shows it, Mark Complete works.

If any one of these failed → go to `INCIDENT_RUNBOOK.md` now. Do **not** proceed to the real call.

---

## T-15 min — Clean test orders (or don't)

Option A — clean DB:
```bash
pnpm --filter @olive/backend dev-tools clear-test-orders
```

Option B — keep them visible as "kitchen activity":
- Skip this step.
- The seeded/test orders give the dashboard a "live restaurant" feel during the demo instead of a sterile empty list.
- **Recommended if the test orders look plausible.** Discuss with co-founder beforehand.

**Checkpoint:** Decision made and executed.

---

## T-10 min — Stage the screen share

1. Open the call app (Zoom / Google Meet / whatever the owner is using).
2. Share the **dashboard window only** (not full screen — avoids leaking terminals / Slack / personal tabs).
3. Pin the dashboard window so it doesn't get hidden when notifications pop.
4. Mute system notifications: macOS → **Focus → Do Not Disturb**.
5. Position windows:
   - Dashboard: front and center for the screen share.
   - Terminal with backend logs: on your side, not shared.
   - ngrok inspector (`http://localhost:4040`): on your side, not shared.
   - ElevenLabs dashboard (call transcript view): on your side, not shared.

**Checkpoint:** Owner will see only the dashboard.

---

## T-5 min — Pre-warm

Cold starts will hurt latency on the first call of the day. Burn them on a throwaway call, not the owner's.

1. Dial **574-626-6385** from your second phone again.
2. Talk for ~30 seconds. Say a few menu items. Let the agent respond. Hang up.
3. This warms:
   - ElevenLabs agent session caches.
   - Deepgram (if on Plan B path).
   - Claude API connection pool.
   - SQLite page cache.
   - ngrok TCP connections.

After this, the owner's call will hit warm caches.

**Checkpoint:** Test call completed cleanly. Agent latency felt snappy.

---

## During the call

1. Owner dials **574-626-6385**. (Stage 2: owner dials the Twilio number we gave them.)
2. Founder narrates the dashboard:
   - "You can see the order coming in line by line as he speaks."
   - "There's the order number — that would print to your kitchen ticket printer in production."
3. Demonstrate the **86 toggle** at a natural pause:
   - "Watch this — if you run out of, say, chicken biryani in the middle of service…"
   - Click the 86 toggle on the dashboard.
   - "…the agent now knows. Anyone who orders it gets offered an alternative."
   - (Optional) Have your test phone call in to prove it.
4. Show **order completing**:
   - When the agent submits, click **Mark Complete** to simulate kitchen finishing.
   - "When your kitchen marks it done, the call log closes out and the dashboard goes green."

**Do not improvise demos that weren't in the smoke test.** If the owner asks about something we didn't build (SMS confirmation, payment, etc.), say "that's V1 — let me show you what's locked in for V0."

---

## After the call

1. Download the call transcript from ElevenLabs:
   - ElevenLabs dashboard → Conversational AI → **History** → find the call → **Download transcript**.
   - Or via API (see `agent/README.md`).
2. Archive into `agent/transcripts/YYYY-MM-DD-paradise-biryani.json`.
3. Stop the stack:
   ```bash
   make stop
   ```
   (Or Ctrl-C the `make demo` process.)
4. Write a 3-line post-demo note in `tasks/demo-log.md`:
   - What worked.
   - What broke or felt off.
   - One thing to improve before the next demo.
5. If owner agreed to V1 → kick off the Twilio number purchase (`TELEPHONY.md` §3) so we're not racing on Stage 2.

---

## Quick-reference timing

| When | Action | Done if |
|---|---|---|
| T-30 | `make demo` | All 3 URLs respond, tunnel on stable domain |
| T-25 | Verify ElevenLabs config | Base URL + token match |
| T-20 | Full smoke call | Order completes end-to-end, Mark Complete works |
| T-15 | Clear test orders (optional) | Decided |
| T-10 | Screen-share staged | Owner sees dashboard only |
| T-5 | Pre-warm call | Latency felt snappy |
| T-0 | Owner dials | Demo runs |
| Post | Archive transcript | File in `agent/transcripts/` |
