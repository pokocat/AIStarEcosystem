"use client";
// ============================================================
// 标准分视角出图（STEP 06）— 仅按标准构图分视角批量出图，不做任何编辑。
// 美颜 / 妆造 / 五官微调全部在上一步「精调」完成；本步只把定妆形象按 5 个标准视角裁切出图。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Tag, StatusPill } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { Icons } from "@/components/ui/icons";
import { usePolling, useApi } from "@/lib/hooks";
import { templateBeautify, listTemplatesByCategory } from "@/api/ai-avatar";
import { COMPOSITIONS, styleHue } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";
import type { AiAvatarStandardShot } from "@ai-star-eco/types/ai-avatar";

interface CompItem { id: string; name: string; shot: AiAvatarStandardShot; ratio: string; main?: boolean }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

// 仅按构图比例裁切出图（不做美颜/编辑）。不同视角用不同裁切位移模拟「分视角」。
async function renderShot(img: HTMLImageElement, ratio: number, shot: string): Promise<string> {
  const W = 480;
  const H = Math.round(W / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  // 视角偏移：左/右侧脸水平偏移裁切窗口，全身略微下移，半身/表情居中。
  const shiftX = shot === "left_profile" ? -0.12 : shot === "right_profile" ? 0.12 : 0;
  const shiftY = shot === "front_full" ? 0.06 : -0.04;
  ctx.drawImage(img, (W - dw) / 2 + dw * shiftX, (H - dh) / 2 + dh * shiftY, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.9);
}

const RATIO: Record<string, number> = { "3:4": 3 / 4, "9:16": 9 / 16, "1:1": 1 };

export function OutputStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  // 运营可配（/config）：标准构图视角；空 / 未加载时回退出厂 COMPOSITIONS（绝不空视角）。
  const { data: compRows } = useApi(() => listTemplatesByCategory("composition"), []);
  const compositions: CompItem[] = React.useMemo(() => {
    const rows = compRows ?? [];
    if (!rows.length) return COMPOSITIONS.map((c) => ({ id: c.id, name: c.name, shot: c.shot, ratio: c.ratio, main: c.main }));
    return rows.map((t) => {
      const p = (t.params ?? {}) as Record<string, unknown>;
      return { id: t.id, name: t.name, shot: (p.shot as AiAvatarStandardShot) ?? "front_bust", ratio: typeof p.ratio === "string" ? p.ratio : "3:4", main: !!p.main };
    });
  }, [compRows]);

  const [comps, setComps] = React.useState<string[] | null>(null);
  // 构图加载后默认全选（仅首次）。
  React.useEffect(() => {
    if (comps === null && compositions.length) setComps(compositions.map((c) => c.id));
  }, [compositions, comps]);
  const selectedIds = comps ?? compositions.map((c) => c.id);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  const job = detail.recentJobs.find((j) => (j.input as { kind?: string } | null)?.kind === "beautify");
  const running = !!job && (job.status === "running" || job.status === "queued");
  const done = !!job && job.status === "succeeded" && Object.keys(previews).length > 0;
  const phase: "config" | "gen" | "done" = running ? "gen" : done ? "done" : "config";
  usePolling(reload, 700, running);

  const toggle = (id: string) => setComps(() => { const arr = selectedIds; return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]; });
  const selComps = compositions.filter((c) => selectedIds.includes(c.id));

  const run = async () => {
    if (!selectedIds.length) return;
    try {
      if (avatar.coverUrl) {
        const img = await loadImage(avatar.coverUrl);
        const next: Record<string, string> = {};
        for (const c of selComps) next[c.id] = await renderShot(img, RATIO[c.ratio] ?? 0.75, c.shot);
        setPreviews(next);
      }
      // 后台任务（记录版本 + 推状态机 pending_finalize）。本步无美颜模板入参。
      await templateBeautify(avatar.id, { params: { shots: selectedIds, multiView: true } });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "出图失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const hue = styleHue(avatar.styleCategory);

  return (
    <div style={{ padding: "28px 36px 60px", maxWidth: 1340, margin: "0 auto" }}>
      <PageHead no="STEP 06 · 标准素材图集" title="标准分视角出图" status="pending_finalize" sub="基于精调定妆的形象，按标准构图分视角批量出图。本步不做编辑——美颜 / 妆造 / 五官微调请在上一步「精调」完成。"
        right={phase === "done" && <Btn variant="pri" size="lg" iconR={Icons.arrowR} onClick={() => router.push(`/avatars/${avatar.id}/finalize`)}>前往定稿</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 28, alignItems: "start" }}>
        {/* 左控制：只选构图视角 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel title="标准构图视角（系统预设规格）" right={<Tag>{selectedIds.length} / {compositions.length}</Tag>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {compositions.map((c) => {
                const on = selectedIds.includes(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: "var(--r-md)", cursor: "pointer", background: on ? "var(--bg-3)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--line-2)" : "var(--line)") }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ink-0)" }}>{c.name}{c.main && <span style={{ marginLeft: 8 }}><Tag on>主图</Tag></span>}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{c.ratio}</span>
                  </label>
                );
              })}
            </div>
          </Panel>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: 14, borderRadius: "var(--r-md)", background: "var(--bg-1)", border: "1px solid var(--line)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            <Icons.wand size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <span>需要改妆容 / 美颜 / 脸型？请回到<b style={{ color: "var(--ink-1)" }}>「精调」</b>，本步仅出标准视角图。</span>
          </div>
          <Btn variant="pri" size="lg" full icon={Icons.layers} onClick={run} disabled={phase === "gen" || !selectedIds.length}>{phase === "gen" ? "批量出图中…" : "批量出标准图"}</Btn>
        </div>

        {/* 右预览 */}
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span>OUTPUT · 标准形象图集（分视角）</span>
            <span>{phase === "done" ? "✓ 固定规格 · PNG/JPG" : "正面半身 / 全身 / 左右侧脸 / 表情"}</span>
          </div>
          {phase === "config" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c) => <Portrait key={c.id} hue={hue} src={avatar.coverUrl} ratio="3/4" label={c.name} sub={c.ratio} dim />)}
            </div>
          )}
          {phase === "gen" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c, i) => (
                <div key={c.id} style={{ aspectRatio: "3/4", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "linear-gradient(100deg, var(--bg-2) 30%, var(--bg-3) 50%, var(--bg-2) 70%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", animationDelay: i * 0.12 + "s", display: "grid", placeItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--signal)" }}>出图中</span>
                </div>
              ))}
            </div>
          )}
          {phase === "done" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c) => (
                <Portrait key={c.id} hue={hue} src={previews[c.id]} ratio="3/4" label={c.name} sub={c.ratio + " · 1080P"}
                  badge={<SourceBadge mode="mock" engine="多视角出图 (client)" />} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageHead({ no, title, status, sub, right }: { no: string; title: string; status?: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--accent)", marginBottom: 8 }}>{no}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{title}</h1>
          {status && <StatusPill status={status} />}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 8 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}
