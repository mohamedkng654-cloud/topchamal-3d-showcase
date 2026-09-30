import { supabase, type AdminProfile } from "./supabase";

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("user_id,email,display_name,role,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdminProfile;
}

export async function signInAdmin(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) return result;

  const profile = await getAdminProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return {
      data: { user: null, session: null },
      error: new Error("This account is not authorized for admin access."),
    };
  }
  return result;
}

export async function signOutAdmin() {
  return supabase.auth.signOut();
}
