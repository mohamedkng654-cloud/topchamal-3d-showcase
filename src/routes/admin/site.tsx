import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Save, Store } from "lucide-react";
import { defaultSiteSettings, getLocalSiteSettings, saveLocalSiteSettings, type LocalSiteSettings } from "@/lib/local-store";

export const Route = createFileRoute("/admin/site")({ component: AdminSiteSettings });

function AdminSiteSettings() {
  const [settings, setSettings] = useState<LocalSiteSettings>(() => getLocalSiteSettings());
  const [notice, setNotice] = useState("");
  function update(field: keyof LocalSiteSettings, value: string) { setSettings((current) => ({ ...current, [field]: value })); }
  function save() { saveLocalSiteSettings(settings); setNotice("تم حفظ معلومات الموقع بنجاح."); }
  function reset() { setSettings(defaultSiteSettings); saveLocalSiteSettings(defaultSiteSettings); setNotice("تمت استعادة المعلومات الافتراضية."); }
  return <section className="dashboard-page">
    <div className="dashboard-heading"><div><span className="admin-eyebrow">إعدادات الموقع</span><h2>محتوى المتجر</h2><p>عدّل النصوص والمعلومات التي تظهر للزوار في الصفحة الرئيسية.</p></div><Store size={28} /></div>
    {notice && <div className="admin-alert success">{notice}</div>}
    <section className="dashboard-panel">
      <div className="panel-heading"><div><span className="admin-eyebrow">الواجهة الرئيسية</span><h3>العنوان والرسالة الترحيبية</h3></div></div>
      <div className="admin-form-grid">
        <label><span>اسم المتجر</span><input value={settings.brandName} onChange={(e) => update("brandName", e.target.value)} /></label>
        <label><span>النص الصغير فوق العنوان</span><input value={settings.heroKicker} onChange={(e) => update("heroKicker", e.target.value)} /></label>
        <label><span>عنوان الصفحة</span><input value={settings.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} /></label>
        <label><span>الكلمة المميزة</span><input value={settings.heroTitleAccent} onChange={(e) => update("heroTitleAccent", e.target.value)} /></label>
        <label className="admin-form-wide"><span>وصف الصفحة الرئيسية</span><textarea value={settings.heroDescription} onChange={(e) => update("heroDescription", e.target.value)} /></label>
      </div>
    </section>
    <section className="dashboard-panel">
      <div className="panel-heading"><div><span className="admin-eyebrow">محتوى البيع</span><h3>العروض، الثقة، والتواصل</h3></div></div>
      <div className="admin-form-grid">
        <label><span>عنوان قسم لماذا نحن</span><input value={settings.aboutTitle} onChange={(e) => update("aboutTitle", e.target.value)} /></label>
        <label><span>عنوان قسم العروض</span><input value={settings.promoTitle} onChange={(e) => update("promoTitle", e.target.value)} /></label>
        <label><span>وصف قسم العروض</span><input value={settings.promoDescription} onChange={(e) => update("promoDescription", e.target.value)} /></label>
        <label><span>رقم واتساب الدولي</span><input dir="ltr" value={settings.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} /></label>
        <label className="admin-form-wide"><span>وصف أسفل الموقع</span><textarea value={settings.footerDescription} onChange={(e) => update("footerDescription", e.target.value)} /></label>
      </div>
      <div className="admin-form-actions"><button type="button" className="admin-primary-button" onClick={save}><Save size={16} /> حفظ معلومات الموقع</button><button type="button" className="admin-secondary-button" onClick={reset}>استعادة الافتراضي</button></div>
    </section>
  </section>;
}
