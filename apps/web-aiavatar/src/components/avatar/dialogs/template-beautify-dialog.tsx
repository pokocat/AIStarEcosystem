"use client";

import * as React from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import type { AiAvatar, AiAvatarTemplate, AiAvatarStandardShot } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { DialogShell } from "./dialog-shell";
import { TEMPLATE_CATEGORY_LABEL, STANDARD_SHOT_LABEL } from "@/constants/aiavatar-ui";

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

  const shots: AiAvatarStandardShot[] = ["full_body", "half_body", "bust_closeup", "detail_closeup", "three_quarter_profile", "overhead"];

  return (
    <DialogShell title="模板美化 & 标准出图" description="叠加美颜模板，按标准构图批量产出固定规格图集 —— 出图后进入「待定稿」" onClose={onClose} wide
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">取消</button>
          <button onClick={submit} disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 批量出图（6 张）
          </button>
        </>
      }>
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs text-[var(--fg-2)]">选择美颜 / 风格模板（可不选，仅做标准修复）</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((t) => {
              const on = picked === t.id;
              return (
                <button key={t.id} onClick={() => setPicked(on ? null : t.id)}
                  className={cn("relative rounded-lg border p-2.5 text-left transition",
                    on ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
                  {on && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-[var(--brand-strong)]" />}
                  <div className="text-sm font-medium text-[var(--fg-0)]">{t.name}</div>
                  <div className="meta mt-0.5">{TEMPLATE_CATEGORY_LABEL[t.category]}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs text-[var(--fg-2)]">标准输出构图（固定 6 镜头）</div>
          <div className="flex flex-wrap gap-1.5">
            {shots.map((s) => (
              <span key={s} className="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1 text-xs text-[var(--fg-1)]">
                {STANDARD_SHOT_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
