"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/shell/media.tsx —— 画布里显示图 / 视频的唯一组件（v0.198）。
//
// 签名地址有 TTL（默认 1 小时），画布一开半天：地址过期后 <img> / <video> 会报错。这里在 onError 时按 key
// 换一个新地址（POST /me/drama/canvases/{id}/assets/sign），**不改文档**（url 是派生值，文档里的真值是 key）：
//   · 模块级批量队列：同一小段时间里（一帧左右）失败的 key 合成一次请求，一次最多 100 个；
//   · 换到的新地址进内存缓存（按画布隔离，key → url + 时间），50 分钟内直接复用、不再请求；
//   · 同一个地址连续失败只换一次（换来的地址成功加载过就清零，之后再过期还能再换），换了还失败就显示
//     「图片加载失败」/「视频加载失败」占位；
//   · 不在 CanvasDocProvider 里（拿不到 canvasId）时不换新，失败直接显示占位。
// 页面里显示画布的图、视频一律用这两个组件，不要自己写 <img src={asset.url}>（§8.0.1 ④）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { CanvasApi } from "@/api/canvas";
import { useOptionalCanvasDoc } from "@/canvas/core/use-canvas-doc";

/** 换到的新地址复用多久（签名 1 小时，留 10 分钟余量）。 */
export const RESIGN_CACHE_TTL_MS = 50 * 60 * 1000;
/** 一次换新请求最多带几个 key（服务端上限）。 */
export const RESIGN_BATCH_MAX = 100;
/** 攒批的窗口：几张图几乎同时失败（错误事件分在不同任务里派发）时合成一次请求。 */
const BATCH_WINDOW_MS = 16;

type MediaAsset = { key: string; url?: string } | null | undefined;

// ── 模块级：缓存与批量队列（按画布隔离）──────────────────────────────────────

const cache = new Map<string, { url: string; at: number }>();
const inflight = new Map<string, Promise<string | undefined>>();
interface Batch {
  keys: Map<string, (url: string | undefined) => void>;
  timer: ReturnType<typeof setTimeout> | null;
}
const batches = new Map<string, Batch>();

const cacheKey = (canvasId: string, key: string) => `${canvasId}\u0000${key}`;

function cachedUrl(canvasId: string, key: string): string | undefined {
  const hit = cache.get(cacheKey(canvasId, key));
  if (!hit) return undefined;
  if (Date.now() - hit.at > RESIGN_CACHE_TTL_MS) {
    cache.delete(cacheKey(canvasId, key));
    return undefined;
  }
  return hit.url;
}

async function flushBatch(canvasId: string): Promise<void> {
  const batch = batches.get(canvasId);
  if (!batch) return;
  batches.delete(canvasId);
  const entries = [...batch.keys.entries()];
  for (let i = 0; i < entries.length; i += RESIGN_BATCH_MAX) {
    const chunk = entries.slice(i, i + RESIGN_BATCH_MAX);
    let urls: Record<string, string> = {};
    try {
      urls = (await CanvasApi.signAssets(canvasId, chunk.map(([k]) => k))).urls ?? {};
    } catch {
      urls = {}; // 换不到就当这批都失败（组件显示「加载失败」占位）
    }
    const now = Date.now();
    for (const [k, resolve] of chunk) {
      const url = urls[k];
      if (url) cache.set(cacheKey(canvasId, k), { url, at: now });
      resolve(url || undefined);
    }
  }
}

/**
 * 给一个 key 换新地址（进批量队列；同一个 key 正在换时共用那一次）。换不到回 undefined。
 * 组件之外一般用不到；导出给需要自己拼地址的地方（如下载按钮）。
 */
export function resignCanvasAsset(canvasId: string, key: string): Promise<string | undefined> {
  const hit = cachedUrl(canvasId, key);
  if (hit) return Promise.resolve(hit);
  const ck = cacheKey(canvasId, key);
  const running = inflight.get(ck);
  if (running) return running;
  const p = new Promise<string | undefined>((resolve) => {
    let batch = batches.get(canvasId);
    if (!batch) {
      batch = { keys: new Map(), timer: null };
      batches.set(canvasId, batch);
    }
    batch.keys.set(key, resolve);
    if (!batch.timer) batch.timer = setTimeout(() => void flushBatch(canvasId), BATCH_WINDOW_MS);
  });
  inflight.set(ck, p);
  void p.finally(() => {
    if (inflight.get(ck) === p) inflight.delete(ck);
  });
  return p;
}

/** 某个地址已知坏了（换来的也过期了）：从缓存里拿掉，下次重新换。 */
function forget(canvasId: string, key: string, url: string | undefined) {
  const ck = cacheKey(canvasId, key);
  if (url && cache.get(ck)?.url === url) cache.delete(ck);
}

/** 测试用：清空缓存与队列。 */
export function __resetCanvasMediaForTest(): void {
  cache.clear();
  inflight.clear();
  for (const b of batches.values()) if (b.timer) clearTimeout(b.timer);
  batches.clear();
}

// ── 公共逻辑：一个 key 的当前地址 + 失败换新 ─────────────────────────────────
//
// 重试限制是「同一个地址连续失败最多换一次」，不是组件一生一次：换来的新地址成功加载过（onLoad）就清零，
// 之后它再过期（画布开了一整天）照样能再换。换来的地址本身也按 TTL 失效（过了就回落到缓存 / 文档里的地址）。

