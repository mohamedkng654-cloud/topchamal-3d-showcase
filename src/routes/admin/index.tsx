import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  Clock3,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { getLocalOrders, getLocalProducts } from "@/lib/local-store";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type Metrics = {
  revenue: number;
  orders: number;
  pending: number;
  delivered: number;
  customers: number;
  products: number;
  lowStock: number;
};
const emptyMetrics: Metrics = {
  revenue: 0,
  orders: 0,
  pending: 0,
  delivered: 0,
  customers: 0,
  products: 0,
  lowStock: 0,
};
const money = (value: number) =>
  new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(value);

function AdminDashboard() {
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void loadMetrics();
  }, []);
  async function loadMetrics() {
    if (!supabaseConfigured) {
      const orders = getLocalOrders() as Array<{ total_mad?: number; status?: string }>;
      const products = getLocalProducts();
      setMetrics({
        revenue: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total_mad || 0), 0),
        orders: orders.length,
        pending: orders.filter((order) => ["new", "confirmed", "preparing"].includes(order.status || "")).length,
        delivered: orders.filter((order) => order.status === "delivered").length,
        customers: new Set(orders.map((order) => String(order.customer_name || ""))).size,
        products: products.length,
        lowStock: products.filter((product) => product.stock < 5 && product.status === "published").length,
      });
      setLoading(false);
      return;
    }
    const [{ data: orders }, { count: customers }, { count: products }, { count: lowStock }] =
      await Promise.all([
        supabase.from("orders").select("total_mad,status"),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .lt("stock", 5)
          .eq("status", "published"),
      ]);
    const orderRows = orders || [];
    setMetrics({
      revenue: orderRows
        .filter((order) => order.status !== "cancelled")
        .reduce((sum, order) => sum + Number(order.total_mad || 0), 0),
      orders: orderRows.length,
      pending: orderRows.filter((order) => ["new", "confirmed", "preparing"].includes(order.status))
        .length,
      delivered: orderRows.filter((order) => order.status === "delivered").length,
      customers: customers || 0,
      products: products || 0,
      lowStock: lowStock || 0,
    });
    setLoading(false);
  }
  const cards = [
    {
      label: "إجمالي الإيرادات",
      value: `${money(metrics.revenue)} د.م`,
      icon: DollarSign,
      tone: "violet",
    },
    { label: "إجمالي الطلبات", value: metrics.orders, icon: ShoppingCart, tone: "blue" },
    { label: "الطلبات قيد المعالجة", value: metrics.pending, icon: Clock3, tone: "amber" },
    { label: "الطلبات المسلّمة", value: metrics.delivered, icon: CheckCircle2, tone: "green" },
    { label: "إجمالي العملاء", value: metrics.customers, icon: Users, tone: "cyan" },
    { label: "المنتجات", value: metrics.products, icon: Package, tone: "pink" },
  ];
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">نظرة عامة</span>
          <h2>صباح الخير، مدير المتجر</h2>
          <p>تابع أداء TopChamal من مكان واحد.</p>
        </div>
        <button
          className="dashboard-refresh"
          onClick={() => {
            setLoading(true);
            void loadMetrics();
          }}
        >
          تحديث البيانات <ArrowUpLeft size={16} />
        </button>
      </div>
      <div className="metric-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className={`metric-card ${tone}`} key={label}>
            <div className="metric-icon">
              <Icon size={19} />
            </div>
            <span>{label}</span>
            <strong>{loading ? "—" : value}</strong>
            <small>
              <ArrowUpLeft size={12} /> بيانات مباشرة من Supabase
            </small>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="admin-eyebrow">المخزون</span>
              <h3>تنبيهات المخزون</h3>
            </div>
            <a href="/admin/products">عرض المنتجات</a>
          </div>
          <div className="stock-alert">
            <div>
              <AlertTriangle size={19} />
              <span>
                <strong>{metrics.lowStock} منتجات</strong>
                <small>تحتاج إلى مراجعة المخزون</small>
              </span>
            </div>
            <a href="/admin/products">
              مراجعة <ArrowUpLeft size={14} />
            </a>
          </div>
          <div className="empty-dashboard">
            <Package size={26} />
            <p>سيظهر هنا تفصيل المنتجات منخفضة المخزون عند ربط بيانات المنتجات.</p>
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="admin-eyebrow">الطلبات</span>
              <h3>آخر النشاطات</h3>
            </div>
            <a href="/admin/orders">كل الطلبات</a>
          </div>
          <div className="empty-dashboard">
            <ShoppingCart size={26} />
            <p>ستظهر الطلبات الحقيقية هنا بعد تشغيل الجداول وتلقي الطلبات.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
