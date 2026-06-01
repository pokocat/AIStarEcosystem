"use client";

// 模板库（配套工具，导航降一级）：美颜/风格/质感/标准构图模板浏览 + 分类筛选。
// 实际选用在某个 AiAvatar 的「模板美化出图」步骤里发生。
import * as React from "react";
import { Sparkles } from "lucide-react";
import type { AiAvatarTemplate, AiAvatarTemplateCategory } from "@ai-star-eco/types/ai-avatar";
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
        <h1 className="text-xl font-semibold tracking-tight">模板库</h1>
        <p className="mt-0.5 text-sm text-[var(--fg-2)]">美颜 / 风格 / 质感 / 标准构图模板 · 在「模板美化出图」步骤可选用并叠加</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className="chip" data-on={cat === c}>
            {c === "all" ? "全部" : TEMPLATE_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {templates === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--bg-2)]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)] transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-md)]">
              <div className="ph relative flex h-28 items-center justify-center">
                <Sparkles className="h-7 w-7 text-[var(--fg-3)]" />
                <span className="absolute right-2 top-2 rounded-full bg-[var(--bg-1)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-strong)] shadow-[var(--shadow-sm)]">{TEMPLATE_CATEGORY_LABEL[t.category]}</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-medium text-[var(--fg-0)]">{t.name}</h3>
                  {t.official && <span className="shrink-0 rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--fg-2)]">官方</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-[var(--fg-2)]">{t.description}</p>
                <div className="meta mt-2 flex items-center justify-between">
                  <span>{t.capability ? CAPABILITY_LABEL[t.capability] : "—"}</span>
                  <span>用 <span className="num">{t.usageCount}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
