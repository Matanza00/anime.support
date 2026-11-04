import { createClient } from '@supabase/supabase-js';
import { CONFIG, requireConfig } from './config.js';

let client;
export function db() {
  if (!client) {
    requireConfig('supabaseUrl', 'supabaseKey');
    client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { persistSession: false } });
  }
  return client;
}

/** Throws on Supabase errors so failures are never silent. */
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}
