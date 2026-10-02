import { createFileRoute } from "@tanstack/react-router";
import { Edit3, ImagePlus, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/products")({ component: AdminProducts });

type ProductStatus = "draft" | "published" | "archived";
type Category = { id: string; name: string; slug: string };
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_mad: number;
  discount_price_mad: number | null;
  category_id: string | null;
  image_urls: string[];
  stock: number;
  sku: string | null;
  brand: string | null;
  status: ProductStatus;
  is_featured: boolean;
  created_at: string;
};
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  price_mad: string;
  discount_price_mad: string;
  category_id: string;
  image_url: string;
  stock: string;
  sku: string;
  brand: string;
  status: ProductStatus;
  is_featured: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  description: "",
  price_mad: "",
  discount_price_mad: "",
  category_id: "",
  image_url: "",
  stock: "0",
  sku: "",
  brand: "",
  status: "draft",
  is_featured: false,
};

const money = (value: number) => `${Number(value || 0).toLocaleString("fr-MA")} د.م`;
const statusLabels: Record<ProductStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};

function toForm(product: Product): ProductForm {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    price_mad: String(product.price_mad),
    discount_price_mad: product.discount_price_mad == null ? "" : String(product.discount_price_mad),
    category_id: product.category_id || "",
    image_url: product.image_urls?.[0] || "",
    stock: String(product.stock),
    sku: product.sku || "",
    brand: product.brand || "",
    status: product.status,
    is_featured: product.is_featured,
  };
}

