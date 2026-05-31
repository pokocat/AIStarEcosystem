"use client";
// ============================================================
// 衍生（STEP 08）— 3D（TripoSR/FLAME+3DGS）+ 视频（SVD），分任务进度，可交互预览，入库归档。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Portrait, Progress, Seg, Tag } from "@/components/ui/primitives";
import { Icons, type IconComponent } from "@/components/ui/icons";
import { PageHead } from "./output";
import { VideoPlayer, Viewer3D } from "@/components/common/media";
import { deriveAssets, archiveAvatar } from "@/api/ai-avatar";
import { styleHue } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";

export function DeriveStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const hue = styleHue(avatar.styleCategory);
  const [sel, setSel] = React.useState({ d3: false, video: false });
  const [precision, setPrecision] = React.useState<"low" | "high">("high");
  const [scene, setScene] = React.useState("studio");
  const [dur, setDur] = React.useState(20);

  const deriveJobs = detail.recentJobs.filter((j) => (j.input as { kind?: string } | null)?.kind === "derive");
  const running = deriveJobs.some((j) => j.status === "running" || j.status === "queued");
  const allDone = deriveJobs.length > 0 && deriveJobs.every((j) => j.status === "succeeded");

  const scenes: [string, string][] = [["studio", "直播间"], ["indoor", "室内场景"], ["outdoor", "户外场景"], ["plain", "简约背景"]];
  const any = sel.d3 || sel.video;

  const run = async () => {
    const caps: ("img23d" | "img2video")[] = [];
    if (sel.d3) caps.push("img23d");
    if (sel.video) caps.push("img2video");
    if (!caps.length) return;
    try {
      await deriveAssets(avatar.id, { capabilities: caps, videoDurationSec: dur, params: { precision, scene } });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const archive = async () => {
    try {
      await archiveAvatar(avatar.id);
      toast("全部衍生资产已入库归档");
      router.push(`/avatars/${avatar.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "归档失败", { icon: "!", tone: "var(--err)" });
    }
  };

  if (running) {
    return <DeriveRun jobs={deriveJobs} onBg={() => { toast("已转入后台任务中心", { icon: "⚡" }); router.push("/tasks"); }} />;
  }
  if (allDone) {
    const has3d = deriveJobs.some((j) => j.capability === "img23d");
    const hasVid = deriveJobs.some((j) => j.capability === "img2video");
    return (
      <div className="fade-up" style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 36px 60px" }}>
        <PageHead no="STEP 08 · 衍生完成" title="衍生资产已生成" status="archived" sub="预览并确认后入库，与该数字人资产绑定。" />
        <div style={{ display: "grid", gridTemplateColumns: has3d && hasVid ? "1fr 1fr" : "1fr", gap: 22, maxWidth: has3d && hasVid ? "none" : 560, margin: "0 auto" }}>
          {has3d && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>轻量化 3D 数字人</div>
                <Tag on>{precision === "high" ? "高精" : "简易"}</Tag>
              </div>
              <Viewer3D hue={hue} precision={precision} posterSrc={avatar.coverUrl} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn variant="line" size="sm" icon={Icons.download} full onClick={() => toast("已下载 model.glb")}>下载 GLB</Btn>
                <Btn variant="line" size="sm" icon={Icons.retry} onClick={() => toast("已重新生成 3D 模型", { icon: "⚡" })}>重生成</Btn>
              </div>
            </div>
          )}
          {hasVid && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>场景渲染短视频</div>
                <Tag on>{scenes.find((s) => s[0] === scene)?.[1]} · {dur}s</Tag>
              </div>
              <VideoPlayer hue={hue} dur={dur} scene={scenes.find((s) => s[0] === scene)?.[1] ?? "直播间"} posterSrc={avatar.coverUrl} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn variant="line" size="sm" icon={Icons.download} full onClick={() => toast("已下载 render.mp4")}>下载 MP4</Btn>
                <Btn variant="line" size="sm" icon={Icons.retry} onClick={() => toast("已重新渲染视频", { icon: "⚡" })}>重渲染</Btn>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
          <Btn variant="pri" size="lg" icon={Icons.check} onClick={archive}>确认入库 · 完成归档</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 36px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHead no="STEP 08 · 可选衍生" title="衍生资产生成" status="finalized_2d" sub="基于定稿 2D 形象生成延伸资产，非强制步骤，可二选一或都选。" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <DeriveCard icon={Icons.cube} en="OPTION A" title="轻量化 3D 数字人" desc="TripoSR 单图三维重建，秒级生成带纹理网格。" on={sel.d3} onToggle={() => setSel((s) => ({ ...s, d3: !s.d3 }))} hue={200} testId="derive-toggle-3d">
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>3D 精度 / 引擎</div>
            <Seg value={precision} onChange={setPrecision} options={[{ value: "low", label: "简易 · TripoSR" }, { value: "high", label: "高精 · FLAME+3DGS" }]} />
            <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", marginTop: 8 }}>{precision === "low" ? "GLB 网格 · 降面 60-80% · 适配渲染" : "FLAME 头模 + 3D Gaussian · 可驱动（研究级）"}</div>
            <div style={{ marginTop: 14 }}><Portrait hue={200} src={avatar.coverUrl} ratio="4/3" label="3D 模型预览" sub="GLB / FBX" /></div>
          </div>
        </DeriveCard>
        <DeriveCard icon={Icons.film} en="OPTION B" title="场景渲染短视频" desc="Stable Video Diffusion 图生视频，仅缓慢运镜，无动作驱动。" on={sel.video} onToggle={() => setSel((s) => ({ ...s, video: !s.video }))} hue={340} testId="derive-toggle-video">
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>场景模板</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {scenes.map(([k, l]) => <button key={k} onClick={() => setScene(k)} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (scene === k ? "var(--accent-line)" : "var(--line-2)"), background: scene === k ? "var(--accent-soft)" : "var(--bg-2)", color: scene === k ? "var(--accent-hi)" : "var(--ink-1)" }}>{l}</button>)}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-2)" }}>时长</span>
              <Seg size="sm" value={String(dur)} onChange={(v) => setDur(+v)} options={[{ value: "10", label: "10s" }, { value: "20", label: "20s" }, { value: "30", label: "30s" }]} />
            </div>
            <div style={{ marginTop: 14, position: "relative" }}><Portrait hue={340} src={avatar.coverUrl} ratio="16/9" label="渲染视频预览" sub="1080P · 25fps" /></div>
          </div>
        </DeriveCard>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
        <Btn variant="ghost" onClick={() => router.push(`/avatars/${avatar.id}`)}>跳过 · 直接入库</Btn>
        <Btn variant="pri" size="lg" icon={Icons.bolt} disabled={!any} onClick={run}>生成衍生资产</Btn>
      </div>
    </div>
  );
}

function DeriveCard({ icon: I, en, title, desc, on, onToggle, hue, children, testId }: { icon: IconComponent; en: string; title: string; desc: string; on: boolean; onToggle: () => void; hue: number; children: React.ReactNode; testId?: string }) {
  return (
    <div style={{ padding: 22, borderRadius: "var(--r-lg)", background: on ? "var(--bg-2)" : "var(--bg-1)", border: "1px solid " + (on ? "var(--accent)" : "var(--line)"), boxShadow: on ? "var(--glow-accent)" : "none", transition: "all .2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: `oklch(0.3 0.07 ${hue})`, color: `oklch(0.8 0.12 ${hue})`, display: "grid", placeItems: "center", flexShrink: 0 }}><I size={24} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.12em" }}>{en}</div>
          <div style={{ fontSize: 17, fontWeight: 600, margin: "3px 0 6px" }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.5 }}>{desc}</div>
        </div>
        <button data-testid={testId} onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--bg-3)", position: "relative", transition: "all .2s", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "all .2s" }} />
        </button>
      </div>
      {on && <div className="fade-up">{children}</div>}
    </div>
  );
}

function DeriveRun({ jobs, onBg }: { jobs: AiAvatarDetail["recentJobs"]; onBg: () => void }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 36px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>衍生资产生成中</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>基于定稿 2D 形象，异步任务后台执行</div>
      </div>
      {jobs.map((j) => {
        const is3d = j.capability === "img23d";
        const Icon = is3d ? Icons.cube : Icons.film;
        const hue = is3d ? 200 : 340;
        const d = j.status === "succeeded";
        return (
          <div key={j.id} style={{ padding: 18, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(0.3 0.07 ${hue})`, color: `oklch(0.8 0.12 ${hue})`, display: "grid", placeItems: "center" }}><Icon size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{is3d ? "轻量化 3D 数字人" : "场景渲染短视频"}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-2)", marginTop: 2 }}>{j.engine}</div>
              </div>
              <span className="mono" style={{ fontSize: 13, color: d ? "var(--ok)" : "var(--signal)" }}>{d ? "✓ 完成" : Math.round(j.progress) + "%"}</span>
            </div>
            <Progress pct={j.progress} tone={d ? "ok" : "signal"} />
          </div>
        );
      })}
      <Btn variant="line" onClick={onBg} style={{ alignSelf: "center", marginTop: 8 }}>转入后台 · 继续其他工作</Btn>
    </div>
  );
}
