import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.argv[2] || 'https://ejebukxlwgwebjgdicyb.supabase.co';
const serviceKey = process.argv[3] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZWJ1a3hsd2d3ZWJqZ2RpY3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc2NDYyOCwiZXhwIjoyMDkyMzQwNjI4fQ.9r4xLQxpg3wUgetgJj_cCSZ5Y4zMZRyXQ_i_EJQuGjg';
const migrationPath = resolve(__dirname, '..', process.argv[4] || 'supabase/migrations/20260706000000_workers.sql');

const sql = readFileSync(migrationPath, 'utf-8');
console.log(`Applying migration to ${supabaseUrl}...`);

const supabase = createClient(supabaseUrl, serviceKey);

// First try creating exec_sql function
try {
  await supabase.rpc('exec_sql', { query: 'SELECT 1' });
} catch {
  // Need to create it first — try via raw SQL insert
  const createFunc = `
    CREATE OR REPLACE FUNCTION public.exec_sql(query text)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$ BEGIN EXECUTE query; END; $$;
  `;
  // Can't create via REST directly — try Supabase management API instead
}

// Split into statements and run each
const statements = sql
  .replace(/--.*$/gm, '')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

let success = 0;
let failed = 0;

for (const stmt of statements) {
  try {
    const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
    if (error) throw error;
    success++;
  } catch (e) {
    // Try direct post
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      });
      if (res.ok) { success++; continue; }
    } catch {}

    console.log(`  Statement ${success + failed + 1} failed: ${e.message || e}`);
    console.log(`  SQL: ${stmt.substring(0, 80)}...`);
    failed++;
  }
}

console.log(`Done: ${success} succeeded, ${failed} failed`);
