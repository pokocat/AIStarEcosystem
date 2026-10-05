"use client";

// 角色和场景页的几个小件：窄屏判定、某个造型 / 场景 / 素材当前的生成状态、按钮上的价格、角色分级的叫法。
import * as React from "react";
import { Gem } from "lucide-react";
import type { CanvasCharacterRole, CanvasRunRef, DramaCanvasRun, DramaCanvasRunStatus } from "@ai-star-eco/types/drama-canvas";

// ── 窄屏（≤720：手机上只有列表，点卡片开抽屉）────────────────────────────────

/** 与 canvas.css / app.css 的 720 断点同一个值（§5.1：JS 与 CSS 用同一个断点）。 */
export const NARROW_QUERY = "(max-width: 720px)";

function subscribeNarrow(cb: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
}

function narrowNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

export function useNarrow(): boolean {
  return React.useSyncExternalStore(subscribeNarrow, narrowNow, () => false);
}

// ── 生成状态 ─────────────────────────────────────────────────────────────────

export interface AssetRunView {
  status?: DramaCanvasRunStatus;
  runId?: string;
  pending: boolean;
  queued: boolean;
  failed: boolean;
  canceled: boolean;
  /** failed 时给用户看的话。 */
  errorMessage?: string;
  /** 这次（成功的）运行里参考图实际用上的情况。 */
  refs?: DramaCanvasRun["refs"];
}

const IDLE: AssetRunView = { pending: false, queued: false, failed: false, canceled: false };

export const IMAGE_FAILED_MESSAGE = "这次没生成出来，积分已退回，可以再试一次。";

/**
 * 以文档里记着的运行引用为准：runFor(target) 是「这个目标最近一次运行」，只有 id 对得上才用它的细节；
 * 引用在、运行记录还没接回来（刚进页）时，状态先按引用上记的显示。
 */
export function assetRunView(run: DramaCanvasRun | undefined, ref: CanvasRunRef | undefined): AssetRunView {
  const live = run && (!ref?.runId || run.id === ref.runId) ? run : undefined;
  const runId = ref?.runId ?? live?.id;
  if (!runId) return IDLE;
  const status = live?.status ?? ref?.status;
  const failed = status === "failed";
  return {
    status,
    runId,
    pending: status === "queued" || status === "running",
    queued: status === "queued",
    failed,
    canceled: status === "canceled",
    ...(failed ? { errorMessage: live?.errorMessage?.trim() || IMAGE_FAILED_MESSAGE } : {}),
    ...(live?.refs ? { refs: live.refs } : {}),
  };
}

/**
 * 请求正在提交（POST 还没回来，runFor 里还没有这次）也算生成中：卡片显示「生成中」、按钮禁用。
 * 这时没有可停的运行（不给「停止」），也不显示上一次的失败原因。
 */
export function withSubmitting(view: AssetRunView, submitting: boolean): AssetRunView {
  if (!submitting || view.pending) return view;
  return { status: "running", pending: true, queued: false, failed: false, canceled: false };
}

// ── 小件 ─────────────────────────────────────────────────────────────────────

/** 按钮上的价格（钻石 + 数字）。 */
export function Cost({ value }: { value: number | null }) {
  return (
    <span className="cva-cost" aria-label={value == null ? "价格读取中" : `${value} 积分`}>
      <Gem size={12} />
      <span className="num">{value == null ? "—" : value}</span>
    </span>
  );
}

export const ROLE_LABEL: Record<CanvasCharacterRole, string> = {
  lead: "主要角色",
  support: "配角",
  extra: "临时演员",
};

/** 分级的排列顺序（抽屉里的下拉、加角色时的选择都按它）。 */
export const ROLE_ORDER: readonly CanvasCharacterRole[] = ["lead", "support", "extra"];

/**
 * 加角色时选分级（列表页和画布上的「加一个角色」共用）。用 cv-seg 的分段按钮，三档就是 ROLE_LABEL 那三个叫法。
 */
export function RolePicker({ value, onChange, disabled }: { value: CanvasCharacterRole; onChange: (r: CanvasCharacterRole) => void; disabled?: boolean }) {
  const labelId = React.useId();
  return (
    <div className="cv-new-row">
      <span className="cv-inline-field" id={labelId}>
        分级
      </span>
      <div className="cv-seg" role="group" aria-labelledby={labelId} data-field="role">
        {ROLE_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            className={value === r ? "on" : ""}
            aria-pressed={value === r}
            disabled={disabled}
            onClick={() => onChange(r)}
            data-role={r}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 禁用按钮旁边就地写原因（手机上没有 hover）。 */
export function Reason({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <div className="cva-reason">{children}</div>;
}

/** 只读时的统一说法。 */
export const READ_ONLY_REASON = "这张画布在别的页面改过了，载入最新的之后才能改。";
