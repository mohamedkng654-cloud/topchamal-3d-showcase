import { supabase, supabaseConfigured } from "./supabase";

export type StorefrontCategory = {
  id: string;
  label: string;
  fr: string;
  sort_order: number;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number | null;
  description: string;
  image: string;
  slug?: string;
  stock?: number;
  isQuickListing?: boolean;
  expiresAt?: string | null;
};

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_mad: number | string;
  discount_price_mad: number | string | null;
  image_urls: string[] | null;
  stock: number;
  is_quick_listing: boolean;
  expires_at: string | null;
  categories: { slug: string } | { slug: string }[] | null;
};

const fallbackImage = "/topchamal-logo.jpg";

export async function loadStorefrontCategories(
  fallback: StorefrontCategory[],
): Promise<StorefrontCategory[]> {
   if (!supabaseConfigured) throw new Error("تعذر الاتصال بالمتجر.");
  const { data, error } = await supabase
    .from("categories")
    .select("slug,name,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) {
    console.error("[Storefront] Could not load shared categories", error);
    throw new Error("تعذر تحميل التصنيفات. حاول تحديث الصفحة.");
  }
  return (data as Array<{ slug: string; name: string; sort_order: number }>).map((row) => ({
    id: row.slug,
    label: row.name,
    fr: row.slug.replace(/[-_]+/g, " ").toUpperCase(),
    sort_order: row.sort_order,
  }));
}

function mapProduct(row: CatalogRow): StorefrontProduct {
  const category = Array.isArray(row.categories) ? row.categories[0]?.slug : row.categories?.slug;
  const price = Number(row.discount_price_mad ?? row.price_mad);
  const oldPrice = row.discount_price_mad == null ? null : Number(row.price_mad);
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    category: category || "all",
    price,
    oldPrice,
    description: row.description || "منتج من تشكيلة Topchamal.",
    image: row.image_urls?.[0] || fallbackImage,
    stock: row.stock,
    isQuickListing: row.is_quick_listing,
    expiresAt: row.expires_at,
  };
}

export async function loadStorefrontProducts(
  fallback: StorefrontProduct[],
): Promise<StorefrontProduct[]> {
  if (!supabaseConfigured) throw new Error("تعذر الاتصال بالمتجر.");
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,slug,description,price_mad,discount_price_mad,image_urls,stock,is_quick_listing,expires_at,categories(slug)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.error("[Storefront] Could not load shared catalog", error);
    throw new Error("تعذر تحميل المنتجات. حاول تحديث الصفحة.");
  }
  const local = new Map(fallback.map((p) => [p.id, p]));
  return (data as CatalogRow[]).map((row) => {
    const product = mapProduct(row);
    const match = local.get(product.id);
    return match && product.image === fallbackImage ? { ...product, image: match.image } : product;
  });
}

export function subscribeToStorefrontCatalog(onChange: () => void) {
  if (!supabaseConfigured) return () => undefined;
  const channel = supabase
    .channel("topchamal-public-catalog")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export type NewOrder = {
  name: string;
  phone: string;
  city: string;
  email?: string;
  address?: string;
  lines: Array<{ slug: string; quantity: number }>;
};

export async function createStorefrontOrder(order: NewOrder) {
  if (!supabaseConfigured) throw new Error("Le backend n'est pas configuré.");
  const { data, error } = await supabase.rpc("create_public_order", {
    payload: order,
  });
  if (error) throw error;
  return data as { order_number: string; total_mad: number };
}
