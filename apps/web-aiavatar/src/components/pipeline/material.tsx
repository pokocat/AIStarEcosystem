"use client";
// ============================================================
// 素材准备（STEP 02）— 真人：多图上传 + 合规检测 + 电子肖像授权；AI：人设文案。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Tag, inputStyle } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { STYLE_LOOK_TEMPLATES, STYLE_TEMPLATES, UI_CONFIG_DEFAULTS } from "@/constants/aiavatar-ui";
import { PORTRAITS } from "@/mocks/seed";
import { updateAvatar, uploadReferenceImage, uploadSourcePhoto, addSourceText, signLicense, startSampling, getUiConfig } from "@/api/ai-avatar";
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

function DesignSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div tabIndex={0} onBlur={() => window.setTimeout(() => setOpen(false), 100)} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span>{value}</span>
        <Icons.chevD size={15} style={{ color: "var(--ink-2)" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            padding: 6,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--line-2)",
            background: "var(--bg-1)",
            boxShadow: "0 18px 48px rgba(0,0,0,.32)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {options.map((option) => {
            const on = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 10px",
                  border: "none",
                  borderRadius: 7,
                  background: on ? "var(--accent-soft)" : "transparent",
                  color: on ? "var(--accent-hi)" : "var(--ink-1)",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                {option}
                {on && <Icons.check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ALL_TAGS = ["带货主播", "商用", "个人分身", "品牌IP", "泛娱乐"];
const SCENE_OPTIONS = ["带货直播", "品牌代言", "个人分身", "泛娱乐", "虚拟主播", "课程讲师"];

const NAME_SUGGESTIONS = [
  "星眠", "鹿禾", "青岚", "若白", "云栖", "南音", "澈夏", "知予",
  "Nova", "Mira", "Luna", "Astra", "Nori", "Iris",
];

const PERSONA_STYLE_PRESETS = [
  {
    id: "real-influencer",
    name: "写实虚拟达人",
    tag: "商用写实",
    text: "25 岁左右写实虚拟达人，鹅蛋脸，清透底妆，亲和但专业，适合直播带货和品牌短视频，服装为浅色通勤套装，柔和棚拍光，正面半身构图。",
  },
  {
    id: "editorial-fashion",
    name: "时装杂志感",
    tag: "高级质感",
    text: "都市时装杂志风数字人，冷静自信，五官立体，轻奢妆容，黑白灰极简造型，电影级侧逆光，背景干净，适合品牌代言和新品发布。",
  },
  {
    id: "cyber-idol",
    name: "赛博虚拟偶像",
    tag: "未来感",
    text: "未来感赛博虚拟偶像，银灰短发，虹膜微光，机能风外套，蓝紫霓虹边缘光，性格聪明利落，适合科技品牌、游戏和潮流内容。",
  },
  {
    id: "anime-vtuber",
    name: "二次元主播",
    tag: "动漫渲染",
    text: "二次元虚拟主播，大眼但比例自然，蓬松短发，元气开朗，服装带轻量舞台感，干净赛璐璐渲染，适合直播互动和粉丝运营。",
  },
  {
    id: "guofeng-muse",
    name: "新国风主理人",
    tag: "东方审美",
    text: "新国风数字主理人，温润含蓄，东方古典妆造，发饰克制精致，丝绸质感服装，暖色室内光，适合文旅、茶饮、美妆和非遗品牌。",
  },
  {
    id: "soft-3d",
    name: "轻 3D 品牌吉祥物",
    tag: "亲和可爱",
    text: "轻 3D 风格品牌数字人，圆润面部比例，干净大色块服装，微笑亲和，柔和漫反射光，像可长期运营的品牌吉祥物但不过度幼态。",
  },
];

export function MaterialStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const isReal = avatar.mode === "real_clone";
  const [name, setName] = React.useState(avatar.name);
  const nameSuggestions = React.useMemo(() => shuffle(NAME_SUGGESTIONS).slice(0, 3), []);
  const [suggestionIndex, setSuggestionIndex] = React.useState(0);
  const recommendedName = nameSuggestions[suggestionIndex] ?? "星眠";
  const [scene, setScene] = React.useState("带货直播");
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
  const [selectedLookId, setSelectedLookId] = React.useState(STYLE_LOOK_TEMPLATES[0]?.id ?? "");
  const [selectedReferenceId, setSelectedReferenceId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const referenceRef = React.useRef<HTMLInputElement>(null);

  const photos = detail.sourceMaterials.filter((m) => m.kind === "photo");
  const referenceAssets = detail.assets.filter((a) => a.kind === "reference_image");
  const selectedLook = STYLE_LOOK_TEMPLATES.find((t) => t.id === selectedLookId) ?? STYLE_LOOK_TEMPLATES[0];
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

  const onPickReference = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const asset = await uploadReferenceImage(avatar.id, f);
      setSelectedReferenceId(asset.id);
      setSelectedLookId("");
      reload();
      toast("参考风格图已上传");
    } catch (e) {
      toast(e instanceof Error ? e.message : "上传失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setUploading(false);
      if (referenceRef.current) referenceRef.current.value = "";
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
      await updateAvatar(avatar.id, { name: name || recommendedName, persona, styleCategory: style, tags: [...new Set([...tags, scene])] });
      if (isReal) {
        await signLicense(avatar.id, { scope, signatureName: name || avatar.name || "授权人", platforms: ["全平台"], boundAssetIds: photos.map((p) => p.assetId ?? "").filter(Boolean) });
      } else {
        await addSourceText(avatar.id, persona, "persona");
      }
      await startSampling(avatar.id, {
        variants: 5,
        prompt: selectedLook?.prompt ? `${persona}\n风格参考：${selectedLook.prompt}` : persona,
        referenceAssetId: selectedReferenceId ?? undefined,
        params: selectedLook ? { scene, styleLookId: selectedLook.id, styleLookSampleUrl: selectedLook.sampleUrl } : { scene },
      });
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
          <Panel title="基本信息" style={{ overflow: "visible", position: "relative", zIndex: 5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <FieldLabel>数字人名称</FieldLabel>
                <div style={{ position: "relative" }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`AI 推荐：${recommendedName}`} style={{ ...inputStyle, paddingRight: 112 }} />
                  <button
                    type="button"
                    onClick={() => {
                      setName(recommendedName);
                      setSuggestionIndex((i) => (i + 1) % nameSuggestions.length);
                    }}
                    style={{
                      position: "absolute",
                      right: 7,
                      top: 7,
                      height: 28,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0 9px",
                      borderRadius: 7,
                      border: "1px solid var(--accent-line)",
                      background: "var(--accent-soft)",
                      color: "var(--accent-hi)",
                      fontSize: 11.5,
                      cursor: "pointer",
                    }}
                  >
                    <Icons.sparkle size={13} />
                    推荐名
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>使用场景</FieldLabel>
                <DesignSelect value={scene} options={SCENE_OPTIONS} onChange={setScene} />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <FieldLabel>标签</FieldLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_TAGS.map((tg) => {
                  const on = tags.includes(tg);
                  return (
                    <button key={tg} type="button" onClick={() => setTags((s) => (on ? s.filter((x) => x !== tg) : [...s, tg]))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ aspectRatio: "3 / 4", borderRadius: "var(--r-md)", border: "1.5px dashed var(--line-3)", background: "transparent", color: "var(--ink-2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
              <div style={{ marginTop: 14 }}>
                <FieldLabel hint="点击直接填入，可再手动修改">风格化数字人预设</FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {PERSONA_STYLE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersona(p.text)}
                      style={{
                        minHeight: 92,
                        padding: 12,
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--line)",
                        background: "var(--bg-2)",
                        color: "var(--ink-0)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--accent-hi)" }}>{p.tag}</span>
                      </span>
                      <span style={{ display: "block", marginTop: 7, color: "var(--ink-2)", fontSize: 11.5, lineHeight: 1.45 }}>
                        {p.text.slice(0, 42)}…
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {personaChips.map((t) => (
                  <button key={t} type="button" onClick={() => setPersona((p) => p + " " + t)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--ink-1)", cursor: "pointer" }}>+ {t}</button>
                ))}
              </div>
              <div style={{ marginTop: 18 }}>
                <FieldLabel hint="可选 · 可选模板或上传参考图">参考风格图</FieldLabel>
                <input ref={referenceRef} type="file" accept="image/*" hidden onChange={(e) => onPickReference(e.target.files)} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                  {STYLE_LOOK_TEMPLATES.map((look) => {
                    const on = selectedLookId === look.id && !selectedReferenceId;
                    return (
                      <button
                        key={look.id}
                        type="button"
                        onClick={() => {
                          setSelectedLookId(look.id);
                          setSelectedReferenceId(null);
                          setStyle(look.name);
                        }}
                        style={{ border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <Portrait hue={look.hue} src={look.sampleUrl} ratio="1 / 1" label={look.name} sub={look.desc} selected={on} />
                      </button>
                    );
                  })}
                  {referenceAssets.map((asset) => {
                    const on = selectedReferenceId === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          setSelectedReferenceId(asset.id);
                          setSelectedLookId("");
                        }}
                        style={{ border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <Portrait hue={268} src={asset.thumbnailUrl || asset.fileUrl} ratio="1 / 1" label="上传参考" sub="自定义图片" selected={on} />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => referenceRef.current?.click()}
                    disabled={uploading}
                    style={{ aspectRatio: "1", borderRadius: "var(--r-md)", border: "1.5px dashed var(--line-3)", background: "transparent", color: "var(--ink-2)", cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 7 }}
                  >
                    <Icons.upload size={20} />
                    <span style={{ fontSize: 11.5 }}>{uploading ? "上传中…" : "上传图片"}</span>
                  </button>
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
                  <button key={s.id} type="button" onClick={() => setStyle(s.name)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", background: on ? "var(--accent-soft)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--accent-line)" : "var(--line)") }}>
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
                  <button key={k} type="button" onClick={() => setScope(k)} style={{ flex: 1, padding: "9px", fontSize: 13, borderRadius: "var(--r-md)", cursor: "pointer", border: "1px solid " + (scope === k ? "var(--accent-line)" : "var(--line)"), background: scope === k ? "var(--accent-soft)" : "var(--bg-2)", color: scope === k ? "var(--accent-hi)" : "var(--ink-1)" }}>{l}</button>
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

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
