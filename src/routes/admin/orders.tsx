import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  city: string | null;
  total_mad: number;
  status: string;
  created_at: string;
};

function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void supabase
      .from("orders")
      .select("id,order_number,customer_name,phone,city,total_mad,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setOrders((data as Order[]) || []);
        setLoading(false);
      });
  }, []);
  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">المبيعات</span>
          <h2>الطلبات</h2>
          <p>الطلبات المحفوظة مباشرة في Supabase.</p>
        </div>
      </div>
      <div className="dashboard-panel admin-table-panel">
        {loading ? (
          <p>جار تحميل الطلبات...</p>
        ) : orders.length === 0 ? (
          <p>لا توجد طلبات بعد.</p>
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
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>
                      {order.customer_name}
                      <small>{order.phone}</small>
                    </td>
                    <td>{order.city || "—"}</td>
                    <td>{Number(order.total_mad).toLocaleString("fr-MA")} د.م</td>
                    <td>{order.status}</td>
                    <td>{new Date(order.created_at).toLocaleDateString("fr-MA")}</td>
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
