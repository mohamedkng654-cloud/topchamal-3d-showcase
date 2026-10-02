import type { AdminProfile } from "./supabase";

const SESSION_KEY = "topchamal-admin-session";
const ADMIN_EMAIL = "admin@topchamal.ma";
const PASSWORD_SHA256 = "0bb2b760c2c1db0dec49b27727b3a3fcd6fac2ca39e2bbd6605bc24fd7d8b023";

export function getLocalAdmin(): AdminProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as AdminProfile) : null;
  } catch {
    return null;
  }
}

export async function signInLocalAdmin(email: string, password: string): Promise<AdminProfile | null> {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL || !password) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== PASSWORD_SHA256) return null;
  const profile: AdminProfile = {
    user_id: "local-admin",
    email: ADMIN_EMAIL,
    display_name: "مدير المتجر",
    role: "owner",
    is_active: true,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export function signOutLocalAdmin() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
}
