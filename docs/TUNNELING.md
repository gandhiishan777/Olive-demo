# Tunneling — Olive V0

**Owner:** Backend / Telephony
**Last updated:** 2026-05-22

How we expose `localhost:8787` to ElevenLabs / Twilio so that tool calls from the voice agent reach our backend during the demo.

---

## 1. Why we need a tunnel

- The voice agent (ElevenLabs Conversational AI) runs in ElevenLabs' cloud.
- It makes outbound HTTPS calls to our tool endpoints (`get_menu`, `create_order`, `submit_order`, ...).
- Those endpoints live on the founder's MacBook at `http://localhost:8787`.
- ElevenLabs can't reach `localhost`. It needs a **public HTTPS URL with a valid TLS cert**.
- A tunnel exposes `localhost:8787` at e.g. `https://olive-demo.ngrok.app` and forwards traffic.

Requirements the tunnel must satisfy:
- **HTTPS** (ElevenLabs and Twilio both reject HTTP).
- **Valid TLS cert** (tunnel provider gives this; no Let's Encrypt setup on our side).
- **Stable URL across restarts** (so we don't re-paste into the ElevenLabs dashboard every dev session).
- **Forward `POST` bodies and custom headers** (specifically `X-Olive-Token`).

---

## 2. ngrok — recommended

### Install (macOS)
```bash
brew install ngrok
```

### Account + auth token
1. Sign up: https://dashboard.ngrok.com/signup
2. Copy your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure it:
   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```

### Free tier vs paid

| Feature | Free | Paid ("Personal" plan, ~$8/mo) |
|---|---|---|
| HTTPS tunnel | Yes | Yes |
| URL stability | Random subdomain per restart | **Stable custom domain** (`--domain=olive-demo.ngrok.app`) |
| Session length | Drops after some hours | Persistent |
| Bandwidth | Limited | Higher cap |
| Browser interstitial | Yes (warning page on first hit) | No |

**Verdict for demo day:** Paid. The cost ($8/mo) is trivial vs. the operational pain of:
- Re-pasting a new URL into the ElevenLabs dashboard each session.
- The free-tier browser interstitial occasionally interfering with webhook clients.
- Sessions dropping mid-call.

### Reserve the stable domain (paid)
1. Dashboard → **Domains** → **+ New Domain**.
2. Pick subdomain, e.g. `olive-demo`.
3. Save. You now own `olive-demo.ngrok.app` while the subscription is active.

### One-line start
The repo's `Makefile` wraps the command:
```bash
make tunnel
```
Under the hood this runs:
```bash
ngrok http --domain=$NGROK_DOMAIN 8787
```
where `NGROK_DOMAIN` is set in `.env` (e.g. `olive-demo.ngrok.app`).

For free-tier users (no domain reserved), `make tunnel` should fall back to:
```bash
ngrok http 8787
```
…and you'll have to copy the random URL each time.

---

## 3. Configuring ElevenLabs to use the tunnel URL

ElevenLabs dashboard layout changes — these steps may drift. Verify against https://elevenlabs.io/docs/conversational-ai/overview.

As of 2026-05:

1. Log in to https://elevenlabs.io/app/conversational-ai.
2. Open the Olive agent (or whatever it's named in the workspace).
3. Sidebar → **Tools** (or **Server Tools** / **Custom Tools** depending on UI version).
4. For each tool that calls our backend, the **base URL** or **webhook URL** field should be `https://olive-demo.ngrok.app` + the tool's path (per `docs/API_CONTRACT.md`).
5. Headers section → add `X-Olive-Token: <value from .env>`.
6. Save.
7. (Optional but recommended) Click **Test** on a tool — should hit your local backend and return 200.

If the agent has a single "base_url" for all tools, set it to `https://olive-demo.ngrok.app` and tool definitions append their paths.

---

## 4. Troubleshooting

### "Tunnel keeps dropping"
- Free tier: expected — sessions are time-boxed. Upgrade or restart.
- Paid + stable domain: check `ngrok diagnose` output. Likely flaky Wi-Fi. Move to wired ethernet or phone hotspot.
- If `ngrok` log shows `ERR_NGROK_*`, look up the code at https://ngrok.com/docs/errors.

### "Twilio (or ElevenLabs) rejects the URL"
- Confirm it's `https://` not `http://`.
- Open the URL in a browser. Should return your backend's `404 Not Found` (or a JSON error from Hono) — meaning the tunnel reaches the backend.
- If you see ngrok's "You are about to visit…" interstitial, that's a free-tier behavior. Either upgrade or add the `ngrok-skip-browser-warning: true` header in the agent tool config.
- For Twilio webhook specifically: open Twilio console → **Monitor → Logs → Errors** and search the request SID. The error code (e.g. `11200`) tells you what failed.

### "CORS error"
- CORS only applies to browser-origin requests. ElevenLabs and Twilio servers do **not** care about CORS. If you see a CORS error, the offender is the dashboard, not the phone path.
- For dashboard, ensure backend allows the dashboard origin (default `http://localhost:5173`). This is unrelated to the tunnel.

### "Tunnel session expired"
- Free tier kicked you. Restart with `make tunnel`. Re-paste new URL into ElevenLabs.
- If on paid and seeing this: account in arrears or auth token rotated. Check https://dashboard.ngrok.com.

### "Tunnel up but backend gets no requests"
- Hit the tunnel URL directly from your terminal:
  ```bash
  curl -i https://olive-demo.ngrok.app/healthz
  ```
- If 200 — tunnel is fine; the agent config has the wrong URL.
- If timeout — backend isn't on 8787. Run `lsof -i :8787` to confirm.

### "Backend gets request but returns 401"
- `X-Olive-Token` header missing or wrong. Check `.env` matches what's pasted in ElevenLabs dashboard.

---

## 5. Alternative — Cloudflare Tunnel

Free, stable subdomain on your own domain (or a `*.trycloudflare.com` quick tunnel). Use this if budget is tight or ngrok is blocked.

### Quick (no account) — disposable URL
```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8787
```
Prints a `https://<random>.trycloudflare.com` URL. Free, ephemeral.

### Named tunnel (stable URL on a domain you own)
1. `cloudflared tunnel login` — authenticates in browser.
2. `cloudflared tunnel create olive-demo` — creates the tunnel; saves credentials.
3. Add a DNS route on a Cloudflare-managed domain:
   `cloudflared tunnel route dns olive-demo olive.<yourdomain>.com`
4. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: olive-demo
   credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: olive.<yourdomain>.com
       service: http://localhost:8787
     - service: http_status:404
   ```
5. Run: `cloudflared tunnel run olive-demo`

Reference: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

### When to choose Cloudflare Tunnel
- Want zero recurring spend.
- Already own a domain on Cloudflare DNS.
- Need a stable URL but won't pay ngrok.

### Trade-offs vs ngrok
- Setup is heavier (DNS, config file).
- Logging UI is less friendly for live request inspection.
- No "inspect requests" web UI like ngrok's `http://localhost:4040`.

---

## 6. Alternative — Tailscale Funnel

Free, stable, but assumes Tailscale is already in your stack. If you're not already on Tailscale, this is a strictly worse choice than ngrok or Cloudflare for this use case.

- `tailscale funnel 8787`
- Exposes on `https://<machine>.<tailnet>.ts.net`.
- Free, stable URL tied to the machine.
- Adds complexity (need tailnet, machine must stay online, ACLs).
- Reference: https://tailscale.com/kb/1223/funnel

### When to choose it
- Founders are already running Tailscale and want one less vendor.
- Otherwise: skip.

---

## 7. Verdict

**Primary: ngrok paid (~$8/mo) with `--domain=olive-demo.ngrok.app`.**

Rationale:
- One command (`make tunnel`).
- Stable URL → set the ElevenLabs config once and forget it.
- Best-in-class live request inspector at `http://localhost:4040` for mid-demo debugging.
- $8/mo is rounding error against the cost of a botched demo.

**Zero-cost fallback: Cloudflare Tunnel** (named tunnel, on a domain we control).

**Avoid for V0:** Tailscale Funnel, custom reverse proxies, port-forwarding the router. Each adds a debugging surface we don't need.
