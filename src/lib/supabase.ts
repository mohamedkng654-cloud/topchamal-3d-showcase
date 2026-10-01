import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://wqxuuymasmsbebutbdwa.supabase.co";
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeHV1eW1hc21zYmVidXRiZHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MDUzNzgsImV4cCI6MjEwNjM4MTM3OH0.NBBYC2TwQEkAgTcHPhspshSZWO3uqGorizCmBTB1Ryo";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type AdminProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "owner" | "admin" | "editor";
  is_active: boolean;
};
