"use client";

import * as React from "react";
import { Loader2, Wand2 } from "lucide-react";
import type { AiAvatar } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { DialogShell } from "./dialog-shell";

const PRESETS = ["发色调亮一些", "增加未来机能感", "表情更柔和", "换更简洁的背景", "强化眼神光", "服装更高级"];

/** 草稿迭代（Step 2）：自然语言指令 img2img。 */
export function DraftIterateDialog({ avatar, onClose, onStarted }: { avatar: AiAvatar; onClose: () => void; onStarted: () => void }) {
  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try { await AiAvatarApi.startDraftIterate(avatar.id, { prompt: prompt.trim() }); onStarted(); }
    finally { setBusy(false); }
  };

  return (
    <DialogShell title="草稿迭代" description="用自然语言描述要怎么改，在当前版基础上生成新版本（img2img）" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">取消</button>
          <button onClick={submit} disabled={busy || !prompt.trim()} className="btn btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} 生成新一版
          </button>
        </>
      }>
      <div className="space-y-3">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="例如：发色调亮一些，增加一点未来机能感…"
          className="aa-textarea" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setPrompt((v) => (v ? v + "，" + p : p))} className="chip">
              {p}
            </button>
          ))}
        </div>
      </div>
    </DialogShell>
  );
}
