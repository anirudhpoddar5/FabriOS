import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Supabase Admin Client (service_role) ──
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = 'https://ejebukxlwgwebjgdicyb.supabase.co';

  // Try to load service role key from .env.local
  const envPath = path.resolve(__dirname, '..', '.env.local');
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    if (match) key = match[1].trim();
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not found. Set it in .env.local or environment.');

  _admin = createClient(url, key);
  return _admin;
}
