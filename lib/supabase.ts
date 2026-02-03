
import { createClient } from '@supabase/supabase-js';

// Helper to get keys from storage since we can't use process.env in this runtime easily without a build step
export const getSupabaseConfig = () => {
  const url = localStorage.getItem('nexus_sb_url');
  const key = localStorage.getItem('nexus_sb_key');
  return { url, key };
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('nexus_sb_url', url);
  localStorage.setItem('nexus_sb_key', key);
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('nexus_sb_url');
  localStorage.removeItem('nexus_sb_key');
};

const { url, key } = getSupabaseConfig();

// Initialize the client only if keys exist
export const supabase = (url && key) 
  ? createClient(url, key) 
  : null;
