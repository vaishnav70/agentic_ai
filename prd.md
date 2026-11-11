# StyleScent: Product Requirements Document (PRD)

| | |
|---|---|
| **Track** | Best AI Agent on Nonilion, INNOVORTEX 4.0 (TechNeeds, IGDTUW) |
| **Final judging** | 14 November 2026, by the Nonilion team |
| **Document date** | 10 November 2026 |
| **Stack** | Node.js, custom agent code, imported into Nonilion.com |
| **Companion doc** | `design.md` (technical design) |

> **Note for the coding agent:** read this file and `design.md` in full before starting any task. If the two ever disagree, `design.md` wins on *how*, and this file wins on *what*.

---

## 1. Summary

**StyleScent** is an AI personal-styling agent that lives in a Nonilion office as a character people can talk to. A user describes an occasion, or sends a photo of a garment, and StyleScent plans a complete look (colours, patterns, pairings) plus a matching fragrance. Every recommendation is grounded in a curated dataset and in deterministic colour-theory tools, then delivered in the format the user needs: a chat reply, a mood-board image, and a downloadable shopping list.

## 2. Problem

- Choosing an outfit and a fragrance for an occasion is a frequent decision, and most advice is generic or scattered across many sources.
- General chatbots can name perfumes and colours, but they:
  - invent fragrance notes and products that do not exist,
  - do not know what the user already owns,
  - give inconsistent answers to the same question,
  - return only text, with nothing the user can act on (a list, a board, a file).
- The track asks for an agent that goes **beyond a chatbot wrapper**: one that reasons, plans, uses tools, and hands over usable results.

## 3. Target users

| Persona | Need |
|---|---|
| **P1: Aanya, college student** (primary) | Needs a look and a scent for a fest, interview, or date, quickly and on a budget. |
| **P2: Rohan, young professional** | Wants a reliable "office / client dinner / wedding" recommendation without browsing. |
| **P3: Boutique or fragrance-shop associate** (commercial angle, pitch only) | Wants consistent pairing suggestions and a shareable shortlist for customers. |

The agent is built for **personal use first**. P3 is how we describe the post-hackathon commercial path in the pitch; it is not built.

## 4. Goals and non-goals

### Goals
1. Deliver a complete look and fragrance recommendation for a stated occasion, with reasons.
2. Ground every fragrance in the dataset and every colour pairing in deterministic rules, so answers are consistent and explainable.
3. Return results in several formats: chat, file, image.
4. Handle unclear or impossible requests by asking one follow-up or explaining the limit, never by making things up.
5. Run reliably **inside Nonilion** during live judging.

### Non-goals
- No purchasing, payments, live prices or stock checks.
- No body-measurement or fit advice.
- No medical or allergy advice. The agent only honours "avoid these notes" preferences and does not claim anything is safe.
- No model training or fine-tuning.
- No claim that a style is objectively "correct"; style is subjective and the agent says why a pairing works.

## 5. Scope and priorities

| Priority | Meaning |
|---|---|
| **P0** | Required to qualify and to demo. Must be done by 12 Nov. |
| **P1** | Stand-out features that score marks. Do after all P0 are working in Nonilion. |
| **P2** | Only if time remains. Drop without regret. |

## 6. User stories

1. As a student, I say "outfit and perfume for a college fest evening" and get a complete look, a fragrance pick, reasons, and a shopping list file.
2. As a user, I send a photo of a shirt I own and the agent suggests what to wear with it and a perfume to match.
3. As a user, I say "what should I wear?" and the agent asks me for the occasion instead of guessing.
4. As a user, I ask for something outside the dataset and the agent tells me it has no match instead of inventing one.
5. As a team member, I @mention the agent in room chat and it replies in the channel.
6. As a user, I tell the agent "I dislike vanilla and musk" and those notes are excluded from every suggestion.

