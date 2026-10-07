import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Clock3, Edit3, ImagePlus, Pause, Play, Trash2, Video, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  deleteLocalStory,
  getLocalStories,
  pullSiteContent,
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
const MAX_STORY_FILE_SIZE = 20 * 1024 * 1024;
const TARGET_STORY_MEDIA_SIZE = 3.5 * 1024 * 1024;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف الناتج."));
    reader.readAsDataURL(blob);
  });
}

async function compressStoryImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("تعذر ضغط الصورة.");
  return { dataUrl: await blobToDataUrl(blob), size: blob.size, width: canvas.width, height: canvas.height };
}

async function renderStoryVideo(file: File, start: number, end: number, scale: number, bitrate: number) {
  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("تعذر قراءة الفيديو."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("المتصفح لا يدعم تجهيز الفيديو.");
  const stream = canvas.captureStream(24);
  const sourceStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
  sourceStream?.getAudioTracks().forEach((track: MediaStreamTrack) => stream.addTrack(track));
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  const result = await new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onerror = () => reject(new Error("تعذر ضغط الفيديو."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    video.onseeked = () => {
      recorder.start(250);
      void video.play();
      const draw = () => {
        if (video.currentTime >= end || video.ended) {
          recorder.stop();
          video.pause();
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();
    };
    video.currentTime = Math.max(0, start);
  });
  stream.getTracks().forEach((track) => track.stop());
  URL.revokeObjectURL(sourceUrl);
  return result;
}

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
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [mediaInfo, setMediaInfo] = useState<{ size: number; duration?: number; width?: number; height?: number } | null>(null);
  const [videoStart, setVideoStart] = useState(0);
  const [videoEnd, setVideoEnd] = useState(0);
  const [videoScale, setVideoScale] = useState("0.75");
  const [mediaProcessing, setMediaProcessing] = useState(false);

  function refresh() {
    setStories(getLocalStories());
  }
  useEffect(() => { refresh(); void pullSiteContent().then(refresh); }, []);

  function update<K extends keyof StoryForm>(key: K, value: StoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_STORY_FILE_SIZE) {
      setError("حجم الملف كبير. اختر صورة أو فيديو أقل من 20 ميغابايت.");
      return;
    }
    setError("");
    setNotice("");
    setSelectedFile(null);
    setMediaPreviewUrl("");
    setMediaInfo(null);
    if (file.type.startsWith("image/")) {
      setMediaProcessing(true);
      try {
        const compressed = await compressStoryImage(file);
        setForm((current) => ({ ...current, media_type: "image", media_url: compressed.dataUrl }));
        setMediaPreviewUrl(compressed.dataUrl);
        setMediaInfo(compressed);
        setNotice(`تم ضغط الصورة وتجهيزها (${(compressed.size / 1048576).toFixed(1)} ميغابايت).`);
      } catch (processingError) {
        setError(processingError instanceof Error ? processingError.message : "تعذر تجهيز الصورة.");
      } finally {
        setMediaProcessing(false);
      }
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = previewUrl;
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      setSelectedFile(file);
      setMediaPreviewUrl(previewUrl);
      setMediaInfo({ size: file.size, duration, width: video.videoWidth, height: video.videoHeight });
      setVideoStart(0);
      setVideoEnd(duration);
      setForm((current) => ({
        ...current,
        media_type: "video",
        media_url: "",
      }));
      setNotice("اضبط بداية ونهاية الفيديو ثم اضغط تجهيز الفيديو قبل النشر.");
    };
    video.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setError("تعذر قراءة الفيديو. اختر ملف MP4 أو WebM صالحاً.");
    };
  }

  async function prepareVideo() {
    if (!selectedFile || !mediaInfo?.duration) return;
    const start = Math.max(0, Math.min(videoStart, mediaInfo.duration - 0.5));
    const end = Math.max(start + 0.5, Math.min(videoEnd || mediaInfo.duration, mediaInfo.duration));
    setMediaProcessing(true);
    setError("");
    setNotice("جاري قص الفيديو وضغطه…");
    try {
      const duration = end - start;
      const initialBitrate = Math.min(1_800_000, Math.max(320_000, (TARGET_STORY_MEDIA_SIZE * 8 * 0.82) / duration));
      let blob = await renderStoryVideo(selectedFile, start, end, Number(videoScale), initialBitrate);
      if (blob.size > TARGET_STORY_MEDIA_SIZE) {
        blob = await renderStoryVideo(selectedFile, start, end, Number(videoScale), initialBitrate * 0.55);
      }
      if (blob.size > MAX_STORY_FILE_SIZE) {
        throw new Error("تعذر ضغط الفيديو إلى أقل من 20 ميغابايت. قصّره أكثر أو اختر دقة أقل.");
      }
      const dataUrl = await blobToDataUrl(blob);
      setForm((current) => ({ ...current, media_type: "video", media_url: dataUrl }));
      setMediaPreviewUrl(dataUrl);
      setMediaInfo((current) => ({ ...(current || {}), size: blob.size, duration, width: Math.round((current?.width || 0) * Number(videoScale)), height: Math.round((current?.height || 0) * Number(videoScale)) }));
      setSelectedFile(null);
      setNotice(`تم تجهيز الفيديو بنجاح (${(blob.size / 1048576).toFixed(1)} ميغابايت).`);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "تعذر تجهيز الفيديو.");
    } finally {
      setMediaProcessing(false);
    }
  }

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSelectedFile(null);
    setMediaPreviewUrl("");
    setMediaInfo(null);
    setVideoStart(0);
    setVideoEnd(0);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!form.media_url) {
      setError("جهّز الصورة أو الفيديو أولاً، ثم اضغط نشر القصة.");
      return;
    }
    if (form.media_url.length * 0.75 > MAX_STORY_FILE_SIZE) {
      setError("الملف الناتج أكبر من 20 ميغابايت. اضغطه أو قصّ الفيديو أكثر.");
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
    setMediaPreviewUrl(story.media_url);
    setMediaInfo(null);
    setSelectedFile(null);
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
          <div className="panel-heading-actions">{editingId && <button type="button" className="admin-icon-button" onClick={reset}><X size={16} /></button>}<button type="button" className="admin-collapse-button" onClick={() => setFormOpen((open) => !open)} aria-expanded={formOpen}><ChevronDown size={15} className={formOpen ? "" : "is-collapsed"} />{formOpen ? "إخفاء" : "إظهار"}</button></div>
        </div>
        {formOpen && <>
        <div className="story-form-grid">
          <label className="story-media-picker">
            <span className="story-media-preview">
              {mediaPreviewUrl ? (
                form.media_type === "video" ? <video src={mediaPreviewUrl} muted controls /> : <img src={mediaPreviewUrl} alt="معاينة القصة" />
              ) : <ImagePlus size={32} />}
            </span>
            <strong>{mediaPreviewUrl ? "تغيير الصورة أو الفيديو" : "اختر صورة أو فيديو"}</strong>
            <small>حتى 20 ميغابايت · JPG, PNG, WEBP, MP4</small>
            <input type="file" accept="image/*,video/*" onChange={handleFile} />
          </label>
          <div className="story-media-editor">
            <div className="story-editor-heading"><strong>تعديل وتجهيز الوسائط</strong><span>{mediaInfo ? `${(mediaInfo.size / 1048576).toFixed(1)} ميغابايت` : "لم يتم اختيار ملف"}</span></div>
            {form.media_type === "video" && mediaInfo?.duration ? <>
              <label><span>بداية الفيديو: {videoStart.toFixed(1)}ث</span><input type="range" min="0" max={Math.max(0, mediaInfo.duration - 0.5)} step="0.1" value={videoStart} onChange={(e) => setVideoStart(Number(e.target.value))} /></label>
              <label><span>نهاية الفيديو: {videoEnd.toFixed(1)}ث</span><input type="range" min={Math.min(mediaInfo.duration, videoStart + 0.5)} max={mediaInfo.duration} step="0.1" value={videoEnd} onChange={(e) => setVideoEnd(Number(e.target.value))} /></label>
              <label><span>الدقة</span><select value={videoScale} onChange={(e) => setVideoScale(e.target.value)}><option value="1">الأصلية</option><option value="0.75">متوسطة (75%)</option><option value="0.5">خفيفة (50%)</option></select></label>
              <button type="button" className="admin-secondary-button" onClick={() => void prepareVideo()} disabled={mediaProcessing || !selectedFile}>{mediaProcessing ? "جاري التجهيز..." : form.media_url ? "إعادة تجهيز الفيديو" : "قص وضغط الفيديو"}</button>
              <small className="story-editor-help">يتم قص الفيديو وإعادة ضغطه تلقائياً قبل النشر لضمان بقاء الحجم أقل من 20 ميغابايت.</small>
            </> : mediaInfo ? <small className="story-editor-help">تم ضغط الصورة تلقائياً وتجهيزها للنشر.</small> : <small className="story-editor-help">اختر صورة أو فيديو، ثم عدّل الحجم والمدة هنا قبل النشر.</small>}
          </div>
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
          <button className="admin-primary-button" type="submit" disabled={mediaProcessing || !!selectedFile}>{editingId ? <Edit3 size={16} /> : <Play size={16} />}{mediaProcessing ? "جاري تجهيز الوسائط..." : editingId ? "حفظ التعديل" : "نشر القصة"}</button>
          {editingId && <button className="admin-secondary-button" type="button" onClick={reset}>إلغاء</button>}
        </div>
        </>}
      </form>

      <div className="dashboard-panel admin-table-panel">
        <div className="panel-heading"><div><span className="admin-eyebrow">إدارة القصص</span><h3>{stories.length} قصة محفوظة</h3></div><div className="panel-heading-actions"><small className="story-local-note">تُحفظ محلياً في هذا المتصفح</small><button type="button" className="admin-collapse-button" onClick={() => setListOpen((open) => !open)} aria-expanded={listOpen}><ChevronDown size={15} className={listOpen ? "" : "is-collapsed"} />{listOpen ? "إخفاء" : "إظهار"}</button></div></div>
        {listOpen && (!stories.length ? <p className="admin-state">لا توجد قصص بعد. أضف أول قصة أو عرض من النموذج أعلاه.</p> : (
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
        ))}
      </div>
    </div>
  );
}
