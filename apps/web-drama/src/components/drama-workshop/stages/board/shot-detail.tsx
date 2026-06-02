"use client";

// 单镜精修侧栏 — 设计真源:screens-board.jsx `ShotDetail`。
// 全可编辑:出镜方式 / 时长 / 画面描述 / 景别·运镜 chip / 出场角色 /
// 台词配音 / 氛围关键词 / 引擎限制内联校验 / 删除。
import * as React from "react";
import { toast } from "sonner";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Mic,
  Plus,
  Wand2,
  X,
} from "lucide-react";
import { Avatar, ChipGroup, Cost, Editable } from "@/components/drama-ui";
import type { BoardShot, CharacterDef } from "@/mocks/drama-workshop";
import { EngineLimits } from "./engine-limits";
import { OverLimit } from "./shot-bits";
import { DoneToggle } from "./shot-bits";

const LENS = ["推近", "拉远", "左右摇", "跟随", "环绕", "升降", "手持", "希区柯克变焦", "固定"];
const SIZES = ["远景", "全景", "中景", "中近景", "近景", "特写", "大特写", "主观镜头", "空镜"];
const MOOD: Record<string, string[]> = {
  光影: ["逆光", "伦勃朗光", "丁达尔效应", "霓虹流光"],
  色调: ["赛博朋克", "复古胶片", "冷色调", "暖黄"],
  质感: ["电影级", "水墨感", "颗粒感", "高清写实"],
  情绪: ["温馨", "悬疑", "史诗", "压抑", "紧张"],
};

interface ShotDetailProps {
  shot: BoardShot;
  chars: CharacterDef[];
  onClose: () => void;
  onUpd: (patch: Partial<BoardShot>) => void;
  onDel: () => void;
  onPeek: () => void;
}

