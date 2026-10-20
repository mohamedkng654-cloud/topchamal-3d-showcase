import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Save, Store } from "lucide-react";
import {
  defaultSiteSettings,
  getLocalSiteSettings,
  saveLocalSiteSettings,
  type LocalSiteSettings,
  pullSiteContent,
} from "@/lib/local-store";

import { adminHead, subscribeAdminData } from "@/lib/shared-admin";

export const Route = createFileRoute("/admin/site")({
  component: AdminSiteSettings,
  head: () => adminHead("محتوى الموقع", "إدارة محتوى متجر TopChamal وبيانات التواصل المشتركة."),
});

function AdminSiteSettings() {
  const [settings, setSettings] = useState<LocalSiteSettings>(defaultSiteSettings);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const refresh = () => {
      void pullSiteContent()
        .then(() => setSettings(getLocalSiteSettings()))
        .catch(() => setError("تعذر تحميل محتوى المتجر."))
        .finally(() => setLoading(false));
    };
    refresh();
    return subscribeAdminData(["site_content"], refresh);
  }, []);
  const [heroOpen, setHeroOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  function update(field: keyof LocalSiteSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }
  async function save() {
    setError("");
    setNotice("");
    const whatsappInput = settings.whatsapp.trim();
    const normalizedWhatsapp = whatsappInput.replace(/[^\d+]/g, "");
    if (whatsappInput && !/^\+?212[567]\d{8}$/.test(normalizedWhatsapp)) {
      setError("أدخل رقم واتساب مغربي دولياً صالحاً، أو اترك الحقل فارغاً.");
      return;
    }
    setSaving(true);
    try {
      await saveLocalSiteSettings({
        ...settings,
        whatsapp: normalizedWhatsapp.replace(/^\+/, ""),
      });
      setNotice("تم حفظ معلومات الموقع لجميع الزوار.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر نشر التغييرات.");
    } finally {
      setSaving(false);
    }
  }
  async function reset() {
    if (!window.confirm("استعادة معلومات الموقع الافتراضية لجميع الزوار؟")) return;
    setSaving(true);
    setError("");
    try {
      await saveLocalSiteSettings(defaultSiteSettings);
      setSettings(defaultSiteSettings);
      setNotice("تمت استعادة المعلومات الافتراضية لجميع الزوار.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر نشر التغييرات.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="admin-eyebrow">إعدادات الموقع</span>
          <h2>محتوى المتجر</h2>
          <p>عدّل النصوص والمعلومات التي تظهر للزوار في الصفحة الرئيسية.</p>
        </div>
        <Store size={28} />
      </div>
      {(notice || error) && (
        <div className={`admin-alert ${error ? "error" : "success"}`}>{error || notice}</div>
      )}
      <fieldset className="dashboard-panel" disabled={loading || saving}>
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">الواجهة الرئيسية</span>
            <h3>العنوان والرسالة الترحيبية</h3>
          </div>
          <button
            type="button"
            className="admin-collapse-button"
            onClick={() => setHeroOpen((open) => !open)}
            aria-expanded={heroOpen}
          >
            <ChevronDown size={15} className={heroOpen ? "" : "is-collapsed"} />
            {heroOpen ? "إخفاء" : "إظهار"}
          </button>
        </div>
        {heroOpen && (
          <div className="admin-form-grid">
            <label>
              <span>اسم المتجر</span>
              <input
                value={settings.brandName}
                onChange={(e) => update("brandName", e.target.value)}
              />
            </label>
            <label>
              <span>النص الصغير فوق العنوان</span>
              <input
                value={settings.heroKicker}
                onChange={(e) => update("heroKicker", e.target.value)}
              />
            </label>
            <label>
              <span>عنوان الصفحة</span>
              <input
                value={settings.heroTitle}
                onChange={(e) => update("heroTitle", e.target.value)}
              />
            </label>
            <label>
              <span>الكلمة المميزة</span>
              <input
                value={settings.heroTitleAccent}
                onChange={(e) => update("heroTitleAccent", e.target.value)}
              />
            </label>
            <label className="admin-form-wide">
              <span>وصف الصفحة الرئيسية</span>
              <textarea
                value={settings.heroDescription}
                onChange={(e) => update("heroDescription", e.target.value)}
              />
            </label>
          </div>
        )}
      </fieldset>
      <fieldset className="dashboard-panel" disabled={loading || saving}>
        <div className="panel-heading">
          <div>
            <span className="admin-eyebrow">محتوى البيع</span>
            <h3>العروض، الثقة، والتواصل</h3>
          </div>
          <button
            type="button"
            className="admin-collapse-button"
            onClick={() => setSalesOpen((open) => !open)}
            aria-expanded={salesOpen}
          >
            <ChevronDown size={15} className={salesOpen ? "" : "is-collapsed"} />
            {salesOpen ? "إخفاء" : "إظهار"}
          </button>
        </div>
        {salesOpen && (
          <div className="admin-form-grid">
            <label>
              <span>عنوان قسم لماذا نحن</span>
              <input
                value={settings.aboutTitle}
                onChange={(e) => update("aboutTitle", e.target.value)}
              />
            </label>
            <label>
              <span>عنوان قسم العروض</span>
              <input
                value={settings.promoTitle}
                onChange={(e) => update("promoTitle", e.target.value)}
              />
            </label>
            <label>
              <span>وصف قسم العروض</span>
              <input
                value={settings.promoDescription}
                onChange={(e) => update("promoDescription", e.target.value)}
              />
            </label>
            <label>
              <span>رقم واتساب الدولي (اختياري)</span>
              <input
                dir="ltr"
                placeholder="اتركه فارغاً إذا لم يكن الرقم مؤكداً"
                value={settings.whatsapp}
                onChange={(e) => update("whatsapp", e.target.value)}
              />
            </label>
            <label className="admin-form-wide">
              <span>وصف أسفل الموقع</span>
              <textarea
                value={settings.footerDescription}
                onChange={(e) => update("footerDescription", e.target.value)}
              />
            </label>
          </div>
        )}
        {salesOpen && (
          <div className="admin-form-actions">
            <button type="button" className="admin-primary-button" onClick={save}>
              <Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ معلومات الموقع"}
            </button>
            <button type="button" className="admin-secondary-button" onClick={reset}>
              استعادة الافتراضي
            </button>
          </div>
        )}
      </fieldset>
    </section>
  );
}