function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    const [productResult, categoryResult] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("categories").select("id,name,slug").eq("is_active", true).order("sort_order"),
    ]);
    if (productResult.error) setError(productResult.error.message);
    setProducts((productResult.data as Product[]) || []);
    setCategories((categoryResult.data as Category[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;
    return products.filter((product) =>
      [product.name, product.slug, product.sku || "", product.brand || ""].some((field) =>
        field.toLowerCase().includes(value),
      ),
    );
  }, [products, query]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm(toForm(product));
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.name.trim() || !form.slug.trim() || !form.price_mad) {
      setError("أدخل اسم المنتج والرابط والسعر قبل الحفظ.");
      return;
    }
    const price = Number(form.price_mad);
    const discount = form.discount_price_mad ? Number(form.discount_price_mad) : null;
    const stock = Number(form.stock || 0);
    if (!Number.isFinite(price) || price < 0 || (discount !== null && (!Number.isFinite(discount) || discount < 0))) {
      setError("تحقق من قيم الأسعار.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError("المخزون يجب أن يكون رقماً صحيحاً غير سالب.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: form.description.trim() || null,
      price_mad: price,
      discount_price_mad: discount,
      category_id: form.category_id || null,
      image_urls: form.image_url.trim() ? [form.image_url.trim()] : [],
      stock,
      sku: form.sku.trim() || null,
      brand: form.brand.trim() || null,
      status: form.status,
      is_featured: form.is_featured,
    };
    const result = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId).select("*").single()
      : await supabase.from("products").insert(payload).select("*").single();
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(editingId ? "تم تحديث المنتج بنجاح." : "تمت إضافة المنتج بنجاح.");
    if (!editingId) setForm(emptyForm);
    setEditingId(null);
    await loadData();
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`حذف المنتج «${product.name}» نهائياً؟`)) return;
    setError("");
    const result = await supabase.from("products").delete().eq("id", product.id);
    if (result.error) setError(result.error.message);
    else {
      setNotice("تم حذف المنتج.");
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingId === product.id) startCreate();
    }
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">المخزون والكتالوج</span>
          <h2>إدارة المنتجات</h2>
          <p>أضف المنتجات وعدّل الأسعار والصور والمخزون وحالة النشر.</p>
        </div>
        <div className="admin-heading-actions">
          <button className="dashboard-refresh" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} /> تحديث
          </button>
          <button className="admin-primary-button" onClick={startCreate}>
            <Plus size={16} /> منتج جديد
          </button>
        </div>
      </div>

      {(error || notice) && <div className={`admin-alert ${error ? "error" : "success"}`}>{error || notice}</div>}

      <form className="dashboard-panel admin-form-panel" onSubmit={saveProduct}>
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">{editingId ? "تعديل" : "إضافة"}</span>
            <h3>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
          </div>
          {editingId && (
            <button type="button" className="admin-icon-button" onClick={startCreate} aria-label="إلغاء التعديل">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="admin-form-grid">
          <label><span>اسم المنتج *</span><input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="اسم المنتج" /></label>
          <label><span>الرابط المختصر *</span><input dir="ltr" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} placeholder="product-slug" /></label>
          <label><span>السعر *</span><input dir="ltr" type="number" min="0" step="0.01" value={form.price_mad} onChange={(event) => updateField("price_mad", event.target.value)} /></label>
          <label><span>سعر التخفيض</span><input dir="ltr" type="number" min="0" step="0.01" value={form.discount_price_mad} onChange={(event) => updateField("discount_price_mad", event.target.value)} placeholder="اختياري" /></label>
          <label><span>المخزون</span><input dir="ltr" type="number" min="0" step="1" value={form.stock} onChange={(event) => updateField("stock", event.target.value)} /></label>
          <label><span>التصنيف</span><select value={form.category_id} onChange={(event) => updateField("category_id", event.target.value)}><option value="">بدون تصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>العلامة التجارية</span><input value={form.brand} onChange={(event) => updateField("brand", event.target.value)} /></label>
          <label><span>SKU</span><input dir="ltr" value={form.sku} onChange={(event) => updateField("sku", event.target.value)} /></label>
          <label><span>الحالة</span><select value={form.status} onChange={(event) => updateField("status", event.target.value as ProductStatus)}>{(Object.keys(statusLabels) as ProductStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <label className="admin-check-field"><input type="checkbox" checked={form.is_featured} onChange={(event) => updateField("is_featured", event.target.checked)} /><span>منتج مميز</span></label>
          <label className="admin-form-wide"><span>رابط الصورة</span><div className="admin-input-with-icon"><ImagePlus size={16} /><input dir="ltr" value={form.image_url} onChange={(event) => updateField("image_url", event.target.value)} placeholder="https://..." /></div></label>
          <label className="admin-form-wide"><span>الوصف</span><textarea rows={3} value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="وصف المنتج" /></label>
        </div>
        <div className="admin-form-actions"><button type="submit" className="admin-primary-button" disabled={saving}>{saving ? "جار الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المنتج"}</button><button type="button" className="admin-secondary-button" onClick={startCreate}>مسح الحقول</button></div>
      </form>

      <div className="dashboard-panel admin-table-panel">
        <div className="admin-toolbar"><div><strong>كل المنتجات</strong><small>{filteredProducts.length} منتج</small></div><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو SKU..." /></label></div>
        {loading ? <p className="admin-state">جار تحميل المنتجات...</p> : filteredProducts.length === 0 ? <p className="admin-state">لا توجد منتجات مطابقة.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.slug}{product.sku ? ` · ${product.sku}` : ""}</small></td><td>{money(product.discount_price_mad ?? product.price_mad)}{product.discount_price_mad != null && <small className="admin-strike">{money(product.price_mad)}</small>}</td><td><span className={product.stock < 5 ? "stock-low" : ""}>{product.stock}</span></td><td><span className={`status-pill ${product.status}`}>{statusLabels[product.status]}</span></td><td><div className="admin-row-actions"><button className="admin-action edit" onClick={() => startEdit(product)}><Edit3 size={14} /> تعديل</button><button className="admin-action delete" onClick={() => void deleteProduct(product)}><Trash2 size={14} /> حذف</button></div></td></tr>)}</tbody></table></div>}
      </div>
    </section>
  );
}
