// ─────────────────────────────────────────────────────────────────────────────
// render-model-select.tsx — D-11「图片模型 / 视频模型」下拉（一用途多候选端点 + 能力元数据）。
// 消费 GET /me/drama/render/models（RenderApi.listRenderModels）。分镜表 / 短视频出片入口
// 用它替代 v0.98 删掉的假下拉；默认选 isDefault 项。文案用户友好，capability 细节放 hover title，
// 宽度约束防溢出（AGENTS §跨 app 约定 · 不溢出）。
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { RenderApi } from "@/api";
import type { RenderModelOption, RenderModelsResponse } from "@/api/render";

export type RenderLane = "image" | "video";

/** 候选模型列表的加载状态。loading / failed 时报价是猜的，见 priceBlockReason。 */
export type RenderModelsStatus = "loading" | "ready" | "failed";

export interface RenderModelsState {
  models: RenderModelsResponse;
  imageEndpointId?: string;
  videoEndpointId?: string;
  setImageEndpointId: (id: string | undefined) => void;
  setVideoEndpointId: (id: string | undefined) => void;
  status: RenderModelsStatus;
  /** 拉取失败后重试一次。 */
  retry: () => void;
}

/** 拉一次候选模型，选出默认端点作初值。USE_MOCK / 无候选时组为空 → 下拉隐藏，走后端默认端点。 */
export function useRenderModels(): RenderModelsState {
  const [models, setModels] = React.useState<RenderModelsResponse>({ image: [], video: [] });
  const [imageEndpointId, setImageEndpointId] = React.useState<string | undefined>();
  const [videoEndpointId, setVideoEndpointId] = React.useState<string | undefined>();
  const [status, setStatus] = React.useState<RenderModelsStatus>("loading");
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setStatus("loading");
    RenderApi.listRenderModels()
      .then((m) => {
        if (!alive) return;
        setModels(m);
        const pick = (opts: RenderModelOption[]) => opts.find((o) => o.isDefault)?.endpointId ?? opts[0]?.endpointId;
        setImageEndpointId((prev) => prev ?? pick(m.image));
        setVideoEndpointId((prev) => prev ?? pick(m.video));
        setStatus("ready");
      })
      .catch(() => {
        // 不能「静默走默认端点」：服务端不带 endpoint_id 时照样解析默认候选、按它的覆盖价扣（视频还按秒乘），
        // 这边却只能按全局单价报 —— 确认框写 30、实扣 200。标成 failed，由调用方停用生成、给重试。
        if (alive) setStatus("failed");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { models, imageEndpointId, videoEndpointId, setImageEndpointId, setVideoEndpointId, status, retry };
}

/**
 * 按模型计价的生成（首帧 / 视频 / 补尾帧 / AI 改图）现在能不能点：候选模型还没拉到或拉失败时，
 * renderCreditCost 只能回落到全局单价，而服务端会按默认候选的价扣 —— 报价可能比实扣低好几倍。
 * 返回停用原因（给按钮的 title / 提示用），能点返回 null。
 */
export function priceBlockReason(status: RenderModelsStatus): string | null {
  if (status === "ready") return null;
  if (status === "loading") return "正在读取模型和价格，稍等一下";
  return "没读到模型和价格，生成先停用。点「重试」再读一次";
}

/**
 * 按所选模型算一次生成要扣多少积分 —— 确认框、按钮上的钻石数都用它，别再直接用 cfg.prices.frame / clip。
 *
 * 服务端（DramaRenderService.renderFrame / renderClip）的扣法：命中的候选有单价覆盖就用覆盖价，
 * 视频候选按秒计费时乘以时长；没候选（USE_MOCK、后台没配候选）走全局单价 = fallback。
 * 列表还没拉到 / 拉失败时这里也会回 fallback，但那不等于服务端按全局价扣 —— 调用方要用
 * priceBlockReason(status) 把生成按钮停掉，别拿这个数去报价。
 * 所以这里：在 models[lane] 里找 endpointId（没给就找默认那个），找到按 billingUnit 算，找不到回 fallback。
 *
 * 时长和服务端取同一个值：`clamp(asInt(duration_sec, 5), 2, 60)` —— 1 秒的镜头服务端按 2 秒扣，
 * 报价照 1 秒算就又低报了（这条正是 P1「确认金额低于实扣」本身），所以按秒时同样截断取整、夹到 2..60。
 */
export function renderCreditCost({
  models,
  lane,
  endpointId,
  fallback,
  durationSec,
}: {
  models: RenderModelsResponse;
  lane: RenderLane;
  endpointId?: string;
  fallback: number;
  durationSec?: number;
}): number {
  const options = lane === "image" ? models.image : models.video;
  const hit = endpointId ? options.find((o) => o.endpointId === endpointId) : options.find((o) => o.isDefault);
  if (!hit) return fallback;
  if (hit.billingUnit !== "per_second") return hit.creditCost;
  return hit.creditCost * billableSeconds(durationSec);
}

/** 服务端 renderClip 实际计费的秒数：`clamp(body.path("duration_sec").asInt(5), 2, 60)`。 */
function billableSeconds(durationSec: number | undefined): number {
  const raw = durationSec == null || !Number.isFinite(durationSec) ? 5 : Math.trunc(durationSec);
  return Math.min(60, Math.max(2, raw));
}

/** 端点能力 hover 文案（用户友好，把内部字段名翻成人话）。 */
function capabilityTitle(o: RenderModelOption): string {
  const c = o.capability ?? {};
  const unit = o.billingUnit === "per_second" ? "每秒" : "每次";
  const parts: string[] = [`${unit} ${o.creditCost} 积分`];
  if (c.maxRefImages != null) parts.push(`最多用 ${c.maxRefImages} 张参考图`);
  if (c.supportsFirstLastFrame === true) parts.push("支持首尾帧");
  if (c.supportsSubjectReference === true) parts.push("能按定妆照保持人物长相");
  if (c.maxDurationSec != null) parts.push(`单条最长 ${c.maxDurationSec} 秒`);
  return parts.join(" · ");
}

/**
 * 出片模型下拉。候选 ≤1 时不渲染（无可选，直接走默认端点，避免占位噪音）。
 * value/onChange 由父级持有（useRenderModels）。
 */
export function RenderModelSelect({
  lane,
  models,
  value,
  onChange,
  disabled,
}: {
  lane: RenderLane;
  models: RenderModelsResponse;
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const options = lane === "image" ? models.image : models.video;
  if (options.length <= 1) return null;
  const current = options.find((o) => o.endpointId === value);
  return (
    <label
      className="row gap-1"
      style={{ alignItems: "center", fontSize: 11.5, color: "var(--ink-2)", minWidth: 0 }}
      title={current ? capabilityTitle(current) : lane === "image" ? "选择生成首帧用的模型" : "选择生成视频用的模型"}
    >
      <span className="faint" style={{ flex: "none", fontSize: 11 }}>{lane === "image" ? "图片模型" : "视频模型"}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        aria-label={lane === "image" ? "图片模型" : "视频模型"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 24,
          maxWidth: 168,
          fontSize: 11.5,
          color: "var(--ink-1)",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 7,
          padding: "0 6px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.endpointId} value={o.endpointId}>
            {o.name}
            {o.isDefault ? "（默认）" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
