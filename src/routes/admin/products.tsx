import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ClipboardPaste,
  ChevronDown,
  Edit3,
  ImagePlus,
  PackageX,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import {
  getLocalCategories,
  getLocalProducts,
  CATALOG_EMPTY,
  deleteLocalProduct,
  upsertLocalProduct,
  upsertLocalCategory,
  deleteLocalCategory,
} from "@/lib/local-store";
import { generateProductMetadata } from "@/lib/admin-ai.functions";

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
  tags: string[];
  created_at: string;
};
type BulkRow = {
  name: string;
  price: string;
  stock: string;
  category: string;
  status: ProductStatus;
  slug: string;
  description: string;
  tags: string;
  image_url: string;
};
type AISettings = {
  language: "ar" | "fr" | "en";
  tone: "professional" | "friendly" | "minimal";
  descriptionLength: "short" | "standard" | "long";
  tagCount: number;
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
  tags: string;
};

const defaultAISettings: AISettings = {
  language: "ar",
  tone: "professional",
  descriptionLength: "standard",
  tagCount: 8,
};
const readAISettings = (): AISettings => {
  if (typeof window === "undefined") return defaultAISettings;
  try {
    return {
      ...defaultAISettings,
      ...JSON.parse(window.localStorage.getItem("topchamal-ai-settings") || "{}"),
    } as AISettings;
  } catch {
    return defaultAISettings;
  }
};
const languageLabels: Record<AISettings["language"], string> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};
const toneLabels: Record<AISettings["tone"], string> = {
  professional: "احترافي",
  friendly: "ودود",
  minimal: "مختصر",
};
const lengthLabels: Record<AISettings["descriptionLength"], string> = {
  short: "قصير (30-50 كلمة)",
  standard: "متوسط (60-90 كلمة)",
  long: "مفصل (100-140 كلمة)",
};

const emptyBulkRow = (): BulkRow => ({
  name: "",
  price: "",
  stock: "0",
  category: "",
  status: "draft",
  slug: "",
  description: "",
  tags: "",
  image_url: "",
});
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const guessDescription = (name: string) =>
  name.trim() ? `منتج ${name.trim()} من تشكيلة Topchamal.` : "";

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
  tags: "",
};

