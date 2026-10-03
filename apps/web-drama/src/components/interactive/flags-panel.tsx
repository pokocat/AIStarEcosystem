"use client";

// 剧情状态（globalFlags）面板（v0.79）。只添加真正影响走向的状态（拿没拿到钥匙 / 好感度等）+ 开始时的值。
// 弹出条件 / 选项里「选了之后记下」用到的状态必须先在这里添加（检查会拦住没添加的）。
// v0.197：名字允许中文（之前正则只留 A-Z0-9_，输入「钥匙」点添加没反应也不报错）；界面不再出现 condition / setFlags / 布尔。
// v0.197 评审 WB6 / WB7：删一条还有地方在用的状态，先列出用在哪几处再确认；改了类型之后，
// 还按旧类型填的那几处在这一行下面直接说出来（「检查」里也会逐条列）。
import * as React from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import type { FlagValue } from "@/lib/interactive-types";
import { FLAG_NAME_STRIP, flagKindOf as kindOf, type FlagKind, type FlagUsage } from "@/lib/interactive-graph";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";

interface Props {
  flags: Record<string, FlagValue>;
  onChange: (flags: Record<string, FlagValue>) => void;
  /** 这条状态用在哪几处（弹出条件 / 选项记下 / 填空记录）。不传就不做引用提示。 */
  usagesOf?: (key: string) => FlagUsage[];
}

/** 确认框里最多列几处，再多就说「等 N 处」。 */
const USAGE_LIST_MAX = 6;

const INPUT: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "5px 8px",
  fontSize: 12.5,
  background: "var(--surface-2)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
  minWidth: 0,
};

export function FlagsPanel({ flags, onChange, usagesOf }: Props) {
  const [newName, setNewName] = React.useState("");
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const entries = Object.entries(flags);

  const setFlag = (key: string, value: FlagValue) => onChange({ ...flags, [key]: value });
  const removeFlag = async (key: string) => {
    const used = usagesOf?.(key) ?? [];
    if (used.length > 0) {
      const shown = used.slice(0, USAGE_LIST_MAX);
      const ok = await dramaConfirm({
        title: `删除「${key}」？`,
        body: (
          <div className="col gap-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>这些地方还在用它，删掉后要去改掉，不然「检查」会报错：</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {shown.map((u, i) => (
                <li key={i}>{u.label}</li>
              ))}
            </ul>
            {used.length > shown.length && <div className="faint">等 {used.length} 处</div>}
          </div>
        ),
        confirmLabel: "仍然删除",
        cancelLabel: "先保留",
        tone: "danger",
      });
      if (!ok) return;
    }
    const next = { ...flags };
    delete next[key];
    onChange(next);
  };
  const changeKind = (key: string, kind: FlagKind) => {
    const def: FlagValue = kind === "boolean" ? false : kind === "number" ? 0 : "";
    setFlag(key, def);
  };
  const addFlag = () => {
    const name = newName.trim().replace(FLAG_NAME_STRIP, "");
    if (!name) {
      setNameErr("名字只能用文字、数字和下划线，不能有空格和标点");
      return;
    }
    if (flags[name] !== undefined) {
      setNameErr(`已经有「${name}」了`);
      return;
    }
    onChange({ ...flags, [name]: false });
    setNewName("");
    setNameErr(null);
  };

  return (
    <div className="col gap-3">
      <div className="col gap-1">
        <div className="row gap-2">
          <Flag size={15} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>剧情状态</span>
        </div>
        <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          记住观众做过的选择，比如拿没拿到钥匙、好感度多少。互动点的弹出条件和选项都会用到。
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          还没有剧情状态。剧情里要记住「拿没拿到钥匙」「好感度多少」这类事，就加一条。
        </div>
      ) : (
        <div className="col gap-2">
          {entries.map(([key, value]) => {
            const kind = kindOf(value);
            const stale = (usagesOf?.(key) ?? []).filter((u) => u.stale).length;
            return (
              <div key={key} className="col gap-1">
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  <span
                    style={{ fontWeight: 700, fontSize: 12.5, minWidth: 0, maxWidth: 140, flex: "1 1 90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={key}
                  >
                    {key}
                  </span>
                  <select value={kind} aria-label={`「${key}」记的是什么`} onChange={(e) => changeKind(key, e.target.value as FlagKind)} style={{ ...INPUT, width: 78 }}>
                    <option value="boolean">是否</option>
                    <option value="number">数字</option>
                    <option value="string">文字</option>
                  </select>
                  <span className="faint" style={{ fontSize: 11, flex: "none" }}>开始时</span>
                  {kind === "boolean" ? (
                    <select
                      value={String(value)}
                      aria-label={`「${key}」开始时`}
                      onChange={(e) => setFlag(key, e.target.value === "true")}
                      style={{ ...INPUT, width: 64 }}
                    >
                      <option value="false">否</option>
                      <option value="true">是</option>
                    </select>
                  ) : kind === "number" ? (
                    <input
                      type="number"
                      aria-label={`「${key}」开始时`}
                      value={Number(value)}
                      onChange={(e) => setFlag(key, Number(e.target.value) || 0)}
                      style={{ ...INPUT, width: 80 }}
                    />
                  ) : (
                    <input aria-label={`「${key}」开始时`} value={String(value)} onChange={(e) => setFlag(key, e.target.value)} style={{ ...INPUT, width: 120 }} />
                  )}
                  <button type="button" className="btn btn-icon btn-ghost btn-sm wb-touch-icon" title="删除这条剧情状态" aria-label={`删除「${key}」`} onClick={() => void removeFlag(key)} style={{ flex: "none" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                {stale > 0 && (
                  <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--danger)" }}>
                    有 {stale} 处条件或选项还是按原来的类型填的，要重新设。「检查」里能看到是哪几处。
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="col gap-1">
        <div className="row gap-2">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (nameErr) setNameErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFlag();
              }
            }}
            placeholder="名字，比如：拿到钥匙"
            aria-label="新剧情状态的名字"
            style={{ ...INPUT, flex: 1 }}
          />
          <button type="button" className="btn btn-line btn-sm" onClick={addFlag} disabled={!newName.trim()} style={{ flex: "none" }}>
            <Plus size={13} /> 添加
          </button>
        </div>
        {nameErr && <span style={{ fontSize: 11.5, color: "var(--danger)" }}>{nameErr}</span>}
      </div>
    </div>
  );
}
