import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
// In Vite, variables must start with VITE_ to be exposed to the browser.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase Environment Variables. Check your .env.local file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
