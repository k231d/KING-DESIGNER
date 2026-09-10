import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  COVERS: 'covers',
  MEDIA: 'media',
  MESSAGES: 'messages-media',
  VERIFICATIONS: 'verifications',
  PORTFOLIO: 'portfolio',
} as const;
