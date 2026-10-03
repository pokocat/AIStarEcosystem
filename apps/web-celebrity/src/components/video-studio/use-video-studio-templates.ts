"use client";

// 「模板」页签的数据：官方模板 + 我的模板（docs/video-studio-plan.md §10）。
// 进页面就拉一次（切到页签时马上能看）；存模板、删除 / 撤回、做同款之后就地更新，不整张重拉。

import * as React from "react";
import type { VideoStudioTemplate } from "@ai-star-eco/types/video-studio";
import { VideoStudioApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";

export interface VideoStudioTemplatesState {
  /** null = 首次加载中或首次加载失败。 */
  templates: VideoStudioTemplate[] | null;
  /** 首次加载失败的原因。 */
  error: string | null;
  /** 列表已有时刷新失败的原因（列表保留）。 */
  refreshError: string | null;
  refreshing: boolean;
  reload: () => void;
  /** 刚存好的模板放到最前面。 */
  prepend: (template: VideoStudioTemplate) => void;
  /** 删除 / 撤回之后从列表里拿掉。 */
  remove: (id: string) => void;
  /** 做同款提交成功后，「已做同款」次数先就地 +1（服务端同一时机自增）。 */
  bumpUseCount: (id: string) => void;
  /** 单个重新拉一次（封面 / 成片 / 素材的签名地址过期时换新）。 */
  refreshTemplate: (id: string) => void;
}

export function useVideoStudioTemplates(): VideoStudioTemplatesState {
  const [templates, setTemplates] = React.useState<VideoStudioTemplate[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const seq = React.useRef(0);
  const loadedRef = React.useRef(false);

  const load = React.useCallback(() => {
    seq.current += 1;
    const mine = seq.current;
    setRefreshing(true);
    VideoStudioApi.listTemplates()
      .then((list) => {
        if (mine !== seq.current) return;
        loadedRef.current = true;
        setTemplates(list);
        setError(null);
        setRefreshError(null);
      })
      .catch((e) => {
        if (mine !== seq.current) return;
        const message = errorMessage(e, "模板没有加载出来，请稍后重试");
        if (loadedRef.current) setRefreshError(message);
        else setError(message);
      })
      .finally(() => {
        if (mine === seq.current) setRefreshing(false);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const prepend = React.useCallback((template: VideoStudioTemplate) => {
    setTemplates((prev) => (prev ? [template, ...prev.filter((t) => t.id !== template.id)] : prev));
  }, []);

  const remove = React.useCallback((id: string) => {
    setTemplates((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
  }, []);

  const bumpUseCount = React.useCallback((id: string) => {
    setTemplates((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, useCount: t.useCount + 1 } : t)) : prev));
  }, []);

  const refreshTemplate = React.useCallback((id: string) => {
    VideoStudioApi.getTemplate(id)
      .then((fresh) => {
        setTemplates((prev) => (prev ? prev.map((t) => (t.id === fresh.id ? fresh : t)) : prev));
      })
      .catch(() => {
        /* 换不到新地址就先保持原样；用户可以点「刷新」重拉整张列表 */
      });
  }, []);

  return { templates, error, refreshError, refreshing, reload: load, prepend, remove, bumpUseCount, refreshTemplate };
}