type Phase = "ok" | "resigning" | "failed";

interface ResignState {
  key?: string;
  base?: string;
  url?: string;
  urlAt?: number;
  phase: Phase;
  /** 上次成功加载之后换过几次（≥1 时再失败就不换了）。 */
  retries: number;
}

function useResignable(asset: MediaAsset, extraKeys: string[] = []) {
  const docCtx = useOptionalCanvasDoc();
  const canvasId = docCtx?.canvasId;
  const key = asset?.key;
  const baseUrl = asset?.url;
  const [state, setState] = React.useState<ResignState>({ phase: "ok", retries: 0 });
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 换了一张图（key 或派生地址变了）：状态从头来
  const current: ResignState =
    state.key === key && state.base === baseUrl ? state : { key, base: baseUrl, phase: "ok", retries: 0 };
  if (current !== state) setState(current);

  const ownUrl = current.url && current.urlAt !== undefined && Date.now() - current.urlAt <= RESIGN_CACHE_TTL_MS ? current.url : undefined;
  const src = ownUrl ?? (canvasId && key ? cachedUrl(canvasId, key) : undefined) ?? baseUrl;

  const extra = extraKeys.join("\u0000");
  const onError = React.useCallback(() => {
    if (!key) return;
    if (current.phase === "resigning" || current.phase === "failed") return;
    if (!canvasId || current.retries >= 1) {
      setState((s) => (s.key === key ? { ...s, phase: "failed" } : s));
      return;
    }
    forget(canvasId, key, src);
    setState((s) => (s.key === key ? { ...s, phase: "resigning", retries: s.retries + 1 } : s));
    const extras = extra ? extra.split("\u0000") : [];
    for (const k of extras) void resignCanvasAsset(canvasId, k);
    void resignCanvasAsset(canvasId, key).then((url) => {
      if (!alive.current) return;
      setState((s) => {
        if (s.key !== key) return s;
        // 换不到，或换来的还是那个坏地址：不再试
        if (!url || url === src) return { ...s, phase: "failed" };
        return { ...s, url, urlAt: Date.now(), phase: "ok" };
      });
    });
  }, [key, canvasId, current.phase, current.retries, src, extra]);

  /** 成功加载过：连续失败计数清零（之后再过期还能再换）。 */
  const onLoad = React.useCallback(() => {
    setState((s) => (s.key === key && s.retries ? { ...s, retries: 0 } : s));
  }, [key]);

  // 有 key 没地址（服务端没签 / 结果里没带）：当作一次失败，去换一个
  const needsSign = !!key && !src && current.phase === "ok" && current.retries === 0;
  React.useEffect(() => {
    if (needsSign) onError();
  }, [needsSign, onError]);

  return { canvasId, key, src, phase: current.phase, onError, onLoad };
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

export interface CanvasImageProps {
  asset?: MediaAsset;
  alt: string;
  fit?: "cover" | "contain";
  className?: string;
  style?: React.CSSProperties;
  /** 没有图时显示的东西；缺省一个中性占位（不写字）。 */
  placeholder?: React.ReactNode;
}

export function CanvasImage({ asset, alt, fit = "cover", className, style, placeholder }: CanvasImageProps) {
  const { src, phase, onError, onLoad } = useResignable(asset);
  const cls = (extra: string) => [extra, className].filter(Boolean).join(" ");
  if (!asset?.key) {
    return placeholder !== undefined ? <>{placeholder}</> : <div className={cls("cv-media-ph")} style={style} aria-hidden />;
  }
  if (phase === "failed") {
    return (
      <div className={cls("cv-media-ph cv-media-failed")} style={style} role="img" aria-label={`${alt}：图片加载失败`}>
        图片加载失败
      </div>
    );
  }
  if (!src || phase === "resigning") {
    return <div className={cls("cv-media-ph cv-media-loading")} style={style} aria-busy="true" aria-label={alt} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} src={src} alt={alt} className={className} style={{ objectFit: fit, ...style }} onError={onError} onLoad={onLoad} draggable={false} />
  );
}

export interface CanvasVideoProps {
  version?: MediaAsset;
  /** 封面（一般是首帧或末帧）；视频换新地址时顺带给它换。 */
  poster?: MediaAsset;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function CanvasVideo({ version, poster, controls = true, autoPlay, muted, loop, className, style }: CanvasVideoProps) {
  const posterKey = poster?.key;
  const extras = React.useMemo(() => (posterKey ? [posterKey] : []), [posterKey]);
  const { canvasId, src, phase, onError, onLoad } = useResignable(version, extras);
  const posterSrc = (canvasId && posterKey ? cachedUrl(canvasId, posterKey) : undefined) ?? poster?.url;
  const cls = (extra: string) => [extra, className].filter(Boolean).join(" ");
  if (!version?.key) return <div className={cls("cv-media-ph")} style={style} aria-hidden />;
  if (phase === "failed") {
    return (
      <div className={cls("cv-media-ph cv-media-failed")} style={style} role="img" aria-label="视频加载失败">
        视频加载失败
      </div>
    );
  }
  if (!src || phase === "resigning") {
    return <div className={cls("cv-media-ph cv-media-loading")} style={style} aria-busy="true" aria-label="视频" />;
  }
  return (
    <video
      key={src}
      src={src}
      poster={posterSrc}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      preload="metadata"
      className={className}
      style={style}
      onError={onError}
      onLoadedData={onLoad}
    />
  );
}
