"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { AiAvatar } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { DialogShell } from "./dialog-shell";

/** 打样（Step 1）：真人=faceClone，AI=txt2img；一次出 3~5 版。 */
export function SamplingDialog({ avatar, onClose, onStarted }: { avatar: AiAvatar; onClose: () => void; onStarted: () => void }) {
  const [prompt, setPrompt] = React.useState(avatar.persona ?? "");
  const [variants, setVariants] = React.useState(3);
  const [busy, setBusy] = React.useState(false);
  const isReal = avatar.mode === "real_clone";

  const submit = async () => {
    setBusy(true);
    try {
      await AiAvatarApi.startSampling(avatar.id, { prompt, variants });
      onStarted();
    } finally { setBusy(false); }
  };

  return (
    <DialogShell title="打样" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">取消</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 开始打样
          </button>
        </>
      }>
      <div className="space-y-4">
        <div className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400">
          {isReal ? "真人复刻：InstantID 基于已上传的合规照片做 ID 保持打样。" : "AI 原创：SDXL/FLUX 按人设文案文生图打样。"}
          一次出 3~5 版，单选进入草稿迭代。
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs text-zinc-400">{isReal ? "补充提示词（可选）" : "人设 / 提示词"}</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-zinc-400">出版数量：{variants}</span>
          <input type="range" min={3} max={5} value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full accent-amber-500" />
        </label>
      </div>
    </DialogShell>
  );
}
