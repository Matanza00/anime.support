import OpenAI from 'openai';
import { CONFIG, requireConfig } from './config.js';
import { log, warn } from './log.js';

// The paid model is used first. When the account runs out of credits (HTTP 402), the rest of the run
// switches to OpenRouter's free models (no credits needed; 50 requests/day, or 1,000/day once $10 of
// credits has ever been bought). If those are exhausted too, AiUnavailable is thrown so callers stop early.
// Free models change often, so the list is read from OpenRouter when first needed (LLM_FALLBACK_MODELS overrides it).
let FALLBACKS = (process.env.LLM_FALLBACK_MODELS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
let discovered = FALLBACKS.length > 0;

async function discoverFreeModels() {
  if (discovered || FALLBACKS.length) return;
  discovered = true;
  try {
    const res = await fetch(`${CONFIG.llm.baseURL.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(20000) });
    const { data = [] } = await res.json();
    const skip = /safety|guard|code|coder|embed|vl\b|vision|ocr|audio|tts|nano|mini-?code|2\.6b|1b|3b\b|4b\b/i;
    FALLBACKS = data
      .filter((m) => /:free$/.test(m.id) && !skip.test(m.id) && (m.context_length || 0) >= 16000)
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .slice(0, 6)
      .map((m) => m.id);
    log(`Free AI models available: ${FALLBACKS.join(', ') || 'none'}`);
  } catch (err) {
    warn(`Could not list free AI models: ${err.message}`);
  }
}

export class AiUnavailable extends Error {}

const state = { paidOut: false, freeOut: new Set(), usedFallback: false, noJsonMode: new Set() };
export const aiStatus = () => ({ usedFallback: state.usedFallback, exhausted: state.paidOut && discovered && FALLBACKS.every((m) => state.freeOut.has(m)) });

let client;
function llm() {
  if (!client) {
    requireConfig('llm.apiKey');
    client = new OpenAI({
      baseURL: CONFIG.llm.baseURL,
      apiKey: CONFIG.llm.apiKey,
      maxRetries: 1,
      timeout: 120000,
      defaultHeaders: { 'HTTP-Referer': CONFIG.siteUrl, 'X-Title': CONFIG.siteName }, // OpenRouter attribution
    });
  }
  return client;
}

const isCredit = (err) => err?.status === 402 || /credit|afford|quota|insufficient/i.test(err?.message || '');
const isLimit = (err) => err?.status === 429 || /rate.?limit|free-models-per-day/i.test(err?.message || '');

function parseJson(raw) {
  const text = String(raw || '').replace(/^```(?:json)?|```$/gm, '');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

async function ask(model, system, user, temperature, maxTokens) {
  const jsonMode = !state.noJsonMode.has(model);
  try {
    const res = await llm().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens, // a cap keeps OpenRouter from reserving 16k tokens of credit per call
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: jsonMode ? user : `${user}\n\nReply with ONE JSON object only, no other text.` },
      ],
    });
    return parseJson(res.choices?.[0]?.message?.content);
  } catch (err) {
    // some free models refuse response_format; retry the same model without it
    if (jsonMode && err?.status === 400 && /response_format|json/i.test(err.message || '')) {
      state.noJsonMode.add(model);
      return ask(model, system, user, temperature, maxTokens);
    }
    throw err;
  }
}

/** Asks for a JSON object: paid model first, then the free fallbacks. Retries once on malformed output. */
export async function chatJSON(system, user, { temperature = 0.6, maxTokens = Number(process.env.LLM_MAX_TOKENS || 2000) } = {}) {
  if (state.paidOut) await discoverFreeModels();
  const models = [...(state.paidOut ? [] : [CONFIG.llm.model]), ...FALLBACKS.filter((m) => !state.freeOut.has(m))];
  if (!models.length) throw new AiUnavailable('AI_UNAVAILABLE: out of credits and free models are used up for today');
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await ask(model, system, user, temperature, maxTokens);
        if (FALLBACKS.includes(model)) state.usedFallback = true;
        return out;
      } catch (err) {
        lastErr = err;
        if (model === CONFIG.llm.model && isCredit(err)) {
          state.paidOut = true;
          warn(`AI credits are empty (${CONFIG.llm.model}); switching to free models for this run. Top up at https://openrouter.ai/settings/credits`);
          await discoverFreeModels();
          models.push(...FALLBACKS.filter((m) => !models.includes(m)));
          break;
        }
        if (FALLBACKS.includes(model) && (isLimit(err) || isCredit(err) || err?.status === 404 || err?.status === 400)) {
          state.freeOut.add(model);
          warn(`Free model ${model} unavailable: ${String(err.message).slice(0, 140)}`);
          break;
        }
        if (err instanceof SyntaxError) continue; // malformed JSON: ask the same model again
        if (attempt === 1) break;
      }
    }
  }
  if (aiStatus().exhausted) throw new AiUnavailable(`AI_UNAVAILABLE: ${lastErr?.message}`);
  throw new Error(`LLM failed: ${lastErr?.message}`);
}
