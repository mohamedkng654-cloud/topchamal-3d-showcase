import { useEffect, useRef, useState } from "react";
import { loadStorefrontProductImage } from "@/lib/storefront";

const fallbackImage = "/topchamal-logo.jpg";

type StorefrontProductImageProps = {
  alt: string;
  className?: string | undefined;
  hasInlineImage?: boolean | undefined;
  loading?: "eager" | "lazy" | undefined;
  slug?: string | undefined;
  src: string;
};

export function StorefrontProductImage({
  alt,
  className,
  hasInlineImage = false,
  loading = "lazy",
  slug,
  src,
}: StorefrontProductImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [inlineImage, setInlineImage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasInlineImage || !slug || !imageRef.current) return;
    const image = imageRef.current;
    let active = true;
    const loadImage = () => {
      observer?.disconnect();
      void loadStorefrontProductImage(slug).then((url) => {
        if (active && url) setInlineImage(url);
      });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) loadImage();
            },
            { rootMargin: "240px" },
          );
    if (observer) observer.observe(image);
    else loadImage();

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [hasInlineImage, slug]);

  return (
    <img
      ref={imageRef}
      className={className}
      src={inlineImage || src || fallbackImage}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith(fallbackImage)) {
          event.currentTarget.src = fallbackImage;
        }
      }}
    />
  );
}
