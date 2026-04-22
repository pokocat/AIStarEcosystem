"use client";

import * as React from "react";
import { Save, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listConfigs, type PlatformConfigDto } from "@/api/platform-config";

const DEFAULT_KEYS: { key: string; label: string; description: string }[] = [
  { key: "workflow.song.pricing",     label: "歌曲生成计价", description: "按 modelVersion / thinkDepth 查表的扣费配置" },
  { key: "workflow.forge.pricing",    label: "形象锻造计价", description: "Appearance Forge 工作流扣费" },
  { key: "workflow.forge.templates",  label: "锻造炉预设",   description: "面部风格 / 发型 / 瞳色 预设" },
  { key: "platform.reward.promo",     label: "拉新奖励",     description: "首次充值 / 邀请 / 活动赠送点数" },
  { key: "platform.features.flags",   label: "灰度开关",     description: "Feature flag / 新模块灰度分发" },
  { key: "distribution.channels",     label: "分发渠道白名单", description: "允许主动对接的第三方平台" },
];

export default function PlatformConfigPage() {
  const [configs, setConfigs] = React.useState<PlatformConfigDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    listConfigs()
      .then((res) => { if (alive) setConfigs(res ?? []); })
      .catch(() => { if (alive) setConfigs([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHeader
        title="平台配置"
        description="运营参数 / 工作流计价 / 灰度开关。所有改动都会写入审计日志。"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Save className="h-4 w-4" /> 保存变更
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DEFAULT_KEYS.map((def) => {
          const cfg = configs.find((c) => c.key === def.key);
          const value = cfg?.value ?? null;
          return (
            <Section
              key={def.key}
              title={
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" /> {def.label}
                </div>
              }
              description={def.description}
              actions={
                <StatusBadge
                  tone={value ? "success" : "neutral"}
                  label={cfg ? `v${cfg.version}` : "未设置"}
                  dot={!!cfg}
                />
              }
            >
              <div className="text-xs text-muted-foreground mb-2 font-mono">{def.key}</div>
              <textarea
                className="w-full h-40 rounded-md border border-border bg-input px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-ring/30"
                defaultValue={value ? JSON.stringify(value, null, 2) : "{}"}
                placeholder={loading ? "加载中…" : "请粘贴或编辑 JSON"}
              />
              {cfg?.updatedAt && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  最后更新：{cfg.updatedAt.slice(0, 19).replace("T", " ")} · by {cfg.updatedBy ?? "系统"}
                </div>
              )}
            </Section>
          );
        })}
      </div>
    </>
  );
}
