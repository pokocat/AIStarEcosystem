"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/use-canvas-pricing.tsx —— 画布里所有按钮上的价格（v0.198，契约见 contract.ts「价格」一节）。
//
// 单价来自 GET /me/drama/config（文字类五项 + 出图 frame）与 GET /me/drama/render/models（出图 / 视频候选的单价与能力）。
// 两份都模块级缓存（一次会话拉一次）。按钮上写的是**本次预计**，真实扣费以服务端为准（run.cost）。
// 还没读到（ready=false）时价格函数按默认单价算，界面可以先显示「—」。
//
// 视频模型、出图模型的选择都按画布记在 localStorage（读写都 try/catch：隐私模式下读不到就用默认模型）；
// 同一张画布里所有调用 useCanvasPricing 的组件共享一个选择（模块级 store）。出图面板、列表批量出图、
// 片段「出首帧」都读同一个 imageModelId 并把它带进请求（v0.198.1：以前只有面板记在内存里，批量和首帧
// 不带 endpointId，一律走后台默认模型，而线上那个默认模型任何画幅都 400）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { USE_MOCK } from "@/api/_client";
import { DRAMA_CONFIG_DEFAULTS, getDramaConfig, type DramaCreditConfig } from "@/api/drama-config";
import { listRenderModels, type RenderModelOption, type RenderModelsResponse } from "@/api/render";
import { MOCK_CANVAS_RENDER_MODELS } from "@/mocks/canvas";
import type { CanvasModelOption, CanvasPricingValue } from "./contract";
import { useOptionalCanvasDoc } from "./use-canvas-doc";

/** 视频模型不知道单条上限时按这个算。 */
export const DEFAULT_MAX_SEGMENT_SEC = 10;
/** 视频模型不知道单条下限时按这个算。 */
export const DEFAULT_MIN_SEGMENT_SEC = 1;

let modelsCache: Promise<RenderModelsResponse> | null = null;

function loadModels(): Promise<RenderModelsResponse> {
  if (!modelsCache) {
    // mock 模式下 render.ts 回空列表（那边的短剧页据此隐藏下拉）；画布的 mock 服务端按它自己的一份候选计价，这里读同一份
    modelsCache = (USE_MOCK ? Promise.resolve(MOCK_CANVAS_RENDER_MODELS) : listRenderModels()).catch((e) => {
      modelsCache = null; // 失败不缓存，下次重试
      throw e;
    });
  }
  return modelsCache;
}

/** 测试用。 */
export function __resetCanvasPricingForTest(): void {
  modelsCache = null;
  choices.clear();
}

function toOption(m: RenderModelOption): CanvasModelOption {
  return {
    endpointId: m.endpointId,
    name: m.name,
    isDefault: m.isDefault,
    creditCost: m.creditCost,
    billingUnit: m.billingUnit,
    maxDurationSec: m.capability?.maxDurationSec ?? null,
    minDurationSec: m.capability?.minDurationSec ?? null,
    // 能力元数据里没有「看不看首帧」这一项；明确写了最多 0 张参考图的才算不看，其余按看（跑完以服务端 refs.notes 为准）
    acceptsFirstFrame: m.capability?.maxRefImages !== 0,
  };
}

// ── 模型选择（视频 / 出图各一个，按画布记）──────────────────────────────────

type ModelKind = "video" | "image";
const STORAGE_PREFIX: Record<ModelKind, string> = {
  video: "drama-canvas:video-model:",
  image: "drama-canvas:image-model:",
};
/** 键 = STORAGE_PREFIX[kind] + canvasKey（就是 localStorage 的键）。 */
const choices = new Map<string, string | undefined>();
const listeners = new Set<() => void>();

function readChoice(kind: ModelKind, canvasKey: string): string | undefined {
  const key = STORAGE_PREFIX[kind] + canvasKey;
  if (choices.has(key)) return choices.get(key);
  let v: string | undefined;
  try {
    v = window.localStorage.getItem(key) ?? undefined;
  } catch {
    v = undefined;
  }
  choices.set(key, v);
  return v;
}

