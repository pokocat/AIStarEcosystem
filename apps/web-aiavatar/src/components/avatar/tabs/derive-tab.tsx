"use client";

import * as React from "react";
import { ArrowRight, Check, Cuboid, Loader2, Video, Workflow } from "lucide-react";
import type { AiAvatarDetail, AiAvatarCapability } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { AssetTile } from "@/components/common/asset-tile";

/** 衍生（Step 6）：3D（TripoSR）+ 视频（SVD），需已定稿。
 *  showResults=false 时（内嵌于阶段卡）只显示发起表单 + 「查看产出」链接。 */
export function DeriveTab({ detail, onChanged, showResults = true, onSeeOutputs }: {
  detail: AiAvatarDetail; onChanged: () => void; showResults?: boolean; onSeeOutputs?: () => void;
}) {
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
      <div className="rounded-xl border border-dashed border-[var(--line-strong)] py-14 text-center">
        <Workflow className="mx-auto mb-2 h-8 w-8 text-[var(--fg-3)]" />
        <p className="text-sm text-[var(--fg-2)]">请先完成「定稿确认」，再生成 3D / 视频衍生</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DeriveCard active={want3d} onToggle={() => setWant3d((v) => !v)} icon={Cuboid}
          title="3D 模型" desc="TripoSR 单图重建 · 输出 GLB/FBX，可旋转预览" badge="TripoSR" />
        <DeriveCard active={wantVideo} onToggle={() => setWantVideo((v) => !v)} icon={Video}
          title="场景视频" desc="SVD 缓慢运镜 · 1080P/25fps" badge="SVD-XT">
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--fg-2)]" onClick={(e) => e.stopPropagation()}>
            时长
            {[10, 20, 30].map((d) => (
              <button key={d} onClick={() => setVideoDur(d)} className="chip" data-on={videoDur === d}>
                <span className="num">{d}</span>s
              </button>
            ))}
          </div>
        </DeriveCard>
      </div>

      {err && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">{err}</p>}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />} 发起衍生生成
        </button>
        {!showResults && (models.length > 0 || videos.length > 0) && onSeeOutputs && (
          <button onClick={onSeeOutputs} className="btn btn-quiet btn-sm">
            查看产出 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && (models.length > 0 || videos.length > 0) && (
        <div className="space-y-4 pt-1">
          {models.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-[var(--fg-1)]">已生成 3D</h4>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {models.map((a) => <AssetTile key={a.id} asset={a} ratio="square" />)}
              </div>
            </div>
          )}
          {videos.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-[var(--fg-1)]">已生成视频</h4>
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
      className={cn("rounded-xl border p-4 text-left transition",
        active ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--bg-1)] hover:border-[var(--line-strong)]")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg",
          active ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-[var(--bg-2)] text-[var(--fg-2)]")}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-[var(--fg-0)]">{title}</span>
          <span className="num rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--fg-2)]">{badge}</span>
        </div>
        <span className={cn("ml-auto flex h-5 w-5 items-center justify-center rounded-full border",
          active ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--line-strong)] text-transparent")}>
          <Check className="h-3 w-3" />
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--fg-2)]">{desc}</p>
      {children}
    </button>
  );
}
