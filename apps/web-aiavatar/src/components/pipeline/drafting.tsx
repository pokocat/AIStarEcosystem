"use client";
// ============================================================
// 草稿迭代（STEP 04）— 自然语言指令多轮生成（img2img + InstructPix2Pix），每轮存版本。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, StatusPill, Tag } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { usePolling } from "@/lib/hooks";
import { startDraftIterate, chooseVariant, transitionAvatar } from "@/api/ai-avatar";
import { hueFor } from "@/lib/hue";
import { toast } from "@/components/ui/toast";

interface Round { key: string; instr: string; initial?: boolean; variants: { assetId: string; label: string; src?: string | null }[] }

export function DraftingStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const [input, setInput] = React.useState("");
  const [chosen, setChosen] = React.useState<string | null>(null);
  const presets = ["瘦脸", "淡妆", "换职业装", "发型微卷", "更年轻"];

  const draftJobs = detail.recentJobs.filter((j) => (j.input as { kind?: string } | null)?.kind === "draft").reverse();
  const busy = draftJobs.some((j) => j.status === "running" || j.status === "queued");
  usePolling(reload, 700, busy);

  const rounds: Round[] = React.useMemo(() => {
    const rs: Round[] = [{ key: "r0", instr: "初始草稿（基于已选打样）", initial: true, variants: [{ assetId: avatar.coverAssetId ?? "cover", label: "基底", src: avatar.coverUrl }] }];
    draftJobs.forEach((j, i) => {
      const ids = (j.result as { assetIds?: string[] } | null)?.assetIds ?? [];
      rs.push({
        key: j.id,
        instr: (j.input as { prompt?: string } | null)?.prompt ?? "调整",
        variants: ids.map((aid, k) => ({ assetId: aid, label: `R${i + 1} · ${k + 1}`, src: detail.assets.find((x) => x.id === aid)?.fileUrl || avatar.coverUrl })),
      });
    });
    return rs;
  }, [draftJobs, detail.assets, avatar.coverUrl, avatar.coverAssetId]);

  const submit = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
    try {
      await startDraftIterate(avatar.id, { prompt: t, variants: 2 });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const proceed = async () => {
    if (!chosen) return;
    try {
      await chooseVariant(avatar.id, chosen);
      await transitionAvatar(avatar.id, "refining").catch(() => undefined);
      router.push(`/avatars/${avatar.id}/studio`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const totalDrafts = rounds.reduce((s, r) => s + (r.initial ? 0 : r.variants.length), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", height: "calc(100vh - 53px)" }}>
      {/* 左：草稿流 */}
      <div style={{ overflowY: "auto", padding: "28px 36px 40px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>草稿迭代</h1>
            <StatusPill status="draft_iterating" />
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink-1)" }}>用自然语言下发调整指令，批量生成多版草稿。系统自动保存每一轮版本。</div>
        </div>
        {rounds.map((r, ri) => (
          <div key={r.key} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--accent)", padding: "3px 8px", border: "1px solid var(--accent-line)", borderRadius: 6 }}>R{ri}</span>
              <span style={{ fontSize: 13.5, color: "var(--ink-0)" }}>{r.initial ? r.instr : "“" + r.instr + "”"}</span>
              {!r.initial && <span style={{ marginLeft: "auto" }}><Tag>NLU 解析 ✓</Tag></span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, maxWidth: 620 }}>
              {r.variants.map((v) => (
                <div key={v.assetId}>
                  <Portrait hue={hueFor(v.assetId)} src={v.src} label={v.label} selected={chosen === v.assetId} onClick={() => setChosen(v.assetId)} />
                  <div style={{ display: "flex", gap: 4, marginTop: 7, justifyContent: "center" }}>
                    <IconBtn icon={Icons.heart} size={28} title="标记偏好" />
                    <IconBtn icon={chosen === v.assetId ? Icons.check : Icons.arrowR} size={28} active={chosen === v.assetId} title="选定" onClick={() => setChosen(v.assetId)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--signal)", fontSize: 13, padding: "8px 0" }}>
            <span style={{ width: 14, height: 14, border: "2px solid var(--signal)", borderTopColor: "transparent", borderRadius: 999, animation: "spin .8s linear infinite" }} />
            生成新一轮草稿中…
          </div>
        )}
      </div>

      {/* 右：指令面板 */}
      <div style={{ borderLeft: "1px solid var(--line)", background: "var(--bg-1)", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>调整指令</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>img2img + InstructPix2Pix · 指令编辑</div>
        </div>
        <div style={{ flex: 1, padding: 22, overflowY: "auto" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 12 }}>快捷指令</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
            {presets.map((p) => (
              <button key={p} onClick={() => submit(p)} disabled={busy} style={{ fontSize: 12.5, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--ink-1)", cursor: "pointer" }}>+ {p}</button>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 12 }}>草稿统计</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([["迭代轮次", rounds.length - 1], ["草稿总数", totalDrafts], ["偏好标记", chosen ? 1 : 0], ["已废弃", 0]] as const).map(([l, v]) => (
              <div key={l} style={{ padding: 14, background: "var(--bg-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{v}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 18, borderTop: "1px solid var(--line)" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="描述要调整的细节，如「瘦脸、淡妆、换职业装」" style={{ width: "100%", padding: "11px 13px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 13, outline: "none", resize: "none", marginBottom: 12 }} />
          <Btn variant="signal" full icon={Icons.wand} onClick={() => submit()} disabled={busy || !input.trim()}>生成草稿</Btn>
          <Btn variant="pri" full iconR={Icons.arrowR} disabled={!chosen} onClick={proceed} style={{ marginTop: 10 }}>选定此版 · 进入精调</Btn>
        </div>
      </div>
    </div>
  );
}
