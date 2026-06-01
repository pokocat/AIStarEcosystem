"use client";

// 选内容类型 — 设计真源:screens-entry.jsx `PickType`。
// 类型决定故事骨架、画幅和镜头风格。
import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { CONTENT_TYPES, type ContentType } from "@/mocks/drama-workshop";

interface PickTypeProps {
  onPick: (t: ContentType) => void;
}

export function PickType({ onPick }: PickTypeProps) {
  const [q, setQ] = React.useState("");
  const list = CONTENT_TYPES.filter(
    (t) => !q || t.name.includes(q) || t.desc.includes(q),
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 0 60px" }}>
      <div className="col center" style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "-.02em",
          }}
        >
          想拍哪一类?
        </h1>
        <div className="muted" style={{ marginTop: 6, maxWidth: 460 }}>
          类型决定故事骨架、画幅和镜头风格。选错也没关系,后面随时能调。
        </div>
        <div
          className="row card"
          style={{
            marginTop: 18,
            padding: "0 14px",
            height: 42,
            width: 320,
            gap: 8,
            borderRadius: 999,
          }}
        >
          <Search size={17} style={{ color: "var(--ink-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索类型…"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              flex: 1,
              fontSize: 14,
              fontFamily: "var(--font)",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(244px,1fr))",
          gap: 18,
        }}
      >
        {list.map((t, i) => (
          <TypeCard key={t.key} t={t} delay={i * 30} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function TypeCard({
  t,
  delay,
  onPick,
}: {
  t: ContentType;
  delay: number;
  onPick: (t: ContentType) => void;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => onPick(t)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card col fade-up"
      style={{
        padding: 0,
        overflow: "hidden",
        textAlign: "left",
        animationDelay: delay + "ms",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        transition: "transform .18s, box-shadow .18s",
        cursor: "pointer",
      }}
    >
      <Thumb
        from={t.from}
        to={t.to}
        ratio="16/7"
        radius={0}
        stripes={!t.plain}
        style={{ width: "100%" }}
      >
        {t.plain && (
          <Plus
            size={28}
            style={{ color: "rgba(255,255,255,.92)", position: "relative", zIndex: 1 }}
          />
        )}
      </Thumb>
      <div className="col gap-2" style={{ padding: 15 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>{t.desc}</div>
        <div className="row gap-2" style={{ marginTop: 4 }}>
          <span className="tag tag-gray">{t.ratio}</span>
          <span className="tag tag-gray">{t.pace}</span>
        </div>
      </div>
    </button>
  );
}
