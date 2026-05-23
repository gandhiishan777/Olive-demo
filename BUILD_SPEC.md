# Olive V0 — Build Prompt for Claude Code

You are the technical lead and CEO for shipping the V0 demo of **Olive**, an AI voice agent for independent restaurants. You have unlimited usage, unlimited subagents, and full autonomy over scope, architecture, and execution. Treat this as a 2-week sprint and ship aggressively.

---

## The Mission (read this twice before doing anything)

We have a verbal pilot commitment from **Paradise Biryani** — a 5-location Bay Area Indian restaurant chain. The owner said: *"Show me a demo and I'll test if it's good enough."*

**Demo conditions you are building for:**
- The owner will call a real Twilio phone number from his phone
- He will speak with the AI voice agent ("Olive") in real time
- He may be in a noisy kitchen, in his car, or somewhere with background TV/music
- He will ask about menu items, place a real order with modifiers, change his mind mid-order, and expect Olive to handle it without sounding like a corporate IVR
- He will be evaluating on **3 hard criteria** he explicitly stated:
  1. **Real-world noise handling** — kitchen sounds, TV, driving, background voices. This is non-negotiable. A demo that works only in a quiet office FAILS.
  2. **Menu knowledge depth** — must know ingredients, spice levels, allergens, prep times. Not just item names.
  3. **Order placement that actually completes** — not a deflection to online ordering. The order ends inside the POS, ready for the kitchen.

