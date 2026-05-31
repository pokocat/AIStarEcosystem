"use client";

// AI 模板中心（任务书 §7 配套模块）：美颜/风格/质感/标准构图模板浏览 + 分类筛选。
import * as React from "react";
import { Sparkles } from "lucide-react";
import type { AiAvatarTemplate, AiAvatarTemplateCategory } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { TEMPLATE_CATEGORY_LABEL, CAPABILITY_LABEL } from "@/constants/aiavatar-ui";

export default function TemplatesPage() {
  const [templates, setTemplates] = React.useState<AiAvatarTemplate[] | null>(null);
  const [cat, setCat] = React.useState<AiAvatarTemplateCategory | "all">("all");

  React.useEffect(() => { AiAvatarApi.listTemplates().then(setTemplates).catch(() => setTemplates([])); }, []);

  const filtered = (templates ?? []).filter((t) => cat === "all" || t.category === cat);
  const cats: (AiAvatarTemplateCategory | "all")[] = ["all", "beauty", "style", "retouch", "composition"];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">AI 模板中心</h1>
        <p className="mt-0.5 text-sm text-zinc-500">美颜 / 风格 / 质感 / 标准构图模板 · 模板美化出图时可选用并叠加</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={cn("rounded-full border px-3 py-1 text-sm", cat === c ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
            {c === "all" ? "全部" : TEMPLATE_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {templates === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-zinc-800/50" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--bg-1)]">
              <div className="ph relative flex h-28 items-center justify-center">
                <Sparkles className="h-7 w-7 text-amber-400/50" />
                <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-amber-300">{TEMPLATE_CATEGORY_LABEL[t.category]}</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-100">{t.name}</h3>
                  {t.official && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">官方</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{t.description}</p>
                <div className="meta mt-2 flex items-center justify-between">
                  <span>{t.capability ? CAPABILITY_LABEL[t.capability] : "—"}</span>
                  <span>用 {t.usageCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
