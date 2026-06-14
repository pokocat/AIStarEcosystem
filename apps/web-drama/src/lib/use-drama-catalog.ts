"use client";

// useDramaCatalog — 短剧平台目录（v0.67）。
// 立即返回内置默认（避免抖动），后台拉取后端运营值后刷新；失败保持默认。
import * as React from "react";
import { CATALOG_DEFAULTS, getCatalog, type DramaCatalog } from "@/api/catalog";

export function useDramaCatalog(): DramaCatalog {
  const [cat, setCat] = React.useState<DramaCatalog>(CATALOG_DEFAULTS);
  React.useEffect(() => {
    let alive = true;
    getCatalog()
      .then((c) => {
        if (alive) setCat(c);
      })
      .catch(() => {
        /* 失败用默认，不打扰 */
      });
    return () => {
      alive = false;
    };
  }, []);
  return cat;
}
