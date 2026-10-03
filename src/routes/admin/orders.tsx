import { createFileRoute } from "@tanstack/react-router";
import { Edit3, RefreshCw, Search, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import {
  deleteLocalOrder,
  getLocalOrders,
  saveLocalOrders,
  updateLocalOrder,
} from "@/lib/local-store";
import type { LocalOrder } from "@/lib/local-store";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type OrderStatus = "new" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  total_mad: number;
  payment_method: string;
  status: OrderStatus;
  created_at: string;
};

type OrderForm = Pick<
  Order,
  | "order_number"
  | "customer_name"
  | "phone"
  | "email"
  | "address"
  | "city"
  | "total_mad"
  | "payment_method"
  | "status"
>;
function normalizeLocalOrder(raw: LocalOrder, index: number): Order {
  return {
    id: String(raw.id || `local-order-${index}`),
    order_number: String(raw.order_number || raw.orderNumber || `LOCAL-${index + 1}`),
    customer_name: String(raw.customer_name || raw.name || ""),
    phone: String(raw.phone || ""),
    email: raw.email ? String(raw.email) : null,
    address: raw.address ? String(raw.address) : null,
    city: raw.city ? String(raw.city) : null,
    total_mad: Number(raw.total_mad ?? raw.total ?? 0),
    payment_method: String(raw.payment_method || "cash_on_delivery"),
    status: (raw.status as OrderStatus) || "new",
    created_at: String(raw.created_at || raw.createdAt || new Date().toISOString()),
  };
}
const statusLabels: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};
const paymentLabels: Record<string, string> = { cash_on_delivery: "الدفع عند الاستلام" };

function toForm(order: Order): OrderForm {
  return {
    order_number: order.order_number,
    customer_name: order.customer_name,
    phone: order.phone,
    email: order.email || "",
    address: order.address || "",
    city: order.city || "",
    total_mad: order.total_mad,
    payment_method: order.payment_method,
    status: order.status,
  };
}

