"use client";

export const dynamic = "force-dynamic";

// 戏服与道具（v0.197：侧栏「即将上线」分组）。
// 如实标注：这一页的上传原来是 setTimeout 假上传（只存在组件 state 里，刷新就没了，却提示「已加入素材库」），
// 「分配给演员」永远是灰的、分配弹窗永远打不开，「稀有度 S/A/B/C 类」是游戏概念 → 全部去掉。
// 上传禁用并说明「服装参考图先传到素材库」，给去素材库的按钮。服装目录本身读 /wardrobe/items（真接口）。
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Info, Search, Shirt, Upload } from "lucide-react";
import type { ClothingItem } from "@ai-star-eco/types/wardrobe";
import { Button, Card, Chip } from "@/components/premium";
import { EmptyState, ErrorBlock, LoadingBlock, ViewHeader } from "@/components/common";
import { WardrobeApi } from "@/api";
import { useAsync } from "@/lib/drama-query";

type Kind = "all" | "top" | "bottom" | "accessory" | "shoes" | "hair";

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: "all", label: "全部" },
  { id: "top", label: "上衣" },
  { id: "bottom", label: "下装" },
  { id: "shoes", label: "鞋子" },
  { id: "accessory", label: "配饰" },
  { id: "hair", label: "发型" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label]));

export default function WardrobePage() {
  return (
    <React.Suspense fallback={null}>
      <WardrobeInner />
    </React.Suspense>
  );
}

function WardrobeInner() {
  const sp = useSearchParams();
  const rawKind = sp.get("kind");
  const kindInit: Kind = KINDS.some((k) => k.id === rawKind) ? (rawKind as Kind) : "all";
  const [kind, setKind] = React.useState<Kind>(kindInit);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    window.history.replaceState(null, "", `/wardrobe${params.toString() ? `?${params}` : ""}`);
  }, [kind]);

  const itemsQ = useAsync<ClothingItem[]>("/wardrobe/items", () => WardrobeApi.listClothing());
  const items = itemsQ.data ?? [];

  const filtered = items.filter((it) => {
    if (kind !== "all" && it.category !== kind) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!it.name.toLowerCase().includes(needle) && !it.tags.some((t) => t.toLowerCase().includes(needle)))
        return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="即将上线"
        title={
          <>
            戏服{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              与道具
            </span>
          </>
        }
        meta={`${items.length} 件服装参考`}
        action={
          <Button variant="ghost" size="md" disabled title="上传还没接通" style={{ flex: "none", opacity: 0.55, cursor: "not-allowed" }}>
            <Upload size={14} />
            上传服装图
          </Button>
        }
      />

      {/* 如实说明：上传没接通，先传素材库 */}
      <div
        className="card row gap-3"
        style={{
          padding: "12px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--line-soft)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Info size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          这一页的上传还没接通，传了也不会保存。服装参考图先传到<b style={{ color: "var(--ink)" }}>素材库</b>：类型选「其他」，标签写「服装」。道具也放素材库，类型选「道具」。
        </div>
        <Link href="/assets" style={{ textDecoration: "none", flex: "none" }}>
          <button type="button" className="btn btn-grad btn-sm">
            去素材库上传 <ArrowRight size={13} />
          </button>
        </Link>
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Search size={14} color="var(--fg-2)" style={{ flex: "none" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜名称或标签"
              aria-label="搜索服装"
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className="mk-tap"
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </Card>

      {itemsQ.isLoading && <LoadingBlock rows={3} height={140} />}
      {!!itemsQ.error && <ErrorBlock onRetry={itemsQ.refetch} />}
      {!itemsQ.isLoading && !itemsQ.error && filtered.length === 0 && (
        <EmptyState
          icon={<Shirt size={28} />}
          title={items.length === 0 ? "还没有服装参考" : "没有匹配的服装"}
          description={items.length === 0 ? "服装参考图先传到素材库。" : "换个分类或关键词试试。"}
        />
      )}
      {!itemsQ.isLoading && filtered.length > 0 && (
        <div className="mk-wd-grid">
          {filtered.map((it) => (
            <Card
              key={it.id}
              style={{
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 160,
                  background: it.imageUrl
                    ? `url(${JSON.stringify(it.imageUrl)}) center/cover`
                    : "linear-gradient(135deg, rgba(212,175,106,0.25), rgba(164,76,255,0.18))",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 4 }}>
                  {it.isNew && <Chip tone="success">新</Chip>}
                  {it.isTrending && <Chip tone="violet">热门</Chip>}
                </div>
              </div>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div
                  title={it.name}
                  style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {it.name}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[KIND_LABEL[it.category] ?? "", ...it.tags.slice(0, 3)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
