"use client";

import * as React from "react";
import { Camera, Check, Loader2, Lock, Plus, ScrollText, ShieldAlert, X } from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { relativeTime } from "@/lib/format";

/** 素材填写（任务书 §7）：真人=多图上传+合规检测；AI=人设文案。 */
export function SourceTab({ detail, onChanged }: { detail: AiAvatarDetail; onChanged: () => void }) {
  const { avatar, sourceMaterials } = detail;
  const isReal = avatar.mode === "real_clone";
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const photos = sourceMaterials.filter((m) => m.kind === "photo");
  const texts = sourceMaterials.filter((m) => m.kind !== "photo");

  const addText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await AiAvatarApi.addSourceText(avatar.id, text.trim()); setText(""); onChanged(); }
    finally { setBusy(false); }
  };

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await AiAvatarApi.uploadSourcePhoto(avatar.id, f, true);
      }
      onChanged();
      // 合规检测 mock 任务异步回填，稍后刷新
      setTimeout(onChanged, 3000);
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="space-y-5">
      {isReal && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-zinc-200"><Camera className="h-4 w-4" /> 真人照片（加密存储 + 合规检测）</h3>
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} 上传照片
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
          </div>
          <p className="mb-3 flex items-center gap-1 text-xs text-zinc-500"><Lock className="h-3 w-3" /> 原图经 AES-GCM 加密存档，仅展示脱敏预览；InsightFace 自动筛查遮挡 / 模糊 / 多脸。</p>
          {photos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 py-10 text-center text-sm text-zinc-500">还没有上传照片</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-lg border border-zinc-800">
                  <div className="relative aspect-[3/4]">
                    {m.assetUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.assetUrl} alt="source" className="h-full w-full object-cover blur-[1px]" />
                    ) : <div className="ph h-full w-full" />}
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-zinc-300"><Lock className="mr-0.5 inline h-2.5 w-2.5" />加密</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1.5 text-[11px]">
                    {m.faceCheckPassed == null ? (
                      <span className="flex items-center gap-1 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> 检测中</span>
                    ) : m.faceCheckPassed ? (
                      <span className="flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" /> 合规</span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400"><ShieldAlert className="h-3 w-3" /> {m.faceCheck?.reason || "不合规"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-200"><ScrollText className="h-4 w-4" /> 人设 / 文案素材</h3>
        <div className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="补充人设描述、风格关键词、参考说明…"
            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500" />
          <button onClick={addText} disabled={busy || !text.trim()}
            className="shrink-0 self-end rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">添加</button>
        </div>
        {texts.length > 0 && (
          <div className="mt-3 space-y-2">
            {texts.map((m) => (
              <div key={m.id} className="rounded-lg border border-zinc-800 bg-[var(--bg-1)] px-3 py-2 text-sm text-zinc-300">
                {m.text}
                <div className="meta mt-1">{relativeTime(m.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
