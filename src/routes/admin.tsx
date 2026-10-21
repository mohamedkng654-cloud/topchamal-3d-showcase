import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronLeft,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Clapperboard,
  Store,
  Tag,
  Users,
  SlidersHorizontal,
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

const NAV_VISIBILITY_STORAGE_KEY = "topchamal-admin-nav-visibility";
const defaultAdminNavVisibility = Object.fromEntries(
  navigation.map(({ to }) => [to, true]),
) as Record<string, boolean>;

function loadAdminNavVisibility() {
  if (typeof window === "undefined") {
    return { ...defaultAdminNavVisibility };
  }

  try {
    const saved = window.localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);
    if (!saved) return { ...defaultAdminNavVisibility };
    const parsed = JSON.parse(saved) as Record<string, boolean | undefined>;
    return { ...defaultAdminNavVisibility, ...parsed };
  } catch {
    return { ...defaultAdminNavVisibility };
  }
}

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const { admin } = Route.useRouteContext() as { admin: AdminProfile | null };
  const [legacySyncNotice, setLegacySyncNotice] = useState("");
  const [legacySyncError, setLegacySyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [navVisibility, setNavVisibility] = useState<Record<string, boolean>>(() =>
    loadAdminNavVisibility(),
  );

  useEffect(() => {
    window.localStorage.setItem(NAV_VISIBILITY_STORAGE_KEY, JSON.stringify(navVisibility));
  }, [navVisibility]);

  const visibleNavigation = navigation.filter(({ to }) => navVisibility[to] !== false);

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

  function toggleNavItem(to: string, enabled: boolean) {
    setNavVisibility((current) => ({ ...current, [to]: enabled }));
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

        <button
          type="button"
          className="admin-customizer-button"
          onClick={() => setCustomizerOpen((open) => !open)}
          aria-expanded={customizerOpen}
        >
          <SlidersHorizontal size={15} />
          تخصيص القائمة
        </button>

        {customizerOpen && (
          <div className="admin-customizer-panel">
            <div className="admin-customizer-header">
              <strong>أزل أو أعد الخيارات</strong>
            </div>

            <div className="admin-customizer-list">
              {navigation.map(({ label, to, icon: Icon }) => (
                <label className="admin-customizer-item" key={to}>
                  <input
                    type="checkbox"
                    checked={navVisibility[to] !== false}
                    onChange={(event) => toggleNavItem(to, event.target.checked)}
                  />
                  <span className="admin-customizer-icon">
                    <Icon size={14} />
                  </span>
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="admin-customizer-actions">
              <button
                type="button"
                className="admin-secondary-button admin-customizer-action"
                onClick={() => setNavVisibility({ ...defaultAdminNavVisibility })}
              >
                أعد الكل
              </button>
              <button
                type="button"
                className="admin-secondary-button admin-customizer-action"
                onClick={() => setNavVisibility(Object.fromEntries(navigation.map(({ to }) => [to, false])))}
              >
                أزل الكل
              </button>
            </div>
          </div>
        )}

        {visibleNavigation.length === 0 ? (
          <div className="admin-menu-empty">
            <p>تمت إزالة كل الخيارات من الشريط مؤقتاً.</p>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => setNavVisibility({ ...defaultAdminNavVisibility })}
            >
              أعد جميع الخيارات
            </button>
          </div>
        ) : (
          <nav className="admin-nav">
            {visibleNavigation.map(({ label, to, icon: Icon }) => (
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
        )}

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