## 7. Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-1 | P0 | Agent is imported into Nonilion, appears in the office, and replies there without the user leaving the app. |
| FR-2 | P0 | **Understand:** extract from a request the occasion, season or weather, time of day, colour preferences, budget, avoided notes, and any garment already owned. |
| FR-3 | P0 | **Clarify:** if the occasion is missing or the request is contradictory, ask **one** short follow-up question. Otherwise proceed and state assumptions in the reply. |
| FR-4 | P0 | **Refuse sensibly:** for out-of-scope or impossible requests (guarantees, live prices, non-fashion tasks, products not in the dataset), explain the limit and offer the nearest thing the agent can do. |
| FR-5 | P0 | **Plan:** produce a short visible plan (understand, wardrobe, fragrance, check, deliver) before acting. |
| FR-6 | P0 | **Colour tool:** deterministic colour analysis and harmony suggestions (complementary, analogous, triadic, neutral pairing) with seasonal palettes. |
| FR-7 | P1 | **Pattern tool:** rules for pairing patterns (for example stripes with solids, how to mix two prints) with a verdict and a reason. |
| FR-8 | P0 | **Fragrance matcher:** score dataset fragrances against occasion, season, vibe, projection and longevity, time of day and budget; return the top 3 with reasons. |
| FR-9 | P1 | **Image input:** accept a garment photo, extract colours and pattern, confirm with the user if confidence is low. |
| FR-10 | P0 | **Checker:** before replying, verify every fragrance exists in the dataset, avoided notes are excluded, the outfit colour score passes the threshold, and the reply contains assumptions. Allow one revision loop. |
| FR-11 | P0 | **Chat output:** a formatted reply with headings, a table, and the reasons. |
| FR-12 | P0 | **File output:** a downloadable CSV shopping list (and a Markdown outfit plan). |
| FR-13 | P1 | **Image output:** a mood-board PNG showing the palette, outfit swatches, and the chosen fragrance. |
| FR-14 | P1 | **Team chat:** reply to @mentions in room chat, direct messages, and channels. |
| FR-15 | P1 | **Sub-agents:** orchestrator, wardrobe specialist, fragrance specialist, and checker as separate roles behind one character. |
| FR-16 | P1 | **Trace log:** record the plan, tool calls and checker verdict for every request, so the team can show and justify the reasoning. |
| FR-17 | P2 | **Voice reply** (spoken summary). |
| FR-18 | P2 | **Office actions:** post a progress update, or search the room knowledge base. |
| FR-19 | P0 | **Safety and privacy:** no API keys in code or on screen; user photos are processed for the request only and not stored. |

## 8. Acceptance criteria

### Rulebook must-haves

| # | Rulebook must-have | How we prove it |
|---|---|---|
| 1 | Imported and appears in the office | The StyleScent character is visible in our Nonilion office. |
| 2 | Answers inside Nonilion live | Demo never leaves Nonilion. |
| 3 | Completes a real task end to end | "Outfit + perfume for a college fest evening" returns a full look, a fragrance, reasons and files. |
| 4 | Right format for the task | The same request returns a chat reply, a CSV file, and a mood-board image. |
| 5 | Handles unclear or impossible requests | "What should I wear?" gets one follow-up question. "Which perfume will trend next year?" gets a clear "cannot know, here is what I can do". |

### Golden test requests (all must pass inside Nonilion before 13 Nov)

1. "Outfit and perfume for a college fest evening" → full output in three formats.
2. "What should I wear?" → one clarifying question about the occasion.
3. Photo of a navy striped shirt + "perfume for office" → extracted colours, pairing, fragrance.
4. "A strong oud perfume under a low budget" → if nothing matches, says so and offers the closest options.
5. "Will this outfit get me the job?" → explains it cannot guarantee outcomes, offers styling help.
6. "What goes with a red kurta?" → harmony suggestions with reasons.
7. "Formal wedding but I want to wear gym clothes" → flags the conflict politely.
8. @mention in a channel → reply appears in that channel.
9. "I dislike vanilla and musk" → neither appears in any suggestion.
10. "Write my essay" → politely out of scope, redirects to styling.

## 9. Non-functional requirements

- **Reliability:** all 10 golden tests pass after import, not only locally.
- **Speed:** a typical request finishes in roughly 20 seconds or less. For anything longer, post a progress message instead of going silent.
- **Availability:** the service stays up and connected through judging on 14 Nov (no sleeping instance, API credits topped up).
- **Explainability:** every fragrance recommendation cites the dataset entry it came from.
- **Security:** keys in environment variables only; `.env` is git-ignored.

## 10. Data requirements

