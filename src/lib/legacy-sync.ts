import { defaultSiteSettings, type LocalOrder, type LocalProduct, type LocalCategory } from "@/lib/local-store";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const MIGRATION_KEY = "topchamal-legacy-local-sync-v1";
const PRODUCT_STATUSES = new Set(["draft", "published", "archived"]);
const ORDER_STATUSES = new Set(["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"]);

type LegacySummary = {
  products: number;
  categories: number;
  orders: number;
  siteSettings: boolean;
  stories: number;
};

export type LegacySyncOptions = {
  force?: boolean;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Recovers data written by older admin builds that used localStorage instead
 * of Supabase. Automatic recovery is one-time per browser; an explicit admin
 * button can force the same local changes to be published again.
 */
export async function migrateLegacyLocalAdminData(
  { force = false }: LegacySyncOptions = {},
): Promise<LegacySummary | null> {
  if (typeof window === "undefined" || !supabaseConfigured) return null;
  if (!force && window.localStorage.getItem(MIGRATION_KEY)) return null;

  const summary: LegacySummary = { products: 0, categories: 0, orders: 0, siteSettings: false, stories: 0 };
  const localCategories = readJson<LocalCategory[]>("topchamal-local-categories", []);
  const localProducts = readJson<LocalProduct[]>("topchamal-local-products", []);
  const localOrders = readJson<LocalOrder[]>("topchamal-local-orders", []);
  const localStories = readJson<unknown[]>("topchamal-local-stories", []);
  const localSettings = readJson<Record<string, unknown> | null>("topchamal-local-site-settings", null);

  const categoryRows = localCategories
    .filter((category) => category && asString(category.slug))
    .map((category) => ({
      name: asString(category.name, asString(category.slug)),
      slug: asString(category.slug),
      is_active: category.is_active !== false,
      sort_order: Math.max(0, Math.trunc(asNumber(category.sort_order))),
    }));

  if (categoryRows.length) {
    const result = await supabase.from("categories").upsert(categoryRows, { onConflict: "slug" });
    if (result.error) throw result.error;
    const verification = await supabase
      .from("categories")
      .select("slug")
      .in("slug", categoryRows.map((row) => row.slug));
    if (verification.error) throw verification.error;
    if ((verification.data || []).length < new Set(categoryRows.map((row) => row.slug)).size) {
      throw new Error("تم الحفظ الجزئي للتصنيفات فقط. أعد المحاولة.");
    }
    summary.categories = categoryRows.length;
  }

  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select("id,slug");
  if (categoryError) throw categoryError;
  const categoryIds = new Map<string, string>();
  for (const row of (categoryData || []) as Array<{ id: string; slug: string }>) {
    categoryIds.set(row.slug, row.id);
  }

  const productRows = localProducts
    .filter((product) => product && asString(product.slug || product.id))
    .map((product) => {
      const categoryValue = asString(product.category_id);
      const categorySlug = categoryValue.replace(/^category-/, "");
      const status = asString(product.status, "draft");
      return {
        name: asString(product.name, asString(product.slug || product.id)),
        slug: asString(product.slug || product.id),
        description: product.description || null,
        price_mad: Math.max(0, asNumber(product.price_mad)),
        discount_price_mad:
          product.discount_price_mad == null ? null : Math.max(0, asNumber(product.discount_price_mad)),
        category_id: categoryIds.get(categorySlug) || categoryIds.get(categoryValue) || null,
        image_urls: Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean).map(String) : [],
        stock: Math.max(0, Math.trunc(asNumber(product.stock))),
        sku: product.sku || null,
        brand: product.brand || null,
        status: PRODUCT_STATUSES.has(status) ? status : "draft",
        is_featured: product.is_featured === true,
        tags: Array.isArray(product.tags) ? product.tags.filter(Boolean).map(String).slice(0, 12) : [],
      };
    });

  if (productRows.length) {
    const result = await supabase.from("products").upsert(productRows, { onConflict: "slug" });
    if (result.error) throw result.error;
    const verification = await supabase
      .from("products")
      .select("slug")
      .in("slug", productRows.map((row) => row.slug));
    if (verification.error) throw verification.error;
    if ((verification.data || []).length < new Set(productRows.map((row) => row.slug)).size) {
      throw new Error("تم الحفظ الجزئي للمنتجات فقط. أعد المحاولة.");
    }
    summary.products = productRows.length;
  }

  if (localSettings && JSON.stringify(localSettings) !== JSON.stringify(defaultSiteSettings)) {
    const result = await supabase.from("site_content").upsert({
      key: "site_settings",
      value: { ...defaultSiteSettings, ...localSettings },
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    const verification = await supabase.from("site_content").select("key").eq("key", "site_settings").maybeSingle();
    if (verification.error || !verification.data) {
      throw verification.error || new Error("لم يتم تأكيد حفظ إعدادات الموقع.");
    }
    summary.siteSettings = true;
  }

  if (Array.isArray(localStories) && localStories.length) {
    const result = await supabase.from("site_content").upsert({
      key: "stories",
      value: localStories,
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    const verification = await supabase.from("site_content").select("key").eq("key", "stories").maybeSingle();
    if (verification.error || !verification.data) {
      throw verification.error || new Error("لم يتم تأكيد حفظ القصص.");
    }
    summary.stories = localStories.length;
  }

  const orderRows = localOrders
    .filter((order) => order && asString(order.order_number || order.orderNumber))
    .map((order, index) => {
      const status = asString(order.status, "new");
      return {
        order_number: asString(order.order_number || order.orderNumber, `LOCAL-${index + 1}`),
        customer_name: asString(order.customer_name || order.name, "عميل المتجر"),
        phone: asString(order.phone, "غير متوفر"),
        email: order.email ? asString(order.email) : null,
        address: order.address ? asString(order.address) : null,
        city: order.city ? asString(order.city) : null,
        subtotal_mad: Math.max(0, asNumber(order.total_mad ?? order.total)),
        delivery_fee_mad: 0,
        total_mad: Math.max(0, asNumber(order.total_mad ?? order.total)),
        payment_method: asString(order.payment_method, "cash_on_delivery"),
        status: ORDER_STATUSES.has(status) ? status : "new",
        created_at: asString(order.created_at || order.createdAt, new Date().toISOString()),
      };
    });

  if (orderRows.length) {
    const result = await supabase.from("orders").upsert(orderRows, { onConflict: "order_number" });
    if (result.error) throw result.error;
    const verification = await supabase
      .from("orders")
      .select("order_number")
      .in("order_number", orderRows.map((row) => row.order_number));
    if (verification.error) throw verification.error;
    if ((verification.data || []).length < new Set(orderRows.map((row) => row.order_number)).size) {
      throw new Error("تم الحفظ الجزئي للطلبات فقط. أعد المحاولة.");
    }
    summary.orders = orderRows.length;
  }

  window.localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  return summary;
}
