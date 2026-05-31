"use client";

// 角色管理（v0.45）：增删改 + 绑定「演员 IP 阵容」(/cast 数字人) 作为角色，生成时带入演员形象。
import * as React from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/premium";
import { Field, Select, TextArea, TextInput, EmptyState } from "@/components/common";
import type { DramaCharacter } from "@/api/short-drama";

export interface CastOption {
  id: string;
  name: string;
  avatar?: string;
}

const ROLES = [
  { value: "male_lead", label: "男主" },
  { value: "female_lead", label: "女主" },
  { value: "supporting", label: "配角" },
  { value: "antagonist", label: "反派" },
  { value: "cameo", label: "客串" },
];

function newCharacter(idx: number): DramaCharacter {
  return { id: `ch_${Date.now()}_${idx}`, name: "", role: "supporting", appearance: "" };
}

export function CharacterPanel({
  characters,
  onChange,
  castOptions,
}: {
  characters: DramaCharacter[];
  onChange: (next: DramaCharacter[]) => void;
  castOptions: CastOption[];
}) {
  function patch(i: number, p: Partial<DramaCharacter>) {
    onChange(characters.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  }
  function bindCast(i: number, castId: string) {
    if (!castId) {
      patch(i, { cast_id: undefined, cast_name: undefined, cast_avatar: undefined });
      return;
    }
    const cast = castOptions.find((c) => c.id === castId);
    if (!cast) return;
    const c = characters[i];
    patch(i, {
      cast_id: cast.id,
      cast_name: cast.name,
      cast_avatar: cast.avatar,
      // 形象为空时用演员名带入，便于生成提示词
      appearance: c.appearance && c.appearance.trim() ? c.appearance : `由演员「${cast.name}」出演`,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {characters.length === 0 && (
        <EmptyState icon={<UserPlus size={26} />} title="还没有角色" description="添加角色并绑定演员阵容里的虚拟演员，生成时会带入演员形象。" />
      )}
      {characters.map((c, i) => (
        <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 14px", background: "var(--surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {c.cast_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cast_avatar} alt={c.cast_name ?? ""} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", fontSize: 12 }}>
                {(c.name || "角").slice(0, 1)}
              </div>
            )}
            <div style={{ flex: 1, fontSize: 12.5, color: "var(--fg-2)" }}>
              {c.cast_name ? <span>已绑定演员 · <b style={{ color: "var(--fg-0)" }}>{c.cast_name}</b></span> : "未绑定演员"}
            </div>
            <button
              type="button"
              title="删除角色"
              onClick={() => onChange(characters.filter((_, idx) => idx !== i))}
              style={{ display: "inline-flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--danger)", cursor: "pointer" }}
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <Field label="角色名">
              <TextInput value={c.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="如：陆烬" />
            </Field>
            <Field label="角色定位">
              <Select value={c.role ?? "supporting"} onChange={(e) => patch(i, { role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="绑定演员（来自演员 IP 阵容）" hint={castOptions.length === 0 ? "暂无可用演员，可先去「演员 IP 阵容」孵化" : undefined}>
            <Select value={c.cast_id ?? ""} onChange={(e) => bindCast(i, e.target.value)}>
              <option value="">不绑定（仅用文字形象）</option>
              {castOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>

          <Field label="形象描述" hint="生成视频时带入；绑定演员后可自动填充">
            <TextArea rows={2} value={c.appearance ?? ""} onChange={(e) => patch(i, { appearance: e.target.value })} placeholder="年龄 / 气质 / 穿搭 / 标志特征" />
          </Field>
        </div>
      ))}

      <Button variant="secondary" size="md" onClick={() => onChange([...characters, newCharacter(characters.length)])}>
        <Plus size={14} /> 添加角色
      </Button>
    </div>
  );
}
