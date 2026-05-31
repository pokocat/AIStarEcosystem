"use client";
// ============================================================
// 运营配置 · Prompt 模板编辑（复用共享 prompt_template；key=aiavatar.*）。
// 左列 key 列表，右侧 system / user textarea + params + 启用开关 + 试运行（dry-run）。
// 镜像 admin /platform/prompts；live 走 /api/admin/prompts/*。
// ============================================================
import * as React from "react";
import type { AiAvatarPromptConfig } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Tag } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { listPromptConfigs, upsertPromptConfig, dryRunPromptConfig } from "@/api/ai-avatar";
import { toast } from "@/components/ui/toast";

const ta: React.CSSProperties = {
  width: "100%", padding: "11px 13px", background: "var(--bg-2)", border: "1px solid var(--line)",
  borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 13, fontFamily: "var(--font-mono)",
  outline: "none", resize: "vertical", lineHeight: 1.6,
};

export function PromptConfigSection() {
  const { data, reload } = useApi(() => listPromptConfigs(), []);
  const list = data ?? [];
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const active = list.find((p) => p.key === (activeKey ?? list[0]?.key)) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
      {/* 左：key 列表 */}
      <Panel title="Prompt 列表" pad={10}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {list.map((p) => {
            const on = p.key === (active?.key ?? "");
            return (
              <button key={p.key} onClick={() => setActiveKey(p.key)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer", border: "1px solid " + (on ? "var(--accent-line)" : "transparent"), background: on ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: on ? "var(--accent-hi)" : "var(--ink-0)" }}>{p.label}</span>
                  {!p.enabled && <Tag>已停用</Tag>}
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3 }}>{p.key} · v{p.version}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 右：编辑器 */}
      {active ? <PromptEditor key={active.key} prompt={active} onSaved={reload} /> : <div style={{ color: "var(--ink-2)", padding: 40 }}>加载中…</div>}
    </div>
  );
}

function PromptEditor({ prompt, onSaved }: { prompt: AiAvatarPromptConfig; onSaved: () => void }) {
  const [system, setSystem] = React.useState(prompt.systemPrompt);
  const [userTpl, setUserTpl] = React.useState(prompt.userTemplate);
  const [enabled, setEnabled] = React.useState(prompt.enabled);
  const [temp, setTemp] = React.useState(prompt.params?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = React.useState(prompt.params?.maxTokens ?? 1024);
  const [jsonMode, setJsonMode] = React.useState(prompt.params?.jsonMode ?? false);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const dirty = system !== prompt.systemPrompt || userTpl !== prompt.userTemplate || enabled !== prompt.enabled
    || temp !== (prompt.params?.temperature ?? 0.7) || maxTokens !== (prompt.params?.maxTokens ?? 1024) || jsonMode !== (prompt.params?.jsonMode ?? false);

  // 从 userTemplate 解析占位符，给 dry-run 提供样本输入框。
  const placeholders = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of userTpl.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) set.add(m[1]);
    return [...set];
  }, [userTpl]);
  const [vars, setVars] = React.useState<Record<string, string>>({});

  const save = async () => {
    setBusy(true);
    try {
      await upsertPromptConfig(prompt.key, { systemPrompt: system, userTemplate: userTpl, enabled, params: { temperature: temp, maxTokens, jsonMode } });
      onSaved();
      toast(`已保存「${prompt.label}」· 版本 +1`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };

  const dryRun = async () => {
    try {
      const r = await dryRunPromptConfig(prompt.key, vars);
      setPreview(`【SYSTEM】\n${r.system}\n\n【USER（占位符已填充）】\n${r.user}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "试运行失败", { icon: "!", tone: "var(--err)" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title={prompt.label} right={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><Tag on>{prompt.capability ?? "llm"}</Tag><span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>v{prompt.version} · 来源 {prompt.origin ?? "code"}</span></div>}>
        {prompt.description && <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.6 }}>{prompt.description}</div>}

        <Label>System Prompt（系统设定）</Label>
        <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={4} style={ta} />

        <Label style={{ marginTop: 16 }}>User Template（用户模板 · 支持 {"{{占位符}}"}）</Label>
        <textarea value={userTpl} onChange={(e) => setUserTpl(e.target.value)} rows={4} style={ta} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
          <div>
            <Label>温度 temperature</Label>
            <input type="number" step={0.05} min={0} max={2} value={temp} onChange={(e) => setTemp(+e.target.value)} style={numInput} />
          </div>
          <div>
            <Label>最大 token</Label>
            <input type="number" step={128} min={128} max={8192} value={maxTokens} onChange={(e) => setMaxTokens(+e.target.value)} style={numInput} />
          </div>
          <div>
            <Label>JSON 模式</Label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", fontSize: 13, color: "var(--ink-1)", cursor: "pointer" }}>
              <input type="checkbox" checked={jsonMode} onChange={(e) => setJsonMode(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
              response_format=json_object
            </label>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-1)", cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            启用此 Prompt
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Btn variant="line" icon={Icons.eye} onClick={dryRun}>试运行</Btn>
            <Btn variant="pri" icon={Icons.check} onClick={save} disabled={busy || !dirty}>{busy ? "保存中…" : "保存"}</Btn>
          </div>
        </div>
      </Panel>

      {(placeholders.length > 0 || preview) && (
        <Panel title="试运行（dry-run · 不真调大模型）">
          {placeholders.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
              {placeholders.map((ph) => (
                <div key={ph}>
                  <Label>{`{{${ph}}}`}</Label>
                  <input value={vars[ph] ?? ""} onChange={(e) => setVars((v) => ({ ...v, [ph]: e.target.value }))} placeholder={`样本 ${ph}`} style={numInput} />
                </div>
              ))}
            </div>
          )}
          {preview && (
            <pre style={{ margin: 0, padding: 14, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 12, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{preview}</pre>
          )}
        </Panel>
      )}
    </div>
  );
}

const numInput: React.CSSProperties = { width: "100%", padding: "9px 11px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none" };
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "var(--ink-1)", marginBottom: 7, ...style }}>{children}</div>;
}
