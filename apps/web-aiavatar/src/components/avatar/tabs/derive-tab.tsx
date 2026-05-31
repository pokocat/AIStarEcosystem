"use client";

import * as React from "react";
import { Cuboid, Loader2, Video, Workflow } from "lucide-react";
import type { AiAvatarDetail, AiAvatarCapability } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { AssetTile } from "@/components/common/asset-tile";

/** 衍生（任务书 §7 Step 6）：3D（TripoSR）+ 视频（SVD），需已定稿。 */
export function DeriveTab({ detail, onChanged }: { detail: AiAvatarDetail; onChanged: () => void }) {
  const { avatar } = detail;
  const finalized = avatar.status === "finalized_2d" || avatar.status === "deriving" || avatar.status === "archived";
  const [want3d, setWant3d] = React.useState(true);
  const [wantVideo, setWantVideo] = React.useState(true);
  const [videoDur, setVideoDur] = React.useState(10);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const models = detail.assets.filter((a) => a.kind === "model_3d");
  const videos = detail.assets.filter((a) => a.kind === "video");

  const submit = async () => {
    const caps: AiAvatarCapability[] = [];
    if (want3d) caps.push("img23d");
    if (wantVideo) caps.push("img2video");
    if (caps.length === 0) { setErr("请至少选择一种衍生类型"); return; }
    setBusy(true); setErr(null);
    try { await AiAvatarApi.derive(avatar.id, { capabilities: caps, videoDurationSec: videoDur }); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "衍生失败"); }
    finally { setBusy(false); }
  };

  if (!finalized) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center">
        <Workflow className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-400">请先完成「定稿确认」，再生成 3D / 视频衍生</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DeriveCard active={want3d} onToggle={() => setWant3d((v) => !v)} icon={Cuboid}
          title="3D 模型" desc="TripoSR 单图重建 · 输出 GLB/FBX，可旋转预览" badge="TripoSR" />
        <DeriveCard active={wantVideo} onToggle={() => setWantVideo((v) => !v)} icon={Video}
          title="场景视频" desc="SVD 缓慢运镜 · 1080P/25fps · 仅静态展示+运镜" badge="SVD-XT">
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400" onClick={(e) => e.stopPropagation()}>
            时长
            {[10, 20, 30].map((d) => (
              <button key={d} onClick={() => setVideoDur(d)}
                className={cn("rounded-full border px-2 py-0.5", videoDur === d ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-zinc-700")}>
                {d}s
              </button>
            ))}
          </div>
        </DeriveCard>
      </div>

      {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{err}</p>}

      <button onClick={submit} disabled={busy}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />} 发起衍生生成
      </button>

      {(models.length > 0 || videos.length > 0) && (
        <div className="space-y-3">
          {models.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-200">已生成 3D</h4>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {models.map((a) => <AssetTile key={a.id} asset={a} ratio="square" />)}
              </div>
            </div>
          )}
          {videos.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-200">已生成视频</h4>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {videos.map((a) => <AssetTile key={a.id} asset={a} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeriveCard({ active, onToggle, icon: Icon, title, desc, badge, children }: {
  active: boolean; onToggle: () => void; icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; badge: string; children?: React.ReactNode;
}) {
  return (
    <button onClick={onToggle}
      className={cn("rounded-xl border p-4 text-left transition", active ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-[var(--bg-1)] hover:border-zinc-600")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-amber-400")}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-100">{title}</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{badge}</span>
          </div>
        </div>
        <span className={cn("ml-auto flex h-5 w-5 items-center justify-center rounded-full border", active ? "border-amber-500 bg-amber-500 text-zinc-950" : "border-zinc-600")}>
          {active && "✓"}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{desc}</p>
      {children}
    </button>
  );
}
