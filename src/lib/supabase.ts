export { supabase } from "@/integrations/supabase/client";

export const supabaseConfigured = true;

export type AdminProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "owner" | "admin" | "editor";
  is_active: boolean;
};
