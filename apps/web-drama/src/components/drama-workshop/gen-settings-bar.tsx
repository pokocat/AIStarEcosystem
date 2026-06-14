"use client";

// 生成设置栏 — 设计真源 v4 screens-factory-v4.jsx `GenSettingsBar`:
// 模型 / 画幅比 / 分辨率 + @素材参考(打通素材库)。
// 注:单镜时长不在此设置 —— 时长由分镜逐镜累计得来,这里调全局时长无意义(已移除);生成数量同除。
import * as React from "react";
import { Check, ChevronDown, Mic, Play, Sliders, Sparkles, Users, X, Zap } from "lucide-react";
import { MAT_CATS, MATERIALS, type Material } from "@/mocks/drama-workshop";

interface GenModel {
  id: string;
  name: string;
  tag: string;
  icon: React.ElementType;
}

const GEN_MODELS: GenModel[] = [
  { id: "m4", name: "Master V4.0", tag: "综合最强 · 推荐", icon: Sparkles },
  { id: "m35", name: "Master V3.5", tag: "稳定均衡", icon: Sparkles },
  { id: "av2", name: "数字人 Avatar V2", tag: "口播/出镜最佳", icon: Mic },
  { id: "turbo", name: "极速 Turbo", tag: "快 · 省积分", icon: Zap },
];
const GEN_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "Auto"];
const GEN_RES: { k: string; pro?: boolean }[] = [{ k: "480p" }, { k: "720p" }, { k: "1080p", pro: true }];

function RatioGlyph({ r, on }: { r: string; on: boolean }) {
  const col = on ? "#fff" : "var(--ink-3)";
  if (r === "Auto") {
    return <span style={{ width: 22, height: 22, border: `1.6px dashed ${col}`, borderRadius: 5, display: "block" }} />;
  }
  const [w, h] = r.split(":").map(Number);
  const W = w >= h ? 22 : Math.round((22 * w) / h);
  const H = h >= w ? 22 : Math.round((22 * h) / w);
  return <span style={{ width: W, height: H, border: `1.6px solid ${col}`, borderRadius: 4, display: "block" }} />;
}

export interface GenSettingsBarProps {
  defaultRatio?: string;
  refs: Material[];
  setRefs: (next: Material[]) => void;
}

