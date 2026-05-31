"use client";
// ============================================================
// 草稿迭代（STEP 04）— AI 对话框在左侧（Figma AI 风格），右侧草稿画廊。
// 自然语言指令多轮生成（img2img + InstructPix2Pix），每轮存版本。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, StatusPill, Tag } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { usePolling, useApi } from "@/lib/hooks";
import { startDraftIterate, chooseVariant, transitionAvatar, getUiConfig } from "@/api/ai-avatar";
import { hueFor } from "@/lib/hue";
import { UI_CONFIG_DEFAULTS } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";

interface Round { key: string; instr: string; initial?: boolean; running?: boolean; variants: { assetId: string; label: string; src?: string | null }[] }

export function DraftingStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const [input, setInput] = React.useState("");
  const [chosen, setChosen] = React.useState<string | null>(null);
  const { data: uiCfg } = useApi(() => getUiConfig(), []);
  const presets = uiCfg?.draftPresets ?? UI_CONFIG_DEFAULTS.draftPresets; // 运营可配（/config）
  const chatEndRef = React.useRef<HTMLDivElement>(null);

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
        running: j.status === "running" || j.status === "queued",
        variants: ids.map((aid, k) => ({ assetId: aid, label: `R${i + 1} · ${k + 1}`, src: detail.assets.find((x) => x.id === aid)?.fileUrl || avatar.coverUrl })),
      });
    });
    return rs;
  }, [draftJobs, detail.assets, avatar.coverUrl, avatar.coverAssetId]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rounds.length, busy]);

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
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", height: "calc(100vh - 53px)" }}>
      {/* 左：AI 对话框（Figma AI 风格）*/}
      <div style={{ borderRight: "1px solid var(--line)", background: "var(--bg-1)", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* 头部 */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(140deg, var(--accent) 0%, var(--accent-dim) 100%)", display: "grid", placeItems: "center", color: "#1a1205", boxShadow: "var(--glow-accent)", flexShrink: 0 }}>
            <Icons.sparkle size={16} stroke={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>AI 草稿助手</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-2)" }}>img2img + InstructPix2Pix</div>
          </div>
          <StatusPill status="draft_iterating" />
        </div>

        {/* 对话流 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 系统欢迎气泡 */}
          <Bubble role="ai">
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>你好，我是 AI 草稿助手 👋 用自然语言告诉我要怎么调整这版形象，我会批量生成多版草稿供你挑选，每轮自动存为版本。</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {presets.map((p) => (
                <button key={p} onClick={() => submit(p)} disabled={busy} style={chipStyle}>+ {p}</button>
              ))}
            </div>
          </Bubble>

          {rounds.filter((r) => !r.initial).map((r, ri) => (
            <React.Fragment key={r.key}>
              {/* 用户指令气泡（右） */}
              <Bubble role="user">「{r.instr}」</Bubble>
              {/* AI 回应气泡（左）：缩略草稿 + 解析标记 */}
              <Bubble role="ai">
                {r.running ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--signal)", fontSize: 12.5 }}>
                    <span style={{ width: 13, height: 13, border: "2px solid var(--signal)", borderTopColor: "transparent", borderRadius: 999, animation: "spin .8s linear infinite" }} />
                    正在生成第 {ri + 1} 轮草稿…
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                      <Tag>NLU 解析 ✓</Tag>
                      <span style={{ fontSize: 12, color: "var(--ink-2)" }}>生成了 {r.variants.length} 版，点选你喜欢的</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {r.variants.map((v) => (
                        <button key={v.assetId} onClick={() => setChosen(v.assetId)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                          <Portrait hue={hueFor(v.assetId)} src={v.src} label={v.label} selected={chosen === v.assetId} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </Bubble>
            </React.Fragment>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 输入区 */}
        <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
          <div style={{ position: "relative", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              placeholder="描述要调整的细节，如「瘦脸、淡妆、换职业装」…（Enter 发送）"
              style={{ width: "100%", background: "transparent", border: "none", color: "var(--ink-0)", fontSize: 13, outline: "none", resize: "none", fontFamily: "var(--font-ui)" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{busy ? "生成中…" : "Enter 发送 · Shift+Enter 换行"}</span>
              <button onClick={() => submit()} disabled={busy || !input.trim()} style={{ width: 30, height: 30, borderRadius: 8, border: "none", cursor: busy || !input.trim() ? "not-allowed" : "pointer", background: busy || !input.trim() ? "var(--bg-3)" : "var(--accent)", color: busy || !input.trim() ? "var(--ink-2)" : "#1a1205", display: "grid", placeItems: "center" }}>
                <Icons.arrowR size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右：草稿画廊 + 顶部信息 + 底部「进入精调」 */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ padding: "20px 36px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>草稿迭代</h1>
            <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 6 }}>左侧用 AI 对话下发调整指令，这里挑选每轮草稿；满意后选定进入精调。</div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            {([["迭代轮次", rounds.length - 1], ["草稿总数", totalDrafts], ["已选", chosen ? 1 : 0]] as const).map(([l, v]) => (
              <div key={l} style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 36px 110px" }}>
          {rounds.map((r, ri) => (
            <div key={r.key} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)", padding: "3px 8px", border: "1px solid var(--accent-line)", borderRadius: 6 }}>R{ri}</span>
                <span style={{ fontSize: 13.5, color: "var(--ink-0)" }}>{r.initial ? r.instr : "“" + r.instr + "”"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, maxWidth: 680 }}>
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

        {/* 底部确认条 */}
        <div style={{ position: "fixed", left: 232 + 380, right: 0, bottom: 0, padding: "16px 36px", background: "var(--bg-glass)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 60 }}>
          <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{chosen ? "已选中一版草稿 · 将作为精调基底" : "在画廊或对话里选定一版草稿"}</div>
          <Btn variant="pri" size="lg" iconR={Icons.arrowR} disabled={!chosen} onClick={proceed}>选定此版 · 进入精调</Btn>
        </div>
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = { fontSize: 12, padding: "6px 11px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--ink-1)", cursor: "pointer" };

function Bubble({ role, children }: { role: "ai" | "user"; children: React.ReactNode }) {
  const isAi = role === "ai";
  return (
    <div style={{ display: "flex", justifyContent: isAi ? "flex-start" : "flex-end" }}>
      <div
        style={{
          maxWidth: isAi ? "94%" : "82%",
          padding: "11px 13px",
          borderRadius: isAi ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
          background: isAi ? "var(--bg-2)" : "var(--accent-soft)",
          border: "1px solid " + (isAi ? "var(--line)" : "var(--accent-line)"),
          color: isAi ? "var(--ink-0)" : "var(--accent-hi)",
          fontSize: 13,
        }}
      >
        {children}
      </div>
    </div>
  );
}
