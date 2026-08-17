// ─────────────────────────────────────────────────────────────────────────────
// render-model-select.tsx — D-11「出片模型」下拉（一用途多候选端点 + 能力元数据）。
// 消费 GET /me/drama/render/models（RenderApi.listRenderModels）。分镜表 / 短视频出片入口
// 用它替代 v0.98 删掉的假下拉；默认选 isDefault 项。文案用户友好，capability 细节放 hover title，
// 宽度约束防溢出（AGENTS §跨 app 约定 · 不溢出）。
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { RenderApi } from "@/api";
import type { RenderModelOption, RenderModelsResponse } from "@/api/render";

export type RenderLane = "image" | "video";

export interface RenderModelsState {
  models: RenderModelsResponse;
  imageEndpointId?: string;
  videoEndpointId?: string;
  setImageEndpointId: (id: string | undefined) => void;
  setVideoEndpointId: (id: string | undefined) => void;
}

/** 拉一次候选模型，选出默认端点作初值。USE_MOCK / 无候选时组为空 → 下拉隐藏，走后端默认端点。 */
export function useRenderModels(): RenderModelsState {
  const [models, setModels] = React.useState<RenderModelsResponse>({ image: [], video: [] });
  const [imageEndpointId, setImageEndpointId] = React.useState<string | undefined>();
  const [videoEndpointId, setVideoEndpointId] = React.useState<string | undefined>();

  React.useEffect(() => {
    let alive = true;
    RenderApi.listRenderModels()
      .then((m) => {
        if (!alive) return;
        setModels(m);
        const pick = (opts: RenderModelOption[]) => opts.find((o) => o.isDefault)?.endpointId ?? opts[0]?.endpointId;
        setImageEndpointId((prev) => prev ?? pick(m.image));
        setVideoEndpointId((prev) => prev ?? pick(m.video));
      })
      .catch(() => {
        /* 拉取失败：静默 → 走后端默认端点（不阻塞出片）。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return { models, imageEndpointId, videoEndpointId, setImageEndpointId, setVideoEndpointId };
}

/** 端点能力 hover 文案（用户友好，把内部字段名翻成人话）。 */
function capabilityTitle(o: RenderModelOption): string {
  const c = o.capability ?? {};
  const unit = o.billingUnit === "per_second" ? "秒" : "次";
  const parts: string[] = [`消耗 ${o.creditCost} 积分/${unit}`];
  if (c.maxRefImages != null) parts.push(`最多参考 ${c.maxRefImages} 张`);
  if (c.supportsFirstLastFrame === true) parts.push("支持首尾帧衔接");
  if (c.supportsSubjectReference === true) parts.push("支持主体参考");
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
      title={current ? capabilityTitle(current) : "选择出片使用的模型"}
    >
      <span className="faint" style={{ flex: "none", fontSize: 11 }}>{lane === "image" ? "出图模型" : "出片模型"}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
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
