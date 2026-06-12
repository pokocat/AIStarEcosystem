"use client";

// 快速开剧弹窗 — 设计真源 v4 screens-home-v3.jsx `QuickCreateModal3`:
// 左挑模板(封面 + 一句话描述),右看效果与估时大纲(统一预览组件),满意直接开拍。
import * as React from "react";
import { ArrowRight, Check, Wand2, X, Zap } from "lucide-react";
import { CreditButton } from "@/components/drama-ui";
import { CONTENT_TYPES, TEMPLATES, getTplMeta } from "@/mocks/drama-workshop";
import { TplPreviewBody } from "./preview-modal";
import { VideoCover } from "./video-cover";

export interface QuickCreatePayload {
  type: string;
  template: string;
  idea: string;
  derive?: boolean;
}

interface QuickCreateModalProps {
  onClose: () => void;
  onCreate: (payload: QuickCreatePayload) => void;
  onGuided: () => void;
}

export function QuickCreateModal({ onClose, onCreate, onGuided }: QuickCreateModalProps) {
  const [type, setType] = React.useState("mystery");
  const [tpl, setTpl] = React.useState(TEMPLATES.mystery[0].id);
  const [idea, setIdea] = React.useState("");
  const list = TEMPLATES[type] ?? [];
  const typeName = CONTENT_TYPES.find((t) => t.key === type)?.name;
  const cur = list.find((x) => x.id === tpl) ?? list[0];
  const meta = getTplMeta(cur);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 940, maxWidth: "96vw", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3" style={{ padding: "16px 22px 12px", flex: "none" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
              display: "grid",
              placeItems: "center",
              flex: "none",
              color: "#fff",
            }}
          >
            <Zap size={20} fill="currentColor" strokeWidth={0} />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 17 }}>快速开剧 · 套爆款模板</div>
            <div className="faint" style={{ fontSize: 12 }}>左边挑模板,右边看效果和估时大纲 —— 满意就直接开拍</div>
          </div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="row grow" style={{ minHeight: 0, alignItems: "stretch" }}>
          {/* 左:类型 + 模板列表 */}
          <div className="col scroll" style={{ flex: 1.12, minWidth: 0, padding: "2px 18px 16px 22px", gap: 12 }}>
            <div className="row gap-2" style={{ flexWrap: "wrap", flex: "none" }}>
              {CONTENT_TYPES.filter((t) => t.key !== "custom").map((t) => {
                const has = !!TEMPLATES[t.key]?.length;
                const on = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={"chip" + (on ? " on" : "")}
                    title={has ? t.desc : "该类型模板整理中"}
                    disabled={!has}
                    style={{ opacity: has ? 1 : 0.42, cursor: has ? "pointer" : "not-allowed" }}
                    onClick={() => {
                      if (has) {
                        setType(t.key);
                        setTpl(TEMPLATES[t.key][0].id);
                      }
                    }}
                  >
                    {t.name}
                    {!has && " ·待上新"}
                  </button>
                );
              })}
            </div>
            <div className="faint" style={{ fontSize: 12, fontWeight: 700 }}>
              「{typeName}」下的爆款结构 · 都是跑出来过的
            </div>
            <div className="col gap-2">
              {list.map((tp) => {
                const on = tpl === tp.id;
                const m = getTplMeta(tp);
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setTpl(tp.id)}
                    className="card row gap-3"
                    style={{ padding: 10, textAlign: "left", border: on ? "2px solid var(--accent)" : "1.5px solid var(--line-soft)", alignItems: "stretch" }}
                  >
                    <div style={{ width: 92, flex: "none", borderRadius: 10, overflow: "hidden" }}>
                      <VideoCover from={m.cover.from} to={m.cover.to} ratio="16/10" />
                    </div>
                    <div className="grow col" style={{ minWidth: 0, gap: 4, padding: "2px 0" }}>
                      <div className="row gap-2">
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{tp.name}</span>
                        <span className="faint num" style={{ fontSize: 11.5 }}>{tp.eps > 1 ? `${tp.eps} 集` : "单集"}</span>
                        {on && (
                          <span className="tag tag-accent" style={{ marginLeft: "auto" }}>
                            <Check size={11} /> 已选
                          </span>
                        )}
                      </div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {m.desc}
                      </div>
                      <div className="row gap-2" style={{ flexWrap: "wrap", marginTop: "auto" }}>
                        {tp.hooks.slice(0, 3).map((h) => (
                          <span key={h} className="tag tag-gray">{h}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右:效果预览 + 估时大纲(统一预览组件) */}
          <div className="col scroll" style={{ flex: 1, minWidth: 0, padding: "2px 22px 16px 18px", borderLeft: "1px solid var(--line-soft)" }}>
            <TplPreviewBody
              cover={meta.cover}
              title={cur.name}
              desc={meta.desc}
              tpl={cur}
              coverLabel="模板效果预览 · 同结构成片片段"
            />
          </div>
        </div>

        <div
          className="col"
          style={{ padding: "12px 22px 16px", borderTop: "1px solid var(--line-soft)", background: "var(--surface)", gap: 10, flex: "none" }}
        >
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="你的特色,可不填 —— 比如:把女主职业换成法医、故事放在 90 年代小城…"
            style={{
              height: 42,
              border: "1.5px solid var(--line)",
              borderRadius: 12,
              padding: "0 14px",
              fontSize: 13.5,
              outline: "none",
              background: "var(--surface-2)",
              width: "100%",
            }}
          />
          <div className="row gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onClose();
                onGuided();
              }}
            >
              <Wand2 size={13} /> 想从零聊出故事?用 AI 引导式 <ArrowRight size={13} />
            </button>
            <span className="grow" />
            <CreditButton
              cost={18}
              onConfirm={() => onCreate({ type, template: tpl, idea })}
              confirmTitle="套模板开剧"
              confirmBody="按所选爆款模板预填并立项新剧。"
              className="btn btn-grad"
              markSize={15}
            >
              <Zap size={16} /> 立即开剧
            </CreditButton>
          </div>
        </div>
      </div>
    </div>
  );
}
