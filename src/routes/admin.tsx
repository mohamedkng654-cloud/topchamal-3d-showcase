import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  ChevronLeft,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAdminProfile, signOutAdmin } from "@/lib/admin-auth";
import { ADMIN_REFRESH_EVENT } from "@/lib/shared-admin";

import { supabase, supabaseConfigured, type AdminProfile } from "@/lib/supabase";
import "../styles/admin.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const isLoginRoute = location.pathname === "/admin/login";
    const forceLogin = isLoginRoute && new URLSearchParams(location.search).get("login") === "1";
    const admin = await getAdminProfile();
    if (!admin && !isLoginRoute) throw redirect({ to: "/admin/login" });
    if (admin && isLoginRoute && !forceLogin) throw redirect({ to: "/admin" });
    return { admin: forceLogin ? null : admin };
  },
  component: AdminLayout,
});

const navigation = [
  { label: "نظرة عامة", to: "/admin", icon: LayoutDashboard },
  { label: "الكتالوج والمنتجات", to: "/admin/products", icon: Package },
  { label: "الطلبات والعملاء", to: "/admin/orders", icon: ShoppingCart },
  { label: "القصص والعروض", to: "/admin/stories", icon: Clapperboard },
  { label: "محتوى الموقع", to: "/admin/site", icon: Store },
] as const;

const navigationPreferenceKey = "topchamal-admin-visible-navigation";

function loadVisibleNavigation() {
  const allPaths = navigation.map(({ to }) => to);
  if (typeof window === "undefined") return new Set<string>(allPaths);

  try {
    const saved = window.localStorage.getItem(navigationPreferenceKey);
    if (!saved) return new Set<string>(allPaths);
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return new Set<string>(allPaths);
    const allowedPaths = new Set<string>(allPaths);
    return new Set(
      parsed.filter((path): path is string => typeof path === "string" && allowedPaths.has(path)),
    );
  } catch {
    return new Set<string>(allPaths);
  }
}

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const { admin } = Route.useRouteContext() as { admin: AdminProfile | null };
  const [legacySyncNotice, setLegacySyncNotice] = useState("");
  const [legacySyncError, setLegacySyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [visibleNavigation, setVisibleNavigation] = useState(loadVisibleNavigation);
  const [navigationPreferencesOpen, setNavigationPreferencesOpen] = useState(false);

  useEffect(() => {
    if (!admin) return;
    try {
      window.localStorage.setItem(navigationPreferenceKey, JSON.stringify([...visibleNavigation]));
    } catch {
      // Keep the selection active for this session if browser storage is unavailable.
    }
  }, [admin, visibleNavigation]);

  function toggleNavigation(path: string) {
    setVisibleNavigation((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function showAllNavigation() {
    setVisibleNavigation(new Set(navigation.map(({ to }) => to)));
  }

  function hideAllNavigation() {
    setVisibleNavigation(new Set());
  }

  async function logout() {
    await signOutAdmin();
    await router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setLegacySyncError("");
    setLegacySyncNotice("");
    try {
      const { error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", admin?.user_id || "")
        .single();
      if (error) throw error;
      window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT));
      await router.invalidate();
      setLegacySyncNotice("تم تحديث البيانات المشتركة من المتجر.");
    } catch (error) {
      setLegacySyncError(
        `فشلت المزامنة: ${error instanceof Error ? error.message : "تعذر الاتصال بالمتجر."}`,
      );
    } finally {
      setSyncing(false);
    }
  }

  if (!admin) return <Outlet />;
  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img
            className="admin-brand-logo"
            src="/topchamal-logo.jpg"
            width="58"
            height="38"
            alt="TopChamal"
          />
          <div>
            <strong>TopChamal</strong>
            <small>لوحة الإدارة</small>
          </div>
        </div>
        <div className="admin-profile">
          <span>{admin.display_name?.slice(0, 1) || admin.email.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{admin.display_name || "مدير المتجر"}</strong>
            <small>{admin.email}</small>
          </div>
        </div>
        <nav className="admin-nav">
          {navigation
            .filter(({ to }) => visibleNavigation.has(to))
            .map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "active" }}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
                <ChevronLeft size={14} className="nav-arrow" />
              </Link>
            ))}
        </nav>
        <button
          className="admin-logout"
          onClick={logout}
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut size={18} /> تسجيل الخروج
        </button>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">TOPCHAMAL ADMIN</span>
            <h1>إدارة المتجر</h1>
          </div>
          <div className="admin-top-actions">
            <button
              type="button"
              className="admin-nav-toggle"
              onClick={() => setNavigationPreferencesOpen((open) => !open)}
              aria-label="تخصيص عناصر قائمة الإدارة"
              aria-controls="admin-nav-preferences"
              aria-expanded={navigationPreferencesOpen}
              title="تخصيص قائمة الإدارة"
            >
              <Settings size={16} />
              <span>تخصيص القائمة</span>
            </button>
            <a href="/" target="_blank" rel="noreferrer">
              <Store size={17} /> عرض المتجر
            </a>
            <button
              type="button"
              className="admin-sync-button"
              onClick={() => void syncNow()}
              disabled={syncing}
              title="تحديث البيانات المشتركة"
            >
              <RefreshCw size={15} className={syncing ? "syncing" : ""} />
              <span>{syncing ? "جارٍ التحديث..." : "تحديث البيانات"}</span>
            </button>
          </div>
          {navigationPreferencesOpen && (
            <div
              className="admin-nav-preferences"
              id="admin-nav-preferences"
              role="dialog"
              aria-label="تخصيص عناصر قائمة الإدارة"
            >
              <div className="admin-nav-preferences-heading">
                <strong>الأقسام الظاهرة</strong>
                <div className="admin-nav-preferences-actions">
                  <button type="button" onClick={showAllNavigation}>
                    إظهار الكل
                  </button>
                  <button type="button" onClick={hideAllNavigation}>
                    إخفاء الكل
                  </button>
                </div>
              </div>
              <p>اختر أقسام الإدارة التي تريد إظهارها. تُحفظ اختياراتك في هذا المتصفح.</p>
              <div className="admin-nav-preferences-list">
                {navigation.map(({ label, to, icon: Icon }) => (
                  <label key={to} className="admin-nav-preference">
                    <input
                      type="checkbox"
                      checked={visibleNavigation.has(to)}
                      onChange={() => toggleNavigation(to)}
                    />
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </header>
        <main className="admin-content">
          {legacySyncNotice && <div className="admin-alert success">{legacySyncNotice}</div>}
          {legacySyncError && <div className="admin-alert error">{legacySyncError}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

void supabase;
