# Agent instructions

The canonical project context for every coding agent (Claude Code, Codex, Gemini/Antigravity, Cursor…) is
**[CLAUDE.md](CLAUDE.md)**: safety rules, architecture, strategy logic, risk layers, Delta API gotchas, commands.
Read it before changing anything. Frontend-specific rules are in [frontend/AGENTS.md](frontend/AGENTS.md).

The non-negotiables, repeated here:
1. Never make the bot trade real orders by default (`dry_run=True`, `auto_start=False`).
2. No fake or hardcoded data in the UI or API. Show a loading or empty state instead.
3. Only `live_enabled` strategies may trade; prove a new one out of sample first (`POST /backtest/compare`).
4. Run `uv run pytest` (backend) and `npx tsc --noEmit && npm run lint && npm run build` (frontend) before committing.
