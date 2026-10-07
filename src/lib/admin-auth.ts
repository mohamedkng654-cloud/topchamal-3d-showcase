import { supabase, supabaseConfigured, type AdminProfile } from "./supabase";
import { getLocalAdmin, signInLocalAdmin, signOutLocalAdmin } from "./local-admin";

export async function getAdminProfile(): Promise<AdminProfile | null> {
  if (!supabaseConfigured) return getLocalAdmin();
  signOutLocalAdmin();
  try {
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
  } catch (error) {
    console.error("[Admin] Unable to load admin profile", error);
    return null;
  }
}

export async function signInAdmin(email: string, password: string) {
  if (!supabaseConfigured) {
    const localAdmin = await signInLocalAdmin(email, password);
    if (localAdmin) return { data: { user: { id: localAdmin.user_id }, session: null }, error: null };
    return { data: { user: null, session: null }, error: new Error("بيانات الدخول غير صحيحة.") };
  }

  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return result;

    const profile = await getAdminProfile();
    if (!profile) {
      await supabase.auth.signOut();
      return {
        data: { user: null, session: null },
        error: new Error("تم تسجيل الدخول، لكن هذا الحساب غير مضاف إلى قائمة مديري المتجر."),
      };
    }

    return result;
  } catch (error) {
    return {
      data: { user: null, session: null },
      error: error instanceof Error ? error : new Error("Unable to connect to Supabase."),
    };
  }
}

export async function signOutAdmin() {
  signOutLocalAdmin();
  if (!supabaseConfigured) return { error: null, data: { user: null, session: null } };
  return supabase.auth.signOut();
}
