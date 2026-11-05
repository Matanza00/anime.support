import OpenAI from 'openai';
import { CONFIG, requireConfig } from './config.js';

let client;
function llm() {
  if (!client) {
    requireConfig('llm.apiKey');
    client = new OpenAI({
      baseURL: CONFIG.llm.baseURL,
      apiKey: CONFIG.llm.apiKey,
      defaultHeaders: { 'HTTP-Referer': CONFIG.siteUrl, 'X-Title': CONFIG.siteName }, // OpenRouter attribution
    });
  }
  return client;
}

/** Asks the model for a JSON object, retrying once on malformed output. */
export async function chatJSON(system, user, { temperature = 0.6, maxTokens = Number(process.env.LLM_MAX_TOKENS || 3000) } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await llm().chat.completions.create({
        model: CONFIG.llm.model,
        temperature,
        max_tokens: maxTokens, // a cap keeps OpenRouter from reserving 16k tokens of credit per call
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const raw = res.choices?.[0]?.message?.content ?? '';
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      return JSON.parse(json);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`LLM failed: ${lastErr?.message}`);
}
