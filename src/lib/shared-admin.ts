import { supabase } from "@/lib/supabase";

export const ADMIN_REFRESH_EVENT = "topchamal-admin-refresh";

export function subscribeAdminData(tables: string[], refresh: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  };
  const channel = supabase.channel(`admin-${tables.join("-")}-${Math.random()}`);
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
  }
  channel.subscribe();
  window.addEventListener(ADMIN_REFRESH_EVENT, schedule);
  window.addEventListener("focus", schedule);
  return () => {
    clearTimeout(timer);
    window.removeEventListener(ADMIN_REFRESH_EVENT, schedule);
    window.removeEventListener("focus", schedule);
    void supabase.removeChannel(channel);
  };
}

export function adminHead(title: string, description: string) {
  return {
    meta: [
      { title: `TopChamal | ${title}` },
      { name: "description", content: description },
      { property: "og:title", content: `TopChamal | ${title}` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
