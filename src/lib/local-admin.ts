import type { AdminProfile } from "./supabase";

export const LOCAL_ADMIN_MODE = true;
const LOCAL_ADMIN_KEY = "topchamal-local-admin";

export function getLocalAdmin(): AdminProfile | null {
  if (!LOCAL_ADMIN_MODE || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCAL_ADMIN_KEY);
    if (!value) return null;
    return JSON.parse(value) as AdminProfile;
  } catch {
    return null;
  }
}

export function signInLocalAdmin(email: string, password: string): AdminProfile | null {
  if (!LOCAL_ADMIN_MODE || !email.trim() || !password) return null;
  const profile: AdminProfile = {
    user_id: "local-demo-admin",
    email: email.trim(),
    display_name: "مدير المتجر (محلي)",
    role: "owner",
    is_active: true,
  };
  window.localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(profile));
  return profile;
}

export function signOutLocalAdmin() {
  if (typeof window !== "undefined") window.localStorage.removeItem(LOCAL_ADMIN_KEY);
}
