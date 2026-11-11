/**
 * Golden Integration Tests for Orchestrator with Scripted Fake LLM (Milestone M3).
 *
 * What: Exercises PRD golden scenarios (1, 2, 4, 5, 6, 7, 9, 10) plus error-handling
 * edge cases using dependency injection, loaded real datasets, and scripted LLM responses.
 * Why: Proves end-to-end correctness of slot routing, clarification flows, conflict detection,
 * deterministic specialists, and response composition without network dependencies.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';
import { createTools } from '../src/tools/index.js';
import { createOrchestrator } from '../src/agent/orchestrator.js';
import { createSessionStore } from '../src/agent/session.js';
import { UNDERSTAND_SYSTEM } from '../src/agent/prompts.js';

describe('Orchestrator Golden Scenarios', () => {
  const data = loadDatasets();
  const tools = createTools(data);

  test('Golden 1: full look for college_fest produces 4 sections, valid fragrance IDs, and plan in progress', async () => {
    let llmCalls = 0;
    const fakeLlm = {
      async generateJson(prompt, options) {
        llmCalls++;
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'full_look',
            occasion: 'college_fest',
            tone: 'dark',
            avoidNotes: ['vanilla'],
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Dark tones provide confident contrast for a vibrant fest evening.',
          fragrance_why: 'Crisp bergamot and woods project well in festive spaces.',
          tip: 'Roll up the sleeves for an effortless campus vibe.',
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'Outfit and perfume for a college fest evening, I like dark colours, no vanilla',
      userId: 'user-g1',
      channel: 'test',
    });

    assert.ok(res.text.includes('## Your look'));
    assert.ok(res.text.includes('## Why it works'));
    assert.ok(res.text.includes('## Fragrance pick'));
    assert.ok(res.text.includes('## Assumptions'));
    assert.ok(res.progress.length >= 4);

    // Every fragrance ID in reply exists in dataset
    const allIds = new Set(data.perfumes.map((p) => p.id));
    const mentionedIds = res.text.match(/p_\d{3}/g) || [];
    assert.ok(mentionedIds.length > 0);
    for (const id of mentionedIds) {
      assert.ok(allIds.has(id));
    }

    // Trace assertions
    assert.equal(res.trace.intent, 'full_look');
    assert.equal(res.trace.clarification, false);
    assert.ok(res.trace.toolCalls.length >= 2);
    assert.ok(llmCalls <= 2);
  });

  test('Golden 2: vague request asks exactly 1 question with 0 tool calls; turn 2 produces full reply', async () => {
    let turn = 1;
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          if (turn === 1) {
            // Vague input: no occasion
            return {
              intent: 'full_look',
              occasion: null,
              unsupported: [],
            };
          }
          // Turn 2: answer "college fest"
          return {
            intent: 'full_look',
            occasion: 'college_fest',
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Great combination for campus.',
          fragrance_why: 'Energetic and refreshing scent.',
          tip: 'Wear with confidence.',
        };
      },
    };

    const sessions = createSessionStore();
    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions,
    });

    // Turn 1
    const res1 = await orchestrator.handleRequest({
      text: 'What should I wear?',
      userId: 'user-g2',
      channel: 'test',
    });

    assert.equal(res1.trace.clarification, true);
    assert.equal(res1.trace.toolCalls.length, 0);
    assert.ok(res1.text.includes('Which occasion are you dressing for?'));

    // Turn 2
    turn = 2;
    const res2 = await orchestrator.handleRequest({
      text: 'College fest',
      userId: 'user-g2',
      channel: 'test',
    });

    assert.equal(res2.trace.clarification, false);
    assert.ok(res2.text.includes('## Your look'));
    assert.ok(res2.text.includes('## Fragrance pick'));
  });

  test('Golden 4: oud plus budget is honest (relaxation named or no close match) and never invents fragrance', async () => {
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'fragrance_only',
            occasion: 'date_night',
            budget: 'budget',
            requireNotes: ['oud'],
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Bold oud notes suited for date night.',
          fragrance_why: 'Warm and rich presence.',
          tip: 'Spray sparingly.',
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'A strong oud perfume under a low budget',
      userId: 'user-g4',
      channel: 'test',
    });

    // If matches were found via relaxation, relaxation is stated; if no matches, says so
    if (res.trace.relaxed.length > 0) {
      assert.ok(res.text.includes('Relaxed') || res.text.includes('budget'));
    } else {
      assert.ok(res.text.includes('No close fragrance matches') || res.text.includes('budget'));
    }

    // Every fragrance ID in reply exists in dataset
    const allIds = new Set(data.perfumes.map((p) => p.id));
    const mentionedIds = res.text.match(/p_\d{3}/g) || [];
    for (const id of mentionedIds) {
      assert.ok(allIds.has(id));
    }
  });

  test('Golden 5: guarantee request gives limits message plus offer, no tools called', async () => {
    const fakeLlm = {
      async generateJson() {
        return {
          intent: 'full_look',
          unsupported: ['guarantee'],
          occasion: null,
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'Will this outfit get me the job?',
      userId: 'user-g5',
      channel: 'test',
    });

    assert.equal(res.trace.toolCalls.length, 0);
    assert.ok(res.text.includes('cannot guarantee'));
  });

  test('Golden 6: pairing for a red kurta returns pairing ideas with no fragrance section', async () => {
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'pairing_only',
            garments: [{ type: 'ethnic', colourName: 'Red', colourHex: '#ff0000', pattern: 'solid' }],
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Gold accents and cream trousers complement vibrant red.',
          tip: 'Pair with embroidered mojaris.',
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'What goes with a red kurta?',
      userId: 'user-g6',
      channel: 'test',
    });

    assert.ok(res.text.includes('## Pairing ideas'));
    assert.equal(res.text.includes('## Fragrance pick'), false);
    assert.equal(res.trace.intent, 'pairing_only');
  });

  test('Golden 7: formal wedding in gym clothes asks 1 question naming conflict; acknowledgeConflict proceeds', async () => {
    let acknowledge = false;
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'full_look',
            occasion: 'wedding',
            garments: [{ type: 'top', colourName: 'Grey', colourHex: '#808080', formality: 'casual' }],
            acknowledgeConflict: acknowledge,
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Unconventional casual contrast at a formal event.',
          fragrance_why: 'Rich woody scent to elevate the casual look.',
          tip: 'Confidence is key.',
        };
      },
    };

    const sessions = createSessionStore();
    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions,
    });

    // Turn 1: Conflict detected
    const res1 = await orchestrator.handleRequest({
      text: 'Formal wedding but I want to wear gym clothes',
      userId: 'user-g7',
      channel: 'test',
    });

    assert.equal(res1.trace.clarification, true);
    assert.ok(res1.text.includes('clashes with the formal dress code for a wedding'));

    // Turn 2: User acknowledges conflict
    acknowledge = true;
    const res2 = await orchestrator.handleRequest({
      text: 'Yes proceed anyway with gym wear',
      userId: 'user-g7',
      channel: 'test',
    });

    assert.equal(res2.trace.clarification, false);
    assert.ok(res2.text.includes('## Your look'));
  });

  test('Golden 9: avoid vanilla and musk ensures neither appears in any note of shown fragrance', async () => {
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'full_look',
            occasion: 'party',
            avoidNotes: ['vanilla', 'musk'],
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Crisp party styling.',
          fragrance_why: 'Citrus and woody notes without vanilla or musk.',
          tip: 'Stand tall.',
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'Party outfit and scent, avoid vanilla and musk',
      userId: 'user-g9',
      channel: 'test',
    });

    const allPerfumeMap = new Map(data.perfumes.map((p) => [p.id, p]));
    const mentionedIds = res.text.match(/p_\d{3}/g) || [];
    assert.ok(mentionedIds.length > 0);

    for (const id of mentionedIds) {
      const perfume = allPerfumeMap.get(id);
      assert.ok(perfume);
      const allNotes = [...(perfume.top_notes || []), ...(perfume.heart_notes || []), ...(perfume.base_notes || [])];
      for (const note of allNotes) {
        assert.equal(note.toLowerCase().includes('vanilla'), false, `Fragrance ${id} contains vanilla`);
        assert.equal(note.toLowerCase().includes('musk'), false, `Fragrance ${id} contains musk`);
      }
    }
  });

  test('Golden 10: "write my essay" triggers out-of-scope redirect with 0 tool calls', async () => {
    const fakeLlm = {
      async generateJson() {
        return {
          intent: 'out_of_scope',
          unsupported: [],
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'Write my essay',
      userId: 'user-g10',
      channel: 'test',
    });

    assert.equal(res.trace.intent, 'out_of_scope');
    assert.equal(res.trace.toolCalls.length, 0);
    assert.ok(res.text.includes('personal styling agent'));
  });

  test('Images with no image tool asks for description', async () => {
    const orchestrator = createOrchestrator({
      data,
      tools: { ...tools, image: null },
      llm: { async generateJson() { return {}; } },
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: '',
      images: [{ name: 'shirt.png', mime: 'image/png' }],
      userId: 'user-img',
      channel: 'test',
    });

    assert.equal(res.trace.clarification, true);
    assert.ok(res.text.includes("can't analyse photos yet"));
  });

  test('understand throwing gives friendly apology and does not crash', async () => {
    const throwingLlm = {
      async generateJson() {
        throw new Error('API network failure');
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: throwingLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'hello',
      userId: 'user-err',
      channel: 'test',
    });

    assert.ok(res.text.includes('trouble understanding that styling request'));
    assert.equal(res.trace.clarification, true);
  });

  test('a full request makes at most MAX_LLM_CALLS_PER_REQUEST (2) LLM calls', async () => {
    let callCount = 0;
    const fakeLlm = {
      async generateJson(prompt, options) {
        callCount++;
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return {
            intent: 'full_look',
            occasion: 'office',
            unsupported: [],
          };
        }
        return {
          why_it_works: 'Tailored and smart.',
          fragrance_why: 'Subtle projection.',
          tip: 'Keep shoes polished.',
        };
      },
    };

    const orchestrator = createOrchestrator({
      data,
      tools,
      llm: fakeLlm,
      sessions: createSessionStore(),
    });

    const res = await orchestrator.handleRequest({
      text: 'Office outfit and perfume',
      userId: 'user-quota',
      channel: 'test',
    });

    assert.ok(callCount <= 2);
    assert.equal(res.trace.llmCalls, callCount);
  });
});