export function ShotDetail({ shot, chars, onClose, onUpd, onDel, onPeek }: ShotDetailProps) {
  const keyChars = chars.filter((c) => c.role === "key");
  const moods = shot.moods ?? [];
  const toggleMood = (it: string) =>
    onUpd({ moods: moods.includes(it) ? moods.filter((x) => x !== it) : [...moods, it] });
  const toggleCast = (id: string) =>
    onUpd({ cast: shot.cast.includes(id) ? shot.cast.filter((x) => x !== id) : [...shot.cast, id] });

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.18)",
          zIndex: 30,
        }}
        onClick={onClose}
      />
      <aside
        className="col scroll slide-in-r"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 384,
          maxWidth: "92%",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          zIndex: 31,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="row"
          style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-soft)" }}
        >
          <span className="num tag tag-accent" style={{ marginRight: 8 }}>
            第 {shot.no} 镜
          </span>
          <span style={{ fontWeight: 700 }}>精修</span>
          <span className="grow" />
          <DoneToggle done={shot.done} onToggle={(v) => onUpd({ done: v })} />
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={onClose}
            style={{ marginLeft: 4 }}
          >
            <X size={17} />
          </button>
        </div>
        <div className="col gap-4 scroll" style={{ padding: 18, flex: 1 }}>
          {/* 参考帧 / 分镜草图 占位 */}
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "var(--surface-2)",
              borderRadius: 12,
              border: "1.5px dashed var(--line)",
              display: "grid",
              placeItems: "center",
              color: "var(--ink-3)",
              fontSize: 12,
              gap: 6,
            }}
          >
            <ImageIcon size={22} />
            <span>拖入参考帧 / 分镜草图</span>
          </div>

          {/* 出镜方式 */}
          <div>
            <div
              className="faint"
              style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}
            >
              出镜方式
            </div>
            <div
              className="row"
              style={{
                background: "var(--surface-2)",
                borderRadius: 11,
                padding: 3,
                gap: 2,
              }}
            >
              {[
                { k: "avatar" as const, n: "数字人出镜", fg: "var(--accent)" },
                { k: "seedance" as const, n: "特效镜 · 待开通", fg: "#b45309" },
              ].map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => onUpd({ engine: o.k })}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    background:
                      shot.engine === o.k ? "var(--surface)" : "transparent",
                    color: shot.engine === o.k ? o.fg : "var(--ink-3)",
                    boxShadow:
                      shot.engine === o.k ? "var(--shadow-sm)" : "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {o.n}
                </button>
              ))}
            </div>
            {shot.engine === "avatar" && (
              <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                关键角色出镜,自动锁形象、跨集一致
              </div>
            )}
          </div>

          {/* 时长 */}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>
              时长
            </div>
            <div className="row gap-2">
              <button
                type="button"
                className="btn btn-icon btn-line btn-sm"
                style={{ width: 28, height: 28 }}
                onClick={() => onUpd({ dur: Math.max(1, shot.dur - 1) })}
              >
                <ChevronLeft size={13} />
              </button>
              <span
                className="num"
                style={{ fontWeight: 700, minWidth: 34, textAlign: "center" }}
              >
                {shot.dur}s
              </span>
              <button
                type="button"
                className="btn btn-icon btn-line btn-sm"
                style={{ width: 28, height: 28 }}
                onClick={() => onUpd({ dur: shot.dur + 1 })}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* 画面描述 */}
          <div>
            <div
              className="faint"
              style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}
            >
              画面描述
            </div>
            <textarea
              value={shot.desc}
              onChange={(e) => onUpd({ desc: e.target.value })}
              placeholder="写这一镜的画面描述…"
              style={{
                width: "100%",
                minHeight: 70,
                border: "1.5px solid var(--line)",
                borderRadius: 11,
                padding: 11,
                fontSize: 13.5,
                resize: "vertical",
                outline: "none",
                background: "var(--surface-2)",
                color: "var(--ink)",
                lineHeight: 1.55,
                fontFamily: "var(--font)",
              }}
            />
          </div>

          <ChipGroup
            label="景别(灵感速查)"
            items={SIZES}
            value={shot.size}
            onToggle={(v) => onUpd({ size: v })}
          />
          <ChipGroup
            label="运镜"
            items={LENS}
            value={shot.move}
            onToggle={(v) => onUpd({ move: v })}
          />

          {/* 出场角色 */}
          <div className="col gap-2">
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>
              出场角色(点选引用其数字人形象)
            </div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {keyChars.map((c) => {
                const on = shot.cast.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCast(c.id)}
                    className="row gap-2"
                    style={{
                      padding: "3px 10px 3px 3px",
                      borderRadius: 999,
                      gap: 6,
                      background: on ? "var(--accent-soft)" : "var(--surface-2)",
                      border: on
                        ? "1.5px solid var(--accent)"
                        : "1.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar theme={c.avatar} size={22} bound={c.bound} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: on ? "var(--accent)" : "var(--ink-2)",
                      }}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 台词 / 配音 */}
          <div className="col gap-2">
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>
              台词 / 配音指令
            </div>
            {shot.line ? (
              <div
                className="row gap-2 card"
                style={{
                  padding: 10,
                  background: "var(--surface-2)",
                  border: "none",
                  alignItems: "flex-start",
                }}
              >
                <Mic
                  size={15}
                  style={{ color: "var(--ink-3)", flex: "none", marginTop: 2 }}
                />
                <div className="grow" style={{ fontSize: 13 }}>
                  <b>
                    <Editable
                      value={shot.line.who}
                      placeholder="角色"
                      onCommit={(v) => onUpd({ line: { ...shot.line!, who: v } })}
                    />
                  </b>
                  :「
                  <Editable
                    value={shot.line.text}
                    placeholder="台词"
                    onCommit={(v) => onUpd({ line: { ...shot.line!, text: v } })}
                  />
                  」
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm"
                  style={{ width: 24, height: 24 }}
                  onClick={() => onUpd({ line: null })}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="chip"
                style={{ alignSelf: "flex-start" }}
                onClick={() =>
                  onUpd({
                    line: {
                      who: keyChars[0]?.name ?? "旁白",
                      text: "",
                    },
                  })
                }
              >
                <Plus size={12} /> 加台词
              </button>
            )}
            <textarea
              value={shot.voice ?? ""}
              onChange={(e) => onUpd({ voice: e.target.value })}
              placeholder="配音 / 音效指令,如:低沉弦乐 + 雨声"
              style={{
                width: "100%",
                minHeight: 44,
                border: "1.5px solid var(--line)",
                borderRadius: 11,
                padding: 10,
                fontSize: 12.5,
                resize: "vertical",
                outline: "none",
                background: "var(--surface-2)",
                color: "var(--ink)",
                fontFamily: "var(--font)",
              }}
            />
          </div>

          {/* 氛围关键词 */}
          <div className="col gap-3">
            <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>
              氛围关键词
            </div>
            {Object.entries(MOOD).map(([k, items]) => (
              <ChipGroup
                key={k}
                label={k}
                items={items}
                value={moods}
                multi
                onToggle={toggleMood}
              />
            ))}
          </div>

          {shot.overLimit && <OverLimit />}
          <EngineLimits shot={shot} />

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: "flex-start", color: "#dc2626" }}
            onClick={onDel}
          >
            <X size={14} /> 删除这一镜
          </button>
        </div>
        <div
          className="row gap-3"
          style={{ padding: 16, borderTop: "1px solid var(--line-soft)" }}
        >
          <button
            type="button"
            className="btn btn-line btn-sm grow"
            onClick={() => toast.success("已按编辑标签重写本镜")}
          >
            <Wand2 size={14} /> 换个说法重写 <Cost n={4} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onPeek}>
            <Box size={14} /> 看配方
          </button>
        </div>
      </aside>
    </>
  );
}