function writeChoice(kind: ModelKind, canvasKey: string, id: string): void {
  const key = STORAGE_PREFIX[kind] + canvasKey;
  if (choices.get(key) === id) return;
  choices.set(key, id);
  try {
    window.localStorage.setItem(key, id);
  } catch {
    /* 存不下就只在这一页记着 */
  }
  for (const l of [...listeners]) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// ── hook ─────────────────────────────────────────────────────────────────────

interface Loaded {
  config: DramaCreditConfig;
  image: CanvasModelOption[];
  video: CanvasModelOption[];
}

export function useCanvasPricing(): CanvasPricingValue {
  const docCtx = useOptionalCanvasDoc();
  const canvasKey = docCtx?.canvasId ?? "default";
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([getDramaConfig(), loadModels()])
      .then(([config, models]) => {
        if (!alive) return;
        setLoaded({ config, image: (models.image ?? []).map(toOption), video: (models.video ?? []).map(toOption) });
      })
      .catch(() => {
        /* 读不到：ready 保持 false，价格按默认单价估；下次挂载再试 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const storedVideo = React.useSyncExternalStore(
    subscribe,
    () => readChoice("video", canvasKey),
    () => undefined,
  );
  const storedImage = React.useSyncExternalStore(
    subscribe,
    () => readChoice("image", canvasKey),
    () => undefined,
  );

  return React.useMemo<CanvasPricingValue>(() => {
    const config = loaded?.config ?? DRAMA_CONFIG_DEFAULTS;
    const prices = config.prices;
    const imageModels = loaded?.image ?? [];
    const videoModels = loaded?.video ?? [];
    const defaultOf = (list: CanvasModelOption[]) => list.find((m) => m.isDefault) ?? list[0];

    // 存的那个还在候选里就用它，否则默认模型（候选还没读到时先按存的报，读到后再校正）
    const resolve = (list: CanvasModelOption[], stored: string | undefined) =>
      loaded ? (list.find((m) => m.endpointId === stored) ?? defaultOf(list))?.endpointId : stored;
    const videoModelId = resolve(videoModels, storedVideo);
    const imageModelId = resolve(imageModels, storedImage);
    const videoModel = (id?: string) =>
      videoModels.find((m) => m.endpointId === (id ?? videoModelId)) ?? defaultOf(videoModels);
    const imageModel = (id?: string) => imageModels.find((m) => m.endpointId === (id ?? imageModelId)) ?? defaultOf(imageModels);

    return {
      ready: !!loaded,
      imageModels,
      videoModels,
      videoModelId,
      setVideoModelId: (id: string) => writeChoice("video", canvasKey, id),
      imageModelId,
      setImageModelId: (id: string) => writeChoice("image", canvasKey, id),
      confirmThreshold: config.confirmThreshold,
      scriptPrice: (stage) =>
        stage === "setting" ? prices.canvasScriptSetting : stage === "outline" ? prices.canvasScriptOutline : prices.canvasScriptEpisode,
      extractPrice: () => prices.canvasExtract,
      storyboardPrice: () => prices.canvasStoryboard,
      imagePrice: (count, endpointId) => {
        const n = Math.max(1, Math.trunc(count || 1));
        return (imageModel(endpointId)?.creditCost ?? prices.frame) * n;
      },
      videoPrice: (durationSec, endpointId) => {
        const m = videoModel(endpointId);
        if (!m) return prices.clip;
        return m.billingUnit === "per_second" ? m.creditCost * Math.max(1, Math.ceil(durationSec || 0)) : m.creditCost;
      },
      maxSegmentSec: () => videoModel()?.maxDurationSec ?? DEFAULT_MAX_SEGMENT_SEC,
      minSegmentSec: () => Math.max(DEFAULT_MIN_SEGMENT_SEC, videoModel()?.minDurationSec ?? DEFAULT_MIN_SEGMENT_SEC),
    };
  }, [loaded, storedVideo, storedImage, canvasKey]);
}
