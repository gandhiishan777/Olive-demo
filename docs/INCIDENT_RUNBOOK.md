# Incident Runbook — Mid-Demo Recovery

**Owner:** Founder on the call
**Use this:** Something just broke during a live owner demo. Don't panic. Find the matching scenario, say the line, do the silent fix.

## Operating principles

1. **Never break the fourth wall.** Don't say "ngrok died" or "our backend crashed." Owners don't care; they want to know if the product works.
2. **Calm narration buys ~20 seconds.** Use it.
3. **Always have a Plan B on screen.** If voice dies, pivot to dashboard. If both die, talk through architecture.
4. **Don't argue with the owner about facts on the call.** Whatever they said happened, happened. Fix it in the DB after; do not relitigate live.
5. **One person speaks, one person fixes.** If two founders are on the call, designate the speaker and the silent fixer up front.

---

## Scenario 0 — Supabase unreachable

**Symptom:** Backend logs `connect ETIMEDOUT` / `ENOTFOUND` to `*.supabase.com`. `curl /healthz` → `503`. Agent gets 5xx on every tool call.

**Say to owner:**
> "Apologies, we're seeing a quick database hiccup. Give me one second."

**Do silently:**
1. Check WiFi/internet (any other site loading?).
2. `curl -s https://supabase.com >/dev/null && echo ok || echo down` — quick reachability.
3. Open https://status.supabase.com — confirm it's not Supabase's outage.
4. **If your network is the problem:** switch to phone hotspot. Restart `pnpm backend`.
5. **If Supabase is actually down (rare):** there's no fix. Pivot — "While that comes back, let me walk you through the architecture / show you the dashboard view." Demo turns into a walkthrough; reschedule the live call.

**Prevention:** `make smoke` at T-5 minutes catches this before the owner dials.

**Recovery time:** 15s if it's network. 5+ minutes if it's Supabase (basically: postpone).

---

## Scenario 1 — Backend crashed

**Symptom:** Agent says "let me get a team member" / tool calls return 5xx / dashboard "Live Orders" stops updating.

**Say to owner:**
> "Give me one second — our system just hiccupped, this is exactly the kind of thing we instrument for."

**Do silently:**
1. New terminal in the repo root.
2. `pnpm backend` (or whatever the package script is — `pnpm --filter @olive/backend dev`).
3. Wait for `Listening on :8787`.
4. Dashboard should reconnect via SSE automatically; if not, refresh the dashboard tab.
5. Ask the owner to redial if the call dropped. "Mind giving it one more try?"

**Recovery time:** ~15 seconds.

---

## Scenario 2 — ngrok tunnel dropped

**Symptom:** Agent tool calls 502 / 404. Backend logs show no requests during the call. ngrok inspector (`http://localhost:4040`) page won't load.

**Say to owner:**
> "Let me reconnect quickly — give me about 10 seconds."

**Do silently:**
1. `make tunnel`
2. Because we use the **stable `--domain=olive-demo.ngrok.app`**, the URL is the same. **No need to re-paste anything into ElevenLabs.**
3. Verify `http://localhost:4040` loads again.
4. Ask owner to redial.

**Recovery time:** ~10 seconds.

**If you're on free-tier ngrok and the URL changed:** you now have ~30 seconds of paste-and-save work in the ElevenLabs dashboard. This is why we recommend paid. If this happens, switch the demo to a dashboard walkthrough (Scenario 4 pivot) and come back to the live call at the end.

---

## Scenario 3 — Agent took the wrong item

**Symptom:** Agent confirms "1 chicken biryani" but owner said "1 chicken 65." Or quantity is off. Or an extra item slipped in.

**Say to owner:**
> "Good catch — let me correct that with our team. In production this is what the dashboard's edit flow handles."

**Do silently:**
1. **Do NOT argue on the call.** Don't say "actually the agent heard you say…" even if you think it did.
2. On dashboard: click the order → **Edit** → fix the item.
3. Or directly in DB if dashboard edit isn't wired:
   ```bash
   pnpm --filter @olive/backend dev-tools fix-order --id=<order_id>
   ```
4. After the demo, log the misrecognition into `agent/transcripts/misrecognitions.md`. Real signal for Phase 2 noise tuning.

