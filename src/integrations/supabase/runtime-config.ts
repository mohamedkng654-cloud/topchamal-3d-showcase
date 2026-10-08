// Public browser configuration only. Never place a service-role key here.
const fallbackUrl = "https://wqxuuymasmsbebutbdwa.supabase.co";
const fallbackPublishableKey = "sb_publishable_ylws91z9w_UvtxE4ARxPbA_nDoPTk-U";

export function getSupabasePublicConfig() {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    url: env["VITE_SUPABASE_URL"] || fallbackUrl,
    publishableKey: env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"] || fallbackPublishableKey,
  };
}
