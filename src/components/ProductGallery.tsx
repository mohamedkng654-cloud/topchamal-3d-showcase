import { useCallback, useEffect, useRef, useState } from "react";
import { loadStorefrontProductImages } from "@/lib/storefront";

const fallbackImage = "/topchamal-logo.jpg";

type ProductGalleryProps = {
  alt: string;
  className?: string | undefined;
  /** Static (non-embedded) picture URLs already known from the catalog payload. */
  images?: string[] | undefined;
  /** Product slug; when present the full picture list is lazy-loaded on visibility. */
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
 * Animated product picture gallery: crossfades between every picture of a
 * product, auto-advances, supports swiping/dots, and lazily loads the full
 * picture list (including embedded photos) when it scrolls into view.
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
  const initialImages = images ? Array.from(new Set(images.filter(Boolean))) : [];
  const [list, setList] = useState<string[]>(initialImages);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((next: number, total: number) => {
    if (total === 0) return;
    setIndex(((next % total) + total) % total);
  }, []);

  // Lazy-load the complete picture list once the gallery becomes visible.
  useEffect(() => {
    if (!slug) return;
    if (initialImages.length > 1 && !hasInlineImage) return;
    const node = containerRef.current;
    if (!node) return;
    let active = true;

    const load = () => {
      void loadStorefrontProductImages(slug).then((fetched) => {
        if (!active || fetched.length === 0) return;
        setList((current) => {
          if (fetched.length === current.length && fetched.every((url, i) => url === current[i])) {
            return current;
          }
          return fetched;
        });
      });
    };

    if (eager || typeof IntersectionObserver === "undefined") {
      load();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: "320px" },
      );
      observer.observe(node);
      return () => observer.disconnect();
    }
    return () => {
      active = false;
    };
    // initialImages identity is intentionally excluded; it is derived once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, hasInlineImage, eager]);

  // Reset the active slide when the gallery changes entirely.
  useEffect(() => {
    setIndex((current) => (current < list.length ? current : 0));
  }, [list.length, slug]);

  // Auto-advance through the pictures.
  useEffect(() => {
    if (list.length < 2 || paused || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % list.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [list.length, paused]);

  const visible = list.length > 0 ? list : [fallbackImage];
  const safeIndex = Math.min(index, visible.length - 1);

  return (
    <div
      ref={containerRef}
      className={["product-gallery", className].filter(Boolean).join(" ")}
      data-gallery-count={visible.length > 1 ? visible.length : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
    >
      <div className="gallery-frame" aria-roledescription="carousel" aria-label={alt}>
        {visible.map((src, position) => (
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
        ))}
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
