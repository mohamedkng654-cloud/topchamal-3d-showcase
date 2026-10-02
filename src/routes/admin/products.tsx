import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/products")({ component: AdminProducts });

type Product = {
  id: string;
  name: string;
  slug: string;
  price_mad: number;
  discount_price_mad: number | null;
  stock: number;
  status: string;
};

function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void supabase
      .from("products")
      .select("id,name,slug,price_mad,discount_price_mad,stock,status")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setProducts((data as Product[]) || []);
        setLoading(false);
      });
  }, []);
  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">المخزون</span>
          <h2>المنتجات</h2>
          <p>الكتالوج والمخزون من Supabase.</p>
        </div>
      </div>
      <div className="dashboard-panel admin-table-panel">
        {loading ? (
          <p>جار تحميل المنتجات...</p>
        ) : products.length === 0 ? (
          <p>لا توجد منتجات بعد. طبّق migration المتجر أولاً.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>المخزون</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <small>{product.slug}</small>
                    </td>
                    <td>
                      {Number(product.discount_price_mad ?? product.price_mad).toLocaleString(
                        "fr-MA",
                      )}{" "}
                      د.م
                    </td>
                    <td>{product.stock}</td>
                    <td>{product.status}</td>
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
