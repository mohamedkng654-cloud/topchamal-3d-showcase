const PRODUCTS_KEY = "topchamal-local-products";
const CATEGORIES_KEY = "topchamal-local-categories";
const ORDERS_KEY = "topchamal-local-orders";

type LocalProduct = {
  id: string; name: string; slug: string; description: string | null; price_mad: number;
  discount_price_mad: number | null; category_id: string | null; image_urls: string[];
  stock: number; sku: string | null; brand: string | null;
  status: "draft" | "published" | "archived"; is_featured: boolean; tags: string[]; created_at: string;
};
type LocalCategory = { id: string; name: string; slug: string; is_active: boolean; sort_order: number };
type LocalOrder = Record<string, unknown>;

const starterCategories: LocalCategory[] = [
  ["coffee", "آلات القهوة"], ["blender", "الخلاطات"], ["robot", "العجانات"],
  ["cocotte", "طنجرات الضغط"], ["presse", "عصارات"], ["aspirateur", "مكانس كهربائية"],
].map(([slug, name], index) => ({ id: `category-${slug}`, name, slug, is_active: true, sort_order: index }));

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { window.localStorage.setItem(key, JSON.stringify(value)); }
function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function getLocalProducts(): LocalProduct[] { return read<LocalProduct[]>(PRODUCTS_KEY, []); }
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
export function getLocalOrders(): LocalOrder[] { return read<LocalOrder[]>(ORDERS_KEY, []); }
export function saveLocalOrders(orders: LocalOrder[]) { write(ORDERS_KEY, orders); }
export function updateLocalOrder(idValue: string, patch: LocalOrder) { saveLocalOrders(getLocalOrders().map((order) => order.id === idValue ? { ...order, ...patch } : order)); }
export function deleteLocalOrder(idValue: string) { saveLocalOrders(getLocalOrders().filter((order) => order.id !== idValue)); }
export type { LocalProduct, LocalCategory, LocalOrder };
