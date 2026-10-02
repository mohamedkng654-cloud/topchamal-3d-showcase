// Lovable Cloud provides the managed backend credentials at deploy time.
// This client uses Cloud's managed Supabase-compatible foundation; no external
// Supabase project is required or connected by this application.
export { supabase } from "@/integrations/supabase/client";

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
);

export type AdminProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "owner" | "admin" | "editor";
  is_active: boolean;
};
