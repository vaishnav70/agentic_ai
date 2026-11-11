/**
 * Terminal Chat Harness CLI.
 *
 * What: Interactive CLI that lets developers chat directly with the StyleScent orchestrator.
 * Why: Provides an immediate feedback loop for testing the agent locally without requiring
 * an external chat platform, webhook tunnels, or Nonilion import in early milestones.
 */

import readline from 'node:readline/promises';
import { handleRequest } from '../agent/orchestrator.js';
import { defaultSessionStore } from '../agent/session.js';
import { config } from '../config.js';

async function main() {
  const showTrace = process.argv.includes('--trace');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('========================================================');
  console.log(' StyleScent CLI Chat (Milestone M3)');
  console.log(` Mode: ${config.isEchoMode ? 'Echo Mode (no LLM key configured)' : 'LLM Mode'}`);
  console.log(` Trace: ${showTrace ? 'Enabled (--trace)' : 'Disabled'}`);
  console.log(' Type your message and press Enter.');
  console.log(" Type '/reset' to clear conversation memory.");
  console.log(" Type 'exit' or 'quit' to stop.");
  console.log('========================================================\n');

  const channel = 'terminal';
  const userId = 'cli';

  try {
    while (true) {
      const input = await rl.question('You > ');
      const trimmed = input.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        break;
      }

      if (trimmed === '/reset') {
        defaultSessionStore.clear(channel, userId);
        console.log('\n[Session memory cleared]\n');
        continue;
      }

      try {
        const response = await handleRequest({
          text: trimmed,
          userId,
          channel,
        });

        console.log(`\nStyleScent >\n\n${response.text}\n`);

        if (showTrace && response.trace) {
          console.log('-------------------- [TRACE] --------------------');
          console.log(JSON.stringify(response.trace, null, 2));
          console.log('-------------------------------------------------\n');
        }
      } catch (err) {
        console.error(`\nError: ${err.message}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
