import type { AdminProfile } from "./supabase";

export const LOCAL_ADMIN_MODE = true;
const LOCAL_ADMIN_KEY = "topchamal-local-admin";
const LOCAL_ADMIN_EMAIL = "admin@topchamal.ma";
const LOCAL_ADMIN_PASSWORD_SHA256 = "0bb2b760c2c1db0dec49b27727b3a3fcd6fac2ca39e2bbd6605bc24fd7d8b023";

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

export async function signInLocalAdmin(email: string, password: string): Promise<AdminProfile | null> {
  if (!LOCAL_ADMIN_MODE || email.trim().toLowerCase() !== LOCAL_ADMIN_EMAIL || !password) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const passwordHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (passwordHash !== LOCAL_ADMIN_PASSWORD_SHA256) return null;
  const profile: AdminProfile = {
    user_id: "local-demo-admin",
    email: LOCAL_ADMIN_EMAIL,
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
