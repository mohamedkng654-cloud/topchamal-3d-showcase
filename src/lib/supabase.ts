// Lovable Cloud provides the managed backend credentials at deploy time.
// This client uses Cloud's managed Supabase-compatible foundation; no external
// Supabase project is required or connected by this application.
export { supabase } from "@/integrations/supabase/client";
import { getSupabasePublicConfig } from "@/integrations/supabase/runtime-config";

const runtimeEnv = typeof process !== "undefined" ? process.env : undefined;
const publicConfig = getSupabasePublicConfig();
const supabaseUrl = publicConfig.url || runtimeEnv?.["SUPABASE_URL"];
const supabaseKey = publicConfig.publishableKey ||
  runtimeEnv?.["SUPABASE_PUBLISHABLE_KEY"] ||
  runtimeEnv?.["SUPABASE_ANON_KEY"];

export const supabaseConfigured = Boolean(
  supabaseUrl && supabaseKey,
);

export type AdminProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "owner" | "admin" | "editor";
  is_active: boolean;
};
