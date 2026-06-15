"use client";

// 运营侧 · 配方骨架可视化（option 1）。把一条 DramaRecipe 的 payload
// （mainline / beats / characters / hooks / notes）画成时间线 + 角色卡 + 钩子标签，
// 比纯文字折叠更一目了然。仅运营审核 / 已上架巡检使用 —— 不在创意市场对用户外露 payload。
import * as React from "react";
import { GitBranch, ListOrdered, Sparkles, Users } from "lucide-react";
import type { RecipeData } from "@/api/recipes";

const ROLE_LABEL: Record<string, string> = { key: "主角", extra: "配角" };

function Block({ icon, title, count, children }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="col gap-2">
      <div className="row gap-1" style={{ alignItems: "center" }}>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{title}</span>
        {count != null && <span className="faint num" style={{ fontSize: 11 }}>· {count}</span>}
      </div>
      {children}
    </div>
  );
}

export function RecipeSkeletonView({ data }: { data: RecipeData }) {
  const mainline = data.mainline?.trim();
  const mainlineSteps = mainline?.includes(" → ") ? mainline.split(" → ").map((s) => s.trim()).filter(Boolean) : null;

  return (
    <div className="col gap-3" style={{ padding: "12px 12px 14px", background: "var(--surface)", borderRadius: 10 }}>
      {/* 主线模板 */}
      <Block icon={<GitBranch size={13} />} title="主线模板">
        {mainlineSteps ? (
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {mainlineSteps.map((s, i) => (
              <React.Fragment key={i}>
                <span className="tag tag-accent" style={{ fontSize: 11.5 }}>{s}</span>
                {i < mainlineSteps.length - 1 && <span className="faint" style={{ fontSize: 11.5, alignSelf: "center" }}>→</span>}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, lineHeight: 1.6, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, borderLeft: "3px solid var(--accent)" }}>
            {mainline || "—"}
          </div>
        )}
      </Block>

      {/* 分集节拍时间线 */}
      {data.beats.length > 0 && (
        <Block icon={<ListOrdered size={13} />} title="分集节拍" count={data.beats.length}>
          <div className="col" style={{ position: "relative", paddingLeft: 22 }}>
            <span style={{ position: "absolute", left: 9, top: 6, bottom: 6, width: 2, background: "var(--line-soft)" }} />
            {data.beats.map((b) => (
              <div key={b.no} className="row gap-2" style={{ alignItems: "flex-start", paddingBottom: 8 }}>
                <span
                  className="num"
                  style={{
                    position: "absolute", left: 0, width: 20, height: 20, borderRadius: "50%",
                    background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
                  }}
                >
                  {b.no}
                </span>
                <div className="col" style={{ gap: 1, minWidth: 0 }}>
                  {b.hook && <span style={{ fontSize: 12, fontWeight: 700 }}>{b.hook}</span>}
                  {b.beat && <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{b.beat}</span>}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* 角色原型卡 */}
      {data.characters.length > 0 && (
        <Block icon={<Users size={13} />} title="角色原型" count={data.characters.length}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {data.characters.map((c, i) => (
              <div key={i} className="col gap-1" style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                <div className="row gap-1" style={{ alignItems: "center" }}>
                  <span className={c.role === "key" ? "tag tag-accent" : "tag tag-gray"} style={{ fontSize: 10 }}>
                    {ROLE_LABEL[c.role] || c.role}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{c.archetype || "—"}</span>
                </div>
                {c.desc && <span className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>{c.desc}</span>}
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* 关键钩子 */}
      {data.hooks.length > 0 && (
        <Block icon={<Sparkles size={13} />} title="关键钩子" count={data.hooks.length}>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {data.hooks.map((h, i) => (
              <span key={i} className="tag" style={{ fontSize: 11, background: "var(--accent-soft, rgba(124,58,237,0.12))", color: "var(--accent)" }}>
                {h}
              </span>
            ))}
          </div>
        </Block>
      )}

      {/* 套用建议 */}
      {data.notes?.trim() && (
        <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap", paddingTop: 2, borderTop: "1px dashed var(--line-soft)" }}>
          <b>套用建议：</b>{data.notes.trim()}
        </div>
      )}
    </div>
  );
}
