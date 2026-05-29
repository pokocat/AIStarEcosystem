import { MixcutApi } from "@/api";
import * as React from "react";
import type { MaterialProduct } from "./types";

type ThumbEntry = readonly [string, string];

function firstImage(product: MaterialProduct): string | null {
  return product.images?.find((url) => typeof url === "string" && url.trim()) ?? null;
}

async function resolveProductThumb(product: MaterialProduct): Promise<ThumbEntry | null> {
  const image = firstImage(product);
  if (image) return [product.id, image] as const;

  try {
    const assets = await MixcutApi.listAssets({ relatedProductId: product.id, kind: "image" });
    const asset =
      assets.find((item) => item.subkind === "product-photo") ??
      assets.find((item) => item.kind === "image");
    const url = asset?.preview_url ?? asset?.thumbnail_url ?? asset?.file_url;
    return url ? ([product.id, url] as const) : null;
  } catch {
    return null;
  }
}

export async function loadProductThumbMap(products: MaterialProduct[]): Promise<Record<string, string>> {
  const entries = await Promise.all(products.map(resolveProductThumb));
  return Object.fromEntries(entries.filter((entry): entry is ThumbEntry => Boolean(entry)));
}

export function productThumbUrl(product: MaterialProduct | undefined, thumbByProductId: Record<string, string>): string | undefined {
  if (!product) return undefined;
  return thumbByProductId[product.id] ?? firstImage(product) ?? undefined;
}

export function useProductThumbUrl(product: MaterialProduct | null | undefined): string | undefined {
  const [thumbByProductId, setThumbByProductId] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!product) {
      setThumbByProductId({});
      return;
    }

    let cancelled = false;
    loadProductThumbMap([product]).then((thumbs) => {
      if (!cancelled) setThumbByProductId(thumbs);
    });

    return () => {
      cancelled = true;
    };
  }, [product]);

  return productThumbUrl(product ?? undefined, thumbByProductId);
}
