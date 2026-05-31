"use client";
// ============================================================
// 素材准备（STEP 02）— 真人：多图上传 + 合规检测 + 电子肖像授权；AI：人设文案。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Tag, inputStyle } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { STYLE_TEMPLATES, UI_CONFIG_DEFAULTS } from "@/constants/aiavatar-ui";
import { PORTRAITS } from "@/mocks/seed";
import { updateAvatar, uploadSourcePhoto, addSourceText, signLicense, startSampling, getUiConfig } from "@/api/ai-avatar";
import { useApi } from "@/lib/hooks";
import { toast } from "@/components/ui/toast";

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0)" }}>{children}</label>
      {hint && <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{hint}</span>}
    </div>
  );
}

const ALL_TAGS = ["带货主播", "商用", "个人分身", "品牌IP", "泛娱乐"];

export function MaterialStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const isReal = avatar.mode === "real_clone";
  const [name, setName] = React.useState(avatar.name);
  const [tags, setTags] = React.useState<string[]>(avatar.tags ?? []);
  const [agreed, setAgreed] = React.useState(false);
  const [scope, setScope] = React.useState("commercial");
  // 运营可配（/config）：默认人设 + 人设描述 chip。
  const { data: uiCfg } = useApi(() => getUiConfig(), []);
  const personaChips = uiCfg?.personaChips ?? UI_CONFIG_DEFAULTS.personaChips;
  const [persona, setPersona] = React.useState(avatar.persona ?? "");
  const personaSeeded = React.useRef(false);
  React.useEffect(() => {
    // AI 模式且用户未填、未改过 → 用运营配置的默认人设预填一次。
    if (isReal || personaSeeded.current) return;
    if (!persona && uiCfg?.defaultPersona) {
      setPersona(uiCfg.defaultPersona);
      personaSeeded.current = true;
    }
  }, [uiCfg, isReal, persona]);
  const [style, setStyle] = React.useState(avatar.styleCategory ?? (isReal ? "写实主播风" : "简约风"));
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const photos = detail.sourceMaterials.filter((m) => m.kind === "photo");
  const canNext = isReal ? photos.length >= 3 && agreed : persona.trim().length > 4;

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadSourcePhoto(avatar.id, f);
      reload();
      toast("照片已上传 · 合规检测通过");
    } catch (e) {
      toast(e instanceof Error ? e.message : "上传失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setUploading(false);
    }
  };

  // 离线 demo 便捷：用内置开源人像作示例素材。
  const useSamples = async () => {
    setUploading(true);
    try {
      for (let i = 0; i < 3; i++) {
        const url = PORTRAITS[i];
        const blob = await fetch(url).then((r) => r.blob());
        const file = new File([blob], `sample-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
        await uploadSourcePhoto(avatar.id, file);
      }
      reload();
      toast("已载入 3 张示例照片");
    } catch {
      toast("载入示例失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setUploading(false);
    }
  };

  const startGen = async () => {
    setBusy(true);
    try {
      await updateAvatar(avatar.id, { name: name || (isReal ? "林夕" : "Aria"), persona, styleCategory: style, tags });
      if (isReal) {
        await signLicense(avatar.id, { scope, signatureName: name || avatar.name || "授权人", platforms: ["全平台"], boundAssetIds: photos.map((p) => p.assetId ?? "").filter(Boolean) });
      } else {
        await addSourceText(avatar.id, persona, "persona");
      }
      await startSampling(avatar.id, { variants: 5, prompt: persona });
      router.push(`/avatars/${avatar.id}/sampling`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", { icon: "!", tone: "var(--err)" });
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 36px 60px" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 600 }}>{isReal ? "上传真人素材 · 授权签署" : "填写人设文案"}</h1>
      <p style={{ color: "var(--ink-1)", fontSize: 14, margin: "0 0 30px" }}>
        {isReal ? "上传多角度参考照片并签署电子肖像授权，系统将做合规检测（无生成动作）。" : "AI 将解析你的描述词，直接生成原创人像形象。"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isReal ? "1fr 360px" : "1fr", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* 基本信息 */}
          <Panel title="基本信息">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <FieldLabel>数字人名称</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：林夕" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>使用场景</FieldLabel>
                <select style={{ ...inputStyle, appearance: "none" }}>
                  {["带货直播", "品牌代言", "个人分身", "泛娱乐"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel>标签</FieldLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_TAGS.map((tg) => {
                  const on = tags.includes(tg);
                  return (
                    <button key={tg} onClick={() => setTags((s) => (on ? s.filter((x) => x !== tg) : [...s, tg]))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <Tag on={on}># {tg}</Tag>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          {isReal ? (
            <Panel title="真人参考照片" right={<span className="mono" style={{ fontSize: 11, color: photos.length >= 3 ? "var(--ok)" : "var(--warn)" }}>{photos.length} / 3 张（最少）</span>}>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {photos.map((p, i) => (
                  <div key={p.id} style={{ position: "relative" }}>
                    <Portrait hue={28} src={p.assetUrl} ratio="3 / 4" label={["正面半身", "左侧脸", "右侧脸", "全身照"][i] || "参考"} />
                    <div style={{ position: "absolute", top: 6, left: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid rgba(86,214,160,0.3)" }}>
                        {p.faceCheckPassed ? "✓ 合规" : "检测中"}
                      </span>
                    </div>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ aspectRatio: "3 / 4", borderRadius: "var(--r-md)", border: "1.5px dashed var(--line-3)", background: "transparent", color: "var(--ink-2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icons.upload size={22} />
                  <span style={{ fontSize: 12 }}>{uploading ? "上传中…" : "上传照片"}</span>
                </button>
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 7 }}>
                  <Icons.scan size={14} style={{ color: "var(--signal)" }} />
                  InsightFace 人脸检测 · 遮挡 / 模糊度合规筛查（无生成动作）
                </div>
                {photos.length < 3 && <Btn variant="line" size="sm" icon={Icons.image} onClick={useSamples} disabled={uploading}>使用示例照片</Btn>}
              </div>
            </Panel>
          ) : (
            <Panel title="人设描述词" right={<Tag on>LLM 解析 → 结构化人设</Tag>}>
              <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={4} placeholder="角色人设、外貌、风格、穿搭、气质…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {personaChips.map((t) => (
                  <button key={t} onClick={() => setPersona((p) => p + " " + t)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--ink-1)", cursor: "pointer" }}>+ {t}</button>
                ))}
              </div>
              <div style={{ marginTop: 18 }}>
                <FieldLabel hint="可选 · 仅作风格参考，非肖像">参考风格图</FieldLabel>
                <div style={{ display: "flex", gap: 12 }}>
                  {[0, 1].map((i) => <div key={i} style={{ width: 90 }}><Portrait hue={268} ratio="1 / 1" label="风格图" /></div>)}
                  <button style={{ width: 90, aspectRatio: "1", borderRadius: "var(--r-md)", border: "1.5px dashed var(--line-3)", background: "transparent", color: "var(--ink-2)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icons.plus size={20} /></button>
                </div>
              </div>
            </Panel>
          )}

          {/* 风格分类 */}
          <Panel title={isReal ? "基础风格模板" : "风格分类"}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {STYLE_TEMPLATES.map((s) => {
                const on = style === s.name;
                return (
                  <button key={s.id} onClick={() => setStyle(s.name)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", background: on ? "var(--accent-soft)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--accent-line)" : "var(--line)") }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: `linear-gradient(140deg, oklch(0.5 0.12 ${s.hue}), oklch(0.3 0.08 ${s.hue}))` }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--accent-hi)" : "var(--ink-0)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* 右侧授权栏（real）*/}
        {isReal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 20 }}>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--accent-line)", borderRadius: "var(--r-lg)", padding: 20, boxShadow: "0 0 0 1px var(--accent-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <span style={{ color: "var(--accent)" }}><Icons.shield size={20} /></span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>电子肖像授权</div>
                <span style={{ marginLeft: "auto" }}><Tag on>必签</Tag></span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.6, margin: "0 0 16px" }}>协议将与上传照片绑定存档。禁止无授权使用他人照片生成数字人。</p>
              <FieldLabel>授权范围</FieldLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {([["commercial", "商用"], ["noncommercial", "非商用"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setScope(k)} style={{ flex: 1, padding: "9px", fontSize: 13, borderRadius: "var(--r-md)", cursor: "pointer", border: "1px solid " + (scope === k ? "var(--accent-line)" : "var(--line)"), background: scope === k ? "var(--accent-soft)" : "var(--bg-2)", color: scope === k ? "var(--accent-hi)" : "var(--ink-1)" }}>{l}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div><FieldLabel>使用期限</FieldLabel><select style={{ ...inputStyle, padding: "8px 10px", fontSize: 12.5, appearance: "none" }}>{["1 年", "3 年", "永久"].map((o) => <option key={o}>{o}</option>)}</select></div>
                <div><FieldLabel>平台范围</FieldLabel><select style={{ ...inputStyle, padding: "8px 10px", fontSize: 12.5, appearance: "none" }}>{["全平台", "指定平台"].map((o) => <option key={o}>{o}</option>)}</select></div>
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: 12, borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ accentColor: "var(--accent)", marginTop: 2, width: 16, height: 16 }} />
                <span style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.5 }}>我已阅读并签署 <span style={{ color: "var(--accent-hi)", textDecoration: "underline" }}>《电子肖像授权协议》</span>，确认拥有该肖像合法授权。</span>
              </label>
            </div>

            <OutputBox isReal={isReal} />
            <Btn variant="pri" size="lg" full iconR={Icons.arrowR} disabled={!canNext || busy} onClick={startGen}>{busy ? "提交中…" : "开始打样"}</Btn>
            {!canNext && <div style={{ fontSize: 11.5, color: "var(--ink-2)", textAlign: "center", marginTop: -8 }}>需上传 ≥3 张照片并签署授权</div>}
          </div>
        )}
      </div>

      {/* AI 路径的产出物 + 开始按钮（无授权栏，放底部）*/}
      {!isReal && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, gap: 20, flexWrap: "wrap" }}>
          <OutputBox isReal={isReal} inline />
          <Btn variant="pri" size="lg" iconR={Icons.arrowR} disabled={!canNext || busy} onClick={startGen}>{busy ? "提交中…" : "开始打样"}</Btn>
        </div>
      )}
    </div>
  );
}

function OutputBox({ isReal, inline }: { isReal: boolean; inline?: boolean }) {
  const items = [isReal ? "真人原始素材包" : "人设文案 + 风格素材", isReal ? "电子授权凭证" : "NLU 解析结构化人设", "合规检测报告"];
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18, flex: inline ? 1 : undefined, maxWidth: inline ? 520 : undefined }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 14 }}>OUTPUT · 本步产出物</div>
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--ink-1)", padding: "7px 0" }}>
          <Icons.doc size={15} style={{ color: "var(--ink-2)" }} />
          {t}
        </div>
      ))}
    </div>
  );
}
