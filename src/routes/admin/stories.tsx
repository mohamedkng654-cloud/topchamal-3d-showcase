import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Edit3, ImagePlus, Pause, Play, Trash2, Video, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  deleteLocalStory,
  getLocalStories,
  type LocalStory,
  type StoryDuration,
  upsertLocalStory,
  updateLocalStory,
} from "@/lib/local-store";

export const Route = createFileRoute("/admin/stories")({ component: AdminStories });

type StoryForm = {
  media_type: "image" | "video";
  media_url: string;
  title: string;
  caption: string;
  product_name: string;
  price_mad: string;
  old_price_mad: string;
  offer_label: string;
  duration: StoryDuration;
};

const emptyForm: StoryForm = {
  media_type: "image",
  media_url: "",
  title: "",
  caption: "",
  product_name: "",
  price_mad: "",
  old_price_mad: "",
  offer_label: "عرض خاص",
  duration: "24h",
};

const durationLabels: Record<StoryDuration, string> = {
  "24h": "24 ساعة",
  "72h": "72 ساعة",
  until_deleted: "حتى أحذفها أو أوقفها",
};

function toForm(story: LocalStory): StoryForm {
  return {
    media_type: story.media_type,
    media_url: story.media_url,
    title: story.title,
    caption: story.caption,
    product_name: story.product_name,
    price_mad: story.price_mad == null ? "" : String(story.price_mad),
    old_price_mad: story.old_price_mad == null ? "" : String(story.old_price_mad),
    offer_label: story.offer_label,
    duration: story.duration,
  };
}

function expiryFor(duration: StoryDuration) {
  if (duration === "until_deleted") return null;
  return new Date(Date.now() + (duration === "24h" ? 24 : 72) * 60 * 60 * 1000).toISOString();
}

