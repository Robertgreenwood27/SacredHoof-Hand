"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, supabaseConfigured } from "@/lib/env";

/**
 * Browser-side Supabase client. Returns null when Supabase isn't configured so
 * UI can show a friendly "coming soon" state instead of crashing.
 */
export function createClient() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(env.supabaseUrl!, env.supabasePublishableKey!);
}