const money = (value: number) => `${Number(value || 0).toLocaleString("fr-MA")} د.م`;
const productsTable = (): any => supabase.from("products");
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
    discount_price_mad:
      product.discount_price_mad == null ? "" : String(product.discount_price_mad),
    category_id: product.category_id || "",
    image_url: product.image_urls?.[0] || "",
    stock: String(product.stock),
    sku: product.sku || "",
    brand: product.brand || "",
    status: product.status,
    is_featured: product.is_featured,
    tags: (product.tags || []).join(", "),
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
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, emptyBulkRow),
  );
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [aiSettings, setAiSettings] = useState<AISettings>(readAISettings);
  const [catalogName, setCatalogName] = useState("");
  const [catalogSlug, setCatalogSlug] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [copilot, setCopilot] = useState({
    name: "",
    brand: "",
    category_id: "",
    price: "",
    stock: "0",
    notes: "",
  });
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("topchamal-admin-collapsed-panels") || "{}") as Record<
        string,
        boolean
      >;
    } catch {
      return {};
    }
  });

  function togglePanel(panel: string) {
    setCollapsedPanels((current) => {
      const next = { ...current, [panel]: !current[panel] };
      try {
        localStorage.setItem("topchamal-admin-collapsed-panels", JSON.stringify(next));
      } catch {
        /* Layout preferences are optional. */
      }
      return next;
    });
  }

  function panelToggle(panel: string) {
    const isCollapsed = !!collapsedPanels[panel];
    return (
      <button
        type="button"
        className="admin-collapse-button"
        onClick={() => togglePanel(panel)}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown size={15} className={isCollapsed ? "is-collapsed" : ""} />
        {isCollapsed ? "إظهار" : "إخفاء"}
      </button>
    );
  }

  async function loadData() {
    setLoading(true);
    setError("");
    if (CATALOG_EMPTY) {
      setProducts([]);
      setCategories(getLocalCategories());
      setLoading(false);
      return;
    }
    if (!supabaseConfigured) {
      setProducts(getLocalProducts() as Product[]);
      setCategories(getLocalCategories());
      setLoading(false);
      return;
    }
    const categoryPromise = supabase
      .from("categories")
      .select("id,name,slug")
      .eq("is_active", true)
      .order("sort_order");
    const allProducts: Product[] = [];
    const pageSize = 1000;
    let page = 0;
    let productError: string | null = null;
    while (true) {
      const result = await productsTable()
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (result.error) {
        productError = result.error.message;
        break;
      }
      allProducts.push(...((result.data as unknown as Product[]) || []));
      if (!result.data || result.data.length < pageSize) break;
      page += 1;
    }
    const categoryResult = await categoryPromise;
    if (productError) setError(productError);
    setProducts(allProducts);
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
      [
        product.name,
        product.slug,
        product.sku || "",
        product.brand || "",
        product.tags.join(" "),
        categories.find((category) => category.id === product.category_id)?.name || "",
      ].some((field) => field.toLowerCase().includes(value)),
    );
  }, [categories, products, query]);

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

  async function imageToDataUrl(file: File): Promise<string> {
    if (typeof createImageBitmap === "undefined")
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  function readImageFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة صالحاً.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 4 ميغابايت.");
      return;
    }
    void imageToDataUrl(file)
      .then((image_url) => setForm((current) => ({ ...current, image_url })))
      .catch(() => setError("تعذر تجهيز الصورة."));
  }

  function readBulkImageFile(index: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      setError("كل صورة يجب أن تكون صالحة وأقل من 4 ميغابايت.");
      return;
    }
    void imageToDataUrl(file)
      .then((image_url) =>
        setBulkRows((current) =>
          current.map((row, rowIndex) => (rowIndex === index ? { ...row, image_url } : row)),
        ),
      )
      .catch(() => setError("تعذر تجهيز الصورة."));
  }

  function saveCatalog() {
    const name = catalogName.trim();
    const slug = slugify(catalogSlug || name);
    if (!name || !slug) {
      setError("أدخل اسم الكتالوج.");
      return;
    }
    if (supabaseConfigured) {
      setError("إدارة الكتالوجات متاحة حالياً في الوضع المحلي فقط.");
      return;
    }
    upsertLocalCategory(name, slug, editingCategoryId || undefined);
    setCategories(getLocalCategories());
    setCatalogName("");
    setCatalogSlug("");
    setEditingCategoryId(null);
    setNotice(editingCategoryId ? "تم تحديث الكتالوج." : "تمت إضافة الكتالوج.");
  }

  function editCatalog(category: Category) {
    setEditingCategoryId(category.id);
    setCatalogName(category.name);
    setCatalogSlug(category.slug);
  }

  function removeCatalog(category: Category) {
    if (!window.confirm(`حذف الكتالوج «${category.name}»؟`)) return;
    if (supabaseConfigured) {
      setError("إدارة الكتالوجات متاحة حالياً في الوضع المحلي فقط.");
      return;
    }
    deleteLocalCategory(category.id);
    setCategories(getLocalCategories());
    setNotice("تم حذف الكتالوج.");
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.name.trim()) {
      setError("أدخل اسم المنتج قبل الحفظ.");
      return;
    }
    const generatedSlug = slugify(form.slug || form.name);
    const price = Number(form.price_mad);
    const discount = form.discount_price_mad ? Number(form.discount_price_mad) : null;
    const stock = Number(form.stock || 0);
    if (
      !Number.isFinite(price) ||
      (!form.price_mad ? false : price < 0) ||
      (discount !== null && (!Number.isFinite(discount) || discount < 0))
    ) {
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
      slug: generatedSlug || `product-${Date.now()}`,
      description: form.description.trim() || null,
      price_mad: form.price_mad ? price : 0,
      discount_price_mad: discount,
      category_id: form.category_id || null,
      image_urls: form.image_url.trim() ? [form.image_url.trim()] : [],
      stock,
      sku: form.sku.trim() || null,
      brand: form.brand.trim() || null,
      status: form.price_mad ? form.status : "draft",
      is_featured: form.is_featured,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
    };
    if (!supabaseConfigured) {
      upsertLocalProduct(editingId ? { ...payload, id: editingId } : payload);
      setSaving(false);
      setNotice(
        editingId
          ? "تم تحديث المنتج بنجاح."
          : form.price_mad
            ? "تمت إضافة المنتج بنجاح."
            : "تم حفظ المنتج كمسودة. يمكنك إضافة السعر لاحقاً.",
      );
      if (!editingId) setForm(emptyForm);
      setEditingId(null);
      await loadData();
      return;
    }
    const result = editingId
      ? await productsTable().update(payload).eq("id", editingId).select("*").single()
      : await productsTable().insert(payload).select("*").single();
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(
      editingId
        ? "تم تحديث المنتج بنجاح."
        : form.price_mad
          ? "تمت إضافة المنتج بنجاح."
          : "تم حفظ المنتج كمسودة. يمكنك إضافة السعر لاحقاً.",
    );
    if (!editingId) setForm(emptyForm);
    setEditingId(null);
    await loadData();
  }

  function updateBulkRow(index: number, field: keyof BulkRow, value: string) {
    setBulkRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  }

  function addBulkRows(count = 5) {
    setBulkRows((current) => [...current, ...Array.from({ length: count }, emptyBulkRow)]);
  }

  function importBulkText() {
    const lines = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const imported = lines.map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const [name = "", price = "", stock = "0", category = ""] = parts.map((part) => part.trim());
      const matchedCategory = categories.find(
        (item) =>
          item.id === category ||
          item.slug === category ||
          item.name.toLowerCase() === category.toLowerCase(),
      );
      return {
        ...emptyBulkRow(),
        name,
        price,
        stock: stock || "0",
        category: matchedCategory?.id || "",
      };
    });
    if (imported.length) {
      setBulkRows(imported);
      setBulkText("");
      setNotice(`تم استيراد ${imported.length} صف. راجعها ثم احفظ.`);
    }
  }

  function updateAISettings<K extends keyof AISettings>(field: K, value: AISettings[K]) {
    setAiSettings((current) => ({ ...current, [field]: value }));
  }

  function saveAISettings() {
    window.localStorage.setItem("topchamal-ai-settings", JSON.stringify(aiSettings));
    setNotice("تم حفظ إعدادات التوليد بالذكاء الاصطناعي.");
  }

  async function assistBulkRow(index: number) {
    const row = bulkRows[index];
    if (!row?.name.trim()) {
      setError("أدخل اسم المنتج أولاً ثم اضغط المساعدة الذكية.");
      return;
    }
    setError("");
    try {
      const category = categories.find((item) => item.id === row.category);
      const suggestion = await generateProductMetadata({
        data: {
          name: row.name,
          category: category?.name || "",
          existingDescription: row.description,
          language: aiSettings.language,
          tone: aiSettings.tone,
          descriptionLength: aiSettings.descriptionLength,
          tagCount: aiSettings.tagCount,
        },
      });
      setBulkRows((current) =>
        current.map((item, rowIndex) =>
          rowIndex === index
            ? {
                ...item,
                slug: suggestion.slug,
                description: suggestion.description,
                tags: suggestion.tags.join(", "),
              }
            : item,
        ),
      );
      setNotice("تم إنشاء الوصف والوسوم والرابط بواسطة OpenAI. راجعها قبل الحفظ.");
    } catch (assistError) {
      setError(assistError instanceof Error ? assistError.message : "تعذر تشغيل المساعد الذكي.");
    }
  }

  async function assistSingleProduct() {
    if (!form.name.trim()) {
      setError("أدخل اسم المنتج أولاً ثم شغّل المساعد الذكي.");
      return;
    }
    setAiLoading(true);
    setError("");
    try {
      const category = categories.find((item) => item.id === form.category_id);
      const suggestion = await generateProductMetadata({
        data: {
          name: form.name,
          brand: form.brand,
          category: category?.name || "",
          existingDescription: form.description,
          language: aiSettings.language,
          tone: aiSettings.tone,
          descriptionLength: aiSettings.descriptionLength,
          tagCount: aiSettings.tagCount,
        },
      });
      setForm((current) => ({
        ...current,
        slug: suggestion.slug,
        description: suggestion.description,
        tags: suggestion.tags.join(", "),
      }));
      setNotice("تم إنشاء الوصف والوسوم والرابط بواسطة OpenAI. راجعها قبل الحفظ.");
    } catch (assistError) {
      setError(assistError instanceof Error ? assistError.message : "تعذر تشغيل المساعد الذكي.");
    } finally {
      setAiLoading(false);
    }
  }

  async function buildCopilotDraft() {
    if (!copilot.name.trim()) {
      setError("المساعد يحتاج اسم المنتج أولاً.");
      return;
    }
    setCopilotLoading(true);
    setError("");
    const category = categories.find((item) => item.id === copilot.category_id);
    try {
      const suggestion = await generateProductMetadata({
        data: {
          name: copilot.name,
          brand: copilot.brand,
          category: category?.name || "",
          existingDescription: copilot.notes,
          language: aiSettings.language,
          tone: aiSettings.tone,
          descriptionLength: aiSettings.descriptionLength,
          tagCount: aiSettings.tagCount,
        },
      });
      setForm({
        ...emptyForm,
        name: copilot.name.trim(),
        slug: suggestion.slug,
        brand: copilot.brand.trim(),
        category_id: copilot.category_id,
        price_mad: copilot.price,
        stock: copilot.stock || "0",
        description: suggestion.description,
        tags: suggestion.tags.join(", "),
      });
      setNotice("جهّز المساعد مسودة المنتج. راجعها ثم احفظها.");
    } catch {
      setForm({
        ...emptyForm,
        name: copilot.name.trim(),
        slug: slugify(copilot.name),
        brand: copilot.brand.trim(),
        category_id: copilot.category_id,
        price_mad: copilot.price,
        stock: copilot.stock || "0",
        description: copilot.notes || guessDescription(copilot.name),
        tags: category?.name || "",
      });
      setNotice("تم تجهيز المسودة. أضف مفتاح OpenAI لتوليد وصف ووسوم أكثر تفصيلاً.");
    } finally {
      setCopilotLoading(false);
    }
  }

  async function saveBulkProducts() {
    const rows = bulkRows.filter((row) => row.name.trim());
    if (!rows.length) {
      setError("أدخل اسم منتج واحد على الأقل في جدول الإضافة السريعة.");
      return;
    }
    const invalidRow = rows.find(
      (row) =>
        (row.price.trim() && (!Number.isFinite(Number(row.price)) || Number(row.price) < 0)) ||
        !Number.isFinite(Number(row.stock || 0)) ||
        Number(row.stock || 0) < 0,
    );
    if (invalidRow) {
      setError(`تحقق من السعر والمخزون للمنتج «${invalidRow.name}».`);
      return;
    }
    setBulkSaving(true);
    setError("");
    const payload = rows.map((row, index) => ({
      name: row.name.trim(),
      slug: slugify(row.slug || row.name) || `product-${Date.now()}-${index}`,
      description: row.description.trim() || null,
      tags: row.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
      price_mad: Number(row.price || 0),
      discount_price_mad: null,
      category_id: row.category || null,
      image_urls: row.image_url.trim() ? [row.image_url.trim()] : [],
      stock: Math.max(0, Number(row.stock || 0)),
      sku: null,
      brand: null,
      status: row.price.trim() ? row.status : "draft",
      is_featured: false,
    }));
    const chunkSize = 100;
    const totalChunks = Math.ceil(payload.length / chunkSize);
    if (!supabaseConfigured) {
      payload.forEach((item) => upsertLocalProduct(item));
      setBulkSaving(false);
      setBulkProgress("");
      setNotice(`${payload.length} منتج جاهز. المنتجات بدون سعر بقيت كمسودات حتى تكمل بياناتها.`);
      setBulkRows(Array.from({ length: 5 }, emptyBulkRow));
      await loadData();
      return;
    }
    for (let index = 0; index < payload.length; index += chunkSize) {
      const chunkNumber = Math.floor(index / chunkSize) + 1;
      setBulkProgress(`جار حفظ الدفعة ${chunkNumber} من ${totalChunks}...`);
      const result = await productsTable().insert(payload.slice(index, index + chunkSize));
      if (result.error) {
        setBulkSaving(false);
        setBulkProgress("");
        setError(`تم حفظ ${index} منتجاً قبل الخطأ: ${result.error.message}`);
        await loadData();
        return;
      }
    }
    setBulkSaving(false);
    setBulkProgress("");
    setNotice(`${payload.length} منتج جاهز. المنتجات بدون سعر بقيت كمسودات حتى تكمل بياناتها.`);
    setBulkRows(Array.from({ length: 5 }, emptyBulkRow));
    await loadData();
  }

  async function setStock(product: Product, stock: number) {
    if (!supabaseConfigured) {
      upsertLocalProduct({ ...product, stock });
      setNotice(stock === 0 ? "تم وضع المنتج خارج المخزون." : "تم تحديث المخزون.");
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stock } : item)),
      );
      return;
    }
    const result = await productsTable().update({ stock }).eq("id", product.id);
    if (result.error) setError(result.error.message);
    else {
      setNotice(stock === 0 ? "تم وضع المنتج خارج المخزون." : "تم تحديث المخزون.");
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stock } : item)),
      );
    }
  }

  async function archiveProduct(product: Product) {
    if (!supabaseConfigured) {
      upsertLocalProduct({ ...product, status: "archived" });
      setNotice("تم نقل المنتج إلى التخزين/الأرشيف.");
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: "archived" } : item)),
      );
      return;
    }
    const result = await supabase
      .from("products")
      .update({ status: "archived" })
      .eq("id", product.id);
    if (result.error) setError(result.error.message);
    else {
      setNotice("تم نقل المنتج إلى التخزين/الأرشيف.");
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: "archived" } : item)),
      );
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`حذف المنتج «${product.name}» نهائياً؟`)) return;
    setError("");
    if (!supabaseConfigured) {
      deleteLocalProduct(product.id);
      setNotice("تم حذف المنتج.");
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingId === product.id) startCreate();
      return;
    }
    const result = await productsTable().delete().eq("id", product.id);
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

      {(error || notice) && (
        <div className={`admin-alert ${error ? "error" : "success"}`}>{error || notice}</div>
      )}

      <section className="dashboard-panel ai-settings-panel">
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">إعدادات المساعد</span>
            <h3>تخصيص التوليد بالذكاء الاصطناعي</h3>
            <p className="admin-panel-help">
              هذه الإعدادات تُحفظ لهذا المتصفح وتُستخدم في الإضافة الفردية والجماعية.
            </p>
          </div>
          {panelToggle("ai-settings")}
        </div>
        {!collapsedPanels["ai-settings"] && (
          <div className="ai-settings-grid">
            <label>
              <span>لغة الوصف والوسوم</span>
              <select
                value={aiSettings.language}
                onChange={(event) =>
                  updateAISettings("language", event.target.value as AISettings["language"])
                }
              >
                {(Object.keys(languageLabels) as AISettings["language"][]).map((language) => (
                  <option key={language} value={language}>
                    {languageLabels[language]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>نبرة الكتابة</span>
              <select
                value={aiSettings.tone}
                onChange={(event) =>
                  updateAISettings("tone", event.target.value as AISettings["tone"])
                }
              >
                {(Object.keys(toneLabels) as AISettings["tone"][]).map((tone) => (
                  <option key={tone} value={tone}>
                    {toneLabels[tone]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>طول الوصف</span>
              <select
                value={aiSettings.descriptionLength}
                onChange={(event) =>
                  updateAISettings(
                    "descriptionLength",
                    event.target.value as AISettings["descriptionLength"],
                  )
                }
              >
                {(Object.keys(lengthLabels) as AISettings["descriptionLength"][]).map((length) => (
                  <option key={length} value={length}>
                    {lengthLabels[length]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>عدد الوسوم</span>
              <select
                value={aiSettings.tagCount}
                onChange={(event) => updateAISettings("tagCount", Number(event.target.value))}
              >
                {[5, 6, 8, 10, 12].map((count) => (
                  <option key={count} value={count}>
                    {count} وسوم
                  </option>
                ))}
              </select>
            </label>
            <div className="ai-settings-summary">
              <Sparkles size={15} /> {languageLabels[aiSettings.language]} ·{" "}
              {toneLabels[aiSettings.tone]} · {lengthLabels[aiSettings.descriptionLength]} ·{" "}
              {aiSettings.tagCount} وسوم
            </div>
            <button type="button" className="admin-primary-button" onClick={saveAISettings}>
              حفظ الإعدادات
            </button>
          </div>
        )}
      </section>

      <section className="dashboard-panel product-copilot-panel">
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">مساعد الإضافة</span>
            <h3>اسألني عن المنتج وسأجهز لك مسودة</h3>
            <p className="admin-panel-help">
              أجب عن الأسئلة الأساسية فقط؛ سيكمل المساعد الرابط والوصف والوسوم، ثم يمكنك تعديل كل
              شيء قبل النشر.
            </p>
          </div>
          {panelToggle("copilot")}
        </div>
        {!collapsedPanels["copilot"] && (
          <>
            <div className="copilot-chat">
              <div className="copilot-message">
                ما اسم المنتج؟ وما العلامة التجارية والتصنيف والسعر والمخزون؟ يمكنك إضافة ملاحظات
                قصيرة وسأرتب المعلومات لك.
              </div>
            </div>
            <div className="admin-form-grid copilot-grid">
              <label>
                <span>اسم المنتج *</span>
                <input
                  value={copilot.name}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="مثلاً: Blender Moulinex"
                />
              </label>
              <label>
                <span>العلامة التجارية</span>
                <input
                  value={copilot.brand}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, brand: event.target.value }))
                  }
                  placeholder="Moulinex"
                />
              </label>
              <label>
                <span>التصنيف</span>
                <select
                  value={copilot.category_id}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, category_id: event.target.value }))
                  }
                >
                  <option value="">بدون تصنيف</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>السعر</span>
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  value={copilot.price}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, price: event.target.value }))
                  }
                  placeholder="اتركه فارغاً لمسودة"
                />
              </label>
              <label>
                <span>المخزون</span>
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  value={copilot.stock}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, stock: event.target.value }))
                  }
                />
              </label>
              <label className="admin-form-wide">
                <span>معلومات إضافية أو وصف أولي</span>
                <textarea
                  value={copilot.notes}
                  onChange={(event) =>
                    setCopilot((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="اللون، السعة، أو أي معلومة تريد تضمينها..."
                />
              </label>
            </div>
            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-primary-button"
                onClick={() => void buildCopilotDraft()}
                disabled={copilotLoading}
              >
                <Sparkles size={16} />{" "}
                {copilotLoading ? "المساعد يجهز المسودة..." : "جهّز لي مسودة المنتج"}
              </button>
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => {
                  setCopilot({
                    name: "",
                    brand: "",
                    category_id: "",
                    price: "",
                    stock: "0",
                    notes: "",
                  });
                  setForm(emptyForm);
                }}
              >
                مسح المحادثة
              </button>
            </div>
          </>
        )}
      </section>

      <section className="dashboard-panel catalog-manager-panel">
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">التصنيفات والكتالوجات</span>
            <h3>إدارة الكتالوجات</h3>
            <p className="admin-panel-help">
              أنشئ تصنيفات جديدة، ثم اخترها لكل منتج أثناء الإضافة الجماعية أو التعديل.
            </p>
          </div>
          {panelToggle("catalog")}
        </div>
        {!collapsedPanels["catalog"] && (
          <>
            <div className="admin-form-grid">
              <label>
                <span>اسم الكتالوج</span>
                <input
                  value={catalogName}
                  onChange={(event) => setCatalogName(event.target.value)}
                  placeholder="مثلاً: أجهزة المطبخ"
                />
              </label>
              <label>
                <span>الرابط المختصر</span>
                <input
                  dir="ltr"
                  value={catalogSlug}
                  onChange={(event) => setCatalogSlug(event.target.value)}
                  placeholder="kitchen-appliances"
                />
              </label>
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-primary-button" onClick={saveCatalog}>
                {editingCategoryId ? "حفظ تعديل الكتالوج" : "إضافة الكتالوج"}
              </button>
              {editingCategoryId && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCatalogName("");
                    setCatalogSlug("");
                  }}
                >
                  إلغاء
                </button>
              )}
            </div>
            <div className="admin-row-actions catalog-list">
              {categories.map((category) => (
                <span className="status-pill" key={category.id}>
                  {category.name}
                  <button
                    type="button"
                    className="admin-icon-button"
                    onClick={() => editCatalog(category)}
                    aria-label={`تعديل ${category.name}`}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    onClick={() => removeCatalog(category)}
                    aria-label={`حذف ${category.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="dashboard-panel bulk-products-panel">
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">إضافة سريعة</span>
            <h3>أضف عدة منتجات مرة واحدة</h3>
            <p className="admin-panel-help">
              يمكنك ترك السعر فارغاً؛ سيُحفظ المنتج كمسودة لتكمل معلوماته لاحقاً.
            </p>
          </div>
          <div className="bulk-panel-actions">
            <button type="button" className="admin-secondary-button" onClick={() => addBulkRows()}>
              <Plus size={15} /> صفوف جديدة
            </button>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void saveBulkProducts()}
              disabled={bulkSaving}
            >
              <ClipboardPaste size={15} />{" "}
              {bulkProgress || (bulkSaving ? "جار الحفظ..." : "حفظ الكل")}
            </button>
          </div>
          {panelToggle("bulk")}
        </div>
        {!collapsedPanels["bulk"] && (
          <>
            <div className="bulk-import">
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder="الصق من Excel أو Google Sheets: الاسم، السعر، المخزون، التصنيف (كل منتج في سطر)"
              />
              <button type="button" className="admin-secondary-button" onClick={importBulkText}>
                استيراد الصفوف
              </button>
            </div>
            <div className="admin-table-wrap bulk-table-wrap">
              <table className="admin-table bulk-table" aria-label="إضافة منتجات بالجملة">
                <thead>
                  <tr>
                    <th>اسم المنتج *</th>
                    <th>الوصف</th>
                    <th>السعر لاحقاً</th>
                    <th>المخزون</th>
                    <th>التصنيف</th>
                    <th>الحالة</th>
                    <th>الصورة</th>
                    <th>الوسوم</th>
                    <th>مساعدة</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          value={row.name}
                          onChange={(event) => updateBulkRow(index, "name", event.target.value)}
                          placeholder="مثلاً: خلاط Moulinex"
                        />
                      </td>
                      <td>
                        <input
                          value={row.description}
                          onChange={(event) =>
                            updateBulkRow(index, "description", event.target.value)
                          }
                          placeholder="وصف المنتج"
                        />
                      </td>
                      <td>
                        <input
                          dir="ltr"
                          type="number"
                          min="0"
                          value={row.price}
                          onChange={(event) => updateBulkRow(index, "price", event.target.value)}
                          placeholder="لاحقاً"
                        />
                      </td>
                      <td>
                        <input
                          dir="ltr"
                          type="number"
                          min="0"
                          step="1"
                          value={row.stock}
                          onChange={(event) => updateBulkRow(index, "stock", event.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          value={row.category}
                          onChange={(event) => updateBulkRow(index, "category", event.target.value)}
                        >
                          <option value="">بدون تصنيف</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) => updateBulkRow(index, "status", event.target.value)}
                        >
                          <option value="draft">مسودة</option>
                          <option value="published">منشور</option>
                          <option value="archived">مؤرشف</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => readBulkImageFile(index, event.target.files?.[0])}
                        />
                        <input
                          dir="ltr"
                          value={
                            row.image_url.startsWith("data:") ? "تم اختيار صورة" : row.image_url
                          }
                          onChange={(event) =>
                            updateBulkRow(index, "image_url", event.target.value)
                          }
                          placeholder="رابط الصورة"
                        />
                      </td>
                      <td>
                        <input
                          value={row.tags}
                          onChange={(event) => updateBulkRow(index, "tags", event.target.value)}
                          placeholder="وسوم"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-action ai"
                          onClick={() => void assistBulkRow(index)}
                          title="توليد الوصف والوسوم والرابط بواسطة OpenAI"
                        >
                          <Sparkles size={14} /> اقتراح
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="admin-ai-note">
              <Sparkles size={13} /> OpenAI يولّد الوصف والوسوم والرابط، وتبقى كل الاقتراحات قابلة
              للمراجعة قبل الحفظ.
            </small>
          </>
        )}
      </section>

      <form className="dashboard-panel admin-form-panel" onSubmit={saveProduct}>
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">{editingId ? "تعديل" : "إضافة"}</span>
            <h3>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
          </div>
          {editingId && (
            <button
              type="button"
              className="admin-icon-button"
              onClick={startCreate}
              aria-label="إلغاء التعديل"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="admin-form-grid">
          <label>
            <span>اسم المنتج *</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="اسم المنتج"
            />
          </label>
          <label>
            <span>الرابط المختصر *</span>
            <input
              dir="ltr"
              value={form.slug}
              onChange={(event) => updateField("slug", event.target.value)}
              placeholder="product-slug"
            />
          </label>
          <label>
            <span>السعر *</span>
            <input
              dir="ltr"
              type="number"
              min="0"
              step="0.01"
              value={form.price_mad}
              onChange={(event) => updateField("price_mad", event.target.value)}
            />
          </label>
          <label>
            <span>سعر التخفيض</span>
            <input
              dir="ltr"
              type="number"
              min="0"
              step="0.01"
              value={form.discount_price_mad}
              onChange={(event) => updateField("discount_price_mad", event.target.value)}
              placeholder="اختياري"
            />
          </label>
          <label>
            <span>المخزون</span>
            <input
              dir="ltr"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => updateField("stock", event.target.value)}
            />
          </label>
          <label>
            <span>التصنيف</span>
            <select
              value={form.category_id}
              onChange={(event) => updateField("category_id", event.target.value)}
            >
              <option value="">بدون تصنيف</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>العلامة التجارية</span>
            <input
              value={form.brand}
              onChange={(event) => updateField("brand", event.target.value)}
            />
          </label>
          <label>
            <span>SKU</span>
            <input
              dir="ltr"
              value={form.sku}
              onChange={(event) => updateField("sku", event.target.value)}
            />
          </label>
          <label>
            <span>الحالة</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as ProductStatus)}
            >
              {(Object.keys(statusLabels) as ProductStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-check-field">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(event) => updateField("is_featured", event.target.checked)}
            />
            <span>منتج مميز</span>
          </label>
          <label className="admin-form-wide">
            <span>الوسوم (مفصولة بفواصل)</span>
            <input
              value={form.tags}
              onChange={(event) => updateField("tags", event.target.value)}
              placeholder="خلاط، مطبخ، Moulinex"
            />
          </label>
          <label className="admin-form-wide">
            <span>الصورة</span>
            <div className="admin-input-with-icon">
              <ImagePlus size={16} />
              <input
                dir="ltr"
                value={form.image_url.startsWith("data:") ? "تم اختيار صورة محلية" : form.image_url}
                onChange={(event) => updateField("image_url", event.target.value)}
                placeholder="https://..."
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => readImageFile(event.target.files?.[0])}
            />
            <small>يمكنك رفع صورة من الهاتف أو لصق رابط صورة.</small>
          </label>
          <label className="admin-form-wide">
            <span>الوصف</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="وصف المنتج"
            />
          </label>
        </div>
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button ai-button"
            onClick={() => void assistSingleProduct()}
            disabled={aiLoading}
          >
            {aiLoading ? (
              "جار التوليد..."
            ) : (
              <>
                <Sparkles size={15} /> توليد الوصف والوسوم بالـ AI
              </>
            )}
          </button>
          <button type="submit" className="admin-primary-button" disabled={saving}>
            {saving ? "جار الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المنتج"}
          </button>
          <button type="button" className="admin-secondary-button" onClick={startCreate}>
            مسح الحقول
          </button>
        </div>
      </form>

      <div className="dashboard-panel admin-table-panel">
        <div className="admin-toolbar">
          <div>
            <strong>كل المنتجات</strong>
            <small>{filteredProducts.length} منتج</small>
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم أو SKU..."
            />
          </label>
        </div>
        {loading ? (
          <p className="admin-state">جار تحميل المنتجات...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="admin-state">لا توجد منتجات مطابقة.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>المخزون</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <small>
                        {product.slug}
                        {product.sku ? ` · ${product.sku}` : ""}
                      </small>
                    </td>
                    <td>
                      {money(product.discount_price_mad ?? product.price_mad)}
                      {product.discount_price_mad != null && (
                        <small className="admin-strike">{money(product.price_mad)}</small>
                      )}
                    </td>
                    <td>
                      <span className={product.stock < 5 ? "stock-low" : ""}>{product.stock}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${product.status}`}>
                        {statusLabels[product.status]}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-action edit" onClick={() => startEdit(product)}>
                          <Edit3 size={14} /> تعديل
                        </button>
                        <button
                          className="admin-action stock"
                          onClick={() => void setStock(product, product.stock === 0 ? 1 : 0)}
                        >
                          <PackageX size={14} /> {product.stock === 0 ? "متوفر" : "نفد"}
                        </button>
                        <button
                          className="admin-action archive"
                          onClick={() => void archiveProduct(product)}
                          disabled={product.status === "archived"}
                        >
                          <Archive size={14} /> تخزين
                        </button>
                        <button
                          className="admin-action delete"
                          onClick={() => void deleteProduct(product)}
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
