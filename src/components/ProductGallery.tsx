import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStorefrontProductImage, loadStorefrontProductImages } from "@/lib/storefront";

const fallbackImage = "/topchamal-logo.jpg";

type ProductGalleryProps = {
  alt: string;
  className?: string | undefined;
  /** Public picture URLs already available in the catalog payload. */
  images?: string[] | undefined;
  /** Product slug; when present, the complete picture list loads near the viewport. */
  slug?: string | undefined;
  hasInlineImage?: boolean | undefined;
  eager?: boolean | undefined;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Full-fit product gallery with gentle crossfades, automatic rotation, dots,
 * touch swiping, and lazy loading for published product images.
 */
export function ProductGallery({
  alt,
  className,
  images,
  slug,
  hasInlineImage = false,
  eager = false,
}: ProductGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialImages = useMemo(
    () => (images ? Array.from(new Set(images.filter(Boolean))) : []),
    [images],
  );
  const [list, setList] = useState<string[]>(() => (hasInlineImage ? [] : initialImages));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [galleryFailed, setGalleryFailed] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((next: number, total: number) => {
    if (total === 0) return;
    setIndex(((next % total) + total) % total);
  }, []);

  // Follow runtime changes to the user's motion preference.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Replace the active gallery cleanly if catalog data for this product changes.
  useEffect(() => {
    setList(hasInlineImage ? [] : initialImages);
    setIndex(0);
    setGalleryFailed(false);
  }, [slug, hasInlineImage, initialImages]);

  // Load the full public gallery only when it is near the viewport.
  useEffect(() => {
    if (!slug) return;
    const node = containerRef.current;
    if (!node) return;
    let active = true;
    let loaded = false;
    const needsFullGallery = hasInlineImage || initialImages.length <= 1;

    const load = () => {
      if (!needsFullGallery || loaded) return;
      loaded = true;
      void loadStorefrontProductImages(slug).then(async (fetched) => {
        if (!active) return;
        if (fetched.length > 0) {
          setList(fetched);
          setGalleryFailed(false);
          return;
        }
        if (hasInlineImage) {
          const firstImage = await loadStorefrontProductImage(slug);
          if (!active) return;
          const fallbackList = [firstImage, ...initialImages].filter((url): url is string =>
            Boolean(url),
          );
          if (fallbackList.length > 0) {
            setList((current) => Array.from(new Set([...fallbackList, ...current])));
          } else {
            setGalleryFailed(true);
          }
        }
      });
    };

    if (eager || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      load();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setIsInView(visible);
        if (visible) load();
      },
      { rootMargin: "220px" },
    );
    observer.observe(node);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [slug, hasInlineImage, eager, initialImages]);

  useEffect(() => {
    setIndex((current) => (current < list.length ? current : 0));
  }, [list.length, slug]);

  // Rotate only while the gallery is visible, not focused/hovered, and motion is allowed.
  useEffect(() => {
    if (list.length < 2 || paused || !isInView || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % list.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [list.length, paused, isInView, reducedMotion]);

  const waitingForInlineImage =
    Boolean(slug) && hasInlineImage && list.length === 0 && !galleryFailed;
  const visible = list.length > 0 ? list : waitingForInlineImage ? [] : [fallbackImage];
  const safeIndex = Math.min(index, visible.length - 1);

  return (
    <div
      ref={containerRef}
      className={["product-gallery", className].filter(Boolean).join(" ")}
      data-gallery-count={visible.length > 1 ? visible.length : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      onPointerDown={(event) => {
        touchStartX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (touchStartX.current == null) return;
        const delta = event.clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) < 36 || visible.length < 2) return;
        goTo(safeIndex + (delta < 0 ? 1 : -1), visible.length);
      }}
      onPointerCancel={() => {
        touchStartX.current = null;
      }}
    >
      <div className="gallery-frame" aria-roledescription="carousel" aria-label={alt}>
        {visible.length === 0 ? (
          <div className="gallery-loading" aria-hidden="true" />
        ) : (
          visible.map((src, position) => (
            <img
              key={`${src.slice(0, 48)}-${position}`}
              src={src}
              alt={position === safeIndex ? alt : ""}
              aria-hidden={position !== safeIndex}
              loading={eager && position === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className={position === safeIndex ? "gallery-slide is-active" : "gallery-slide"}
              onError={(event) => {
                const image = event.currentTarget;
                if (!image.src.endsWith(fallbackImage)) image.src = fallbackImage;
              }}
            />
          ))
        )}
      </div>
      {visible.length > 1 && (
        <div className="gallery-dots" role="tablist" aria-label="صور المنتج">
          {visible.map((_, position) => (
            <button
              key={position}
              type="button"
              role="tab"
              aria-selected={position === safeIndex}
              aria-label={`الصورة ${position + 1} من ${visible.length}`}
              className={position === safeIndex ? "gallery-dot is-active" : "gallery-dot"}
              onClick={() => goTo(position, visible.length)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