function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    if (!supabaseConfigured) {
      const normalized = (getLocalOrders() as Array<Record<string, unknown>>).map(
        normalizeLocalOrder,
      );
      saveLocalOrders(normalized);
      setOrders(normalized);
      setLoading(false);
      return;
    }
    const allOrders: Order[] = [];
    const pageSize = 500;
    let page = 0;
    let loadError = "";
    while (true) {
      const result = await supabase
        .from("orders")
        .select(
          "id,order_number,customer_name,phone,email,address,city,total_mad,payment_method,status,created_at",
        )
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (result.error) {
        loadError = result.error.message;
        break;
      }
      allOrders.push(...((result.data as Order[]) || []));
      if (!result.data || result.data.length < pageSize) break;
      page += 1;
    }
    if (loadError) setError(loadError);
    setOrders(allOrders);
    setLoading(false);
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const value = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesQuery =
        !value ||
        [order.order_number, order.customer_name, order.phone, order.city || ""].some((field) =>
          field.toLowerCase().includes(value),
        );
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);

  function startEdit(order: Order) {
    setEditing(order);
    setForm(toForm(order));
    setError("");
    setNotice("");
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
  }

  function updateField<K extends keyof OrderForm>(field: K, value: OrderForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError("");
    if (!supabaseConfigured) {
      updateLocalOrder(editing.id, {
        ...form,
        order_number: form.order_number.trim(),
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        email: String(form.email || "").trim() || null,
        address: String(form.address || "").trim() || null,
        city: String(form.city || "").trim() || null,
        total_mad: Number(form.total_mad || 0),
      });
      setSaving(false);
      setNotice(`تم تحديث الطلب ${editing.order_number}.`);
      closeEdit();
      await loadOrders();
      return;
    }
    const result = await supabase
      .from("orders")
      .update({
        ...form,
        order_number: form.order_number.trim(),
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        email: String(form.email || "").trim() || null,
        address: String(form.address || "").trim() || null,
        city: String(form.city || "").trim() || null,
        total_mad: Number(form.total_mad || 0),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(`تم تحديث الطلب ${editing.order_number}.`);
    closeEdit();
    await loadOrders();
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm(`حذف الطلب ${order.order_number} وجميع تفاصيله؟`)) return;
    setError("");
    if (!supabaseConfigured) {
      deleteLocalOrder(order.id);
      setNotice(`تم حذف الطلب ${order.order_number}.`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      return;
    }
    const result = await supabase.from("orders").delete().eq("id", order.id);
    if (result.error) setError(result.error.message);
    else {
      setNotice(`تم حذف الطلب ${order.order_number}.`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
    }
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">المبيعات والعملاء</span>
          <h2>إدارة الطلبات</h2>
          <p>عدّل بيانات العميل وتابع حالة الطلب أو احذفه عند الحاجة.</p>
        </div>
        <button className="dashboard-refresh" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw size={15} /> تحديث
        </button>
      </div>
      {(error || notice) && (
        <div className={`admin-alert ${error ? "error" : "success"}`}>{error || notice}</div>
      )}
      <div className="order-status-grid">
        {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
          <button
            type="button"
            key={status}
            className={`order-status-card order-${status} ${statusFilter === status ? "active" : ""}`}
            onClick={() => setStatusFilter(status)}
          >
            <strong>{orders.filter((order) => order.status === status).length}</strong>
            <span>{statusLabels[status]}</span>
          </button>
        ))}
      </div>
      {editing && form && (
        <form className="dashboard-panel admin-form-panel" onSubmit={saveOrder}>
          <div className="panel-heading">
            <div>
              <span className="admin-eyebrow">{editing.order_number}</span>
              <h3>تعديل الطلب</h3>
            </div>
            <button type="button" className="admin-icon-button" onClick={closeEdit}>
              <X size={16} />
            </button>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>رقم الطلب</span>
              <input
                dir="ltr"
                value={form.order_number}
                onChange={(event) => updateField("order_number", event.target.value)}
              />
            </label>
            <label>
              <span>اسم العميل</span>
              <input
                value={form.customer_name}
                onChange={(event) => updateField("customer_name", event.target.value)}
              />
            </label>
            <label>
              <span>الهاتف</span>
              <input
                dir="ltr"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </label>
            <label>
              <span>البريد الإلكتروني</span>
              <input
                dir="ltr"
                type="email"
                value={form.email || ""}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
            <label>
              <span>المدينة</span>
              <input
                value={form.city || ""}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </label>
            <label>
              <span>المجموع</span>
              <input
                dir="ltr"
                type="number"
                min="0"
                value={form.total_mad}
                onChange={(event) => updateField("total_mad", Number(event.target.value))}
              />
            </label>
            <label className="admin-form-wide">
              <span>العنوان</span>
              <input
                value={form.address || ""}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </label>
            <label>
              <span>طريقة الدفع</span>
              <select
                value={form.payment_method}
                onChange={(event) => updateField("payment_method", event.target.value)}
              >
                <option value="cash_on_delivery">الدفع عند الاستلام</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="card">بطاقة</option>
              </select>
            </label>
            <label>
              <span>حالة الطلب</span>
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as OrderStatus)}
              >
                {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving ? "جار الحفظ..." : "حفظ التعديلات"}
            </button>
            <button type="button" className="admin-secondary-button" onClick={closeEdit}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      <div className="dashboard-panel admin-table-panel">
        <div className="admin-toolbar">
          <div>
            <strong>كل الطلبات</strong>
            <small>{filteredOrders.length} طلب</small>
          </div>
          <div className="admin-toolbar-filters">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="رقم الطلب أو اسم العميل..."
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
            >
              <option value="all">كل الحالات</option>
              {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <p className="admin-state">جار تحميل الطلبات...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="admin-state">لا توجد طلبات مطابقة.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>المدينة</th>
                  <th>المجموع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.order_number}</strong>
                      <small>{paymentLabels[order.payment_method] || order.payment_method}</small>
                    </td>
                    <td>
                      {order.customer_name}
                      <small dir="ltr">{order.phone}</small>
                    </td>
                    <td>{order.city || "—"}</td>
                    <td>{Number(order.total_mad).toLocaleString("fr-MA")} د.م</td>
                    <td>
                      <span className={`status-pill order-${order.status}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString("fr-MA")}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-action edit" onClick={() => startEdit(order)}>
                          <Edit3 size={14} /> تعديل
                        </button>
                        <button
                          className="admin-action delete"
                          onClick={() => void deleteOrder(order)}
                        >
                          <Trash2 size={14} /> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
