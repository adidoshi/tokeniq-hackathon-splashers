<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TokenIQ frontend

Project-wide context, safety rules and the backend API are in [../CLAUDE.md](../CLAUDE.md). Read it first.

## Routes (keep it to these four; the pitch depends on focus)
| Route | View | Purpose |
|---|---|---|
| `/` | Live Desk (`app/page.tsx`) | KPI strip, live chart, trades, entry gate, decision log, risk guard |
| `/replay` | Session Replay (`features/replay/`) | a past session through the live strategy + risk code, played back in the browser |
| `/backtest` | Backtest Lab (`features/backtest/`) | 4-strategy in/out-of-sample comparison + single-strategy backtests |
| `/about` | Team & Build (`app/about/`, copy in `features/about/content.ts`) | who built it, what is done, strategy and risk summary |

The shell (header, sidebar nav, Start/Pause/Kill) is `components/shell/app-shell.tsx`, rendered from `app/layout.tsx`.

## Data flow (follow it for every new widget)
- `services/*.service.ts`: one function per backend endpoint, built on `services/http.ts`. No React.
- `hooks/*`: TanStack Query hooks around the services. Keys live in `lib/query-keys.ts`. User actions are mutations (`useBotAction`, `useBacktest`).
- `hooks/use-live-stream.ts`: the one WebSocket. It writes server data into the Query cache with `setQueryData`; polling is only a fallback while it's down.
- `stores/live-store.ts` (Zustand): only browser-side live state (socket health, latest tick).
- Components never call `fetch` directly and never use `useEffect` + `setInterval` for server data.

## UI rules
- Light and dark theme tokens (`:root` and `.dark`) live in `app/globals.css`; `next-themes` toggles the class. Check both themes for every new widget. Use Tailwind classes (`bg-card`, `text-primary`, `text-muted-foreground`, `text-long`/`text-short`, `text-warn`, `bg-kill`, `border-accent-line`); no raw hex in components.
- Canvas charts take hex values from `CHART_THEMES` in `lib/constants.ts` (read with `useChartColors`), kept in sync with the tokens.
- Motion: keyframes and classes (`flash-up`, `pulse-ring`, `glow-pulse`, `slide-in-row`, ...) are in `globals.css` and respect reduced motion. Animations must be driven by real data (ticks, events, status); never loop a fake one.
- Charts: use the shared `features/charts/candle-chart.tsx` (candles, EMAs, volume, ADX pane, markers, price lines, live tick). Only real Delta resolutions (`CHART_TIMEFRAMES`).
- Strategy names, parameters and limits come from `/status` or `/api/strategies`; never hardcode "5/15 SMA" or "0.20%".
- No fake data: no static "Connected/Verified" badges, no placeholder numbers. Use a loading or empty state.
- shadcn components are Base UI: `render={<Button />}` instead of `asChild`; ToggleGroup `value` is an array.
- Times: event and trade times show in the viewer's local time; the bot's trading day is UTC (label it).

## Checks before committing
`npx tsc --noEmit && npm run lint && npm run build`: zero errors, zero lint warnings.
