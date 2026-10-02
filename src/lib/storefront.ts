import { supabase, supabaseConfigured } from "./supabase";

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
  categories: { slug: string } | { slug: string }[] | null;
};

const fallbackImage = "/favicon.png";

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
  };
}

export async function loadStorefrontProducts(
  fallback: StorefrontProduct[],
): Promise<StorefrontProduct[]> {
  if (!supabaseConfigured) return fallback;
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,slug,description,price_mad,discount_price_mad,image_urls,stock,categories(slug)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error || !data?.length) return fallback;
  return (data as CatalogRow[]).map(mapProduct);
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
