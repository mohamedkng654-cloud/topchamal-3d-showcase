import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { signInAdmin } from "@/lib/admin-auth";
import { supabaseConfigured } from "@/lib/supabase";
import { getLocalAdmin } from "@/lib/local-admin";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signInAdmin(email.trim(), password);
    if (result.error) setError(result.error.message || "تعذر تسجيل الدخول. تحقق من البيانات.");
    else {
      await router.invalidate();
      await navigate({ to: "/admin", replace: true });
    }
    setLoading(false);
  }

  return (
            <main className="admin-login-page" dir="rtl">
      <div className="login-decoration">
        <span>TOPCHAMAL</span>
      </div>
      <section className="login-card">
        <div className="login-logo">
          <img src="/topchamal-logo.jpg" width="160" height="106" alt="TopChamal Premium Moroccan Cookware" />
        </div>
        <span className="admin-eyebrow">TOPCHAMAL ADMIN</span>
        <h1>مرحباً بعودتك</h1>
        <p>سجّل الدخول لإدارة متجرك ومتابعة طلباتك.</p>
        {!supabaseConfigured && !getLocalAdmin() && (
          <div className="login-alert">
            <AlertCircle size={17} />
            <span>تسجيل دخول محلي بدون Supabase — استخدم بيانات المدير المحددة للمشروع.</span>
          </div>
        )}
        {error && (
          <div className="login-alert error">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            <span>البريد الإلكتروني</span>
            <div className="login-input">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>
          <label>
            <span>كلمة المرور</span>
            <div className="login-input">
              <LockKeyhole size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </label>
          <button className="login-submit" disabled={loading}>
            {loading ? (
              "جار تسجيل الدخول..."
            ) : (
              <>
                تسجيل الدخول <ArrowLeft size={17} />
              </>
            )}
          </button>
        </form>
        <div className="login-security">
          <ShieldCheck size={16} />
          <span>وصول آمن للمستخدمين المصرح لهم فقط</span>
        </div>
      </section>
    </main>
  );
}
