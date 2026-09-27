import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://htwpgzvqjaatvpaheizd.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0d3BnenZxamFhdHZwYWhlaXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjI5ODQsImV4cCI6MjEwNTgzODk4NH0.R6fV2dJcou1zN637pWKp-Iw4avZrMgptvqbAmxnBuJ4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// The redirect URL used during signup — must be in Supabase's allowed redirect list
export const AUTH_REDIRECT_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'http://localhost:5173/auth/callback';
