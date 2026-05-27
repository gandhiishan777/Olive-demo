# Dashboard

Two panels for the demo screen-share: Live Orders + Menu (86 toggle).

## Run

```bash
pnpm dev          # http://localhost:5173
pnpm build        # typecheck + production build
```

Dev server proxies `/api/*` and `/orders/stream` to `http://localhost:8787` — backend must be running.

## Panels

- **Live Orders** — filtered by Kitchen (`submitted`) / Done (`completed`) / All. Pulse-highlight on new submitted orders. "Mark Complete" button.
- **Menu — 86 Toggle** — all items grouped by category. Toggle switch per item. Live updates via SSE `menu_update`.

## SSE event flow

`useOliveStream` opens `/orders/stream` (auto-reconnect with exponential backoff). Events fan out to panels via `window` custom events. On reconnect, panels refetch (the bus has no replay).

## Colors

- Background: `cream-100` (`#FBF6EE`)
- Primary: `burgundy-700` (`#7B1F2B`)
- Accent (positive): `leaf-600` (`#3F7D5C`)

Edit `tailwind.config.ts` to retheme.

## Demo tips

- 110% browser zoom for screen-share legibility
- Phone numbers masked to last 4 digits
- Empty state shows "No orders here yet" so the screen isn't blank pre-call
