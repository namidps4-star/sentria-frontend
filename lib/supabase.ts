import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/** The browser's Supabase client, used for sign-in and the account row.
 *
 *  The anon key is public by design: what it may read is decided by the
 *  row-level security policies in supabase/001_accounts.sql. Null when
 *  the two variables are not set, so the app can say so instead of
 *  failing on every call. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Picks up the session from the confirmation and password
          // reset links Supabase emails.
          detectSessionInUrl: true,
        },
      })
    : null
