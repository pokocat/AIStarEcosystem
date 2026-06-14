"use client";

// useDramaConfig — 短剧个性化配置 hook（v0.66）。
// 立即返回默认值（避免渲染抖动），后台拉真值后刷新；失败保持默认（toast 由调用动作处理）。
import * as React from "react";
import {
  DRAMA_CONFIG_DEFAULTS,
  getDramaConfig,
  type DramaCreditConfig,
} from "@/api/drama-config";

export function useDramaConfig(): DramaCreditConfig {
  const [cfg, setCfg] = React.useState<DramaCreditConfig>(DRAMA_CONFIG_DEFAULTS);
  React.useEffect(() => {
    let alive = true;
    getDramaConfig()
      .then((c) => {
        if (alive) setCfg(c);
      })
      .catch(() => {
        /* 拉取失败用默认值，不打扰用户 */
      });
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}