export function GenSettingsBar({ defaultRatio, refs, setRefs }: GenSettingsBarProps) {
  const [open, setOpen] = React.useState(false);
  const [pick, setPick] = React.useState(false);
  const [tab, setTab] = React.useState("人物");
  const [model, setModel] = React.useState(GEN_MODELS[0]);
  const [ratio, setRatio] = React.useState(defaultRatio ?? "Auto");
  const [res, setRes] = React.useState("480p");
  const mats = MATERIALS;
  const cats = MAT_CATS.map((c) => c.key);
  const has = (id: string) => refs.some((x) => x.id === id);
  const toggleRef = (a: Material) => setRefs(has(a.id) ? refs.filter((x) => x.id !== a.id) : [...refs, a]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
      {/* 汇总条 */}
      <div className="row gap-2" style={{ padding: "10px 12px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="row gap-2"
          onClick={() => {
            setOpen(!open);
            setPick(false);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 11,
            background: open ? "var(--accent-soft)" : "var(--surface-2)",
            color: open ? "var(--accent)" : "var(--ink)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <Sliders size={15} />
          {model.name}
          <span className="faint num" style={{ fontWeight: 600 }}>
            · {ratio} · {res}
          </span>
          <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
        <span className="grow" />
        <button
          type="button"
          className="chip"
          onClick={() => {
            setPick(!pick);
            setOpen(false);
          }}
          style={{
            background: pick || refs.length ? "var(--accent-soft)" : "var(--surface-2)",
            color: pick || refs.length ? "var(--accent)" : "var(--ink-2)",
            fontWeight: 700,
          }}
        >
          <Users size={14} /> @ 素材参考{refs.length ? ` · ${refs.length}` : ""}
        </button>
      </div>

      {/* 已选参考 chips */}
      {refs.length > 0 && (
        <div className="row gap-2" style={{ padding: "0 12px 10px", flexWrap: "wrap" }}>
          {refs.map((a) => (
            <span
              key={a.id}
              className="row gap-2"
              style={{ padding: "4px 6px 4px 4px", borderRadius: 999, background: "var(--surface-2)", fontSize: 12, fontWeight: 600 }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: a.cat === "场景" ? 5 : "50%",
                  background: `linear-gradient(140deg,${a.from},${a.to})`,
                  flex: "none",
                }}
              />
              @{a.name}
              <span className="faint" style={{ fontSize: 10 }}>{a.cat ?? ""}</span>
              <button type="button" onClick={() => toggleRef(a)} style={{ color: "var(--ink-3)", display: "grid", placeItems: "center" }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* @素材选择器(按类型标签,打通素材库) */}
      {pick && (
        <div style={{ borderTop: "1px solid var(--line-soft)", background: "var(--surface-2)", padding: "12px 14px" }}>
          <div className="row gap-2" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            <div className="row" style={{ background: "var(--surface)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  onClick={() => setTab(c)}
                  style={{
                    height: 26,
                    background: tab === c ? "var(--accent-soft)" : "transparent",
                    color: tab === c ? "var(--accent)" : "var(--ink-3)",
                    fontWeight: 700,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="faint" style={{ fontSize: 11 }}>来自素材库 · 选中后作为生成参考</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
            {mats
              .filter((m) => m.cat === tab)
              .map((a) => {
                const on = has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleRef(a)}
                    className="row gap-2"
                    style={{
                      padding: "7px 9px",
                      borderRadius: 11,
                      textAlign: "left",
                      border: on ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 24,
                        borderRadius: 6,
                        background: `linear-gradient(140deg,${a.from},${a.to})`,
                        flex: "none",
                        position: "relative",
                      }}
                    >
                      {a.kind === "video" && (
                        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                          <Play size={9} fill="#fff" strokeWidth={0} />
                        </span>
                      )}
                      {on && (
                        <span
                          style={{
                            position: "absolute",
                            right: -3,
                            bottom: -3,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            display: "grid",
                            placeItems: "center",
                            border: "2px solid var(--surface)",
                            color: "#fff",
                          }}
                        >
                          <Check size={8} />
                        </span>
                      )}
                    </span>
                    <span className="col" style={{ minWidth: 0, gap: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.name}
                      </span>
                      <span className="faint" style={{ fontSize: 9.5 }}>
                        {a.kind === "video" ? "视频" : "图片"}
                        {(a.tags ?? []).length ? " · " + a.tags![0] : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            {mats.filter((m) => m.cat === tab).length === 0 && (
              <span className="faint" style={{ fontSize: 12, padding: "8px 2px" }}>
                素材库里还没有「{tab}」类素材
              </span>
            )}
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {open && (
        <div className="col gap-4" style={{ borderTop: "1px solid var(--line-soft)", padding: "14px 16px 16px" }}>
          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>生成模型</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {GEN_MODELS.map((m) => {
                const on = model.id === m.id;
                const MIcon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m)}
                    className="row gap-2"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 11,
                      border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                      textAlign: "left",
                    }}
                  >
                    <MIcon size={15} style={{ color: on ? "var(--accent)" : "var(--ink-3)" }} />
                    <span className="col" style={{ gap: 0, lineHeight: 1.25 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? "var(--accent)" : "var(--ink)" }}>{m.name}</span>
                      <span className="faint" style={{ fontSize: 10 }}>{m.tag}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>画幅比</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {GEN_RATIOS.map((r) => {
                const on = ratio === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className="col center gap-1"
                    style={{ width: 62, padding: "9px 0", borderRadius: 11, background: on ? "var(--ink)" : "var(--surface-2)", color: on ? "#fff" : "var(--ink-2)" }}
                  >
                    <RatioGlyph r={r} on={on} />
                    <span className="num" style={{ fontSize: 11, fontWeight: 700 }}>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>分辨率</span>
            <div className="row gap-2">
              {GEN_RES.map((o) => {
                const on = res === o.k;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setRes(o.k)}
                    className="row gap-2 grow"
                    style={{
                      justifyContent: "center",
                      height: 40,
                      borderRadius: 11,
                      background: on ? "var(--ink)" : "var(--surface-2)",
                      color: on ? "#fff" : "var(--ink-2)",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {o.k}
                    {o.pro && (
                      <span
                        className="num"
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "1px 5px",
                          borderRadius: 5,
                          background: on ? "rgba(255,255,255,.2)" : "var(--accent-2-soft)",
                          color: on ? "#fff" : "var(--accent-2)",
                        }}
                      >
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
