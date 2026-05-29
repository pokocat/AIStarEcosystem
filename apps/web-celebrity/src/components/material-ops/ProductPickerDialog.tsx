"use client";

// 新建脚本第一步 —— 强制选择关联商品（商品库由商品中心维护，预留入口）。

import * as React from "react";
import { X, Check, ArrowRight, Package, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/creator";
import { ProductsApi } from "@/api";
import { toMaterialProduct } from "@/mocks/material-ops";
import type { MaterialProduct } from "./types";
import { Eyebrow, SearchInput, ProductThumb, hexA } from "./shared";

export function ProductPickerDialog({ onClose, onPick }: { onClose: () => void; onPick: (p: MaterialProduct) => void }) {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<MaterialProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  // 拉系统全部商品（live → 真后端 /api/products；mock → 本地商品库），补展示元数据。
  React.useEffect(() => {
    ProductsApi.listProducts()
      .then((list) => setProducts(list.map(toMaterialProduct)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => !query || p.name.includes(query) || p.category.includes(query));
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const yuan = (p: MaterialProduct) => (p.priceCents ? `¥${(p.priceCents / 100).toFixed(0)}` : "—");

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 80, backdropFilter: "blur(4px)" }} />
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(820px, 92vw)",
          maxHeight: "82vh",
          zIndex: 90,
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 14, background: `linear-gradient(135deg, ${hexA("#7c5cff", "12")}, transparent 50%)` }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0, background: hexA("#7c5cff", "1f"), color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow>新建脚本</Eyebrow>
            <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 600, marginTop: 2 }}>第一步 · 选择关联商品</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 3, lineHeight: 1.5 }}>脚本必须关联一个商品 · 商品库由商品中心统一维护</div>
          </div>
          <a
            href="/products"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", background: hexA("#22b59a", "12"), border: `1px solid ${hexA("#22b59a", "44")}`, padding: "5px 10px", borderRadius: "var(--radius-pill)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "center" }}
          >
            去商品中心 <ExternalLink size={11} />
          </a>
          <Button variant="icon" size="sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <X size={14} />
          </Button>
        </div>

        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
          <SearchInput value={query} onChange={setQuery} placeholder="搜索商品名 / 类目…" />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <Loader2 size={14} className="animate-spin" /> 加载商品库…
            </div>
          )}
          <Eyebrow style={{ marginBottom: 12 }}>近期常用</Eyebrow>
          <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
            {products.slice(0, 3).map((p) => {
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    padding: "6px 14px 6px 6px",
                    borderRadius: "var(--radius-pill)",
                    background: active ? hexA(p.accentColor ?? "#7c5cff", "1f") : "var(--bg-2)",
                    border: `1px solid ${active ? p.accentColor ?? "#7c5cff" : "var(--line-2)"}`,
                    color: "var(--fg-0)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                  }}
                >
                  <ProductThumb name={p.name} image={p.images?.[0]} color={p.accentColor} size={22} radius={99} monoScale={0.5} />
                  {p.name}
                </button>
              );
            })}
          </div>

          <Eyebrow style={{ marginBottom: 12 }}>商品库 · {filtered.length} 件</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {filtered.map((p) => {
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    background: active ? hexA(p.accentColor ?? "#7c5cff", "0d") : "var(--bg-2)",
                    border: `1px solid ${active ? p.accentColor ?? "#7c5cff" : "var(--line)"}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    boxShadow: active ? `0 0 0 3px ${hexA(p.accentColor ?? "#7c5cff", "22")}` : "none",
                  }}
                >
                  <ProductThumb name={p.name} image={p.images?.[0]} color={p.accentColor} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "var(--fg-0)", fontWeight: 500 }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{p.category}</span>
                      <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 600 }}>{yuan(p)}</span>
                      <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warning)" }}>佣金 {p.commissionRate ?? "—"}%</span>
                    </div>
                  </div>
                  {active && <Check size={16} color={p.accentColor ?? "#7c5cff"} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
          {selected ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
              已选 · <span style={{ color: "var(--fg-0)" }}>{selected.name}</span>
            </span>
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>先选一个商品才能继续</span>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button variant="accent" disabled={!selected} onClick={() => selected && onPick(selected)}>
              下一步 · 进入编辑 <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
