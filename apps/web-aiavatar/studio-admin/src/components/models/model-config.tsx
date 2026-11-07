"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import type {
  AiModelAccessRow, AiModelEndpoint, AiModelProviderPreset, AiSceneCatalogRow, AiStudioVideoGroup, ModelFunctionPricingRow, ModelFunctionRow,
} from "@ai-star-eco/types/ai-model-config";
import { ModelConfigApi } from "@/lib/api";
import { errorText, Notice, type ModelConfigData } from "./shared";
import { ModelAccess } from "./model-access";
import { StudioModels } from "./studio-models";
import { FunctionModels } from "./function-models";

/** 三个页签共用一份数据：改了模型，另外两个页签的名字和可用状态也要跟着变。 */
function useModelConfigData() {
  const [data, setData] = React.useState<ModelConfigData | null>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    const api = ModelConfigApi.command;
    try {
      const [endpoints, access, presets, functions, pricing, scenes, videoGroup, director] = await Promise.all([
        api<AiModelEndpoint[]>("endpoints"),
        api<AiModelAccessRow[]>("modelAccessCatalog"),
        api<AiModelProviderPreset[]>("presets"),
        api<ModelFunctionRow[]>("functionCatalog"),
        api<ModelFunctionPricingRow[]>("functionPricingCatalog"),
        api<AiSceneCatalogRow[]>("sceneCatalog"),
        api<AiStudioVideoGroup | null>("studioVideoGroup"),
        api<{ endpointId: string | null }>("directorImageDefault"),
      ]);
      setData({ endpoints, access, presets, functions, pricing, scenes, videoGroup, directorDefault: director.endpointId });
      setError("");
    } catch (e) {
      setError(`模型配置加载失败：${errorText(e)}`);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}

export function ModelConfig() {
  const search = useSearchParams();
  const tab = search.get("tab") ?? "access";
  const { data, error, reload } = useModelConfigData();

  if (!data) {
    return (
      <div className="p-4 md:p-5">
        {error
          ? <div className="space-y-3"><Notice tone="error">{error}</Notice><Button variant="outline" onClick={() => void reload()}><RotateCcw className="size-4" />重试</Button></div>
          : <p className="py-16 text-center text-sm text-slate-500">正在加载模型配置…</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4 md:p-5">
      {error && <Notice tone="error">{error}</Notice>}
      {tab === "studio" ? <StudioModels data={data} reload={reload} />
        : tab === "functions" ? <FunctionModels data={data} reload={reload} />
        : <ModelAccess data={data} reload={reload} />}
    </div>
  );
}
