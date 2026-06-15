import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/lib/env";

/**
 * Server Component / Route Handler Supabase client bound to the request cookies.
 * Returns null when Supabase isn't configured.
 */
export async function createSupabaseServerClient() {
  if (!supabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl!, env.supabasePublishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      },
    },
  });
}

/**
 * Privileged client using the service role key. Server-only. Used by webhooks
 * to write appointments without a logged-in user session. Returns null if the
 * service role key isn't set.
 */
export function createSupabaseAdminClient() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) return null;
  return createServiceClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
