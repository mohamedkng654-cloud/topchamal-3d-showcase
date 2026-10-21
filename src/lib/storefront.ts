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
  hasInlineImage?: boolean;
};

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_mad: number | string;
  discount_price_mad: number | string | null;
  image_url: string | null;
  has_inline_image: boolean;
  stock: number;
  is_quick_listing: boolean;
  expires_at: string | null;
  category_slug: string | null;
  created_at?: string;
};

const fallbackImage = "/topchamal-logo.jpg";
const repairedProductImages: Record<string, string> = {
  "nespresso-c40-eu2": "/products/nespresso-c40-eu2.webp",
  "machine-a-cafe-nespresso-citiz-and-milk-occasion":
    "/products/machine-a-cafe-nespresso-citiz-and-milk-occasion.webp",
  "machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc":
    "/products/machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc.webp",
};
const PRODUCT_CACHE_MS = 30_000;
let productsCache: { data: StorefrontProduct[]; updatedAt: number } | null = null;
let productsRequest: Promise<StorefrontProduct[]> | null = null;
let productsRequestVersion = 0;
const productImageCache = new Map<string, Promise<string | null>>();

export function invalidateStorefrontProducts() {
  productsCache = null;
  productsRequestVersion += 1;
  productsRequest = null;
}

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
  const price = Number(row.discount_price_mad ?? row.price_mad);
  const oldPrice = row.discount_price_mad == null ? null : Number(row.price_mad);
  const sourceImage = row.image_url || fallbackImage;
  const image = sourceImage.startsWith("/__l5e/assets-v1/")
    ? repairedProductImages[row.slug] || fallbackImage
    : sourceImage;
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    category: row.category_slug || "all",
    price,
    oldPrice,
    description: row.description || "منتج من تشكيلة Topchamal.",
    image,
    hasInlineImage: row.has_inline_image,
    stock: row.stock,
    isQuickListing: row.is_quick_listing,
    expiresAt: row.expires_at,
  };
}

async function loadProductsFromPublicTable(): Promise<CatalogRow[]> {
  const pageSize = 250;
  const rows: CatalogRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,slug,description,price_mad,discount_price_mad,image_urls,stock,is_quick_listing,expires_at,created_at,categories(slug)",
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const page = data || [];
    rows.push(
      ...page
        .filter(
          (row) =>
            !row.is_quick_listing ||
            (row.expires_at != null && new Date(row.expires_at).getTime() > Date.now()),
        )
        .map((row) => {
          const firstImage = row.image_urls[0] || null;
          return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            price_mad: row.price_mad,
            discount_price_mad: row.discount_price_mad,
            image_url: firstImage?.startsWith("data:") ? null : firstImage,
            has_inline_image: Boolean(firstImage?.startsWith("data:image/")),
            stock: row.stock,
            is_quick_listing: row.is_quick_listing,
            expires_at: row.expires_at,
            category_slug: row.categories?.slug || null,
            created_at: row.created_at,
          };
        }),
    );

    if (page.length < pageSize) break;
  }

  return rows;
}

export async function loadStorefrontProductImage(slug: string): Promise<string | null> {
  const cached = productImageCache.get(slug);
  if (cached) return cached;
  const request = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_storefront_product_image", {
        product_slug: slug,
      });
      if (error) throw error;
      return typeof data === "string" && data.startsWith("data:image/") ? data : null;
    } catch (error) {
      productImageCache.delete(slug);
      console.warn("[Storefront] Could not load product image", slug, error);
      return null;
    }
  })();
  productImageCache.set(slug, request);
  return request;
}

export async function loadStorefrontProducts(
  fallback: StorefrontProduct[],
): Promise<StorefrontProduct[]> {
  if (!supabaseConfigured) throw new Error("تعذر الاتصال بالمتجر.");
  if (productsCache && Date.now() - productsCache.updatedAt < PRODUCT_CACHE_MS) {
    return productsCache.data;
  }
  if (productsRequest) return productsRequest;

  const requestVersion = productsRequestVersion;
  const request = (async () => {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_storefront_products");
    let catalogRows: CatalogRow[];
    if (rpcError || !rpcData) {
      try {
        catalogRows = await loadProductsFromPublicTable();
        console.warn("[Storefront] Product RPC failed; loaded the public table instead", rpcError);
      } catch (fallbackError) {
        console.error("[Storefront] Could not load products from RPC or public table", {
          rpcError,
          fallbackError,
        });
        if (productsCache?.data.length) return productsCache.data;
        throw new Error("تعذر تحميل المنتجات. حاول تحديث الصفحة.");
      }
    } else {
      catalogRows = rpcData as CatalogRow[];
    }
    const local = new Map(fallback.map((p) => [p.id, p]));
    const rows = catalogRows.map((row) => {
      const product = mapProduct(row);
      const match = local.get(product.id);
      return match && product.image === fallbackImage
        ? { ...product, image: match.image }
        : product;
    });
    if (requestVersion === productsRequestVersion) {
      productsCache = { data: rows, updatedAt: Date.now() };
    }
    return rows;
  })();
  productsRequest = request;
  try {
    return await request;
  } finally {
    if (productsRequest === request) productsRequest = null;
  }
}

export function subscribeToStorefrontCatalog(onChange: () => void) {
  if (!supabaseConfigured) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleChange = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      invalidateStorefrontProducts();
      onChange();
    }, 180);
  };
  const channel = supabase
    .channel("topchamal-public-catalog")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, scheduleChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, scheduleChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[Storefront] Catalog realtime status: ${status}`);
      }
    });
  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
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
