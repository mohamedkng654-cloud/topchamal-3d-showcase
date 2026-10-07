import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Wallet,
  X,
  MessageCircle,
  Package,
  Play,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Button } from "@/components/ui/button";
import catalog from "../data/products.json";
import { categories } from "../data/categories";
import {
  createStorefrontOrder,
  loadStorefrontCategories,
  loadStorefrontProducts,
  subscribeToStorefrontCatalog,
  type StorefrontCategory,
  type StorefrontProduct,
} from "@/lib/storefront";
import { defaultSiteSettings, getActiveLocalStories, getLocalSiteSettings, pullSiteContent, subscribeToSiteContent, type LocalStory } from "@/lib/local-store";
const brandLogo = "/topchamal-logo.jpg";

gsap.registerPlugin(ScrollTrigger);
type Product = StorefrontProduct;
type CartLine = { id: string; quantity: number };
const fallbackProducts = catalog.products as Product[];
const formatPrice = (n: number) =>
  new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(n);
const META =
  "اكتشف آلات القهوة، الخلاطات، العجانات وأجهزة المنزل من Topchamal. تشكيلة مختارة بأسعار الدرهم المغربي.";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Topchamal | أجهزة منزلية لكل لحظة" },
      { name: "description", content: META },
      { property: "og:title", content: "Topchamal | أجهزة منزلية لكل لحظة" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Storefront,
});
function PictureView({
  src,
  alt,
  interactive = true,
}: {
  src: string;
  alt: string;
  interactive?: boolean;
}) {
  return (
    <div className={interactive ? "hero-scene picture-scene" : "showcase-visual picture-scene"}>
      <div className="hero-fallback" />
      <img
        key={src}
        src={src}
        alt={alt}
        className="scene-picture"
        loading={interactive ? "eager" : "lazy"}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith("/topchamal-logo.jpg"))
            event.currentTarget.src = "/topchamal-logo.jpg";
        }}
      />
    </div>
  );
}
export function Storefront() {
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryList, setCategoryList] = useState<StorefrontCategory[]>(categories);
  const [scrolled, setScrolled] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [active, setActive] = useState("all");
  const [feature, setFeature] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [percent, setPercent] = useState(0);
  const [now, setNow] = useState(0);
  const [stories, setStories] = useState<LocalStory[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const holdTimer = useRef<number | null>(null);
  const categoryName = (id: string) =>
    categoryList.find((category) => category.id === id)?.label || "أجهزة منزلية";
  const productRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const refreshProducts = () => { void loadStorefrontProducts(fallbackProducts).then(setProducts); };
    const refreshCategories = () => { void loadStorefrontCategories(categories).then(setCategoryList); };
    refreshProducts();
    refreshCategories();
    try {
      const value = JSON.parse(localStorage.getItem("topchamal-cart") || "[]");
      if (Array.isArray(value))
        setCart(
          value.filter(
            (v: CartLine) =>
              v && typeof v.id === "string" && Number.isInteger(v.quantity) && v.quantity > 0,
          ),
        );
    } catch {
      localStorage.removeItem("topchamal-cart");
    }
    setLoaded(true);
    setStories(getActiveLocalStories());
    setSiteSettings(getLocalSiteSettings());
    void pullSiteContent().then(() => {
      setStories(getActiveLocalStories());
      setSiteSettings(getLocalSiteSettings());
    });
    const unsubscribeCatalog = subscribeToStorefrontCatalog(() => {
      refreshProducts();
      refreshCategories();
    });
    const unsubscribeContent = subscribeToSiteContent(() => {
      setStories(getActiveLocalStories());
      setSiteSettings(getLocalSiteSettings());
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => {
      clearInterval(t);
      unsubscribeCatalog();
      unsubscribeContent();
    };
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem("topchamal-cart", JSON.stringify(cart));
  }, [cart, loaded]);
  useEffect(() => {
    if (storyViewerIndex === null) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStoryViewerIndex(null);
      if (event.key === "ArrowLeft") setStoryViewerIndex((index) => (index === null ? null : Math.max(0, index - 1)));
      if (event.key === "ArrowRight") setStoryViewerIndex((index) => (index === null ? null : index + 1 < stories.length ? index + 1 : 0));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [storyViewerIndex, stories.length]);
  useEffect(() => {
    if (storyViewerIndex === null || stories.length < 2) return;
    const timer = window.setTimeout(() => {
      setStoryViewerIndex((index) => (index === null ? null : index + 1 < stories.length ? index + 1 : 0));
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [storyViewerIndex, stories.length]);
  useEffect(() => {
    if (!previewProduct) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewProduct(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewProduct]);
  useEffect(() => {
    if (!loaded) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motion) {
      setPercent(100);
      return;
    }
    const start = performance.now();
    const interval = setInterval(() => {
      const v = Math.min(100, Math.floor((performance.now() - start) / 9));
      setPercent(v);
      if (v >= 100) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [loaded]);
  useEffect(() => {
    if (!loaded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.12 });
    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);
    const ctx = gsap.context(() => {
      gsap.from(".hero-kicker", { opacity: 0, y: 16, duration: 0.7, ease: "power3.out" });
      gsap.from(".hero h1 .hero-word", {
        opacity: 0,
        y: 42,
        rotateX: 12,
        stagger: 0.14,
        duration: 1.05,
        ease: "power3.out",
        delay: 0.13,
      });
      gsap.from(".hero p", { opacity: 0, y: 22, duration: 0.85, delay: 0.57, ease: "power3.out" });
      gsap.from(".hero-buttons > *", {
        opacity: 0,
        y: 20,
        stagger: 0.12,
        duration: 0.75,
        delay: 0.75,
        ease: "back.out(1.3)",
      });
      gsap.utils
        .toArray<HTMLElement>(
          ".reveal, .category-item, .product-card, .trust-item, .faq-list details",
        )
        .forEach((el, i) =>
          gsap.from(el, {
            opacity: 0,
            y: 34,
            scale: 0.975,
            duration: 0.82,
            delay: (i % 4) * 0.045,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          }),
        );
    }, document.body);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
      ctx.revert();
    };
  }, [loaded]);
  const filtered = useMemo(
    () => (active === "all" ? products : products.filter((p) => p.category === active)),
    [active, products],
  );
  const featured = products.filter((p) =>
    ["cofee-machine", "blender", "robot-cuiseur", "cocotte"].includes(p.category),
  );
  const featuredProduct = featured[feature % featured.length] ?? products[0];
  const count = cart.reduce((n, x) => n + x.quantity, 0);
  const total = cart.reduce(
    (n, x) => n + (products.find((p) => p.id === x.id)?.price || 0) * x.quantity,
    0,
  );
  function add(p: Product) {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id);
      return found
        ? c.map((x) => (x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x))
        : [...c, { id: p.id, quantity: 1 }];
    });
    setDrawer(true);
    setCheckout(false);
  }
  function clearHoldTimer() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }
  function startProductHold(p: Product) {
    clearHoldTimer();
    holdTimer.current = window.setTimeout(() => {
      setPreviewProduct(p);
      holdTimer.current = null;
    }, 420);
  }
  function qty(id: string, d: number) {
    setCart((c) =>
      c
        .map((x) => (x.id === id ? { ...x, quantity: x.quantity + d } : x))
        .filter((x) => x.quantity > 0),
    );
  }
  function choose(id: string) {
    setActive(id);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }
  async function order(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOrderError("");
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const city = String(data.get("city") || "").trim();
    if (!name || !/^0[567]\d{8}$|^\+?212[567]\d{8}$/.test(phone) || !city) {
      setOrderError("يرجى إدخال الاسم والمدينة ورقم هاتف مغربي صالح.");
      return;
    }
    setOrderSubmitting(true);
    const lines = cart
      .map((line) => {
        const product = products.find((item) => item.id === line.id);
        return product
          ? `• ${product.name} × ${line.quantity} — ${formatPrice(product.price * line.quantity)} د.م`
          : "";
      })
      .filter(Boolean);
    const localOrderNumber = `TC-${Date.now().toString(36).toUpperCase()}`;
    let orderNumber = localOrderNumber;
    let orderTotal = total;
    try {
      const result = await createStorefrontOrder({
        name,
        phone,
        city,
        lines: cart.map((line) => ({ slug: line.id, quantity: line.quantity })),
      });
      orderNumber = result.order_number;
      orderTotal = Number(result.total_mad);
    } catch {
      // The storefront must remain usable when no backend has been configured.
      try {
        const saved = JSON.parse(localStorage.getItem("topchamal-local-orders") || "[]");
        const orders = Array.isArray(saved) ? saved : [];
        orders.push({
          id: `local-order-${Date.now()}`,
          order_number: orderNumber,
          customer_name: name,
          phone,
          city,
          total_mad: orderTotal,
          payment_method: "cash_on_delivery",
          status: "new",
          created_at: new Date().toISOString(),
          items: lines,
        });
        localStorage.setItem("topchamal-local-orders", JSON.stringify(orders.slice(-50)));
      } catch {
        // Local storage can be unavailable in private browsing; WhatsApp still works.
      }
    }
    const text = `طلب جديد من Topchamal\nرقم الطلب: ${orderNumber}\n\n${lines.join("\n")}\n\nالمجموع: ${formatPrice(orderTotal)} د.م\nالاسم: ${name}\nالهاتف: ${phone}\nالمدينة: ${city}\nطريقة الدفع: عند الاستلام`;
    const popup = window.open(
      `https://wa.me/${siteSettings.whatsapp}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (!popup) setOrderError("اسمح بفتح النوافذ المنبثقة لإرسال الطلب عبر واتساب.");
    else {
      setCart([]);
      setCheckout(false);
    }
    setOrderSubmitting(false);
  }

  const daysLeft = now
    ? Math.max(0, 7 * 24 * 3600 - (Math.floor(now / 1000) % (7 * 24 * 3600)))
    : 0;
  const hh = String(Math.floor(daysLeft / 3600) % 24).padStart(2, "0"),
    mm = String(Math.floor(daysLeft / 60) % 60).padStart(2, "0"),
    ss = String(daysLeft % 60).padStart(2, "0");
  return (
    <main dir="rtl">
      {loaded && percent < 100 && (
        <div role="status" aria-label="جاري تحميل المعرض" className="loader">
          <div className="loader-mark">
            <img src={brandLogo} alt="TopChamal Home Cookware" />
          </div>
          <span className="num">{percent}%</span>
          <span className="latin">TOPCHAMAL</span>
        </div>
      )}
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="wrap">
          <a className="brand brand-image" href="/" aria-label="Topchamal">
            <img src={brandLogo} width="94" height="68" alt="Topchamal Home Cookware" />
          </a>
          <nav className="desktop-nav" aria-label="القائمة الرئيسية">
            <a href="#home">الرئيسية</a>
            <a href="#categories">التصنيفات</a>
            <a href="#products">المنتجات</a>
            <a href="#about">لماذا نحن</a>
            <a href="#faq">الأسئلة الشائعة</a>
          </nav>
          <a className="btn btn-outline admin-link" href="/admin/login?login=1">
            تسجيل دخول الإدارة
          </a>
          <div className="header-actions">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="فتح القائمة"
              onClick={() => setMenu((v) => !v)}
            >
              <Menu size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="فتح السلة"
              onClick={() => setDrawer(true)}
            >
              <ShoppingBag size={21} />
              {count > 0 && <span className="cart-count num">{count}</span>}
            </Button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav">
            <a onClick={() => setMenu(false)} href="#categories">
              التصنيفات
            </a>
            <a onClick={() => setMenu(false)} href="#products">
              المنتجات
            </a>
            <a onClick={() => setMenu(false)} href="#about">
              لماذا نحن
            </a>
            <a onClick={() => setMenu(false)} href="#faq">
              الأسئلة الشائعة
            </a>
          </nav>
        )}
      </header>
      <section className="hero" id="home">
        <PictureView src={brandLogo} alt="Topchamal" />
        <div className="wrap hero-inner">
          <div className="hero-kicker">{siteSettings.heroKicker}</div>
          <h1>
            <span className="hero-word">{siteSettings.heroTitle}</span>
            <br />
            <span className="hero-word">
              <em>{siteSettings.heroTitleAccent}</em>
            </span>
          </h1>
          <p>{siteSettings.heroDescription}</p>
          <div className="hero-buttons">
            <Button
              className="btn"
              onClick={() =>
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              تسوق الآن <ArrowLeft size={16} />
            </Button>
            <Button
              className="btn btn-outline"
              onClick={() =>
                document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              اكتشف التشكيلة <ChevronDown size={16} />
            </Button>
          </div>
        </div>
        <div className="hero-side">CURATED FOR YOUR HOME · 2026</div>
        <div className="hero-index">
          <span className="num">01 / 03</span>
          <i /> مرر للاستكشاف
        </div>
      </section>
      <div className="stats-strip">
        <div className="wrap stats-inner">
          <div className="stat">
            <Truck size={26} />
            <div>
              <strong>التوصيل لجميع أنحاء المغرب</strong>
              <small>تسوق من أي مدينة</small>
            </div>
          </div>
          <div className="stat">
            <ShieldCheck size={26} />
            <div>
              <strong>منتجات مختارة</strong>
              <small>تشكيلة من علامات معروفة</small>
            </div>
          </div>
          <div className="stat">
            <Wallet size={26} />
            <div>
              <strong>الدفع عند الاستلام</strong>
              <small>اطلب بسهولة عبر واتساب</small>
            </div>
          </div>
        </div>
      </div>
      {stories.length > 0 && (
        <section className="stories-section" aria-label="قصص وعروض Topchamal">
          <div className="wrap">
            <div className="stories-heading"><div><span className="eyebrow">TOPCHAMAL STORIES</span><h2 className="section-heading">آخر العروض والقصص</h2></div><div className="stories-heading-side"><span className="stories-live-badge"><i /> جديد الآن</span><span className="stories-heading-note">اضغط على أي قصة للتصفح مثل Instagram</span></div></div>
            <div className="stories-strip">
              {stories.map((story, index) => <button className="story-card" key={story.id} type="button" onClick={() => setStoryViewerIndex(index)} aria-label={`فتح قصة ${story.title}`}>
                <span className="story-ring"><span className="story-media">{story.media_type === "video" ? <video src={story.media_url} muted playsInline preload="metadata" /> : <img src={story.media_url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" />}</span></span>
                <span className="story-card-label">{story.title}</span>
                {story.media_type === "video" && <span className="story-play"><Play size={14} fill="currentColor" /></span>}
              </button>)}
            </div>
          </div>
        </section>
      )}
      {storyViewerIndex !== null && stories[storyViewerIndex] && (() => {
        const story = stories[storyViewerIndex];
        return <div className="story-viewer" role="dialog" aria-modal="true" aria-label="عارض القصص">
          <button type="button" className="story-viewer-backdrop" onClick={() => setStoryViewerIndex(null)} aria-label="إغلاق القصص" />
          <div className="story-viewer-shell">
            <div className="story-progress-row">{stories.map((item, index) => <span className={`story-progress ${index < storyViewerIndex ? "complete" : ""}`} key={item.id}><i className={index === storyViewerIndex ? "running" : ""} /></span>)}</div>
            <div className="story-viewer-top"><div className="story-viewer-brand"><img src={brandLogo} alt="TopChamal" /><span>TopChamal</span></div><span className="story-counter">{storyViewerIndex + 1} / {stories.length}</span><button type="button" className="story-viewer-close" onClick={() => setStoryViewerIndex(null)} aria-label="إغلاق"><X size={20} /></button></div>
            <div className="story-viewer-media">{story.media_type === "video" ? <video key={story.id} src={story.media_url} autoPlay muted playsInline /> : <img key={story.id} src={story.media_url} alt={story.title} />}</div>
            <button type="button" className="story-nav story-nav-prev" onClick={() => setStoryViewerIndex((index) => index === null ? null : Math.max(0, index - 1))} aria-label="القصة السابقة"><ArrowLeft size={24} /></button>
            <button type="button" className="story-nav story-nav-next" onClick={() => setStoryViewerIndex((index) => index === null ? null : index + 1 < stories.length ? index + 1 : 0)} aria-label="القصة التالية"><ArrowRight size={24} /></button>
            <div className="story-viewer-info"><span className="story-offer">{story.offer_label || "عرض خاص"}</span><h3>{story.title}</h3>{story.caption && <p>{story.caption}</p>}{story.product_name && <strong>{story.product_name}</strong>}{story.price_mad != null && <div className="story-price"><span>{formatPrice(story.price_mad)} د.م</span>{story.old_price_mad != null && <del>{formatPrice(story.old_price_mad)} د.م</del>}</div>}</div>
          </div>
        </div>;
      })()}
      <section className="section category-section" id="categories">
        <div className="wrap">
          <div className="section-top reveal">
            <div>
              <span className="eyebrow">EXPLORE THE COLLECTION</span>
              <h2 className="section-heading">عالم من الاختيارات</h2>
            </div>
            <p className="fine">
              من قهوتك الصباحية إلى وصفاتك المفضلة،
              <br />
              ستجد ما يناسب بيتك.
            </p>
          </div>
          <div className="category-grid">
            {categoryList.map((c, i) => (
              <button
                key={c.id}
                className={`category-item reveal ${active === c.id ? "active" : ""}`}
                onClick={() => choose(c.id)}
                aria-label={`عرض ${c.label}`}
              >
                <div className="category-image">
                  {catalog.categoryImages[c.id as keyof typeof catalog.categoryImages] ||
                  products.find((p) => p.category === c.id)?.image ? (
                    <img
                      loading="lazy"
                      src={
                        catalog.categoryImages[c.id as keyof typeof catalog.categoryImages] ||
                        products.find((p) => p.category === c.id)?.image
                      }
                      alt={c.label}
                      onError={(event) => {
                        if (!event.currentTarget.src.endsWith("/topchamal-logo.jpg"))
                          event.currentTarget.src = "/topchamal-logo.jpg";
                      }}
                    />
                  ) : (
                    <span className="category-symbol">✦</span>
                  )}
                </div>
                <strong>{c.label}</strong>
                <small>{c.fr}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
      {featuredProduct && (
        <section className="section showcase" id="featured">
          <div className="wrap showcase-grid">
            <PictureView
              src={featuredProduct.image}
              alt={featuredProduct.name}
              interactive={false}
            />
            <div className="showcase-details reveal">
              <span className="eyebrow">
                IN THE SPOTLIGHT · {String((feature % featured.length) + 1).padStart(2, "0")}
              </span>
              <h2 className="section-heading">قطعة تستحق اهتمامك</h2>
              <h3>{featuredProduct.name}</h3>
              <p>تصميم عملي لتفاصيل يومك. اكتشف المنتج وأضفه إلى سلتك بكل سهولة.</p>
              <div className="showcase-price">
                <span className="num">{formatPrice(featuredProduct.price)}</span> <small>د.م</small>
                {featuredProduct.oldPrice && (
                  <del className="num">{formatPrice(featuredProduct.oldPrice)}</del>
                )}
              </div>
              <Button className="btn" onClick={() => add(featuredProduct)}>
                أضف إلى السلة <ShoppingBag size={16} />
              </Button>
              <div className="showcase-controls">
                <Button
                  aria-label="المنتج التالي"
                  onClick={() => setFeature((v) => (v + 1) % featured.length)}
                >
                  <ArrowRight size={16} />
                </Button>
                <Button
                  aria-label="المنتج السابق"
                  onClick={() => setFeature((v) => (v - 1 + featured.length) % featured.length)}
                >
                  <ArrowLeft size={16} />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
      <section className="section product-section" id="products" ref={productRef}>
        <div className="wrap">
          <div className="section-top reveal">
            <div>
              <span className="eyebrow">THE TOPCHAMAL EDIT</span>
              <h2 className="section-heading">تشكيلة تناسب كل يوم</h2>
            </div>
            <p className="fine">
              منتجات حقيقية من متجر Topchamal
              <br />
              بأسعار الدرهم المغربي.
            </p>
          </div>
          <div className="filter-row" aria-label="تصفية حسب التصنيف">
            <Button
              className={`filter-btn ${active === "all" ? "active" : ""}`}
              onClick={() => setActive("all")}
            >
              جميع المنتجات
            </Button>
            {categoryList.map((c) => (
              <Button
                key={c.id}
                className={`filter-btn ${active === c.id ? "active" : ""}`}
                onClick={() => setActive(c.id)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          {filtered.length ? (
            <div className="product-grid">
              {filtered.map((p) => (
                <article
                  className="product-card"
                  key={p.id}
                  onPointerMove={(e) => {
                    if (e.pointerType === "mouse") {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                    }
                  }}
                >
                  <div
                    className="product-photo"
                    onPointerDown={(event) => {
                      if (event.pointerType !== "mouse") startProductHold(p);
                    }}
                    onPointerUp={clearHoldTimer}
                    onPointerCancel={clearHoldTimer}
                    onPointerLeave={clearHoldTimer}
                    title="اضغط مطولاً لمعاينة المنتج"
                  >
                    {p.oldPrice && (
                      <span className="badge">
                        -{Math.round((1 - p.price / p.oldPrice) * 100)}%
                      </span>
                    )}
                    <img
                      src={p.image}
                      loading="lazy"
                      alt={p.name}
                      onError={(event) => {
                        if (!event.currentTarget.src.endsWith("/topchamal-logo.jpg"))
                          event.currentTarget.src = "/topchamal-logo.jpg";
                      }}
                    />
                    <span className="product-hold-hint">اضغط مطولاً للمعاينة</span>
                  </div>
                  <div className="product-info">
                    <span className="tag">{categoryName(p.category)}</span>
                    <h3>{p.name}</h3>
                    <div className="product-bottom">
                      <div className="product-price">
                        <span className="num">{formatPrice(p.price)}</span> <small>د.م</small>
                        {p.oldPrice && <del className="num">{formatPrice(p.oldPrice)} د.م</del>}
                      </div>
                      <Button
                        className="add-btn"
                        size="icon"
                        aria-label={`أضف ${p.name} إلى السلة`}
                        onClick={() => add(p)}
                      >
                        <Plus size={18} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Package size={32} />
              <p>لا توجد منتجات في هذا التصنيف حالياً.</p>
              <Button className="btn btn-outline" onClick={() => setActive("all")}>
                عرض جميع المنتجات
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="promo">
        <div className="wrap">
          <div>
            <span className="eyebrow">LIMITED EDITION · TOPCHAMAL</span>
            <h2>{siteSettings.promoTitle}</h2>
            <p>{siteSettings.promoDescription}</p>
            <Button
              className="btn"
              onClick={() => {
                setActive("all");
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              اكتشف العروض <ArrowLeft size={16} />
            </Button>
          </div>
          <div className="countdown" aria-label="عداد تنازلي متجدد">
            <div>
              {hh}
              <small>ساعة</small>
            </div>
            <b>:</b>
            <div>
              {mm}
              <small>دقيقة</small>
            </div>
            <b>:</b>
            <div>
              {ss}
              <small>ثانية</small>
            </div>
          </div>
        </div>
      </section>
      <section className="section" id="about">
        <div className="wrap">
          <span className="eyebrow">THE TOPCHAMAL PROMISE</span>
          <h2 className="section-heading">{siteSettings.aboutTitle}</h2>
          <div className="trust-grid">
            <div className="trust-item reveal">
              <Truck size={36} />
              <h3>توصيل بالمغرب</h3>
              <p>اختر مدينتك عند إتمام الطلب وتواصل لتأكيد تفاصيل التوصيل.</p>
            </div>
            <div className="trust-item reveal">
              <ShieldCheck size={36} />
              <h3>اختيار مميز</h3>
              <p>أجهزة منزلية من علامات معروفة لاحتياجات المطبخ والبيت.</p>
            </div>
            <div className="trust-item reveal">
              <Wallet size={36} />
              <h3>الدفع عند الاستلام</h3>
              <p>بدون بوابة دفع إلكترونية: أرسل طلبك واستفسر عن توفر المنتج.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="section faq-section" id="faq">
        <div className="wrap">
          <span className="eyebrow">QUESTIONS & ANSWERS</span>
          <h2 className="section-heading">أسئلة تتكرر</h2>
          <div className="faq-list">
            <details>
              <summary>كيف أرسل طلبي؟</summary>
              <p>
                أضف المنتجات إلى السلة، أدخل اسمك ورقم هاتفك ومدينتك، ثم شارك رسالة الطلب عبر واتساب
                مع المتجر.
              </p>
            </details>
            <details>
              <summary>هل الأسعار بالدرهم المغربي؟</summary>
              <p>
                نعم، جميع الأسعار المعروضة بالدرهم المغربي (د.م). يُرجى التأكد من السعر والتوفر عند
                تأكيد الطلب.
              </p>
            </details>
            <details>
              <summary>هل أستطيع الدفع عند الاستلام؟</summary>
              <p>
                نعم، نموذج الطلب يحدد الدفع عند الاستلام. يرجى تأكيد تفاصيل الطلب مع المتجر عبر
                واتساب.
              </p>
            </details>
          </div>
        </div>
      </section>
      <footer className="footer" id="contact">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <a className="brand" href="/">
                <img className="footer-logo" src={brandLogo} width="150" height="99" alt="TopChamal Premium Moroccan Cookware" />
              </a>
              <p>{siteSettings.footerDescription}</p>
            </div>
            <div>
              <h4>اكتشف</h4>
              <a href="#categories">التصنيفات</a>
              <a href="#products">المنتجات</a>
              <a href="#featured">منتج مميز</a>
            </div>
            <div>
              <h4>المساعدة</h4>
              <a href="#faq">الأسئلة الشائعة</a>
              <a href="#about">التوصيل والدفع</a>
              <a href="https://topchamal.ma/pages/contact-us" target="_blank" rel="noreferrer">
                التواصل مع المتجر
              </a>
            </div>
            <div>
              <h4>السياسات</h4>
              <a
                href="https://topchamal.ma/pages/terms-and-conditions"
                target="_blank"
                rel="noreferrer"
              >
                شروط الاستخدام
              </a>
              <a href="https://topchamal.ma/pages/privacy-policy" target="_blank" rel="noreferrer">
                سياسة الخصوصية
              </a>
              <a href="https://topchamal.ma/pages/return-policy" target="_blank" rel="noreferrer">
                الاستبدال والاسترجاع
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 TOPCHAMAL</span>
            <span>MADE FOR EVERY MOMENT AT HOME</span>
          </div>
        </div>
      </footer>
      {previewProduct && (
        <div className="product-preview" role="dialog" aria-modal="true" aria-label={`معاينة ${previewProduct.name}`}>
          <button type="button" className="product-preview-backdrop" onClick={() => setPreviewProduct(null)} aria-label="إغلاق المعاينة" />
          <div className="product-preview-card">
            <Button className="product-preview-close icon-btn" size="icon" onClick={() => setPreviewProduct(null)} aria-label="إغلاق المعاينة"><X size={19} /></Button>
            <div className="product-preview-image"><img src={previewProduct.image} alt={previewProduct.name} /></div>
            <div className="product-preview-copy">
              <span className="tag">{categoryName(previewProduct.category)}</span>
              <h2>{previewProduct.name}</h2>
              <p>{previewProduct.description}</p>
              <strong className="product-preview-price"><span className="num">{formatPrice(previewProduct.price)}</span> <small>د.م</small></strong>
              <Button className="btn btn-wide product-preview-add" onClick={() => { add(previewProduct); setPreviewProduct(null); }}><Plus size={18} /> أضف مباشرة إلى السلة</Button>
            </div>
          </div>
        </div>
      )}
      <Button
        className="whatsapp-float"
        aria-label="التواصل مع TopChamal عبر واتساب"
        onClick={() =>
          window.open(
            "https://wa.me/" +
              siteSettings.whatsapp +
              "?text=" +
              encodeURIComponent("مرحباً، أريد الاستفسار عن منتجات Topchamal"),
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        <MessageCircle size={24} />
      </Button>
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={checkout ? "إتمام الطلب" : "سلة التسوق"}
          >
            <div className="drawer-head">
              <h2>
                {checkout ? "إتمام الطلب" : "سلة التسوق"}{" "}
                <span className="num">{!checkout && `(${count})`}</span>
              </h2>
              <Button
                className="icon-btn"
                size="icon"
                aria-label="إغلاق"
                onClick={() => {
                  setDrawer(false);
                  setCheckout(false);
                }}
              >
                <X size={19} />
              </Button>
            </div>
            <div className="drawer-body">
              {checkout ? (
                <form id="checkout-form" className="checkout-form" onSubmit={order}>
                  <p className="fine">الدفع عند الاستلام · سيتم تجهيز الطلب ثم فتح واتساب</p>
                  {orderError && (
                    <p className="checkout-error" role="alert">
                      {orderError}
                    </p>
                  )}
                  <label>
                    الاسم الكامل
                    <input name="name" required placeholder="اسمك الكامل" autoComplete="name" />
                  </label>
                  <label>
                    رقم الهاتف
                    <input
                      name="phone"
                      type="tel"
                      required
                      pattern="(0[567][0-9]{8}|\+?212[567][0-9]{8})"
                      title="أدخل رقم هاتف مغربي صالح"
                      placeholder="06xxxxxxxx"
                      autoComplete="tel"
                      dir="ltr"
                    />
                  </label>
                  <label>
                    المدينة
                    <input
                      name="city"
                      required
                      placeholder="مدينتك"
                      autoComplete="address-level2"
                    />
                  </label>
                  <p className="fine">
                    سيتم فتح واتساب برسالة جاهزة. اختر جهة اتصال المتجر لإرسالها؛ لا يُرسل الطلب
                    تلقائياً.
                  </p>
                </form>
              ) : cart.length ? (
                cart.map((line) => {
                  const p = products.find((x) => x.id === line.id);
                  return p ? (
                    <div className="cart-line" key={line.id}>
                      <img
                        src={p.image}
                        alt={p.name}
                        onError={(event) => {
                          if (!event.currentTarget.src.endsWith("/topchamal-logo.jpg"))
                            event.currentTarget.src = "/topchamal-logo.jpg";
                        }}
                      />
                      <div>
                        <strong>{p.name}</strong>
                        <span>{formatPrice(p.price * line.quantity)} د.م</span>
                        <div className="qty">
                          <Button aria-label={`زيادة ${p.name}`} onClick={() => qty(p.id, 1)}>
                            <Plus size={13} />
                          </Button>
                          <span className="num">{line.quantity}</span>
                          <Button aria-label={`تقليل ${p.name}`} onClick={() => qty(p.id, -1)}>
                            <Minus size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })
              ) : (
                <div className="empty">
                  <ShoppingBag size={38} />
                  <p>سلتك فارغة حالياً</p>
                  <Button className="btn btn-outline" onClick={() => setDrawer(false)}>
                    تصفح المنتجات
                  </Button>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="drawer-foot">
                <div className="total">
                  <span>المجموع</span>
                  <span className="num">{formatPrice(total)} د.م</span>
                </div>
                {checkout ? (
                  <>
                    <Button className="btn btn-wide" type="submit" form="checkout-form">
                      {orderSubmitting ? (
                        "جار حفظ الطلب..."
                      ) : (
                        <>
                          تأكيد الطلب وفتح واتساب <MessageCircle size={17} />
                        </>
                      )}
                    </Button>
                    <Button
                      className="btn btn-outline btn-wide"
                      style={{ marginTop: 8 }}
                      onClick={() => setCheckout(false)}
                    >
                      العودة للسلة
                    </Button>
                  </>
                ) : (
                  <Button className="btn btn-wide" onClick={() => setCheckout(true)}>
                    إتمام الطلب <ArrowLeft size={17} />
                  </Button>
                )}
              </div>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
