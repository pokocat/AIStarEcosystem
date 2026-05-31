"use client";

// 分场景编辑器（v0.45）：增删改 / 调序 / 景别·运镜·时长 / 逐镜配音开关 / 逐镜 AI 重写。
import * as React from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/premium";
import { Field, Select, TextArea, TextInput } from "@/components/common";
import type { CameraMove, DramaScene, ShotType } from "@/api/short-drama";

const SHOT_TYPES: { value: ShotType; label: string }[] = [
  { value: "wide", label: "远景" },
  { value: "medium", label: "中景" },
  { value: "close", label: "近景" },
  { value: "extreme_close", label: "特写" },
];
const CAMERA_MOVES: { value: CameraMove; label: string }[] = [
  { value: "static", label: "固定机位" },
  { value: "push", label: "推镜" },
  { value: "pull", label: "拉镜" },
  { value: "pan", label: "摇镜" },
  { value: "handheld", label: "手持" },
];

function emptyScene(): DramaScene {
  return { heading: "", summary: "", shot: "", dialogue: "", duration_sec: 12, shot_type: "medium", camera_move: "static", gen_voice: true, character_ids: [] };
}

export function SceneEditor({
  scenes,
  onChange,
  canRewrite,
  onRewrite,
}: {
  scenes: DramaScene[];
  onChange: (next: DramaScene[]) => void;
  canRewrite: boolean;
  onRewrite?: (index: number) => Promise<void>;
}) {
  const [rewriting, setRewriting] = React.useState<number | null>(null);

  function patch(i: number, p: Partial<DramaScene>) {
    onChange(scenes.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(scenes.filter((_, idx) => idx !== i));
  }
  async function rewrite(i: number) {
    if (!onRewrite) return;
    setRewriting(i);
    try {
      await onRewrite(i);
    } finally {
      setRewriting(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {scenes.map((sc, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 14px", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>镜 {String(i + 1).padStart(2, "0")}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <IconBtn title="上移" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
              <IconBtn title="下移" disabled={i === scenes.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
              {canRewrite && (
                <IconBtn title="AI 重写本镜" disabled={rewriting !== null} onClick={() => rewrite(i)}>
                  {rewriting === i ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                </IconBtn>
              )}
              <IconBtn title="删除" danger disabled={scenes.length <= 1} onClick={() => remove(i)}><Trash2 size={13} /></IconBtn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <Field label="场景（时间·地点·内外）">
              <TextInput value={sc.heading} onChange={(e) => patch(i, { heading: e.target.value })} placeholder="日 · 咖啡馆 · 内" />
            </Field>
            <Field label="时长(秒)">
              <TextInput type="number" value={String(sc.duration_sec ?? 0)} onChange={(e) => patch(i, { duration_sec: Number(e.target.value) || 0 })} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="景别">
              <Select value={sc.shot_type ?? "medium"} onChange={(e) => patch(i, { shot_type: e.target.value as ShotType })}>
                {SHOT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="运镜">
              <Select value={sc.camera_move ?? "static"} onChange={(e) => patch(i, { camera_move: e.target.value as CameraMove })}>
                {CAMERA_MOVES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="剧情（动作 / 转折）">
            <TextArea rows={2} value={sc.summary} onChange={(e) => patch(i, { summary: e.target.value })} placeholder="这一场发生了什么" />
          </Field>
          <Field label="画面 / 分镜（怎么拍）">
            <TextArea rows={2} value={sc.shot} onChange={(e) => patch(i, { shot: e.target.value })} placeholder="景别 / 机位 / 光线 / 调度" />
          </Field>
          <Field label="台词 / 旁白">
            <TextArea rows={2} value={sc.dialogue} onChange={(e) => patch(i, { dialogue: e.target.value })} placeholder="念什么；没有就留空" />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-2)", cursor: "pointer", marginTop: 2 }}>
            <input type="checkbox" checked={sc.gen_voice !== false} onChange={(e) => patch(i, { gen_voice: e.target.checked })} />
            为本镜台词配音（取消则仅作字幕，不生成语音）
          </label>
        </div>
      ))}

      <Button variant="secondary" size="md" onClick={() => onChange([...scenes, emptyScene()])}>
        <Plus size={14} /> 添加一镜
      </Button>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, danger, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)", background: "rgba(255,255,255,0.02)",
        color: danger ? "var(--danger)" : "var(--fg-2)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
