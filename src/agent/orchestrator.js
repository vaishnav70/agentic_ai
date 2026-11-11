/**
 * StyleScent Agent Orchestrator (Milestones M3 + M4).
 *
 * What: Core coordinator executing the multi-step agent loop: Understand, Clarify, Refuse,
 * Plan, Act (Wardrobe & Fragrance specialists), Compose, Check (C1–C6) and
 * Format (CSV shopping list + Markdown outfit plan as file attachments).
 * Why: Implements dependency injection for zero-network testing while enforcing deterministic
 * safety guardrails: strict LLM call caps, prompt-injection isolation, and session memory.
 */

import { config } from '../config.js';
import { createLlm } from '../llm.js';
import { logger as defaultLogger } from '../logger.js';
import { loadDatasets } from '../data/load.js';
import { createTools } from '../tools/index.js';
import {
  OCCASION_FORMALITY,
  MAX_LLM_CALLS_PER_REQUEST,
} from './rules.js';
import { understand, mergeSlots, normaliseSlots } from './slots.js';
import { defaultSessionStore } from './session.js';
import { buildPlan } from './planner.js';
import { buildLook, pairingIdeas } from './wardrobe.js';
import { buildQuery, findFragrances, condenseCaveats } from './fragrance.js';
import { composeReply, renderFallbackReply } from './composer.js';
import { createChecker } from './checker.js';
import { buildOutputs } from '../tools/outputs.js';
import { MESSAGES } from './messages.js';

/**
 * Creates an orchestrator instance with injected dependencies.
 *
 * @param {Object} [deps]
 * @param {Object|null} [deps.llm]
 * @param {Object} [deps.data]
 * @param {Object} [deps.tools]
 * @param {() => number} [deps.clock]
 * @param {Object} [deps.logger]
 * @param {Object} [deps.sessions]
 * @param {Object} [deps.checker]
 */
