"use client";

// 角色表（WorkshopState.chars）的自动保存。
//
// v0.197 评审 WB2：之前写在工作台页面里，600ms 后执行 `ctx.saveData({ ...data, characters })`，
// data 是改角色那一刻的快照。原地绑数字人之后的这 600ms 里如果别的操作写回了文档（比如某一集的
// 首帧 / 视频生成完写进 episodeDocs），定时器一到就用旧快照把它盖掉。
// 现在：
//   · 落库走 ctx.patchData（按保存那一刻的最新文档合并，只换 characters 一个字段）；
//   · 卸载时（离开工作台）把还没落库的那次改动立刻存掉，而不是清掉定时器了事。
import * as React from "react";
import type { CharacterDef } from "@/mocks/drama-workshop";
import type { StageContext } from "../stages/stage-context";

export const CHARS_AUTOSAVE_DELAY_MS = 600;

export function useCharsAutosave(
  chars: CharacterDef[],
  ctx: Pick<StageContext, "patchData" | "notifyEditing">,
  delayMs: number = CHARS_AUTOSAVE_DELAY_MS,
): void {
  // ctx 每次渲染可能是新对象：只存引用，不进依赖（否则每次渲染都会重排定时器）。
  const ctxRef = React.useRef(ctx);
  ctxRef.current = ctx;
  const lastRef = React.useRef(chars);
  const pendingRef = React.useRef<CharacterDef[] | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void ctxRef.current.patchData((prev) => ({ ...prev, characters: pending })).catch(() => {
      /* saveData 已提示「保存失败」 */
    });
  }, []);

  React.useEffect(() => {
    if (lastRef.current === chars) return;
    lastRef.current = chars;
    pendingRef.current = chars;
    ctxRef.current.notifyEditing?.(); // 标脏：防抖落库前刷新 / 关页会提醒
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  }, [chars, delayMs, flush]);

  // 卸载时把没存的那次改动存掉（切出工作台时不丢）。
  React.useEffect(() => () => flush(), [flush]);
}
