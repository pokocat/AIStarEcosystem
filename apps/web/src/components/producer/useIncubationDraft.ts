"use client";

// localStorage 持久化孵化向导的 WizardState：
//   - 挂载时尝试恢复（version 不匹配静默丢弃）
//   - 状态变化 debounce 400ms 写盘，仅在 hasUserData 时保存
//   - JSON 比较防止刚 restore 后立刻无谓覆写
//   - 成功创建 / 用户「丢弃」时显式 clear
// schema 演进：删/改字段 → 把下面 VERSION +1，旧草稿失效；
//   新加字段无需 bump，restore 路径里 spread INITIAL_STATE 兜底。

import { useCallback, useEffect, useRef, useState } from "react";
import type { WizardState } from "./IncubationWizardShared";
import { INITIAL_STATE } from "./IncubationWizardShared";

const KEY = "aistareco.producer.incubation-v2.draft";
const VERSION = 1;

interface DraftEnvelope {
  version: number;
  savedAt: number;
  state: WizardState;
}

export interface UseIncubationDraftReturn {
  restored: boolean;
  savedAt: number | null;
  saving: boolean;
  clear: () => void;
}

export function useIncubationDraft(
  state: WizardState,
  setState: (s: WizardState) => void,
  hasUserData: (s: WizardState) => boolean,
): UseIncubationDraftReturn {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [restored, setRestored] = useState<boolean>(false);
  const lastJsonRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const env = JSON.parse(raw) as DraftEnvelope;
      if (env.version !== VERSION || !env.state) return;
      const merged: WizardState = { ...INITIAL_STATE, ...env.state };
      lastJsonRef.current = JSON.stringify(merged);
      setState(merged);
      setSavedAt(env.savedAt);
      setRestored(true);
    } catch {
      /* 损坏草稿静默丢弃 */
    }
    // 仅首次挂载执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasUserData(state)) return;
    const json = JSON.stringify(state);
    if (json === lastJsonRef.current) return;
    setSaving(true);
    const t = setTimeout(() => {
      const ts = Date.now();
      try {
        const env: DraftEnvelope = { version: VERSION, savedAt: ts, state };
        window.localStorage.setItem(KEY, JSON.stringify(env));
        lastJsonRef.current = json;
        setSavedAt(ts);
      } catch {
        /* localStorage quota / 隐私模式 静默 */
      } finally {
        setSaving(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, hasUserData]);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
    lastJsonRef.current = "";
    setSavedAt(null);
    setSaving(false);
    setRestored(false);
  }, []);

  return { restored, savedAt, saving, clear };
}
