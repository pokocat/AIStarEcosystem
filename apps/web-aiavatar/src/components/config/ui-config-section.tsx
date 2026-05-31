"use client";
// ============================================================
// 运营配置 · 快捷指令 / 默认人设（落 PlatformConfig aiavatar.ui-config）+ 标准构图 CRUD。
// ============================================================
import * as React from "react";
import type { AiAvatarTemplate, AiAvatarTemplateUpsertInput } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Tag, inputStyle } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import {
  getUiConfig, updateUiConfig,
  listTemplatesByCategory, createTemplate, updateTemplate, deleteTemplate,
} from "@/api/ai-avatar";
import { UI_CONFIG_DEFAULTS } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";

export function UiConfigSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <QuickConfig />
      <CompositionConfig />
    </div>
  );
}

// ── 快捷指令 + 默认人设 ──────────────────────────────────────────────────────
function QuickConfig() {
  const { data, reload } = useApi(() => getUiConfig(), []);
  const cfg = data ?? UI_CONFIG_DEFAULTS;
  const [draft, setDraft] = React.useState(cfg);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (data) setDraft(data); }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await updateUiConfig(draft);
      reload();
      toast("已保存快捷指令 / 默认人设");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="快捷指令 / 默认人设" right={<Btn variant="pri" size="sm" icon={Icons.check} onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Btn>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <ChipList label="草稿迭代 · 快捷指令" sub="草稿迭代 AI 对话框的快捷指令 chip" value={draft.draftPresets} onChange={(v) => setDraft((d) => ({ ...d, draftPresets: v }))} />
        <ChipList label="精调 · 自然语言快捷指令" sub="精调-自然语言面板的 chip" value={draft.refinePresets} onChange={(v) => setDraft((d) => ({ ...d, refinePresets: v }))} />
        <ChipList label="创建 · 人设描述 chip" sub="AI 原创路径人设输入的提示 chip" value={draft.personaChips} onChange={(v) => setDraft((d) => ({ ...d, personaChips: v }))} />
        <div>
          <Lbl>局部重绘默认指令词</Lbl>
          <input value={draft.regionInpaintPrompt} onChange={(e) => setDraft((d) => ({ ...d, regionInpaintPrompt: e.target.value }))} style={inputStyle} />
          <Lbl style={{ marginTop: 16 }}>AI 原创 · 默认人设文案</Lbl>
          <textarea value={draft.defaultPersona} onChange={(e) => setDraft((d) => ({ ...d, defaultPersona: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
        </div>
      </div>
    </Panel>
  );
}

function ChipList({ label, sub, value, onChange }: { label: string; sub: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = React.useState("");
  const add = () => { const t = input.trim(); if (t && !value.includes(t)) { onChange([...value, t]); setInput(""); } };
  return (
    <div>
      <Lbl>{label}</Lbl>
      <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 8 }}>{sub}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {value.map((c) => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--ink-1)" }}>
            {c}
            <button onClick={() => onChange(value.filter((x) => x !== c))} style={{ background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", display: "flex", padding: 0 }}><Icons.x size={12} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="输入后回车添加" style={{ ...inputStyle, padding: "8px 11px", fontSize: 12.5 }} />
        <Btn variant="line" size="sm" icon={Icons.plus} onClick={add}>添加</Btn>
      </div>
    </div>
  );
}

// ── 标准构图 CRUD ────────────────────────────────────────────────────────────
const SHOT_OPTIONS: { value: string; label: string }[] = [
  { value: "front_bust", label: "正面半身" },
  { value: "front_full", label: "正面全身" },
  { value: "left_profile", label: "左侧脸" },
  { value: "right_profile", label: "右侧脸" },
  { value: "expression", label: "表情" },
];

function CompositionConfig() {
  const { data, reload } = useApi(() => listTemplatesByCategory("composition"), []);
  const list = data ?? [];
  const [editing, setEditing] = React.useState<AiAvatarTemplate | "new" | null>(null);

  return (
    <Panel title="标准构图视角" right={<Btn variant="pri" size="sm" icon={Icons.plus} onClick={() => setEditing("new")}>新增构图</Btn>}>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 14 }}>「分视角出图」按这些构图批量出图。每个构图含视角类型 + 画幅比例。</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((t) => {
          const p = (t.params as Record<string, unknown>) ?? {};
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--ink-0)" }}>{t.name}{p.main ? <span style={{ marginLeft: 8 }}><Tag on>主图</Tag></span> : null}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{SHOT_OPTIONS.find((s) => s.value === p.shot)?.label ?? String(p.shot ?? "")}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{(p.ratio as string) ?? "3:4"}</span>
              {!t.enabled && <Tag>停用</Tag>}
              <Btn size="sm" variant="ghost" icon={Icons.sliders} onClick={() => setEditing(t)} />
              <Btn size="sm" variant="ghost" icon={Icons.trash} onClick={async () => { await deleteTemplate(t.id); reload(); toast("已删除"); }} />
            </div>
          );
        })}
        {list.length === 0 && <div style={{ color: "var(--ink-2)", fontSize: 13 }}>暂无构图。</div>}
      </div>
      {editing && <CompositionDialog tpl={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </Panel>
  );
}

function CompositionDialog({ tpl, onClose, onSaved }: { tpl: AiAvatarTemplate | null; onClose: () => void; onSaved: () => void }) {
  const p = (tpl?.params as Record<string, unknown>) ?? {};
  const [name, setName] = React.useState(tpl?.name ?? "");
  const [shot, setShot] = React.useState((p.shot as string) ?? "front_bust");
  const [ratio, setRatio] = React.useState((p.ratio as string) ?? "3:4");
  const [main, setMain] = React.useState(!!p.main);
  const [enabled, setEnabled] = React.useState(tpl?.enabled ?? true);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    if (!name.trim()) { toast("请填写名称", { icon: "!", tone: "var(--err)" }); return; }
    setBusy(true);
    try {
      const body: AiAvatarTemplateUpsertInput = { name, category: "composition", params: { shot, ratio, main }, enabled, official: true };
      if (tpl) await updateTemplate(tpl.id, body);
      else await createTemplate(body);
      onSaved();
      toast(tpl ? "已更新构图" : "已新增构图");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,14,0.7)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "92%", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{tpl ? "编辑构图" : "新增构图"}</div>
          <Btn variant="ghost" icon={Icons.x} size="sm" onClick={onClose} />
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div><Lbl>名称</Lbl><input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：正面半身像" style={inputStyle} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><Lbl>视角类型</Lbl><select value={shot} onChange={(e) => setShot(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>{SHOT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div><Lbl>画幅比例</Lbl><select value={ratio} onChange={(e) => setRatio(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>{["3:4", "9:16", "1:1"].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-1)", cursor: "pointer" }}>
              <input type="checkbox" checked={main} onChange={(e) => setMain(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />主形象图
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-1)", cursor: "pointer" }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />启用
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, padding: "0 20px 20px" }}>
          <Btn variant="line" full onClick={onClose}>取消</Btn>
          <Btn variant="pri" full icon={Icons.check} onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Btn>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-0)", marginBottom: 8, ...style }}>{children}</div>;
}
