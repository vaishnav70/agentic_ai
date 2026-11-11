# StyleScent

StyleScent is an AI personal-styling agent built for Nonilion (INNOVORTEX 4.0 hackathon). It plans outfits (colours, patterns, pairings) and matching fragrances grounded in curated datasets and deterministic rules.

## Current Status

- **M0–M3 complete:** scaffold, curated data, deterministic styling tools, orchestrator with multi-turn memory, clarification and refusals.
- **M4 complete (text + files):** real safety checker (rules C1–C6, `src/agent/checker.js`) and multi-format outputs — CSV shopping list and Markdown outfit plan (`src/tools/outputs.js`), attached to every full-look / fragrance reply. Mood-board PNG is **not** built yet (no image renderer dependency installed).
- **M5 in progress:** `POST /webhook/nonilion` is live with a tolerant parser (accepts `{"text": ...}` and common nested shapes) and replies via the real orchestrator. Official Nonilion auth/signature verification and the exact payload format still wait on the developer guide / pairing code.
- **Dataset (honest):** 55 perfumes in `data/perfumes.json`, all `verified: false` until manually checked. See `data/VERIFY.md` for the coverage audit — college fest (15), interview (10), budget (9) and women's (4) entries now cover the golden scenarios; the 22 entries added 11 Nov 2026 (p_021–p_042) and the 13 team-research entries added 11 Nov 2026 (p_043–p_055, with Fragrantica/Parfumo sources) still need their notes verified against real listings before the demo. Only `festival_traditional` (5) is still below its threshold of 6. Note: the team-research batch was all men's/unisex — no new women's entries, so the women's count is still 4; 7 pasted names were already in the dataset (Invictus, La Nuit de L'Homme, Club de Nuit Intense Man, Khamrah, Cool Water, Voyage, Green Irish Tweed) and were skipped as duplicates.
- **Tests:** run `npm test` (Node's built-in runner, no extra framework).

## Requirements

- Node.js >= 20.0.0
- npm >= 10.0.0

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Set a real `LLM_API_KEY` and `LLM_MODEL` (a current Gemini model ID from Google's docs). If either is unset, StyleScent runs in echo mode and only replies `Hello from StyleScent! You said: "..."`.

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Start the local chat harness:**
   ```bash
   npm run chat
   ```

5. **Start the HTTP server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

## Endpoints

- `GET /health`: Returns service health, uptime, and version (`200 OK`).
- `POST /dev/chat`: Local testing chat endpoint accepting `{ "text": "..." }` (available in non-production). A successful full-look reply returns `text` plus `files` — `stylescent-shopping-list.csv` and `stylescent-outfit-plan.md` — and a `trace.checker` verdict.
- `POST /webhook/nonilion`: Nonilion webhook receiver — parses the payload, runs the orchestrator, replies inline as JSON (official auth/format still pending the developer guide).
- `POST /v1/chat/completions` + `GET /v1/models`: OpenAI-compatible endpoints so Nonilion can import the agent via Hire an agent → IMPORT → Other (Base URL `https://stylescent.onrender.com/v1`). The Import form requires a non-empty API key; use the documented placeholder `stylescent-demo` (not a secret — the backend accepts any key and ignores it).
