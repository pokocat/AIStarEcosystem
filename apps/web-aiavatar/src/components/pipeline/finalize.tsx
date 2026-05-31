"use client";
// ============================================================
// 定稿确认（STEP 07）— 逐张确认标准图集 → 锁定版本、置已定稿、冻结草稿链路。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail, AiAvatarAsset } from "@ai-star-eco/types/ai-avatar";
import { Btn, Portrait, Tag } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { PageHead } from "./output";
import { finalizeAvatar } from "@/api/ai-avatar";
import { COMPOSITIONS, styleHue } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";

export function FinalizeStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const hue = styleHue(avatar.styleCategory);
  const [confirmed, setConfirmed] = React.useState<Record<string, boolean>>({});
  const [done, setDone] = React.useState(avatar.status === "finalized_2d" || avatar.status === "archived");
  const [busy, setBusy] = React.useState(false);

  // 标准图集：优先用带 standardShot 的资产；否则按构图用封面占位。
  const shotAssets: { id: string; name: string; ratio: string; src?: string | null }[] = React.useMemo(() => {
    const withShot = detail.assets.filter((a) => a.standardShot);
    if (withShot.length) {
      return withShot.slice(0, 6).map((a: AiAvatarAsset, i) => ({ id: a.id, name: COMPOSITIONS[i]?.name ?? "标准图", ratio: COMPOSITIONS[i]?.ratio ?? "3:4", src: a.fileUrl || avatar.coverUrl }));
    }
    return COMPOSITIONS.map((c) => ({ id: c.id, name: c.name, ratio: c.ratio, src: avatar.coverUrl }));
  }, [detail.assets, avatar.coverUrl]);

  const allOk = shotAssets.every((s) => confirmed[s.id]);
  const okCount = shotAssets.filter((s) => confirmed[s.id]).length;

  const lock = async () => {
    setBusy(true);
    try {
      await finalizeAvatar(avatar.id, { confirmedAssetIds: shotAssets.map((s) => s.id), note: "锁定标准图集" });
      reload();
      setDone(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "定稿失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 60, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--ok-soft)", border: "1px solid rgba(86,214,160,0.3)", display: "grid", placeItems: "center", color: "var(--ok)", marginBottom: 24 }}>
          <Icons.check size={36} stroke={2.4} />
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 600 }}>已成功定稿</h1>
        <p style={{ color: "var(--ink-1)", fontSize: 14.5, maxWidth: "46ch", lineHeight: 1.6, margin: "0 0 8px" }}>当前版本已锁定，资产状态标记为「已定稿」，草稿链路已冻结。</p>
        <div style={{ display: "flex", gap: 10, margin: "18px 0 32px" }}>
          <Tag on>已定稿 2D</Tag>
          <Tag>{shotAssets.length} 张标准图</Tag>
          <Tag>{avatar.id}</Tag>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <Btn variant="line" size="lg" icon={Icons.layers} onClick={() => router.push(`/avatars/${avatar.id}`)}>查看资产</Btn>
          <Btn variant="pri" size="lg" iconR={Icons.arrowR} onClick={() => router.push(`/avatars/${avatar.id}/derive`)}>生成衍生资产</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 36px 110px", maxWidth: 1240, margin: "0 auto" }}>
      <PageHead no="STEP 07 · 正式定稿" title="定稿确认" status="pending_finalize" sub="逐张确认整套标准图集。确认后将锁定版本、冻结草稿链路。" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {shotAssets.map((s) => {
          const ok = confirmed[s.id];
          return (
            <div key={s.id} style={{ position: "relative" }}>
              <Portrait hue={hue} src={s.src} ratio="3/4" label={s.name} sub={s.ratio} selected={ok} onClick={() => setConfirmed((p) => ({ ...p, [s.id]: !p[s.id] }))} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 13, color: "var(--ink-1)" }}>{s.name}</span>
                <Btn size="sm" variant={ok ? "pri" : "line"} icon={ok ? Icons.check : undefined} onClick={() => setConfirmed((p) => ({ ...p, [s.id]: !p[s.id] }))}>{ok ? "已确认" : "确认"}</Btn>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "fixed", left: 232, right: 0, bottom: 0, padding: "16px 36px", background: "var(--bg-glass)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="mono" style={{ fontSize: 13, color: allOk ? "var(--ok)" : "var(--ink-1)" }}>{okCount} / {shotAssets.length} 已确认</span>
          <Btn variant="line" size="sm" icon={Icons.back} onClick={() => router.push(`/avatars/${avatar.id}/output`)}>返回修改</Btn>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn variant="line" onClick={() => setConfirmed(Object.fromEntries(shotAssets.map((s) => [s.id, true])))}>全部确认</Btn>
          <Btn variant="pri" size="lg" icon={Icons.lock} disabled={!allOk || busy} onClick={lock}>{busy ? "锁定中…" : "锁定定稿"}</Btn>
        </div>
      </div>
    </div>
  );
}