| Dataset | Target size | Fields (see `design.md` §4) |
|---|---|---|
| Fragrances | about 60 entries, varied by family, season, occasion and price band | name, brand, marketed_for, family, notes, seasons, occasions, vibe tags, projection, longevity, price band |
| Colour rules | 4 seasonal palettes, about 8 occasion palettes, a named-colour table | hex values, temperature, neutral flag |
| Pattern rules | 8 pattern types and about 20 pairing rules | pattern pair, verdict, reason |

**Provenance and honesty**
- The data is a **team-curated sample dataset**. State this plainly in the pitch.
- Fragrance notes generated or drafted by an AI tool can be wrong. Every entry carries a `verified` flag, and the team must verify the notes for every fragrance that appears in the demo.
- Do not scrape websites. If a public dataset (for example on Kaggle) is used, check its licence first.

## 11. Evaluation mapping (40 marks)

| Criterion (marks) | How StyleScent earns it |
|---|---|
| Innovation and uniqueness (8) | Fragrance and wardrobe specialists, deterministic colour theory, checker loop, image input; not a chatbot wrapper. |
| Functionality and agent capabilities (8) | Visible plan, tool calls, checker, end-to-end task. |
| Real-world applicability (7) | A clear user, a recurring everyday decision, and a commercial path (boutiques). |
| Effective use of Nonilion (7) | Clean import, @mentions, file and image delivery, image input. |
| UX and practical utility (5) | One request returns chat, CSV and image the user can use immediately. |
| Presentation and demo (5) | Rehearsed script, backup video, honest answers about data and limits. |

## 12. Milestones

| Date | Target |
|---|---|
| **Tue 10 Nov** | Credits redeemed by every member. Repo scaffold, local chat harness, "hello" bot deployed and imported into Nonilion (proves the round trip). Request the Nonilion developer guide. |
| **Wed 11 Nov** | Seed data created and verified. Colour, pattern and fragrance tools with unit tests. |
| **Thu 12 Nov** | Orchestrator, clarification, checker, CSV and mood-board outputs. Real Nonilion adapter working, with @mentions. |
| **Fri 13 Nov** | Golden tests run inside Nonilion. Fix failures. Record the 2 to 3 minute backup video. Finish the pitch and rehearse. |
| **Sat 14 Nov** | Judging. Feature freeze. Instance always on. |

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Nonilion Bot API details unknown until the developer guide arrives | Request it today. Isolate all Nonilion code in one adapter. Build and test the agent through a local harness in the meantime. |
| Import behaves differently from local | Import a "hello" bot today and test inside Nonilion every day. |
| Hosted service sleeps or is slow during judging | Use an always-on instance on Render, check the Render documentation provided, add a health endpoint. |
| Fabricated fragrance data | Dataset-only recommendations, checker validation, `verified` flag, manual verification of demo items. |
| Vision extraction misreads colours | Return a confidence value; below the threshold, ask the user to confirm. |
| Scope creep | P0 first. P1 only after all golden tests pass in Nonilion. P2 is optional. |
| API quota or cost | Use a fast, low-cost model, cache dataset lookups, and top up credits before judging. |

## 14. Open questions

1. Which Nonilion route do we use (Connect a bot with webhook)? Needs confirmation from the Nonilion developer guide.
2. Does the chosen route support file and image attachments back to the user, and incoming images from the user?
3. Which LLM provider and model do we run the agent on (default Gemini, configurable)?
4. Has every team member redeemed Render credits? A submission only counts if all have.

## 15. Demo script (3 to 4 minutes)

1. **Problem (20 s):** "Picking an outfit and a perfume is a daily decision; chatbots invent answers."
2. **Vague request (30 s):** @mention "What should I wear?" → agent asks for the occasion.
3. **Main task (90 s):** "Fest evening, I like dark colours, no vanilla" → visible plan → chat reply + mood-board image + CSV download.
4. **Image input (40 s):** send a photo of a shirt → pairing and fragrance.
5. **Impossible request (20 s):** "Will this get me the job?" → honest limit, useful alternative.
6. **How it works (30 s):** show the trace (plan, tools, checker) and name the model and the import route.
7. **Next steps (20 s):** boutique version, bigger dataset.
