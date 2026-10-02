// Lovable Cloud provides the managed backend credentials at deploy time.
// This client uses Cloud's managed Supabase-compatible foundation; no external
// Supabase project is required or connected by this application.
export { supabase } from "@/integrations/supabase/client";

const runtimeEnv = typeof process !== "undefined" ? process.env : undefined;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeEnv?.SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv?.SUPABASE_PUBLISHABLE_KEY ||
  runtimeEnv?.SUPABASE_ANON_KEY;

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
