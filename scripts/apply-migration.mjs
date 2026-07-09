import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kpcgwampumhfcmgpubtw.supabase.co';
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const migrationPath = resolve(__dirname, '..', process.argv[2]);
if (!migrationPath) {
  console.error('Usage: node scripts/apply-migration.mjs <migration-file-path>');
  console.error('  SUPABASE_ACCESS_TOKEN  — Management API token');
  console.error('  SUPABASE_SERVICE_ROLE_KEY — Service role key (alternative)');
  process.exit(1);
}

const sql = readFileSync(migrationPath, 'utf-8');
console.log(`Applying migration: ${migrationPath}`);

async function main() {
  // Approach 1: Supabase Management API (requires SUPABASE_ACCESS_TOKEN)
  if (ACCESS_TOKEN && PROJECT_REF) {
    console.log('Using Management API...');
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log('Migration applied via Management API');
      process.exit(0);
    }
    console.log(`Management API failed: ${res.status} ${await res.text()}`);
  }

  // Approach 2: Service role key -> exec_sql RPC (needs exec_sql function in DB)
  if (SERVICE_KEY) {
    console.log('Trying service role key RPC...');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log('Migration applied via exec_sql RPC');
      process.exit(0);
    }
    console.log(`RPC failed: ${res.status}`);
  }

  // Approach 3: Direct pg connection string from env
  const DB_URL = process.env.DATABASE_URL;
  if (DB_URL) {
    console.log('Using direct pg connection...');
    const { $ } = await import('zx');
    await $`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`;
    console.log('Migration applied via psql');
    process.exit(0);
  }

  console.log('\n=== MANUAL STEP REQUIRED ===');
  console.log(`Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.log('And run the following SQL:\n');
  console.log(sql);
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
