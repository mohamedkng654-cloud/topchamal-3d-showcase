import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAdminProfile, signOutAdmin } from "@/lib/admin-auth";
import { getLocalAdmin } from "@/lib/local-admin";
import { migrateLegacyLocalAdminData } from "@/lib/legacy-sync";
import { supabase, supabaseConfigured, type AdminProfile } from "@/lib/supabase";
import "../styles/admin.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const isLoginRoute = location.pathname === "/admin/login";
    const forceLogin =
      isLoginRoute && new URLSearchParams(location.search).get("login") === "1";
    if (!supabaseConfigured && !getLocalAdmin()) {
      if (!isLoginRoute) throw redirect({ to: "/admin/login" });
      return { admin: null };
    }
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

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const { admin } = Route.useRouteContext() as { admin: AdminProfile | null };
  const [legacySyncNotice, setLegacySyncNotice] = useState("");
  const [legacySyncError, setLegacySyncError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!admin || !supabaseConfigured) return;
    let mounted = true;
    void migrateLegacyLocalAdminData()
      .then((summary) => {
        if (!mounted || !summary) return;
        const total = summary.products + summary.categories + summary.orders + summary.stories;
        const details = [
          summary.products ? `${summary.products} منتج` : "",
          summary.categories ? `${summary.categories} تصنيف` : "",
          summary.orders ? `${summary.orders} طلب` : "",
          summary.stories ? `${summary.stories} قصة` : "",
          summary.siteSettings ? "إعدادات الموقع" : "",
        ].filter(Boolean);
        if (total || summary.siteSettings) {
          setLegacySyncNotice(`تمت مزامنة بيانات هذا الجهاز مع Supabase: ${details.join("، ")}.`);
        }
      })
      .catch((error) => {
        console.error("[Admin] Legacy local data migration failed", error);
      });
    return () => {
      mounted = false;
    };
  }, [admin]);

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
      const summary = await migrateLegacyLocalAdminData({ force: true });
      if (!summary) {
        setLegacySyncError("تعذر الاتصال بـ Supabase. تحقق من الاتصال ثم حاول مرة أخرى.");
        return;
      }
      const total = summary.products + summary.categories + summary.orders + summary.stories;
      const details = [
        summary.products ? `${summary.products} منتج` : "",
        summary.categories ? `${summary.categories} تصنيف` : "",
        summary.orders ? `${summary.orders} طلب` : "",
        summary.stories ? `${summary.stories} قصة` : "",
        summary.siteSettings ? "إعدادات الموقع" : "",
      ].filter(Boolean);
      setLegacySyncNotice(
        total || summary.siteSettings
          ? `تم نشر التغييرات عالمياً عبر Supabase: ${details.join("، ")}.`
          : "تمت المزامنة. لم توجد تغييرات محلية جديدة على هذا الجهاز.",
      );
    } catch (error) {
      setLegacySyncError(
        `فشلت المزامنة: ${error instanceof Error ? error.message : "تعذر حفظ التغييرات في Supabase."}`,
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
          <img className="admin-brand-logo" src="/topchamal-logo.jpg" width="58" height="38" alt="TopChamal" />
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
          {navigation.map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} activeProps={{ className: "active" }}>
              <Icon size={18} />
              <span>{label}</span>
              <ChevronLeft size={14} className="nav-arrow" />
            </Link>
          ))}
        </nav>
        <button className="admin-logout" onClick={logout}>
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
              title="نشر تغييرات هذا الجهاز لجميع الزوار"
            >
              <RefreshCw size={15} className={syncing ? "syncing" : ""} />
              <span>{syncing ? "جارٍ النشر..." : "مزامنة التغييرات"}</span>
            </button>
            <button aria-label="الإشعارات">
              <Bell size={18} />
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
