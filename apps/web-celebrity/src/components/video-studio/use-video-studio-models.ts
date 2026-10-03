"use client";

// 「视频生成」可选模型。
//
// 报价与服务端冻结金额必须同源：模型列表拿不到（error 非空）时，调用方不显示报价、不许提交，
// 绝不回落写死单价。后台随时可能改价格 / 默认模型，所以页面切回前台且上次加载超过 1 分钟时
// 静默再拉一次；静默刷新失败同样进 error（不让「旧报价 + 新错误」并存），但保留上一份列表
// 用来继续渲染表单：用户已经填的提示词、传的素材不会因为一次刷新失败而丢掉。

import * as React from "react";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { VideoStudioApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";

const STALE_AFTER_MS = 60_000;

export interface VideoStudioModelsState {
  /** 最近一次成功拿到的列表；从没成功过为 null。空数组 = 后台还没配。 */
  models: VideoStudioModel[] | null;
  loading: boolean;
  /** 最近一次加载失败的原因；非空时禁止报价和提交。 */
  error: string | null;
  reload: () => void;
}

export function useVideoStudioModels(): VideoStudioModelsState {
  const [models, setModels] = React.useState<VideoStudioModel[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const loadedAt = React.useRef(0);
  const seq = React.useRef(0);

  const load = React.useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    VideoStudioApi.listModels()
      .then((list) => {
        if (mine !== seq.current) return;
        loadedAt.current = Date.now();
        setModels(list);
        setError(null);
      })
      .catch((e) => {
        if (mine !== seq.current) return;
        setError(errorMessage(e, "视频模型信息没有加载出来，请稍后重试"));
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (loadedAt.current > 0 && Date.now() - loadedAt.current > STALE_AFTER_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  return { models, loading, error, reload: load };
}
