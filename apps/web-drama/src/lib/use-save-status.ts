"use client";

// 草稿自动保存状态机（v0.76）—— 短剧工作台 / 短视频制作页共用。
// 职责：
//   1. 跟踪「未保存(有改动) / 保存中 / 已保存 / 失败」状态，供顶部指示器显示；
//   2. 提供 track(op)：包裹任意异步保存调用，按结果推进状态；
//   3. 提供 notifyEditing()：用户产生编辑（防抖未落库前）即标脏，离开提醒兜底据此判定；
//   4. beforeunload 兜底：有未保存改动 / 正在保存时拦截刷新 / 关闭页（用户选了「自动保存 + 离开提醒」）。
//
// 脏判定用「编辑代际 vs 已保存代际」：每次 notifyEditing 编辑代际 +1；
// track 在保存开始时记下当时代际，成功后推进已保存代际 —— 保存途中又有新编辑则仍判脏，最终一致。
//
// 状态语义修正（避免谎报「保存中」）：notifyEditing 只置「dirty(有改动待保存)」——
// 击键后到防抖真正发请求之间的空窗不再显示旋转的「保存中」；只有 track 真正发起保存请求
// 才切「saving」，成功切「saved」，途中又有新编辑则回落「dirty」。
import * as React from "react";

// dirty = 有改动、尚未发起保存请求（防抖窗口内）；saving = 请求在途。
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function useSaveStatus() {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const editingGen = React.useRef(0);
  const savedGen = React.useRef(0);
  const isDirty = React.useCallback(() => editingGen.current !== savedGen.current, []);

  /** 用户产生一次编辑（防抖落库前先标脏，保证离开提醒/指示器即时反映；此刻还没发请求，故不置「保存中」）。 */
  const notifyEditing = React.useCallback(() => {
    editingGen.current += 1;
    setStatus("dirty");
  }, []);

  /** 包裹一次保存调用：开始置「保存中」，成功推进已保存代际，失败置「失败」。 */
  const track = React.useCallback(
    async <T,>(op: () => Promise<T>): Promise<T> => {
      const g = editingGen.current;
      setStatus("saving");
      try {
        const r = await op();
        if (g > savedGen.current) savedGen.current = g;
        // 保存途中又来了新编辑 → 回落「有改动待保存」（此刻同样没有在途请求，不谎报保存中）。
        setStatus(isDirty() ? "dirty" : "saved");
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
      if (status === "saving" || status === "dirty" || isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status, isDirty]);

  return { status, notifyEditing, track };
}
