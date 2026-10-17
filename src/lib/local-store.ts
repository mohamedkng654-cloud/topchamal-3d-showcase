import catalog from "../data/products.json";
import { supabase, supabaseConfigured } from "@/lib/supabase";

let sharedSettings: Partial<LocalSiteSettings> = {};
let sharedStories: LocalStory[] = [];
export async function readSharedContent<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from("site_content").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error("تعذر تحميل البيانات المشتركة. حاول مرة أخرى.");
  return data ? data.value as unknown as T : null;
}
export async function saveSharedContent(key: string, value: unknown): Promise<void> {
  if (!supabaseConfigured) throw new Error("تعذر الاتصال بالمتجر. لم يتم حفظ التغييرات.");
  const { error } = await supabase.from("site_content").upsert({ key, value: value as import("@/integrations/supabase/types").Json, updated_at: new Date().toISOString() });
  if (error) throw new Error("تعذر حفظ التغييرات لجميع الزوار. حاول مرة أخرى.");
}
async function loadSharedStories(): Promise<LocalStory[]> {
  const { data, error } = await supabase.from("store_stories").select("id,content,is_active,expires_at,created_at").order("created_at", { ascending: false });
  if (error) throw new Error("تعذر تحميل القصص.");
  return (data || []).map((row) => ({ ...(row.content as unknown as LocalStory), id: row.id, is_active: row.is_active, expires_at: row.expires_at, created_at: row.created_at }));
}
export async function pullSiteContent(): Promise<void> {
  const [settings, stories] = await Promise.all([
    readSharedContent<LocalSiteSettings>("site_settings"), loadSharedStories(),
  ]);
  sharedSettings = settings || {};
  sharedStories = stories || [];
}

export function subscribeToSiteContent(onChange: () => void) {
  if (!supabaseConfigured) return () => undefined;
  const channel = supabase
    .channel("topchamal-public-content")
    .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, () => {
      void pullSiteContent().then(onChange).catch((error) => console.error("[Site] Shared content refresh failed", error));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "store_stories" }, () => {
      void pullSiteContent().then(onChange).catch((error) => console.error("[Site] Story refresh failed", error));
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

const PRODUCTS_KEY = "topchamal-local-products";
const CATEGORIES_KEY = "topchamal-local-categories";
const ORDERS_KEY = "topchamal-local-orders";
const SETTINGS_KEY = "topchamal-local-site-settings";
const STORIES_KEY = "topchamal-local-stories";
const CATALOG_SEEDED_KEY = "topchamal-local-catalog-seeded-v1";
/** All products were intentionally removed globally. */
export const CATALOG_EMPTY = false;

type LocalProduct = {
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
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  tags: string[];
  created_at: string;
};
type LocalCategory = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};
type LocalOrder = {
  id?: string;
  order_number?: string;
  orderNumber?: string;
  customer_name?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  total_mad?: number;
  total?: number;
  payment_method?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
};
export type LocalSiteSettings = {
  brandName: string;
  heroKicker: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroDescription: string;
  aboutTitle: string;
  promoTitle: string;
  promoDescription: string;
  footerDescription: string;
  whatsapp: string;
};
export type StoryDuration = "24h" | "72h" | "until_deleted";
export type LocalStory = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  title: string;
  caption: string;
  product_name: string;
  price_mad: number | null;
  old_price_mad: number | null;
  offer_label: string;
  duration: StoryDuration;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

const starterCategories: LocalCategory[] = (
  [
    ["cofee-machine", "آلات القهوة"],
    ["blender", "الخلاطات"],
    ["robot-cuiseur", "العجانات"],
    ["cocotte", "طنجرات الضغط"],
    ["presse", "عصارات"],
    ["aspirateur", "مكانس كهربائية"],
  ] as const
).map(([slug, name], index) => ({
  id: `category-${slug}`,
  name,
  slug,
  is_active: true,
  sort_order: index,
}));

const starterProducts: LocalProduct[] = (
  catalog.products as Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    oldPrice: number | null;
    description: string;
    image: string;
  }>
).map((product) => ({
  id: product.id,
  name: product.name,
  slug: product.id,
  description: product.description,
  price_mad: product.price,
  discount_price_mad: product.oldPrice == null ? null : product.price,
  category_id: `category-${product.category}`,
  image_urls: [product.image],
  stock: 10,
  sku: null,
  brand: null,
  status: "published",
  is_featured: false,
  tags: [],
  created_at: new Date(0).toISOString(),
}));

