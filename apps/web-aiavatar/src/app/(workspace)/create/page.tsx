"use client";

// 创建选择 + 素材授权填写（任务书 §7）：两路径分流。
//  - 真人复刻：建档 → 跳详情页上传照片(合规检测) + 签授权
//  - AI 原创：人设文案 + 风格分类 → 建档 → 跳详情页打样
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Loader2, Sparkles } from "lucide-react";
import type { AiAvatarCreationMode } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { MODE_META, STYLE_PRESETS } from "@/constants/aiavatar-ui";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AiAvatarCreationMode | null>(null);
  const [name, setName] = React.useState("");
  const [persona, setPersona] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    if (!mode) return;
    if (!name.trim()) { setErr("请填写AiAvatar名称"); return; }
    setBusy(true); setErr(null);
    try {
      const a = await AiAvatarApi.createAvatar({
        mode, name: name.trim(),
        persona: persona.trim() || undefined,
        styleCategory: style || undefined,
        tags: tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean),
      });
      // 真人路径先去素材授权（详情页 source tab）；AI 路径也进详情页直接打样
      router.push(`/avatar/${a.id}?onboarding=${mode}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> 返回
      </button>

      <div>
        <h1 className="text-xl font-semibold">新建AiAvatar</h1>
        <p className="mt-0.5 text-sm text-zinc-500">选择创建模式，填写素材，进入 7 步标准链路</p>
      </div>

      {/* 模式选择 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.keys(MODE_META) as AiAvatarCreationMode[]).map((m) => {
          const meta = MODE_META[m];
          const Icon = m === "real_clone" ? Camera : Sparkles;
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)}
              className={cn("rounded-xl border p-5 text-left transition",
                active ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-[var(--bg-1)] hover:border-zinc-600")}>
              <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                active ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-amber-400")}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-zinc-100">{meta.label}</h3>
              <p className="mt-1 text-sm text-zinc-400">{meta.desc}</p>
            </button>
          );
        })}
      </div>

      {/* 表单 */}
      {mode && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-5">
          <Field label="AiAvatar名称" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：星瞳 Luna"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500" />
          </Field>

          <Field label={mode === "ai_original" ? "人设文案（AI 将解析为结构化人设）" : "人物简介（可选）"}>
            <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={4}
              placeholder={mode === "ai_original" ? "未来机能风高辨识度虚拟偶像，冷感光泽，舞台主视觉，适合商业代言与内容连载…" : "真人复刻对象的背景描述…"}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500" />
          </Field>

          <Field label="风格分类">
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((s) => (
                <button key={s} onClick={() => setStyle(style === s ? "" : s)}
                  className={cn("rounded-full border px-3 py-1 text-xs",
                    style === s ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
                  {s}
                </button>
              ))}
            </div>
          </Field>

          <Field label="标签（逗号分隔，可选）">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="未来感, 舞台, 商业"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500" />
          </Field>

          {mode === "real_clone" && (
            <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400">
              <Camera className="mr-1 inline h-3.5 w-3.5" />
              建档后将进入「素材授权」：上传多张真人照片（自动人脸合规检测）+ 签署电子肖像授权，方可打样与定稿。
            </p>
          )}

          {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{err}</p>}

          <button onClick={submit} disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {mode === "real_clone" ? "建档并上传素材" : "建档并开始打样"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-400">{label}{required && <span className="text-amber-400"> *</span>}</span>
      {children}
    </label>
  );
}
