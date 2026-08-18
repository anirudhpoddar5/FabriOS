#!/usr/bin/env node
/**
 * Logical backup of every table, via the service-role API key.
 *
 * Writes JSON per table to ~/Backups/fabrios/<timestamp>/ — deliberately OUTSIDE the
 * repo, because this is live customer data and must never be committed.
 *
 * The schema is not dumped: it already lives in supabase/migrations/ + schema.sql.
 * This is a data safety net, not a substitute for Supabase's own PITR/daily backups.
 *
 * Usage: npm run backup
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (or the environment).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const strip = s => s.trim().replace(/^["']|["']$/g, '');
const PROJECT = 'ejebukxlwgwebjgdicyb';
const URL = `https://${PROJECT}.supabase.co`;

let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key && fs.existsSync('.env.local')) {
  key = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1];
}
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY not found (.env.local or environment)'); process.exit(1); }
const db = createClient(URL, strip(key), { auth: { persistSession: false } });

// Table list read from the generated types, so a schema change is picked up automatically.
const types = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');
const block = types.match(/Tables:\s*{([\s\S]*?)\n    }\n    Views:/);
const TABLES = [...(block?.[1] ?? '').matchAll(/^      (\w+): {/gm)].map(m => m[1]);
if (TABLES.length === 0) { console.error('could not read table list from types.ts'); process.exit(1); }

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const dir = path.join(os.homedir(), 'Backups', 'fabrios', stamp);
fs.mkdirSync(dir, { recursive: true });

const PAGE = 1000;
const summary = [];
let failed = 0;

for (const table of TABLES) {
  const rows = [];
  let from = 0, ok = true;
  for (;;) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1);
    if (error) { summary.push({ table, error: error.message }); failed++; ok = false; break; }
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (!ok) continue;
  fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
  summary.push({ table, rows: rows.length });
}

fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify({ takenAt: stamp, project: PROJECT, tables: summary }, null, 2));

const good = summary.filter(s => s.rows !== undefined);
console.log(`Backup -> ${dir}`);
console.log(`${good.length}/${TABLES.length} tables, ${good.reduce((a, b) => a + b.rows, 0)} rows`);
if (failed) { console.error(`${failed} table(s) FAILED:`, summary.filter(s => s.error).map(s => `${s.table} (${s.error})`).join('; ')); process.exit(1); }
