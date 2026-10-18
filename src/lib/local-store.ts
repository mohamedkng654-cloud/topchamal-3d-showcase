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

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
