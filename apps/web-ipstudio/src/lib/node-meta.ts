// 节点元信息 —— 中文名、说明、图标、端口配色、默认数据。新增节点类型只动这一处。

import {
  Camera, Image as ImageIcon, Layers, Palette, Send, Sparkles, UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IpNode, IpNodeType } from "@ai-star-eco/types";

export interface NodeMeta {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** 端口配色：图片流 / 文本流 */
  flow: "image" | "text";
  /** 是否可运行（服务端只接 identity / generate） */
  runnable: boolean;
}

export const NODE_META: Record<IpNodeType, NodeMeta> = {
  source: { label: "照片", hint: "IP 的身份来源，一张正脸清晰的照片", icon: Camera, flow: "image", runnable: false },
  identity: { label: "人物特征卡", hint: "从照片抽出的长相描述，之后每张图都复用它", icon: UserRound, flow: "text", runnable: true },
  style: { label: "风格", hint: "内置风格逐字进提示词，不让模型自由发挥", icon: Palette, flow: "text", runnable: false },
  look: { label: "形象卡", hint: "一个造型：穿什么、什么姿势、什么表情", icon: Layers, flow: "text", runnable: false },
  generate: { label: "生成", hint: "出若干张候选，你挑一张定稿", icon: Sparkles, flow: "image", runnable: true },
  reference: { label: "参考图", hint: "局部参考，例如帽子款式", icon: ImageIcon, flow: "image", runnable: false },
  publish: { label: "发布", hint: "把定稿形象登记为数字资产", icon: Send, flow: "image", runnable: false },
};

export const PALETTE_ORDER: IpNodeType[] = [
  "source", "identity", "style", "look", "generate", "reference", "publish",
];

export function portColor(flow: "image" | "text"): string {
  return flow === "image" ? "var(--port-image)" : "var(--port-text)";
}

/** 新建节点时的默认数据。 */
export function defaultNodeData(type: IpNodeType): IpNode {
  const base = { id: "", position: { x: 0, y: 0 } };
  switch (type) {
    case "source":
      return { ...base, type, data: {} };
    case "identity":
      return { ...base, type, data: { text: "", promptEn: "", locked: false } };
    case "style":
      // 具体风格由属性面板从内置预设里选（预设走 /v1/ip-studio/styles）
      return { ...base, type, data: { name: "", promptEn: "", custom: false } };
    case "look":
      return { ...base, type, data: { title: "新造型", outfit: "", pose: "", expression: "", details: "" } };
    case "generate":
      return { ...base, type, data: { count: 2, size: "768x1024", isMaster: false } };
    case "reference":
      return { ...base, type, data: { note: "" } };
    case "publish":
      return { ...base, type, data: { avatarName: "" } };
  }
}

/** 运行阶段 → 中文进度说明（不把 stage 原文暴露给用户）。 */
export function describeStage(stage: string): string {
  if (!stage) return "准备中";
  if (stage === "queued") return "排队中";
  if (stage === "prompt.compile") return "整理提示词";
  if (stage.startsWith("image.generate")) {
    const n = stage.split(".").pop();
    const idx = Number(n);
    return Number.isFinite(idx) ? `正在画第 ${idx} 张` : "正在出图";
  }
  if (stage === "identity.extract") return "从照片读取长相特征";
  if (stage === "storage.persist") return "保存成品";
  if (stage === "done") return "已完成";
  if (stage === "cancelled") return "已取消";
  if (stage === "failed") return "未能完成";
  return "处理中";
}

/** 参考图未生效的中文原因（绝不把错误码原文当主可视文案）。 */
export function describeRefReason(reason?: string): string {
  switch (reason) {
    case "over_max_refs":
      return "参考图超出模型上限，已按优先级省略";
    case "local_unfetchable":
      return "这张图当前地址模型取不到，本次未参与";
    case "unreadable":
      return "参考图读取失败，已跳过";
    case "model_no_flf":
      return "所选模型不支持这类参考图";
    default:
      return "本次未参与生成";
  }
}

export function describeRefRole(role: "master" | "source" | "reference"): string {
  switch (role) {
    case "master":
      return "主形象定稿图";
    case "source":
      return "原始照片";
    case "reference":
      return "参考图";
  }
}

/**
 * 抛出来的接口错误 → 中文说明。
 *
 * 同一批错误码既可能异步落在 `IpRun.errorCode`（轮询拿到 failed），也可能同步从
 * POST 直接抛（队列满、素材 key 不合法…），两条路必须给一样的话，所以都过
 * `describeRunError`；带 `code` 的错误优先按码翻译，翻不动再退回服务端原话。
 */
export function describeApiError(e: unknown, fallback: string): string {
  const code = typeof e === "object" && e !== null && "code" in e
    ? String((e as { code?: unknown }).code ?? "")
    : "";
  const message = e instanceof Error ? e.message : "";
  if (code) return describeRunError(code, message || fallback);
  return message || fallback;
}

/** 运行失败的中文说明；服务端错误码只进 title 悬浮，不做主文案。 */
export function describeRunError(code?: string, message?: string): string {
  switch (code) {
    case "DAP_ENGINE_NOT_CONFIGURED":
      return "形象生成引擎还没在后台配好，请联系运营开通后再试。";
    case "PROMPT_NOT_CONFIGURED":
      return "生成模板还没在后台配好，请联系运营配置后再试。";
    case "IP_IDENTITY_EXTRACT_FAILED":
      return "当前引擎读不了这张照片，可以手写特征卡，或联系运营换一个支持看图的模型。";
    case "IP_NODE_INPUT_MISSING":
      return "上游还缺东西：把照片、特征卡、风格和形象卡都接上再运行。";
    case "IP_RUN_ALREADY_RUNNING":
      return "这个节点正在生成中，等它跑完再来。";
    case "IP_REF_UNREADABLE":
      return "主形象或照片读取失败，本次未扣费。可以重新上传照片，或重挑一张主形象定稿图。";
    case "IP_ASSET_KEY_INVALID":
      return "素材来源不合法，请重新上传。";
    case "IP_RUN_QUEUE_FULL":
      return "生成队列已满，请稍后再试。";
    case "IP_RUN_CANCELLED":
      return message || "这次生成已取消，积分已退回。";
    case "INSUFFICIENT_CREDITS":
      return "积分不足，充值后可继续生成。";
    default:
      return message || "这次生成没能完成，可以重试一次。";
  }
}
