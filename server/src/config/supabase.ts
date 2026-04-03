import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function createScopedClient(pharmacyId: string, role: string, userId?: string) {
  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        'x-pharmacy-id': pharmacyId,
        'x-user-role': role,
        ...(userId && { 'x-user-id': userId }),
      },
    },
    db: {
      schema: 'public',
    },
  });
}
