"use client";

// 草稿自动保存状态机（v0.76）—— 短剧工作台 / 短视频制作页共用。
// 职责：
//   1. 跟踪「未保存 / 保存中 / 已保存 / 失败」状态，供顶部指示器显示；
//   2. 提供 track(op)：包裹任意异步保存调用，按结果推进状态；
//   3. 提供 notifyEditing()：用户产生编辑（防抖未落库前）即标脏，离开提醒兜底据此判定；
//   4. beforeunload 兜底：有未保存改动 / 正在保存时拦截刷新 / 关闭页（用户选了「自动保存 + 离开提醒」）。
//
// 脏判定用「编辑代际 vs 已保存代际」：每次 notifyEditing 编辑代际 +1；
// track 在保存开始时记下当时代际，成功后推进已保存代际 —— 保存途中又有新编辑则仍判脏，最终一致。
import * as React from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSaveStatus() {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const editingGen = React.useRef(0);
  const savedGen = React.useRef(0);
  const isDirty = React.useCallback(() => editingGen.current !== savedGen.current, []);

  /** 用户产生一次编辑（防抖落库前先标脏，保证离开提醒/指示器即时反映）。 */
  const notifyEditing = React.useCallback(() => {
    editingGen.current += 1;
    setStatus("saving");
  }, []);

  /** 包裹一次保存调用：开始置「保存中」，成功推进已保存代际，失败置「失败」。 */
  const track = React.useCallback(
    async <T,>(op: () => Promise<T>): Promise<T> => {
      const g = editingGen.current;
      setStatus("saving");
      try {
        const r = await op();
        if (g > savedGen.current) savedGen.current = g;
        setStatus(isDirty() ? "saving" : "saved");
        return r;
      } catch (e) {
        setStatus("error");
        throw e;
      }
    },
    [isDirty],
  );

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "saving" || isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status, isDirty]);

  return { status, notifyEditing, track };
}