export const defaultSiteSettings: LocalSiteSettings = {
  brandName: "TopChamal",
  heroKicker: "تفاصيل تصنع الفرق",
  heroTitle: "لكل بيت حكاية تبدأ",
  heroTitleAccent: "من هنا.",
  heroDescription:
    "اكتشف أجهزة منزلية مختارة بعناية، لتجعل كل لحظة في مطبخك تجربة تستحق أن تعيشها.",
  aboutTitle: "راحة البال مع كل طلب",
  promoTitle: "عروض تستحق الاكتشاف.",
  promoDescription: "تصفح التخفيضات المتوفرة الآن في تشكيلة المتجر.",
  footerDescription: "تفاصيل صغيرة تصنع بيتاً تحب العودة إليه. أجهزة منزلية مختارة لكل يوم.",
  whatsapp: "212716313000",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep the admin usable if storage is full or blocked. */
  }
}
function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getLocalProducts(): LocalProduct[] {
  if (CATALOG_EMPTY) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PRODUCTS_KEY);
      window.localStorage.setItem(CATALOG_SEEDED_KEY, "empty-v1");
    }
    return [];
  }
  const existing = read<LocalProduct[]>(PRODUCTS_KEY, []);
  // Keep only products that are part of the current published source catalog.
  // This removes stale products from older browser sessions while preserving
  // local edits such as price, stock, and publication status.
  const merged = starterProducts.map((seed) => {
    const saved = existing.find((item) => item.id === seed.id);
    return saved ? { ...seed, ...saved } : seed;
  });
  if (typeof window !== "undefined") {
    write(PRODUCTS_KEY, merged);
    window.localStorage.setItem(CATALOG_SEEDED_KEY, "published-v2");
  }
  return merged;
}
export function saveLocalProducts(products: LocalProduct[]) {
  write(PRODUCTS_KEY, products);
}
export function upsertLocalProduct(
  product: Omit<LocalProduct, "id" | "created_at"> &
    Partial<Pick<LocalProduct, "id" | "created_at">>,
): LocalProduct {
  const products = getLocalProducts();
  const saved: LocalProduct = {
    ...product,
    id: product.id || id("product"),
    created_at: product.created_at || new Date().toISOString(),
  };
  const index = products.findIndex((item) => item.id === saved.id);
  if (index >= 0) products[index] = saved;
  else products.unshift(saved);
  saveLocalProducts(products);
  return saved;
}
export function deleteLocalProduct(productId: string) {
  saveLocalProducts(getLocalProducts().filter((item) => item.id !== productId));
}
export function getLocalCategories(): LocalCategory[] {
  return read(CATEGORIES_KEY, starterCategories);
}
export function saveLocalCategories(categories: LocalCategory[]) {
  write(CATEGORIES_KEY, categories);
}
export function upsertLocalCategory(
  name: string,
  slug: string,
  categoryId?: string,
): LocalCategory {
  const categories = getLocalCategories();
  const saved: LocalCategory = {
    id: categoryId || id("category"),
    name: name.trim(),
    slug: slug.trim(),
    is_active: true,
    sort_order: categories.length,
  };
  const index = categories.findIndex((item) => item.id === saved.id);
  if (index >= 0) categories[index] = { ...categories[index], ...saved };
  else categories.push(saved);
  saveLocalCategories(categories);
  return saved;
}
export function deleteLocalCategory(categoryId: string) {
  saveLocalCategories(getLocalCategories().filter((item) => item.id !== categoryId));
}
export function getLocalSiteSettings(): LocalSiteSettings {
  return { ...defaultSiteSettings, ...sharedSettings };
}
export async function saveLocalSiteSettings(settings: LocalSiteSettings): Promise<void> {
  await saveSharedContent("site_settings", settings);
  sharedSettings = settings;
}
export function getLocalStories(): LocalStory[] {
  return sharedStories.filter(
    (story) => story && typeof story.id === "string" && typeof story.media_url === "string",
  );
}
export function getActiveLocalStories(now = Date.now()): LocalStory[] {
  return getLocalStories().filter(
    (story) => story.is_active && (!story.expires_at || new Date(story.expires_at).getTime() > now),
  );
}
export async function upsertLocalStory(
  story: Omit<LocalStory, "id" | "created_at"> & Partial<Pick<LocalStory, "id" | "created_at">>,
): Promise<LocalStory> {
  await pullSiteContent();
  const stories = getLocalStories();
  const saved: LocalStory = {
    ...story,
    id: story.id || id("story"),
    created_at: story.created_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("store_stories").upsert({ id: saved.id, content: saved as unknown as import("@/integrations/supabase/types").Json, is_active: saved.is_active, expires_at: saved.expires_at, created_at: saved.created_at });
  if (error) throw new Error("تعذر حفظ القصة لجميع الزوار.");
  await pullSiteContent();
  return saved;
}
export async function updateLocalStory(idValue: string, patch: Partial<LocalStory>): Promise<void> {
  const { error } = await supabase.from("store_stories").update({ ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}) }).eq("id", idValue).select("id").single();
  if (error) throw new Error("تعذر تحديث القصة.");
  await pullSiteContent();
}
export async function deleteLocalStory(idValue: string): Promise<void> {
  const { error } = await supabase.from("store_stories").delete().eq("id", idValue).select("id").single();
  if (error) throw new Error("تعذر حذف القصة.");
  await pullSiteContent();
}
export function getLocalOrders(): LocalOrder[] {
  return read<LocalOrder[]>(ORDERS_KEY, []).map((order, index) => ({
    ...order,
    id: order.id || `local-order-${index}`,
    order_number: order.order_number || order.orderNumber || `LOCAL-${index + 1}`,
    customer_name: order.customer_name || order.name || "",
    total_mad: Number(order.total_mad ?? order.total ?? 0),
    payment_method: order.payment_method || "cash_on_delivery",
    status: order.status || "new",
    created_at: order.created_at || order.createdAt || new Date().toISOString(),
  }));
}
export function saveLocalOrders(orders: LocalOrder[]) {
  write(ORDERS_KEY, orders);
}
export function updateLocalOrder(idValue: string, patch: LocalOrder) {
  saveLocalOrders(
    getLocalOrders().map((order) => (order.id === idValue ? { ...order, ...patch } : order)),
  );
}
export function deleteLocalOrder(idValue: string) {
  saveLocalOrders(getLocalOrders().filter((order) => order.id !== idValue));
}
export type { LocalProduct, LocalCategory, LocalOrder };
