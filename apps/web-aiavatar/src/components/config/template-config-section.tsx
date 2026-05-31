"use client";
// ============================================================
// 运营配置 · 模板 CRUD（风格/妆造 STYLE · 美颜 BEAUTY）。
// 写走 /api/admin/aiavatar/templates（运营角色）；live + mock 双路径。
//   style → params.prompt（img2img 提示）+ thumbnailUrl（样片，可上传）。
//   beauty → params.{smooth,whiten,warmth,brightness}（真实 canvas beauty）。
// ============================================================
import * as React from "react";
import type { AiAvatarTemplate, AiAvatarTemplateCategory, AiAvatarTemplateUpsertInput } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Tag, inputStyle } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { listTemplatesByCategory, createTemplate, updateTemplate, deleteTemplate, uploadSourcePhoto } from "@/api/ai-avatar";
import { toast } from "@/components/ui/toast";

export function TemplateConfigSection({ category }: { category: Extract<AiAvatarTemplateCategory, "style" | "beauty"> }) {
  const { data, reload } = useApi(() => listTemplatesByCategory(category), [category]);
  const list = data ?? [];
  const [editing, setEditing] = React.useState<AiAvatarTemplate | "new" | null>(null);
  const isStyle = category === "style";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)" }}>
          {isStyle ? "风格 / 妆造模板：每个带样片 + img2img 提示，创作者在精调「模版套用」里选用。" : "美颜模板：磨皮 / 美白 / 暖色 / 亮度参数，创作者实时套用。"}
          <span className="mono" style={{ marginLeft: 8, color: "var(--ink-3)" }}>共 {list.length} 个</span>
        </div>
        <Btn variant="pri" icon={Icons.plus} onClick={() => setEditing("new")}>新增模板</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {list.map((t) => (
          <div key={t.id} style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            {isStyle ? (
              <Portrait hue={(t.params as Record<string, number>)?.hue ?? 28} src={t.thumbnailUrl} ratio="3/4" label="样片" style={{ borderRadius: 0, border: "none" }} />
            ) : (
              <BeautySwatch params={(t.params as Record<string, number>) ?? {}} />
            )}
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                {!t.enabled && <Tag>停用</Tag>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4, minHeight: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn size="sm" variant="line" full icon={Icons.sliders} onClick={() => setEditing(t)}>编辑</Btn>
                <Btn size="sm" variant="ghost" icon={Icons.trash} onClick={async () => { await deleteTemplate(t.id); reload(); toast("已删除"); }} />
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ color: "var(--ink-2)", fontSize: 13, padding: 24 }}>暂无模板，点「新增模板」创建。</div>}
      </div>

      {editing && (
        <TemplateDialog
          category={category}
          tpl={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function BeautySwatch({ params }: { params: Record<string, number> }) {
  // 用参数派生一个色卡预览（纯展示）。
  const hue = params.hue ?? 28;
  return (
    <div style={{ aspectRatio: "3/4", background: `linear-gradient(155deg, oklch(0.6 0.08 ${hue}), oklch(0.3 0.05 ${hue}))`, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)", fontSize: 10.5, gap: 4 }}>
      <div>磨{params.smooth ?? 0} 白{params.whiten ?? 0}</div>
      <div>暖{params.warmth ?? 0} 亮{params.brightness ?? 50}</div>
    </div>
  );
}

function TemplateDialog({ category, tpl, onClose, onSaved }: { category: "style" | "beauty"; tpl: AiAvatarTemplate | null; onClose: () => void; onSaved: () => void }) {
  const isStyle = category === "style";
  const p = (tpl?.params as Record<string, unknown>) ?? {};
  const [name, setName] = React.useState(tpl?.name ?? "");
  const [desc, setDesc] = React.useState(tpl?.description ?? "");
  const [enabled, setEnabled] = React.useState(tpl?.enabled ?? true);
  const [prompt, setPrompt] = React.useState((p.prompt as string) ?? "");
  const [thumb, setThumb] = React.useState<string | null>(tpl?.thumbnailUrl ?? null);
  const [beauty, setBeauty] = React.useState({ smooth: (p.smooth as number) ?? 40, whiten: (p.whiten as number) ?? 20, warmth: (p.warmth as number) ?? 10, brightness: (p.brightness as number) ?? 55 });
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onPickSample = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      // 复用素材上传（mock → dataURL；live → multipart 资产 URL）。无 avatar 作用域时用占位 id。
      const m = await uploadSourcePhoto("config-sample", f).catch(async () => {
        // 退路：直接读 dataURL（mock 友好）。
        return { assetUrl: await fileToDataUrl(f) } as { assetUrl: string };
      });
      setThumb(m.assetUrl ?? null);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) { toast("请填写模板名称", { icon: "!", tone: "var(--err)" }); return; }
    setBusy(true);
    try {
      const params: Record<string, unknown> = isStyle
        ? { prompt, hue: (p.hue as number) ?? 28 }
        : { ...beauty, hue: (p.hue as number) ?? 28 };
      const body: AiAvatarTemplateUpsertInput = {
        name, category, description: desc, params, enabled,
        capability: isStyle ? "img2img" : "restore",
        thumbnailUrl: isStyle ? thumb ?? undefined : undefined,
        official: true,
      };
      if (tpl) await updateTemplate(tpl.id, body);
      else await createTemplate(body);
      onSaved();
      toast(tpl ? "已更新模板" : "已新增模板");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,14,0.7)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "92%", maxHeight: "88%", overflowY: "auto", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{tpl ? "编辑" : "新增"}{isStyle ? "风格 / 妆造模板" : "美颜模板"}</div>
          <Btn variant="ghost" icon={Icons.x} size="sm" onClick={onClose} />
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Lbl>模板名称</Lbl>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isStyle ? "如：职业妆容" : "如：主播美颜"} style={inputStyle} />
          </div>
          <div>
            <Lbl>描述</Lbl>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="一句话描述" style={inputStyle} />
          </div>

          {isStyle ? (
            <>
              <div>
                <Lbl>img2img 提示词（生成时下发给大模型）</Lbl>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="如：职业通勤妆容，自然底妆，保留五官结构" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "var(--font-mono)", fontSize: 12.5 }} />
              </div>
              <div>
                <Lbl>样片参考图</Lbl>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickSample(e.target.files?.[0] ?? null)} />
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 90 }}><Portrait hue={28} src={thumb} ratio="3/4" label={thumb ? "" : "无样片"} /></div>
                  <Btn variant="line" size="sm" icon={Icons.upload} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "上传中…" : "上传样片"}</Btn>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([["smooth", "磨皮", 0, 100], ["whiten", "美白", 0, 100], ["warmth", "色温", -50, 50], ["brightness", "亮度", 0, 100]] as const).map(([k, label, min, max]) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: "var(--ink-1)" }}>{label}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-hi)" }}>{beauty[k]}</span>
                  </div>
                  <input type="range" min={min} max={max} value={beauty[k]} onChange={(e) => setBeauty((b) => ({ ...b, [k]: +e.target.value }))} style={{ width: "100%" }} />
                </div>
              ))}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-1)", cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            启用（关闭后创作者侧不可见）
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, padding: "0 20px 20px" }}>
          <Btn variant="line" full onClick={onClose}>取消</Btn>
          <Btn variant="pri" full icon={Icons.check} onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Btn>
        </div>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-0)", marginBottom: 8 }}>{children}</div>;
}
