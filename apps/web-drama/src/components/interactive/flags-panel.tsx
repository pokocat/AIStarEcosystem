"use client";

// 全局标记（globalFlags）声明面板（v0.79）。只声明真正影响走向的标记（道具 / 好感度等）+ 初值。
// condition / setFlags 引用的标记必须先在此声明（校验会拦未声明引用）。
import * as React from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import type { FlagValue } from "@/lib/interactive-types";

interface Props {
  flags: Record<string, FlagValue>;
  onChange: (flags: Record<string, FlagValue>) => void;
}

type FlagKind = "boolean" | "number" | "string";

function kindOf(v: FlagValue): FlagKind {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  return "string";
}

const INPUT: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "5px 8px",
  fontSize: 12.5,
  background: "var(--surface-2)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
};

export function FlagsPanel({ flags, onChange }: Props) {
  const [newName, setNewName] = React.useState("");
  const entries = Object.entries(flags);

  const setFlag = (key: string, value: FlagValue) => onChange({ ...flags, [key]: value });
  const removeFlag = (key: string) => {
    const next = { ...flags };
    delete next[key];
    onChange(next);
  };
  const changeKind = (key: string, kind: FlagKind) => {
    const def: FlagValue = kind === "boolean" ? false : kind === "number" ? 0 : "";
    setFlag(key, def);
  };
  const addFlag = () => {
    const name = newName.trim().replace(/[^A-Za-z0-9_]/g, "");
    if (!name || flags[name] !== undefined) return;
    onChange({ ...flags, [name]: false });
    setNewName("");
  };

  return (
    <div className="col gap-3">
      <div className="row gap-2">
        <Flag size={15} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 800, fontSize: 14 }}>全局标记</span>
        <span className="faint" style={{ fontSize: 11 }}>影响走向的道具 / 状态（condition / 选项 setFlags 据此判定）</span>
      </div>

      {entries.length === 0 ? (
        <div className="faint" style={{ fontSize: 12.5 }}>还没有声明标记。如有「钥匙 / 好感度」之类影响分支的状态，在此声明。</div>
      ) : (
        <div className="col gap-2">
          {entries.map(([key, value]) => {
            const kind = kindOf(value);
            return (
              <div key={key} className="row gap-2" style={{ flexWrap: "wrap" }}>
                <span className="num" style={{ fontWeight: 700, fontSize: 12.5, minWidth: 90 }}>{key}</span>
                <select value={kind} onChange={(e) => changeKind(key, e.target.value as FlagKind)} style={{ ...INPUT, width: 78 }}>
                  <option value="boolean">布尔</option>
                  <option value="number">数值</option>
                  <option value="string">文本</option>
                </select>
                {kind === "boolean" ? (
                  <select
                    value={String(value)}
                    onChange={(e) => setFlag(key, e.target.value === "true")}
                    style={{ ...INPUT, width: 80 }}
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : kind === "number" ? (
                  <input
                    type="number"
                    value={Number(value)}
                    onChange={(e) => setFlag(key, Number(e.target.value) || 0)}
                    style={{ ...INPUT, width: 90 }}
                  />
                ) : (
                  <input value={String(value)} onChange={(e) => setFlag(key, e.target.value)} style={{ ...INPUT, width: 140 }} />
                )}
                <span className="faint" style={{ fontSize: 11 }}>初值</span>
                <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除标记" onClick={() => removeFlag(key)}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="row gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFlag();
            }
          }}
          placeholder="新标记名（字母/数字/下划线，如 hasKey）"
          style={{ ...INPUT, flex: 1 }}
        />
        <button type="button" className="btn btn-line btn-sm" onClick={addFlag} disabled={!newName.trim()}>
          <Plus size={13} /> 声明
        </button>
      </div>
    </div>
  );
}
