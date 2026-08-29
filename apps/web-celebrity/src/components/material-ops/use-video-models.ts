"use client";

// 生成模型候选的共享 hook（VideoGenDialog / WorkshopScreen / DraftingHub 共用）。
// 模块级缓存：同一会话只拉一次 /material/videos/models，避免各组件重复轮询。
// 加载失败 → error 非空且 models 为 null —— 消费方必须禁用提交/报价展示，
// 绝不回落写死单价（报价与后端 hold 金额必须同源）。

import * as React from "react";
import { MaterialOpsApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";
import type { VideoModelOption } from "./types";

// 缓存带 TTL：admin 可能随时改候选/默认绑定，长驻页面不失效会「按旧模型报价、按新模型生成」。
const CACHE_TTL_MS = 60_000;
let cached: VideoModelOption[] | null = null;
let cachedAt = 0;
let inflight: Promise<VideoModelOption[]> | null = null;

function fetchModels(): Promise<VideoModelOption[]> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = MaterialOpsApi.listVideoModels()
      .then((r) => {
        cached = r.video;
        cachedAt = Date.now();
        return r.video;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useVideoModels(): {
  models: VideoModelOption[] | null;
  error: string | null;
  /** 默认模型（isDefault 优先，退列表第一个）；未加载/为空时 null。 */
  defaultModel: VideoModelOption | null;
} {
  // 初始态只认未过期的缓存；刷新失败时清空 models —— 绝不让「旧报价 + 新错误」并存，
  // 否则消费方可能按过期模型报价提交。
  const [models, setModels] = React.useState<VideoModelOption[] | null>(
    cached && Date.now() - cachedAt < CACHE_TTL_MS ? cached : null,
  );
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchModels()
      .then((list) => {
        if (!alive) return;
        setModels(list);
        setError(list.length === 0 ? "尚未配置可用的视频生成模型，请联系运营在管理后台配置。" : null);
      })
      .catch((e) => {
        if (!alive) return;
        setModels(null);
        setError(errorMessage(e, "生成模型信息加载失败，请稍后重试"));
      });
    return () => {
      alive = false;
    };
  }, []);
  const defaultModel = React.useMemo(
    () => (models && models.length > 0 ? (models.find((m) => m.isDefault) ?? models[0]) : null),
    [models],
  );
  return { models, error, defaultModel };
}