**Why this matters:** Owners are evaluating whether they can trust the system. The right move is "we caught it and fixed it" — not "the agent was right." Even if the agent was right.

---

## Scenario 4 — ElevenLabs outage

**Symptom:** Calls don't connect. ElevenLabs dashboard shows errors. Confirm at https://status.elevenlabs.io.

**Say to owner:**
> "Looks like our voice provider is having a moment — happens to all of them. We can also show you the dashboard side, which is what your staff would actually be using during service."

**Do silently:**
1. Pivot to dashboard walkthrough:
   - Show the menu management panel.
   - Toggle 86 on an item, show how it persists.
   - Manually create a fake order via the test script:
     ```bash
     pnpm --filter @olive/backend dev-tools fake-order
     ```
   - Walk through the order lifecycle, Mark Complete, etc.
2. If outage is short (<10 min) — at end of demo, ask: "Want to try the live call one more time before we wrap?"
3. If outage is long — wrap with: "I'll send you a recording of the voice flow we ran this morning. Want to schedule a follow-up live call this week?"

**Why this works:** The demo isn't binary on voice. The dashboard alone is a real product surface. Show it confidently.

---

## Scenario 5 — Owner orders an 86'd item

**Symptom:** Owner says "I'll have the chicken biryani" but you toggled it 86 earlier in the demo (or it was 86'd in the seed data).

**Expected behavior:** Agent should apologize and offer an alternative. This is a feature, not a bug.

**Say to owner (if agent handled it well):**
> "Notice how it didn't take an order for something you're out of? That's the 86 toggle in action."

**Say to owner (if agent fumbled):**
> "Good — that's actually exactly the edge case we instrument for. The 86 logic is enforced server-side too, so even if the agent fumbles, the order never gets created."

**Do silently:**
- If agent took the order anyway (bug): backend should have returned `409 item_out_of_stock` and order should be in a `rejected` state, not `submitted`. Verify in the dashboard. If it's actually in `submitted`, you have a real bug — file it post-demo.

**Sanity script (test before demo to confirm this works):**
1. 86 a known item.
2. Call 574-626-6385.
3. Order the 86'd item.
4. Expected: agent says "I'm sorry, we're out of X today — can I offer Y?"
5. Confirm in backend logs: `get_menu` returned the item with `available: false` OR `create_order/add_item` got `409`.

If this doesn't pass on demo morning — disable the 86 demonstration in the script. Don't show what you can't guarantee.

---

## Scenario 6 — Owner asks "wait, was that AI?"

Not an incident, but a script moment.

**Say:**
> "Yes — every word. It's running on the same kind of voice tech you use when you talk to a smart speaker, but tuned for restaurant ordering. The dashboard you're watching is what your floor manager would use in real time."

Do NOT say "ChatGPT" / "Claude" / "ElevenLabs" by name unless the owner asks. Owners care about outcomes, not vendors.

---

## Scenario 7 — Total failure (everything is down)

**Symptom:** Backend won't start, ngrok won't connect, ElevenLabs is down, network is dead.

**Say to owner:**
> "I'm going to be straight with you — we're hitting a perfect storm right now. Rather than waste your time, can we reschedule for [tomorrow / this afternoon]? When we do this again I'll have a recording ready as backup."

**Do:**
1. End the call gracefully. Don't drag out a broken demo.
2. After: own the failure in writing within 1 hour. Short, direct, no blaming vendors.
3. Re-run the demo prep checklist (`SETUP_DEMO.md`) from scratch before the reschedule. Find the root cause; don't just hope.

**Don't:**
- Try to recover for more than ~90 seconds in front of the owner.
- Apologize more than once.
- Blame vendors by name.

---

## Pre-demo checklist for incidents

Before the call, confirm you have **two terminal windows ready**:

| Window | Purpose |
|---|---|
| 1 | `make demo` is running here |
| 2 | Empty, in repo root, ready to run `pnpm backend` or `make tunnel` |

And these browser tabs **not shared**, but open on your side:

- `http://localhost:4040` (ngrok inspector)
- `http://localhost:5173` (dashboard)
- ElevenLabs Conversational AI dashboard (call history view)
- https://status.elevenlabs.io
- https://status.twilio.com (once on Stage 2)

If any of those isn't open, open it now. You will not have time to find URLs mid-incident.
