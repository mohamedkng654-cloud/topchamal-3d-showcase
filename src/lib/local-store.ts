import catalog from "../data/products.json";

const PRODUCTS_KEY = "topchamal-local-products";
const CATEGORIES_KEY = "topchamal-local-categories";
const ORDERS_KEY = "topchamal-local-orders";
const SETTINGS_KEY = "topchamal-local-site-settings";
const CATALOG_SEEDED_KEY = "topchamal-local-catalog-seeded-v1";

type LocalProduct = {
  id: string; name: string; slug: string; description: string | null; price_mad: number;
  discount_price_mad: number | null; category_id: string | null; image_urls: string[];
  stock: number; sku: string | null; brand: string | null;
  status: "draft" | "published" | "archived"; is_featured: boolean; tags: string[]; created_at: string;
};
type LocalCategory = { id: string; name: string; slug: string; is_active: boolean; sort_order: number };
type LocalOrder = Record<string, unknown>;
export type LocalSiteSettings = {
  brandName: string; heroKicker: string; heroTitle: string; heroTitleAccent: string; heroDescription: string;
  aboutTitle: string; promoTitle: string; promoDescription: string; footerDescription: string; whatsapp: string;
};

const starterCategories: LocalCategory[] = [
  ["cofee-machine", "آلات القهوة"], ["blender", "الخلاطات"], ["robot-cuiseur", "العجانات"],
  ["cocotte", "طنجرات الضغط"], ["presse", "عصارات"], ["aspirateur", "مكانس كهربائية"],
].map(([slug, name], index) => ({ id: `category-${slug}`, name, slug, is_active: true, sort_order: index }));

const starterProducts: LocalProduct[] = (catalog.products as Array<{ id: string; name: string; category: string; price: number; oldPrice: number | null; description: string; image: string }>).map((product) => ({
  id: product.id, name: product.name, slug: product.id, description: product.description, price_mad: product.price,
  discount_price_mad: product.oldPrice == null ? null : product.price, category_id: `category-${product.category}`,
  image_urls: [product.image], stock: 10, sku: null, brand: null, status: "published", is_featured: false, tags: [], created_at: new Date(0).toISOString(),
}));

export const defaultSiteSettings: LocalSiteSettings = {
  brandName: "TopChamal", heroKicker: "تفاصيل تصنع الفرق", heroTitle: "لكل بيت حكاية تبدأ", heroTitleAccent: "من هنا.",
  heroDescription: "اكتشف أجهزة منزلية مختارة بعناية، لتجعل كل لحظة في مطبخك تجربة تستحق أن تعيشها.",
  aboutTitle: "راحة البال مع كل طلب", promoTitle: "عروض تستحق الاكتشاف.", promoDescription: "تصفح التخفيضات المتوفرة الآن في تشكيلة المتجر.",
  footerDescription: "تفاصيل صغيرة تصنع بيتاً تحب العودة إليه. أجهزة منزلية مختارة لكل يوم.", whatsapp: "212716313000",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { window.localStorage.setItem(key, JSON.stringify(value)); }
function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function getLocalProducts(): LocalProduct[] {
  const existing = read<LocalProduct[]>(PRODUCTS_KEY, []);
  if (typeof window !== "undefined" && !window.localStorage.getItem(CATALOG_SEEDED_KEY)) {
    const merged = [...existing, ...starterProducts.filter((seed) => !existing.some((item) => item.id === seed.id))];
    write(PRODUCTS_KEY, merged);
    window.localStorage.setItem(CATALOG_SEEDED_KEY, "1");
    return merged;
  }
  return existing.length ? existing : starterProducts;
}
export function saveLocalProducts(products: LocalProduct[]) { write(PRODUCTS_KEY, products); }
export function upsertLocalProduct(product: Omit<LocalProduct, "id" | "created_at"> & Partial<Pick<LocalProduct, "id" | "created_at">>): LocalProduct {
  const products = getLocalProducts();
  const saved: LocalProduct = { ...product, id: product.id || id("product"), created_at: product.created_at || new Date().toISOString() };
  const index = products.findIndex((item) => item.id === saved.id);
  if (index >= 0) products[index] = saved; else products.unshift(saved);
  saveLocalProducts(products); return saved;
}
export function deleteLocalProduct(productId: string) { saveLocalProducts(getLocalProducts().filter((item) => item.id !== productId)); }
export function getLocalCategories(): LocalCategory[] { return read(CATEGORIES_KEY, starterCategories); }
export function saveLocalCategories(categories: LocalCategory[]) { write(CATEGORIES_KEY, categories); }
export function upsertLocalCategory(name: string, slug: string, categoryId?: string): LocalCategory {
  const categories = getLocalCategories();
  const saved: LocalCategory = { id: categoryId || id("category"), name: name.trim(), slug: slug.trim(), is_active: true, sort_order: categories.length };
  const index = categories.findIndex((item) => item.id === saved.id);
  if (index >= 0) categories[index] = { ...categories[index], ...saved };
  else categories.push(saved);
  saveLocalCategories(categories);
  return saved;
}
export function deleteLocalCategory(categoryId: string) { saveLocalCategories(getLocalCategories().filter((item) => item.id !== categoryId)); }
export function getLocalSiteSettings(): LocalSiteSettings { return { ...defaultSiteSettings, ...read<Partial<LocalSiteSettings>>(SETTINGS_KEY, {}) }; }
export function saveLocalSiteSettings(settings: LocalSiteSettings) { write(SETTINGS_KEY, settings); }
export function getLocalOrders(): LocalOrder[] { return read<LocalOrder[]>(ORDERS_KEY, []); }
export function saveLocalOrders(orders: LocalOrder[]) { write(ORDERS_KEY, orders); }
export function updateLocalOrder(idValue: string, patch: LocalOrder) { saveLocalOrders(getLocalOrders().map((order) => order.id === idValue ? { ...order, ...patch } : order)); }
export function deleteLocalOrder(idValue: string) { saveLocalOrders(getLocalOrders().filter((order) => order.id !== idValue)); }
export type { LocalProduct, LocalCategory, LocalOrder };