export function createOrchestrator(deps = {}) {
  const clock = deps.clock || (() => Date.now());
  const logger = deps.logger || defaultLogger;
  const sessions = deps.sessions || defaultSessionStore;

  // Data & tools resolution (before the checker: the real checker needs
  // the loaded datasets to verify fragrance ids and notes).
  let data = deps.data;
  if (!data) {
    try {
      data = loadDatasets();
    } catch {
      data = null;
    }
  }

  // Real C1–C6 checker by default (M4). Tests may still inject a fake
  // checker via deps.checker; it is honoured exactly as before.
  const checker = deps.checker || createChecker(data);

  let tools = deps.tools;
  if (!tools && data) {
    try {
      tools = createTools(data);
    } catch {
      tools = null;
    }
  }

  // LLM client
  let llm = deps.llm;
  if (llm === undefined) {
    llm = createLlm(config);
  }

  return {
    /**
     * Handles an incoming normalized request and returns a normalized response with trace.
     *
     * @param {import('../nonilion/types.js').NormalizedRequest} normalizedRequest
     * @returns {Promise<import('../nonilion/types.js').NormalizedResponse>}
     */
    async handleRequest(normalizedRequest) {
      const startTime = clock();
      const inputText = normalizedRequest?.text?.trim() ?? '';
      const userId = normalizedRequest?.userId || 'anonymous';
      const channel = normalizedRequest?.channel || 'default';
      const images = Array.isArray(normalizedRequest?.images) ? normalizedRequest.images : [];

      logger.debug({ userId, channel, text: inputText }, 'Orchestrator handling request');

      let llmCallsCount = 0;
      const toolCalls = [];

      // Wrapped LLM tracking call count
      const trackedLlm = llm
        ? {
            async generateJson(prompt, options) {
              if (llmCallsCount >= MAX_LLM_CALLS_PER_REQUEST) {
                throw new Error('Exceeded MAX_LLM_CALLS_PER_REQUEST');
              }
              llmCallsCount++;
              return await llm.generateJson(prompt, options);
            },
            async generateText(prompt, options) {
              if (llmCallsCount >= MAX_LLM_CALLS_PER_REQUEST) {
                throw new Error('Exceeded MAX_LLM_CALLS_PER_REQUEST');
              }
              llmCallsCount++;
              return await llm.generateText(prompt, options);
            },
          }
        : null;

      // STEP 0: Echo mode if no LLM configured
      if (!trackedLlm) {
        const echoReply = `Hello from StyleScent! You said: "${inputText}".`;
        return {
          text: echoReply,
          files: [],
          images: [],
          progress: ['Received request', 'Echoed response (M0 echo mode)'],
          trace: {
            intent: 'greeting_help',
            slots: null,
            assumptions: [],
            plan: [],
            toolCalls: [],
            relaxed: [],
            clarification: false,
            llmCalls: 0,
            totalMs: clock() - startTime,
          },
        };
      }

      // STEP 1: Images present and no vision tool available
      if (images.length > 0 && (!tools || !tools.image)) {
        if (!inputText) {
          return {
            text: MESSAGES.clarifications.imageNotSupported,
            files: [],
            images: [],
            progress: ['Received image input', 'Image tool unavailable; requested text description'],
            trace: {
              intent: 'clarification',
              slots: null,
              assumptions: [],
              plan: [],
              toolCalls: [],
              relaxed: [],
              clarification: true,
              llmCalls: 0,
              totalMs: clock() - startTime,
            },
          };
        }
      }

      // STEP 2: Understand slots
      const sessionData = sessions.get(channel, userId);
      const previousSlots = sessionData?.slots || null;
      const lastQuestion = sessionData?.lastQuestion || null;

      let understandRes;
      try {
        understandRes = await understand(
          inputText,
          { previousSlots, lastQuestion },
          trackedLlm
        );
      } catch (err) {
        logger.error({ err }, 'Error during slot understanding');
        understandRes = { ok: false };
      }

      if (!understandRes.ok) {
        return {
          text: "I'm sorry, I had trouble understanding that styling request. Could you rephrase what occasion, colours, or garments you're looking for?",
          files: [],
          images: [],
          progress: ['Received request', 'Failed to parse slots; asked user to rephrase'],
          trace: {
            intent: 'unknown',
            slots: previousSlots,
            assumptions: [],
            plan: [],
            toolCalls: [],
            relaxed: [],
            clarification: true,
            llmCalls: llmCallsCount,
            totalMs: clock() - startTime,
          },
        };
      }

      // STEP 3: Merge & Normalise slots
      const merged = mergeSlots(previousSlots, understandRes.slots);
      const { slots, assumptions } = normaliseSlots(merged, {
        colourRules: data?.colourRules,
        clock,
      });

      // STEP 4: Route by intent & Handle refusals
      if (slots.intent === 'greeting_help') {
        return {
          text: MESSAGES.greeting_help,
          files: [],
          images: [],
          progress: ['Recognised greeting intent', 'Returned guidance message'],
          trace: {
            intent: slots.intent,
            slots,
            assumptions,
            plan: [],
            toolCalls: [],
            relaxed: [],
            clarification: false,
            llmCalls: llmCallsCount,
            totalMs: clock() - startTime,
          },
        };
      }

      if (slots.intent === 'out_of_scope') {
        return {
          text: MESSAGES.refusals.out_of_scope,
          files: [],
          images: [],
          progress: ['Recognised out-of-scope query', 'Returned domain redirect message'],
          trace: {
            intent: slots.intent,
            slots,
            assumptions,
            plan: [],
            toolCalls: [],
            relaxed: [],
            clarification: false,
            llmCalls: llmCallsCount,
            totalMs: clock() - startTime,
          },
        };
      }

      // Unsupported flags handling
      let limitsPrefix = '';
      if (Array.isArray(slots.unsupported) && slots.unsupported.length > 0) {
        const hasEnoughSlots =
          (slots.intent === 'pairing_only' &&
            ((slots.garments && slots.garments.length > 0) ||
              (slots.colourPrefs && slots.colourPrefs.length > 0))) ||
          ((slots.intent === 'full_look' || slots.intent === 'fragrance_only') && Boolean(slots.occasion));

        if (hasEnoughSlots) {
          limitsPrefix = MESSAGES.notices.limitsPrefix;
        } else {
          // Refuse and redirect
          let refusalText = MESSAGES.refusals.out_of_scope;
          if (slots.unsupported.includes('guarantee')) {
            refusalText = MESSAGES.refusals.guarantee;
          } else if (slots.unsupported.includes('live_price_stock')) {
            refusalText = MESSAGES.refusals.live_price_stock;
          } else if (slots.unsupported.includes('medical_allergy')) {
            refusalText = MESSAGES.refusals.medical_allergy;
          }

          return {
            text: refusalText,
            files: [],
            images: [],
            progress: ['Detected unsupported request constraint', 'Delivered domain limits refusal'],
            trace: {
              intent: slots.intent,
              slots,
              assumptions,
              plan: [],
              toolCalls: [],
              relaxed: [],
              clarification: false,
              llmCalls: llmCallsCount,
              totalMs: clock() - startTime,
            },
          };
        }
      }

      // STEP 5: Required slots check
      if (slots.intent === 'full_look' || slots.intent === 'fragrance_only') {
        if (!slots.occasion) {
          sessions.set(channel, userId, { slots, lastQuestion: 'occasion' });
          return {
            text: MESSAGES.clarifications.occasion,
            files: [],
            images: [],
            progress: ['Awaiting required occasion slot', 'Asked clarification question'],
            trace: {
              intent: slots.intent,
              slots,
              assumptions,
              plan: [],
              toolCalls: [],
              relaxed: [],
              clarification: true,
              llmCalls: llmCallsCount,
              totalMs: clock() - startTime,
            },
          };
        }
      } else if (slots.intent === 'pairing_only') {
        const hasAnchor =
          (slots.garments && slots.garments.length > 0) ||
          (slots.colourPrefs && slots.colourPrefs.length > 0);
        if (!hasAnchor) {
          sessions.set(channel, userId, { slots, lastQuestion: 'anchor' });
          return {
            text: MESSAGES.clarifications.anchor,
            files: [],
            images: [],
            progress: ['Awaiting anchor piece or colour', 'Asked clarification question'],
            trace: {
              intent: slots.intent,
              slots,
              assumptions,
              plan: [],
              toolCalls: [],
              relaxed: [],
              clarification: true,
              llmCalls: llmCallsCount,
              totalMs: clock() - startTime,
            },
          };
        }
      }

      // STEP 6: Formality Conflict check
      if (slots.occasion && Array.isArray(slots.garments) && slots.garments.length > 0 && !slots.acknowledgeConflict) {
        const occasionLevel = OCCASION_FORMALITY[slots.occasion] ?? 0;
        const occasionStr = occasionLevel === 2 ? 'formal' : occasionLevel === 1 ? 'smart' : 'casual';

        for (const g of slots.garments) {
          const gLevel = g.formality === 'formal' ? 2 : g.formality === 'smart' ? 1 : 0;
          if (Math.abs(occasionLevel - gLevel) === 2) {
            sessions.set(channel, userId, { slots, lastQuestion: 'conflict' });
            const conflictMsg = MESSAGES.clarifications.conflict(
              g.type,
              g.formality || 'casual',
              slots.occasion,
              occasionStr
            );
            return {
              text: conflictMsg,
              files: [],
              images: [],
              progress: ['Detected formality conflict', 'Asked user to confirm or adjust piece'],
              trace: {
                intent: slots.intent,
                slots,
                assumptions,
                plan: [],
                toolCalls: [],
                relaxed: [],
                clarification: true,
                llmCalls: llmCallsCount,
                totalMs: clock() - startTime,
              },
            };
          }
        }
      }

      // STEP 7: Plan
      const plan = buildPlan(slots);
      const progress = [...plan];

      // STEP 8: Act (Wardrobe and Fragrance specialists)
      let lookResult = null;
      let pairingResult = null;
      let fragranceResult = null;

      if (slots.intent === 'pairing_only') {
        const t0 = clock();
        pairingResult = pairingIdeas(slots, data, tools);
        toolCalls.push({
          tool: 'wardrobe.pairingIdeas',
          input: { anchor: pairingResult.anchor },
          outputSummary: `Generated harmonies (${pairingResult.complementary.length} comp, ${pairingResult.analogous.length} ana)`,
          ms: clock() - t0,
        });
      } else {
        // Run wardrobe (if not fragrance_only) and fragrance
        const promises = [];

        if (slots.intent !== 'fragrance_only') {
          const t0 = clock();
          lookResult = buildLook(slots, data, tools);
          toolCalls.push({
            tool: 'wardrobe.buildLook',
            input: { occasion: slots.occasion, itemsCount: lookResult.items.length },
            outputSummary: `Score: ${lookResult.score}, items: ${lookResult.items.map((i) => i.type).join(', ')}`,
            ms: clock() - t0,
          });
        }

        promises.push(
          (async () => {
            const t0 = clock();
            const fragranceQuery = buildQuery(slots, lookResult || {}, data);
            fragranceResult = findFragrances(fragranceQuery, data, tools);
            toolCalls.push({
              tool: 'fragrance.findFragrances',
              input: fragranceQuery,
              outputSummary: `Found ${fragranceResult.results.length} matches (relaxed: ${fragranceResult.relaxed.join(', ') || 'none'})`,
              ms: clock() - t0,
            });
          })()
        );

        await Promise.all(promises);
      }

      // STEP 9: Compose
      const structured = {
        intent: slots.intent,
        slots,
        look: lookResult,
        pairing: pairingResult,
        fragrance: fragranceResult,
        assumptions,
        caveats: condenseCaveats(fragranceResult?.results || []),
        data,
      };

      // Ensure compose only calls LLM if calls quota remaining
      const composeLlm = llmCallsCount < MAX_LLM_CALLS_PER_REQUEST ? trackedLlm : null;
      let replyText = await composeReply(structured, composeLlm);

      if (limitsPrefix) {
        replyText = limitsPrefix + replyText;
      }

      // STEP 10: Checker (M4, real C1–C6 — design.md §6.3).
      // The checker may return a repaired text and/or a corrected
      // structured result with offending fragrances removed; the files
      // in Step 11 are built from the corrected result, never the raw one.
      // Injected test checkers keep working: a string result, or an
      // object with only { text }, is accepted as before.
      let checkerVerdict = null;
      let finalStructured = structured;
      try {
        const checkResult = await checker.check({
          text: replyText,
          structured,
          slots,
        });
        if (typeof checkResult === 'string') {
          replyText = checkResult;
        } else if (checkResult && typeof checkResult.text === 'string') {
          replyText = checkResult.text;
          if (checkResult.structured) finalStructured = checkResult.structured;
          if (typeof checkResult.verdict === 'string') checkerVerdict = checkResult.verdict;
          if (Array.isArray(checkResult.failures) && checkResult.failures.length > 0) {
            logger.warn({ failures: checkResult.failures }, 'Checker found issues; reply repaired where safe');
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Checker threw an error; proceeding with current text');
      }

      // STEP 11: Files (M4) — CSV shopping list + Markdown outfit plan,
      // built from the checker-corrected structured result.
      let files = [];
      try {
        files = buildOutputs(finalStructured, { checkerNote: checkerVerdict });
      } catch (err) {
        logger.warn({ err }, 'Output generation failed; returning text-only reply');
        files = [];
      }

      // STEP 12: Save final session state
      sessions.set(channel, userId, { slots, lastQuestion: null });

      // STEP 13: Return response
      return {
        text: replyText,
        files,
        images: [],
        progress,
        trace: {
          intent: slots.intent,
          slots,
          assumptions,
          plan,
          toolCalls,
          relaxed: fragranceResult?.relaxed || [],
          clarification: false,
          llmCalls: llmCallsCount,
          totalMs: clock() - startTime,
          checker: checkerVerdict || 'checker: not run',
        },
      };
    },
  };
}

export const defaultOrchestrator = createOrchestrator();

/**
 * Default export maintaining backwards compatibility with M0 callers.
 *
 * @param {import('../nonilion/types.js').NormalizedRequest} normalizedRequest
 * @returns {Promise<import('../nonilion/types.js').NormalizedResponse>}
 */
export async function handleRequest(normalizedRequest) {
  return defaultOrchestrator.handleRequest(normalizedRequest);
}
