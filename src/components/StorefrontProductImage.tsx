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
  loading = "eager",
  slug,
  src,
}: StorefrontProductImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [inlineImage, setInlineImage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasInlineImage || !slug || !imageRef.current) return;
    let active = true;
    void loadStorefrontProductImage(slug).then((url) => {
      if (active && url) setInlineImage(url);
    });

    return () => {
      active = false;
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
