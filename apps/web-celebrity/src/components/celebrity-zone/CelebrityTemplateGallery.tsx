"use client";

import * as React from "react";
import { ChevronRight, Eye, Flame, LineChart } from "lucide-react";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import {
  TEMPLATE_STYLES,
  STYLE_BADGE_CLASS,
  ENGINE_META,
} from "@/constants/celebrity-zone-ui";
import type {
  CelebrityStar,
  CelebrityTemplate,
  TemplateStyle,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
  templates: CelebrityTemplate[];
  onPickTemplate: (template: CelebrityTemplate) => void;
  onBack: () => void;
}

/** Step 2a：模板库浏览。 */
export function CelebrityTemplateGallery({ star, templates, onPickTemplate, onBack }: Props) {
  const [activeStyle, setActiveStyle] = React.useState<"全部" | TemplateStyle>("全部");

  const filtered = React.useMemo(() => {
    if (activeStyle === "全部") return templates;
    return templates.filter((t) => t.style === activeStyle);
  }, [templates, activeStyle]);

  return (
    <div className="flex flex-col gap-5">
      {/* 面包屑 */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
        <button onClick={onBack} className="text-zinc-600 hover:text-zinc-900">
          {star.name}
        </button>
        <ChevronRight className="h-3 w-3 text-zinc-400" />
        <button onClick={onBack} className="text-zinc-600 hover:text-zinc-900">
          模板生成
        </button>
        <ChevronRight className="h-3 w-3 text-zinc-400" />
        <span className="text-violet-600 font-medium">选择模板</span>
      </div>

      {/* 风格 tab */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {TEMPLATE_STYLES.map((style) => (
          <button
            key={style}
            onClick={() => setActiveStyle(style)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition",
              activeStyle === style
                ? "text-violet-600"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {style}
            {activeStyle === style && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-violet-500 to-violet-400" />
            )}
          </button>
        ))}
      </div>

      {/* 模板网格 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tpl) => {
          const engine = ENGINE_META[tpl.recommendedEngine];
          return (
            <div
              key={tpl.id}
              className="group relative flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]"
            >
              {tpl.isHot && (
                <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/10 px-2 py-0.5 text-[10px] text-pink-600">
                  <Flame className="h-3 w-3" /> 热门
                </span>
              )}

              <div className="grid grid-cols-2 gap-2">
                {(tpl.previews ?? []).slice(0, 2).map((p, i) => (
                  <CelebrityVideoPlayer
                    key={i}
                    src={p.videoUrl ?? ""}
                    poster={p.thumb}
                    aspect="9/16"
                  />
                ))}
              </div>

              <div>
                <div className="text-base font-semibold text-zinc-800">{tpl.name}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px]",
                      STYLE_BADGE_CLASS[tpl.style],
                    )}
                  >
                    {tpl.style}
                  </span>
                  <span
                    className="rounded-md border px-2 py-0.5 text-[10px]"
                    style={{
                      borderColor: `${engine.color}55`,
                      color: engine.color,
                      background: `${engine.color}14`,
                    }}
                  >
                    {engine.name} · {engine.level}
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-zinc-600 min-h-[36px]">
                {tpl.description}
              </p>

              <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {tpl.plays} 播放
                </span>
                <span className="inline-flex items-center gap-1">
                  <LineChart className="h-3 w-3" />
                  {tpl.conversionRate} 转化
                </span>
              </div>

              <button
                onClick={() => onPickTemplate(tpl)}
                className="mt-1 w-full rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-600 transition hover:border-violet-500 hover:bg-[var(--accent)] hover:text-white"
              >
                使用此模板
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          暂无符合该风格的模板
        </div>
      )}
    </div>
  );
}
