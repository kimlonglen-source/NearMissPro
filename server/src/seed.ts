import bcrypt from 'bcryptjs';
import { supabase } from './config/supabase.js';
import { env } from './config/env.js';

const NAME = process.env.SEED_PHARMACY_NAME || 'Demo Pharmacy';
const PASSWORD = process.env.SEED_PHARMACY_PASSWORD || 'demo1234';
const EMAIL = process.env.SEED_PHARMACY_EMAIL || 'manager@example.com';

async function main() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in server/.env');
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from('pharmacies').select('id, name').ilike('name', NAME).maybeSingle();

  const password_hash = await bcrypt.hash(PASSWORD, 12);

  if (existing) {
    await supabase.from('pharmacies')
      .update({ password_hash, login_attempts: 0, locked_until: null })
      .eq('id', existing.id);
    console.log(`Reset password for existing pharmacy: ${existing.name}`);
  } else {
    const { error } = await supabase.from('pharmacies').insert({
      name: NAME, password_hash, manager_email: EMAIL,
    });
    if (error) { console.error('Insert failed:', error.message); process.exit(1); }
    console.log(`Created pharmacy: ${NAME}`);
  }

  console.log('\nLogin at http://localhost:5173/login with:');
  console.log(`  Pharmacy name: ${NAME}`);
  console.log(`  Password:      ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