function AdminStories() {
  const [stories, setStories] = useState<LocalStory[]>([]);
  const [form, setForm] = useState<StoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function refresh() {
    setStories(getLocalStories());
  }
  useEffect(() => refresh(), []);

  function update<K extends keyof StoryForm>(key: K, value: StoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("حجم الملف كبير. اختر صورة أو فيديو أقل من 8 ميغابايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        media_type: file.type.startsWith("video/") ? "video" : "image",
        media_url: String(reader.result || ""),
      }));
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!form.media_url) {
      setError("أضف صورة أو فيديو للقصة أولاً.");
      return;
    }
    if (!form.title.trim() && !form.product_name.trim()) {
      setError("أضف عنوان القصة أو اسم المنتج.");
      return;
    }
    const existing = editingId ? stories.find((story) => story.id === editingId) : undefined;
    const saved = upsertLocalStory({
      ...(editingId ? { id: editingId } : {}),
      media_type: form.media_type,
      media_url: form.media_url,
      title: form.title.trim() || form.product_name.trim(),
      caption: form.caption.trim(),
      product_name: form.product_name.trim(),
      price_mad: form.price_mad ? Number(form.price_mad) : null,
      old_price_mad: form.old_price_mad ? Number(form.old_price_mad) : null,
      offer_label: form.offer_label.trim(),
      duration: form.duration,
      is_active: existing?.is_active ?? true,
      ...(existing?.created_at ? { created_at: existing.created_at } : {}),
      expires_at:
        existing?.duration === form.duration && existing.expires_at
          ? existing.expires_at
          : expiryFor(form.duration),
    });
    refresh();
    reset();
    setNotice(saved.is_active ? "تم نشر القصة بنجاح." : "تم حفظ القصة.");
  }

  function edit(story: LocalStory) {
    setEditingId(story.id);
    setForm(toForm(story));
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggle(story: LocalStory) {
    updateLocalStory(story.id, { is_active: !story.is_active });
    refresh();
    setNotice(story.is_active ? "تم إيقاف القصة." : "تم تشغيل القصة.");
  }

  function remove(story: LocalStory) {
    if (!window.confirm("حذف هذه القصة نهائياً؟")) return;
    deleteLocalStory(story.id);
    refresh();
    if (editingId === story.id) reset();
    setNotice("تم حذف القصة.");
  }

  return (
    <div dir="rtl">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">STORIES · عروض سريعة</span>
          <h2>قصص المتجر</h2>
          <p>انشر صوراً أو فيديوهات للمنتجات والعروض، وحدد مدة ظهورها للزوار.</p>
        </div>
        <Clock3 size={28} />
      </div>
      {(notice || error) && <div className={`admin-alert ${error ? "error" : "success"}`}>{error || notice}</div>}

      <form className="dashboard-panel admin-form-panel story-form" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">{editingId ? "تعديل القصة" : "قصة جديدة"}</span>
            <h3>{editingId ? "تعديل المحتوى والمدة" : "أضف قصة أو عرضاً"}</h3>
          </div>
          {editingId && <button type="button" className="admin-icon-button" onClick={reset}><X size={16} /></button>}
        </div>
        <div className="story-form-grid">
          <label className="story-media-picker">
            <span className="story-media-preview">
              {form.media_url ? (
                form.media_type === "video" ? <video src={form.media_url} muted controls /> : <img src={form.media_url} alt="معاينة القصة" />
              ) : <ImagePlus size={32} />}
            </span>
            <strong>{form.media_url ? "تغيير الصورة أو الفيديو" : "اختر صورة أو فيديو"}</strong>
            <small>حتى 8 ميغابايت · JPG, PNG, WEBP, MP4</small>
            <input type="file" accept="image/*,video/*" onChange={handleFile} />
          </label>
          <div className="story-fields">
            <label><span>العنوان</span><input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="مثلاً: عرض نهاية الأسبوع" /></label>
            <label><span>اسم المنتج</span><input value={form.product_name} onChange={(e) => update("product_name", e.target.value)} placeholder="مثلاً: آلة قهوة Nespresso" /></label>
            <label className="admin-form-wide"><span>الرسالة أو تفاصيل العرض</span><textarea value={form.caption} onChange={(e) => update("caption", e.target.value)} placeholder="اكتب رسالة قصيرة تظهر داخل القصة..." /></label>
            <div className="story-price-row">
              <label><span>السعر الحالي (د.م)</span><input type="number" min="0" value={form.price_mad} onChange={(e) => update("price_mad", e.target.value)} /></label>
              <label><span>السعر قبل التخفيض</span><input type="number" min="0" value={form.old_price_mad} onChange={(e) => update("old_price_mad", e.target.value)} /></label>
              <label><span>شارة العرض</span><input value={form.offer_label} onChange={(e) => update("offer_label", e.target.value)} placeholder="عرض خاص" /></label>
            </div>
            <label><span>مدة الظهور</span><select value={form.duration} onChange={(e) => update("duration", e.target.value as StoryDuration)}>{Object.entries(durationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </div>
        <div className="admin-form-actions">
          <button className="admin-primary-button" type="submit">{editingId ? <Edit3 size={16} /> : <Play size={16} />}{editingId ? "حفظ التعديل" : "نشر القصة"}</button>
          {editingId && <button className="admin-secondary-button" type="button" onClick={reset}>إلغاء</button>}
        </div>
      </form>

      <div className="dashboard-panel admin-table-panel">
        <div className="panel-heading"><div><span className="admin-eyebrow">إدارة القصص</span><h3>{stories.length} قصة محفوظة</h3></div><small className="story-local-note">تُحفظ محلياً في هذا المتصفح</small></div>
        {!stories.length ? <p className="admin-state">لا توجد قصص بعد. أضف أول قصة أو عرض من النموذج أعلاه.</p> : (
          <div className="story-list">
            {stories.map((story) => {
              const expired = !!story.expires_at && new Date(story.expires_at).getTime() <= Date.now();
              return <article className={`story-admin-card ${!story.is_active || expired ? "is-muted" : ""}`} key={story.id}>
                <div className="story-admin-media">{story.media_type === "video" ? <><video src={story.media_url} muted /><Video size={15} /></> : <img src={story.media_url} alt="" />}</div>
                <div className="story-admin-copy"><div className="story-admin-title"><strong>{story.title}</strong><span className={`story-status ${story.is_active && !expired ? "live" : "paused"}`}>{expired ? "منتهية" : story.is_active ? "نشطة" : "متوقفة"}</span></div><p>{story.caption || story.product_name || "بدون تفاصيل إضافية"}</p><small>{story.offer_label} · {durationLabels[story.duration]}{story.price_mad != null ? ` · ${story.price_mad.toLocaleString("fr-MA")} د.م` : ""}</small></div>
                <div className="admin-row-actions"><button className="admin-action edit" onClick={() => edit(story)} title="تعديل"><Edit3 size={15} /></button><button className="admin-action stock" onClick={() => toggle(story)} title={story.is_active ? "إيقاف" : "تشغيل"}>{story.is_active ? <Pause size={15} /> : <Play size={15} />}</button><button className="admin-action delete" onClick={() => remove(story)} title="حذف"><Trash2 size={15} /></button></div>
              </article>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
