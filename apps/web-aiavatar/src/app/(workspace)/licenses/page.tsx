"use client";
// ============================================================
// 真人授权管理 — 电子肖像授权记录、凭证下载、到期提醒（仅真人复刻路径）。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Portrait } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { listLicenses, listAvatars } from "@/api/ai-avatar";
import { TONE } from "@/constants/aiavatar-ui";
import { hueFor } from "@/lib/hue";
import { Head } from "../templates/page";
import { fmtDate } from "@/lib/format";
import { toast } from "@/components/ui/toast";

function daysTo(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
}

export default function LicensesPage() {
  const router = useRouter();
  const { data: licenses } = useApi(() => listLicenses(), []);
  const { data: avatars } = useApi(() => listAvatars(), []);
  const recs = licenses ?? [];
  const nameOf = (avatarId: string) => (avatars ?? []).find((a) => a.id === avatarId)?.name ?? avatarId;

  const expiringSoon = recs.filter((r) => { const d = daysTo(r.validTo); return d != null && d >= 0 && d < 120; }).length;
  const stats: [string, string | number, keyof typeof TONE][] = [
    ["有效授权", recs.filter((r) => r.status === "active").length, "ok"],
    ["即将到期", expiringSoon, "accent"],
    ["加密素材", recs.reduce((s, r) => s + r.boundAssetIds.length, 0) + " 张", "mute"],
  ];

  return (
    <div className="fade-up" style={{ padding: "28px 36px 60px", maxWidth: 1400, margin: "0 auto" }}>
      <Head kicker="PORTRAIT LICENSE" title="真人授权管理" sub="电子肖像授权记录、凭证下载、到期提醒。仅真人复刻路径使用。"
        right={<Btn variant="line" icon={Icons.doc} onClick={() => toast("打开授权协议模板编辑器", { icon: "▤" })}>授权协议模板</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 26 }}>
        {stats.map(([l, v, tone]) => (
          <div key={l} style={{ padding: 20, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{l}</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600, color: TONE[tone].c, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px 1.3fr 1fr 1fr 1fr 110px", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {["", "数字人 / 被授权方", "授权范围", "期限", "状态", ""].map((h, i) => <span key={i}>{h}</span>)}
        </div>
        {recs.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>暂无授权记录</div>}
        {recs.map((a) => {
          const d = daysTo(a.validTo);
          const soon = d != null && d >= 0 && d < 120;
          return (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "44px 1.3fr 1fr 1fr 1fr 110px", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => router.push(`/avatars/${a.avatarId}`)}>
              <Portrait hue={hueFor(a.avatarId)} src={(avatars ?? []).find((x) => x.id === a.avatarId)?.coverUrl} ratio="1/1" label="" style={{ width: 36, borderRadius: 8 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{nameOf(a.avatarId)}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{a.avatarId} · {a.subjectName}</div>
              </div>
              <span style={{ fontSize: 13, color: "var(--ink-1)" }}>{a.scope === "commercial" ? "商用" : "非商用"}</span>
              <span className="mono" style={{ fontSize: 12, color: soon ? "var(--accent-hi)" : "var(--ink-1)" }}>{a.validTo ? (soon ? `${d} 天后到期` : `至 ${fmtDate(a.validTo)}`) : "永久"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: soon ? "var(--accent)" : a.status === "active" ? "var(--ok)" : "var(--err)" }}>
                <Icons.shield size={13} />{soon ? "即将到期" : a.status === "active" ? "有效" : a.status}
              </span>
              <Btn size="sm" variant="line" icon={Icons.download} onClick={(e) => { e.stopPropagation(); toast(`已下载 ${nameOf(a.avatarId)} 授权凭证 PDF`); }}>凭证</Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}
