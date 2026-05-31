"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { AiAvatar, AiAvatarTemplate } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { DialogShell } from "./dialog-shell";
import { TEMPLATE_CATEGORY_LABEL, STANDARD_SHOT_LABEL } from "@/constants/aiavatar-ui";
import type { AiAvatarStandardShot } from "@ai-star-eco/types/ai-avatar";

/** 模板美化 & 标准出图（Step 4）：选美颜模板 + 标准构图，批量出固定规格图集。 */
export function TemplateBeautifyDialog({ avatar, onClose, onStarted }: { avatar: AiAvatar; onClose: () => void; onStarted: () => void }) {
  const [templates, setTemplates] = React.useState<AiAvatarTemplate[]>([]);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { AiAvatarApi.listTemplates().then(setTemplates).catch(() => setTemplates([])); }, []);

  const submit = async () => {
    setBusy(true);
    try { await AiAvatarApi.startTemplateBeautify(avatar.id, { templateId: picked ?? undefined }); onStarted(); }
    finally { setBusy(false); }
  };

  const shots: AiAvatarStandardShot[] = [
    "full_body",
    "half_body",
    "bust_closeup",
    "detail_closeup",
    "three_quarter_profile",
    "overhead",
  ];

  return (
    <DialogShell title="模板美化 & 标准出图" onClose={onClose} wide
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">取消</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 批量出图（6 张）
          </button>
        </>
      }>
      <div className="space-y-4">
        <div className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400">
          美颜模板可叠加（GFPGAN + 调色 + 妆容迁移），按标准构图批量产出固定规格图集 —— 出图后进入「待定稿」。
        </div>
        <div>
          <div className="mb-2 text-xs text-zinc-400">选择美颜 / 风格模板（可不选，仅做标准修复）</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setPicked(picked === t.id ? null : t.id)}
                className={cn("rounded-lg border p-2.5 text-left transition",
                  picked === t.id ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 hover:border-zinc-600")}>
                <div className="text-sm font-medium text-zinc-100">{t.name}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{TEMPLATE_CATEGORY_LABEL[t.category]}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs text-zinc-400">标准输出构图（固定 6 镜头）</div>
          <div className="flex flex-wrap gap-1.5">
            {shots.map((s) => (
              <span key={s} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">{STANDARD_SHOT_LABEL[s]}</span>
            ))}
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
