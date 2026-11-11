/**
 * Live Golden Tests Execution Script.
 *
 * What: Executes golden test scenarios (1, 2+turn2, 4, 5, 6, 7, 9, 10) against the live LLM
 * provider and real loaded datasets.
 * Why: Provides end-to-end qualitative verification of NLU slot extraction, tool integration,
 * deterministic reasoning, and Markdown reply composition before live judging on Nonilion.
 */

import { config } from '../src/config.js';
import { handleRequest } from '../src/agent/orchestrator.js';

async function runGoldenTests() {
  if (config.isEchoMode || !config.LLM_API_KEY || !config.LLM_MODEL) {
    console.log('Skipping live golden tests: LLM_API_KEY or LLM_MODEL is not configured in .env.');
    console.log('To run live golden tests, set LLM_API_KEY and LLM_MODEL in .env and rerun npm run golden:live.');
    process.exit(0);
  }

  console.log('========================================================');
  console.log(' StyleScent Live Golden Tests Runner');
  console.log(` Provider: ${config.LLM_PROVIDER} | Model: ${config.LLM_MODEL}`);
  console.log('========================================================\n');

  const scenarios = [
    {
      id: 'Golden 1',
      title: 'Full look and perfume for a college fest evening',
      userId: 'golden-1',
      text: 'Outfit and perfume for a college fest evening',
    },
    {
      id: 'Golden 2 (Turn 1)',
      title: 'Vague request asking for clarification',
      userId: 'golden-2',
      text: 'What should I wear?',
    },
    {
      id: 'Golden 2 (Turn 2)',
      title: 'Multi-turn follow-up providing occasion',
      userId: 'golden-2',
      text: 'College fest',
    },
    {
      id: 'Golden 4',
      title: 'Oud perfume under low budget (relaxation / honest match)',
      userId: 'golden-4',
      text: 'A strong oud perfume under a low budget',
    },
    {
      id: 'Golden 5',
      title: 'Guarantee outcome refusal and styling offer',
      userId: 'golden-5',
      text: 'Will this outfit get me the job?',
    },
    {
      id: 'Golden 6',
      title: 'Pairing ideas for a red kurta',
      userId: 'golden-6',
      text: 'What goes with a red kurta?',
    },
    {
      id: 'Golden 7',
      title: 'Formal wedding in gym clothes (formality conflict detection)',
      userId: 'golden-7',
      text: 'Formal wedding but I want to wear gym clothes',
    },
    {
      id: 'Golden 9',
      title: 'Negative note filters (avoid vanilla and musk)',
      userId: 'golden-9',
      text: 'Outfit and perfume for a party, but I dislike vanilla and musk',
    },
    {
      id: 'Golden 10',
      title: 'Out of scope task redirect',
      userId: 'golden-10',
      text: 'Write my essay',
    },
  ];

  for (const s of scenarios) {
    console.log(`--------------------------------------------------------`);
    console.log(`▶ [${s.id}] ${s.title}`);
    console.log(`User > "${s.text}" (userId: ${s.userId})\n`);

    try {
      const response = await handleRequest({
        text: s.text,
        userId: s.userId,
        channel: 'golden-test',
      });

      console.log(`StyleScent Response:\n${response.text}\n`);

      if (response.trace) {
        const t = response.trace;
        console.log(`Trace Summary:`);
        console.log(` - Intent:          ${t.intent}`);
        console.log(` - Clarification:   ${t.clarification}`);
        console.log(` - LLM Calls:       ${t.llmCalls}`);
        console.log(` - Latency:         ${t.totalMs} ms`);
        console.log(` - Plan Steps:      ${t.plan?.length || 0}`);
        console.log(` - Tool Calls:      ${t.toolCalls?.map((c) => c.tool).join(', ') || 'none'}`);
        console.log(` - Relaxed Fields:  ${t.relaxed?.join(', ') || 'none'}`);
        console.log(` - Assumptions:     ${t.assumptions?.length || 0}`);
      }
    } catch (err) {
      console.error(`❌ Error during scenario [${s.id}]:`, err.message);
    }
    console.log('\n');
  }

  console.log('========================================================');
  console.log(' Golden tests execution complete.');
  console.log('========================================================');
}

runGoldenTests().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
