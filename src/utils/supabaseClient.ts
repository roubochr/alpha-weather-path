import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const url = localStorage.getItem('supabase-url');
  const anonKey = localStorage.getItem('supabase-anon-key');

  if (!url || !anonKey) {
    console.warn('Supabase configuration not found. Please configure Supabase URL and Anon Key.');
    return null;
  }

  // Create new client if configuration changed or doesn't exist
  if (!supabaseClient || currentUrl !== url || currentKey !== anonKey) {
    try {
      supabaseClient = createClient(url, anonKey);
      currentUrl = url;
      currentKey = anonKey;
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      return null;
    }
  }

  return supabaseClient;
};

export const isSupabaseConfigured = (): boolean => {
  const url = localStorage.getItem('supabase-url');
  const anonKey = localStorage.getItem('supabase-anon-key');
  return !!(url && anonKey);
};