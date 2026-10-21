// A failed image / video node says what went wrong and offers one way back (2026-10-20 production screenshots: a failed
// node still showed its empty-state 「上传图片或使用 AI 创作」 / 「上传视频，开始解析或拉片」, and the same 「生成」 sat in the
// node, in the toolbar and as 「重新生成」 below it). The prompt, references and settings stay on the node; only the model
// is not reused when the last attempt proved it is gone — a retired model resubmitted three times is three failures.
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";

/** Error codes that mean the model itself cannot take the request again (not a passing outage). */
export const STUDIO_MODEL_GONE_CODES: ReadonlySet<string> = new Set(["VIDEO_MODEL_RETIRED", "STUDIO_VIDEO_MODEL_UNAVAILABLE", "STUDIO_EFFECT_MODEL_UNAVAILABLE"]);

const errorCode = (node: CanvasNodeData | undefined) => node?.metadata?.studio?.task?.errorCode || node?.metadata?.errorCode;

/** True for a failed image / video node that has no picture yet (its empty state would read as a fresh node). */
export function studioFailedWithoutMedia(node: CanvasNodeData | undefined): boolean {
  const meta = node?.metadata;
  return !!node && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) && meta?.status === "error"
    && errorCode(node) !== "IP_RUN_CANCELLED" && !meta?.content && !meta?.storageKey;
}

/**
 * The model of the node's last request when it must not be used again: the failure said the model is gone, or the model
 * is no longer offered. `offered` undefined: the list is not loaded yet, only the error code decides.
 */
export function studioUnusableModel(node: CanvasNodeData | undefined, offered?: readonly string[]): string | undefined {
  const model = node?.metadata?.studio?.request?.model;
  if (!model) return undefined;
  if (node?.metadata?.status === "error" && STUDIO_MODEL_GONE_CODES.has(errorCode(node) || "")) return model;
  return offered && offered.length && !offered.includes(model) ? model : undefined;
}

/** One short line for the node: the first sentence of the server's message, without codes or vendor URLs. */
export function studioFailureReason(node: CanvasNodeData): string {
  const raw = node.metadata?.studio?.task?.errorMessage || node.metadata?.errorDetails || "";
  const plain = raw.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (STUDIO_MODEL_GONE_CODES.has(errorCode(node) || "")) return "这个模型已不可用，请换一个模型再生成";
  if (!plain) return "没有生成出来，可以修改后重试";
  const first = plain.split(/(?<=[。！？；])/)[0] || plain;
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
