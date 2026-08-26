import { createClient } from '@supabase/supabase-js';

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const key = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
).trim();

const url = rawUrl.replace(/\/+$/, '');

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
