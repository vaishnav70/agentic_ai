# StyleScent

StyleScent is an AI personal-styling agent built for Nonilion (INNOVORTEX 4.0 hackathon). It plans outfits (colours, patterns, pairings) and matching fragrances grounded in curated datasets and deterministic rules.

## Current Status

- **M0–M3 complete:** scaffold, curated data, deterministic styling tools, orchestrator with multi-turn memory, clarification and refusals.
- **M4 complete (text + files):** real safety checker (rules C1–C6, `src/agent/checker.js`) and multi-format outputs — CSV shopping list and Markdown outfit plan (`src/tools/outputs.js`), attached to every full-look / fragrance reply. Mood-board PNG is **not** built yet (no image renderer dependency installed).
- **M5 pending:** Nonilion adapter is still a stub — `POST /webhook/nonilion` returns `501 Not Implemented` until the official Nonilion developer guide / pairing code arrives.
- **Dataset (honest):** 42 perfumes in `data/perfumes.json`, all `verified: false` until manually checked. See `data/VERIFY.md` for the coverage audit — college fest (11), interview (6), budget (8) and women's (4) entries now cover the golden scenarios; the 22 entries added 11 Nov 2026 (p_021–p_042) still need their notes verified against real listings before the demo. Only `festival_traditional` (3) is still below its threshold of 6.
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
- `POST /webhook/nonilion`: Nonilion webhook receiver (returns `501 Not Implemented` stub until official Nonilion developer guide is provided).
