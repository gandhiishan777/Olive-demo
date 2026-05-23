# Dashboard — Olive V0

Single-page React app for the live demo. Three panels (Live Orders, Menu/86 toggle, Live Call transcript) connected to the backend over REST + SSE.

## Run

```bash
pnpm install          # from the dashboard/ folder (or root, via workspaces)
pnpm dev              # http://localhost:5173
pnpm build            # type-check + production build into dist/
```

The dev server proxies `/api/*` → `http://localhost:8787/*` and `/orders/stream` → backend SSE. So **the backend must be running** for live data; otherwise you'll see "Backend offline" in the header.

## Authoring `X-Olive-Token`

Write endpoints (mark complete, 86 toggle) need the token. Since this app is local, we accept the token from a URL query string once, then stash it in `localStorage`:

```
http://localhost:5173/?token=<your-OLIVE_AGENT_TOKEN>
```

The URL is stripped after the first load. Clear with: `localStorage.removeItem('olive.token')` in devtools.

## Panel structure

```
App
├── Header  (status pills: backend / stream)
├── OrdersPanel
│   ├── Filter pills (Kitchen / Done / All)
│   └── OrderCard[] (with Mark Complete button)
├── MenuPanel
│   ├── Search box
│   └── Category-grouped rows with 86 toggle
└── CallPanel
    ├── Live call status
    └── Auto-scrolling transcript
```

## SSE event flow

`useOliveStream` opens `/orders/stream` and dispatches `CustomEvent`s on `window` so panels can re-fetch or update independently:

| SSE event            | DOM event            | Receiver       |
|----------------------|----------------------|----------------|
| `order_created`      | `olive:order-event`  | OrdersPanel    |
| `order_updated`      | `olive:order-event`  | OrdersPanel    |
| `order_submitted`    | `olive:order-event`  | OrdersPanel (pulse) |
| `order_completed`    | `olive:order-event`  | OrdersPanel    |
| `menu_update`        | `olive:menu-update`  | MenuPanel      |
| `call_started`       | `olive:call-started` | CallPanel      |
| `call_ended`         | `olive:call-ended`   | CallPanel      |
| `transcript_chunk`   | `olive:transcript`   | CallPanel      |

Reconnection: EventSource auto-reconnects, but `useOliveStream` also adds a 1→15s exponential backoff in case the backend goes fully down.

## Colors (Olive brand)

- Background: `cream-100` (`#FBF6EE`)
- Primary: `burgundy-700` (`#7B1F2B`)
- Accent (positive state): `leaf-600` (`#3F7D5C`)
- Ink: `ink-900` (`#1f1714`)

To change, edit `tailwind.config.ts`. No magic hex values in components — they all reference Tailwind tokens.

## Demo-day screen-share tips

1. Open the dashboard in a fresh Chrome window with one tab. Hide bookmarks bar.
2. Zoom to 110% so the owner can read across the room.
3. Place the dashboard window next to your video conferencing app, full screen.
4. Pre-load by viewing the Menu panel; toggle one item off & on to verify the wire.
5. During the demo, the owner watches: order arrives → pulse-highlight → "Mark Complete" → moves to Done filter.

## Known limitations

- No mobile responsive layout (desktop only — by design)
- Customer phone is shown masked (last 4 digits) to be safe during screen-share — see `src/lib/format.ts:phoneMasked`
- The "all items" list uses a 1..50 id sweep because the backend doesn't expose `/items` (it exposes `/menu` which is in-stock only). If we add more items, bump the upper bound in `src/lib/api.ts:allItems`.
