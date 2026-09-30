import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronLeft,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Users,
} from "lucide-react";
import { getAdminProfile, signOutAdmin } from "@/lib/admin-auth";
import { supabase, supabaseConfigured, type AdminProfile } from "@/lib/supabase";
import "../styles/admin.css";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (!supabaseConfigured) {
      if (location.pathname !== "/admin/login") throw redirect({ to: "/admin/login" });
      return { admin: null };
    }
    const admin = await getAdminProfile();
    if (!admin && location.pathname !== "/admin/login") throw redirect({ to: "/admin/login" });
    return { admin };
  },
  component: AdminLayout,
});

const navigation = [
  { label: "نظرة عامة", to: "/admin", icon: LayoutDashboard },
  { label: "الطلبات", to: "/admin/orders", icon: ShoppingCart },
  { label: "المنتجات", to: "/admin/products", icon: Package },
  { label: "التصنيفات", to: "/admin/categories", icon: Boxes },
  { label: "العملاء", to: "/admin/customers", icon: Users },
  { label: "الكوبونات", to: "/admin/discounts", icon: Tag },
  { label: "الصفحة الرئيسية", to: "/admin/homepage", icon: Home },
  { label: "التحليلات", to: "/admin/analytics", icon: BarChart3 },
  { label: "الإشعارات", to: "/admin/notifications", icon: Bell },
  { label: "إعدادات المتجر", to: "/admin/settings", icon: Settings },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const { admin } = Route.useRouteContext() as { admin: AdminProfile | null };

  async function logout() {
    await signOutAdmin();
    await navigate({ to: "/admin/login" });
  }

  if (!admin) return <Outlet />;
  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">T</span>
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
            <button aria-label="الإشعارات">
              <Bell size={18} />
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

void supabase;