**What this demo is NOT:**
- Not a production system at scale
- Not multi-tenant
- Not a real Toast POS integration (we don't have API credentials yet)
- Not a full dashboard product
- Not a marketing site

**What this demo MUST be:**
- A live phone number the owner can call
- A voice agent that sounds human and handles the full ordering flow
- A simulated POS ("Toast clone") that proves the architecture works
- A simple dashboard showing orders flow in real time (for the screen-share moment during the demo)
- Robust enough to survive a 5–10 minute call with realistic noise
- Demoable repeatedly without breaking

---

## Constraints & Environment

- **Runs on local machine** (Ryan's laptop). Twilio will need a public URL — use ngrok or Cloudflare Tunnel for inbound webhooks.
- **Pick the most pragmatic stack** for 2 weeks of work. Bias toward what gets to a working phone call fastest. Justify your choice in the README.
- **All API keys** (Twilio, ElevenLabs, Deepgram, LLM provider, etc.) should be configurable via `.env`. Never hardcode.
- **The founders are NOT senior engineers.** Ryan is a strong backend engineer who has not done voice AI before. Ishan handles GTM. Code must be readable, runnable with simple commands (`make run`, `npm start`, `docker compose up`, whatever you choose), and well-documented.
- **Budget consciousness:** every voice call costs real money on ElevenLabs/Twilio. Build in safety rails: max call length, max LLM tokens per turn, rate limits.

### Phone Number Strategy (two-stage)

We have **two phone numbers in play** at different stages:

1. **ElevenLabs temporary test number (available NOW):** `574-626-6385`
   - Use this for early voice testing while the rest of the stack comes together
   - Lets the founders dial in and test voice quality, latency, conversation flow, and menu Q&A without waiting for Twilio setup
   - Architecture should treat this as a "voice-only sandbox" — the ElevenLabs agent can still hit the backend API via webhooks/tools

2. **Twilio production number (set up by end of week 1):**
   - This is the number Paradise Biryani's owner will actually call for the demo
   - Routes call → Twilio → orchestration layer → ElevenLabs voice → backend
   - Must be live, stable, and tunneled (ngrok or Cloudflare Tunnel) before E2E demo testing begins

**Build the architecture so swapping from ElevenLabs-native telephony to Twilio is a config change, not a refactor.** The voice agent logic, system prompt, and tool wiring should be telephony-agnostic.

### Menu Handling

The founders have Paradise Biryani's menu and will provide it directly **right before E2E testing** — likely as pasted text, a screenshot, or a structured file (TBD).

**Until then:**
- Build the menu loader to accept JSON/CSV/Markdown input — flexible ingest
- Use a placeholder menu seed of 8–10 representative Indian restaurant items (biryanis, curries, naans, etc.) so the full pipeline can be tested end-to-end before the real menu arrives
- When the real menu lands, swapping it in should be a one-command operation (`npm run seed:menu /path/to/menu.json` or equivalent)
- Build a small **menu-parsing helper** that can take messy pasted text (item name + price + maybe description) and structure it into the schema — the founders will run this against the real menu when they have it

---

## Architecture (your starting point — improve if you find better)

**Voice stack — choose based on current best-in-class for noise handling at sub-500ms latency:**
- **Orchestration:** LiveKit Agents OR Vapi (you decide which is faster to ship, but explain why in README)
- **STT:** Deepgram Nova-3 (best-in-class for noise per 2026 benchmarks; sub-300ms latency at 6.84% WER)
- **TTS:** ElevenLabs Flash v2.5 (75ms latency) with an Indian English voice from their Voice Library — test 3 and pick the best
- **LLM:** Claude Sonnet 4.6 or GPT-4o (whichever has lower latency in your testing; tool-calling reliability matters more than model intelligence here)
- **Noise suppression:** Krisp VIVA (free under 10K min/month) in the audio pipeline
- **Telephony:** Twilio for the phone number → orchestration layer

**Backend ("Toast clone"):**
- Postgres (or SQLite for local v0 — your call) with the schema spec below
- REST API exposing the 8 endpoints in the spec
- Seeded with **Paradise Biryani's real menu** (you will need to scrape/construct this; see "Menu Seeding" task below)

**Dashboard:**
- Single-page web app showing live orders flowing in
- "Done" button to mark orders complete
- "86" toggle to mark items out of stock (and the agent must respect this in real time)
- Keep it visually clean — this gets screen-shared during the demo

---

## Database Schema (start here, expand as needed)

```sql
items
  id SERIAL PK
  name TEXT                -- "Chicken Biryani"
  description TEXT         -- "Aromatic basmati rice with marinated chicken, saffron, fried onions"
  price_cents INT
  in_stock BOOL
  allergens TEXT[]         -- ['dairy', 'nuts']
  spice_level TEXT         -- 'mild' | 'medium' | 'hot' | 'extra_hot'
  prep_minutes INT         -- realistic prep time, used for ETA
  category TEXT            -- 'biryani' | 'curry' | 'appetizer' | 'bread' | 'dessert' | 'drink'
  ingredients TEXT[]       -- detailed ingredient list for Q&A
  is_vegetarian BOOL
  is_vegan BOOL
  is_gluten_free BOOL

orders
  id SERIAL PK
  status TEXT              -- 'open' | 'submitted' | 'completed'
  customer_name TEXT
  customer_phone TEXT      -- captured from Twilio
  conversation_id TEXT     -- voice provider's session id
  total_cents INT
  created_at TIMESTAMP DEFAULT NOW()
  submitted_at TIMESTAMP
  pickup_eta TIMESTAMP

order_lines
  id SERIAL PK
  order_id INT FK
  item_id INT FK
  item_name TEXT           -- snapshot
  quantity INT
  unit_price_cents INT     -- snapshot
  modifiers JSONB          -- {"spice_level": "medium", "no_onions": true}
  notes TEXT
```

---

## API Endpoints (the agent will use these as tools)

**Menu (read):**
- `GET /menu` — all in-stock items, compact format for agent's working memory
- `GET /items/:id` — full item detail (ingredients, allergens, prep time)
- `GET /menu/search?q=...` — fuzzy search by name (the agent will call this when customer says something close but not exact)

**Stock management (dashboard):**
- `PATCH /items/:id/stock` — toggle in_stock

**Order taking (agent):**
- `POST /orders` — create empty order, body: `{ conversation_id, customer_phone }`
- `POST /orders/:id/items` — add line, returns `{ line_id, running_total, item_name, unit_price }`
- `PATCH /orders/:id/items/:line_id` — update quantity or modifiers
- `DELETE /orders/:id/items/:line_id` — remove line, returns updated total
- `GET /orders/:id` — current order state (for read-back)
- `POST /orders/:id/submit` — finalize, returns `{ total, eta_minutes, order_number }`

**Dashboard:**
- `GET /orders?status=open|submitted|completed` — list orders
- `PATCH /orders/:id/complete` — mark done
- `GET /orders/stream` — Server-Sent Events or WebSocket for live updates

---

## Voice Agent Behavior (this is the hard part — get it right)

**Greeting:** Warm, fast, restaurant-specific.
> *"Thanks for calling Paradise Biryani! This is Olive — what can I get started for you?"*

**Required capabilities:**
1. **Knows the menu cold.** Loaded on conversation start via a `get_menu` tool that fires automatically before the first customer turn.
2. **Handles ingredient & allergen questions naturally.** "What's in the chicken 65?" → reads from `description` + `ingredients`. "Is the biryani gluten-free?" → reads `is_gluten_free`.
3. **Handles spice level requests.** "I want it mild" → adds modifier.
4. **Handles modifications.** "No onions, extra raita on the side" → captured as `modifiers` or `notes`.
5. **Handles changes mid-order.** "Actually, make that two biryanis and skip the naan" → uses `delete_item` + `add_item`.
6. **Reads back the order before submitting.** "So that's one chicken biryani, medium spice, two garlic naans, and a mango lassi — total $42.50. Shall I send it to the kitchen?"
7. **Respects 86'd items in real time.** If the dashboard toggles an item out of stock mid-conversation, the agent does NOT take orders for it. (Test this — the demo will include this moment.)
8. **Gracefully escalates** when it can't help. "Let me grab one of our team members for you" → polite handoff fallback.
9. **Handles silence and interruptions.** If the customer pauses, doesn't immediately re-prompt. If the customer interrupts, stops talking immediately.
10. **Does NOT hallucinate menu items.** If asked for something not on the menu, says so politely and offers alternatives.

**System prompt construction:**
- Inject Paradise Biryani's restaurant context (name, locations, hours, cuisine type, pickup-only for the demo)
- Dynamically inject the current menu via the `get_menu` tool at conversation start
- Tone guide: warm, fast, slightly familiar but professional. Restaurant person, not enterprise IVR. Indian English voice from ElevenLabs Voice Library.
- Hard rules: never give pricing not in the menu, never promise delivery (pickup only for v0), never take payment over the phone (mention "you can pay when you pick up")

---

## Menu Seeding — Paradise Biryani

The founders have Paradise Biryani's real menu and will provide it directly before E2E testing. **Do not scrape the web for the menu** — wait for the founders to hand it over.

**Tasks for the seeding subagent:**
1. Build a **flexible menu ingest pipeline** that accepts:
   - Pasted markdown/text (with rough parsing)
   - Structured JSON
   - CSV
   - Photo of a menu (use Claude's vision to extract — bonus capability worth building)
2. Build a **placeholder menu** of 8–10 realistic Indian items so the full pipeline can be tested end-to-end before the real menu arrives. Examples:
   - Chicken Biryani ($16.99, mild/medium/hot)
   - Lamb Biryani ($18.99)
   - Vegetable Biryani ($14.99, vegetarian)
   - Butter Chicken ($15.99, mild/medium/hot)
   - Chicken 65 ($12.99, appetizer)
   - Garlic Naan ($3.99)
   - Mango Lassi ($4.50)
   - Gulab Jamun ($5.99)
   - Plus 1–2 items pre-marked `in_stock=false` for the "86" demo moment
3. **For each item, populate:** realistic price, accurate ingredients, allergen flags, spice level options, prep time, dietary flags (veg/vegan/GF). Be honest where you don't know — leave fields nullable rather than guess.
4. Store the placeholder as `seed/placeholder_menu.json` and write a one-command swap script: `npm run seed:menu /path/to/real_menu.json` (or equivalent)
5. When the founders provide the real menu, the workflow should be: founder pastes/uploads menu → parser structures it → preview shown for confirmation → loaded into DB

---

## Noise Handling — This Is The Differentiator

The owner will fail the demo if Olive struggles with noise. Build for this from day one:

1. **Use Deepgram Nova-3 STT specifically** — it's benchmarked best for noisy environments
2. **Pipe audio through Krisp VIVA** for noise suppression before STT
3. **Test against real noisy audio** — create a test harness that plays pre-recorded noisy audio files into the pipeline and validates transcription accuracy. Subagent task: build a noise-resilience test suite with audio samples (kitchen clatter, TV in background, driving car, restaurant ambient)
4. **Tune VAD (voice activity detection)** carefully — overly aggressive VAD will cut customers off in noisy environments; too loose and the agent will think noise is speech
5. **In the system prompt, include:** "If you don't fully understand what the customer said, ask for clarification politely rather than guessing. Never invent menu items or modifiers you didn't hear clearly."

---

## Dashboard Requirements (keep it minimal but beautiful)

- Single page, no auth (it's local demo)
- **Three panels:**
  1. **Live Orders** — incoming submitted orders with item details, total, ETA, customer phone, time. "Mark Complete" button.
  2. **Menu Management** — list of all items with in-stock toggle (the "86" button). Toggle changes are reflected in the agent's working memory within 5 seconds (use webhooks or short polling — your call).
  3. **Live Call** — optional: shows when a call is active with live transcription scrolling (great for the screen-share moment)
- Visual style: warm cream background, deep burgundy headers (matches Olive brand). Use a clean font stack. **Do not over-engineer this** — this is supposed to take a day max.

---

## Subagent Structure (you decide, but here's a starting suggestion)

**Spawn parallel subagents for:**
1. **Backend / API subagent** — Postgres schema, FastAPI/Express endpoints, placeholder seed data
2. **Voice orchestration subagent** — ElevenLabs agent config, tool wiring to backend, telephony-agnostic design (works with both ElevenLabs-native number AND Twilio)
3. **Menu pipeline subagent** — flexible ingest (text/JSON/CSV/photo), placeholder menu seed, swap-in script for the real menu when founders provide it
4. **Dashboard subagent** — single-page web app, live updates
5. **Noise testing subagent** — build the audio-injection test harness and run it against the pipeline
6. **Twilio + tunneling subagent** — phone number setup, webhook config, ngrok/Cloudflare Tunnel scripts, docs (do this LAST — use ElevenLabs temp number for early testing)

**Coordinate via shared interface contracts:**
- Write the API spec FIRST (OpenAPI or just a clear markdown doc) before any subagent starts coding
- Backend subagent owns the contract; all other subagents code against the spec
- Integration tests run against the live local backend

**Critical handoffs:**
- Backend must be running before voice orchestration can test end-to-end
- Placeholder menu seed must be loaded before agent can be tested with realistic queries (real menu swaps in later)
- ElevenLabs temp number (574-626-6385) usable for voice testing as soon as agent + backend tools are wired
- Twilio tunneling must work before the **final** live phone call demo can be tested (but blocks nothing earlier)

---

## Definition of Done — V0 Demo Ready

Before declaring done, **all of the following must be true and demonstrably tested:**

- [ ] **Stage 1 (early testing):** ElevenLabs temp number (574-626-6385) connects to the agent with tools wired to the backend
- [ ] **Stage 2 (demo-ready):** A live Twilio phone number connects to the agent
- [ ] Calling the number triggers the greeting within 2 seconds of pickup
- [ ] Agent can answer "what's on the menu?" with a coherent summary
- [ ] Agent can answer ingredient/allergen questions for at least 10 menu items correctly
- [ ] Customer can place an order with 3+ items including modifiers
- [ ] Customer can modify the order mid-conversation (remove, change quantity)
- [ ] Agent reads back the order accurately before submission
- [ ] Agent submits the order; it appears in the dashboard within 2 seconds
- [ ] Dashboard "Done" button marks order complete
- [ ] Dashboard "86" toggle removes item from agent's available menu within 5 seconds
- [ ] **Menu swap works:** running the seed swap command with the real Paradise Biryani menu (provided by founders) replaces the placeholder cleanly
- [ ] **Noise test passes:** the audio test harness validates the agent handles at least 3 of these conditions with >85% order accuracy:
  - Kitchen background noise
  - TV/music in background
  - Caller in moving vehicle
  - Background conversation
- [ ] Total call latency (customer finishes speaking → agent starts speaking) is consistently under 1 second
- [ ] System runs reliably for at least 10 consecutive test calls without restart
- [ ] README has setup instructions Ryan can follow without you
- [ ] `.env.example` lists every key needed
- [ ] Single command starts the entire stack (`make demo` or equivalent)

---

## What You Should Do First

1. **Spend 30 minutes researching current best practices.** Web-search for ElevenLabs agent telephony capabilities in 2026, latest Deepgram STT model, ElevenLabs Indian English voices. Don't take my architecture suggestions as gospel — improve them.
2. **Write the API contract** (one markdown file) and commit it.
3. **Spawn the subagents** with clear, scoped tasks and the API contract as their shared reference.
4. **Build vertical slice using the ElevenLabs temp number first.** By end of day 1, the founders should be able to dial 574-626-6385, place an order against the placeholder menu, and see it appear in the dashboard. Skip Twilio entirely on day 1 — speed matters.
5. **Then iterate:** menu depth → noise handling → modifier handling → polish → Twilio wiring (week 2).

---

## What NOT to Do

- **Do not** add features outside this scope (loyalty, payments, delivery, SMS confirmations, analytics, multi-restaurant support). All of those are post-V0.
- **Do not** spend time on auth, multi-tenancy, or production deployment concerns.
- **Do not** build a "real" Toast integration. The clone IS the integration for v0.
- **Do not** ship without testing live phone calls. A passing unit test ≠ a passing demo.
- **Do not** invent menu items. Use only what's in the seed file.

---

## Final Note

You are the CEO of this demo. If you find a better path than what I've outlined — take it. If a subagent is stuck, reassign or refactor the task. If the demo will be more impressive with a slight scope change, make the call and document why.

The single measure of success is: **Paradise Biryani's owner calls the number, has a real conversation, gets a real order placed, and says some version of "yeah, this could work."**

Ship aggressively. Test against real noise. Don't over-engineer.

Go.
