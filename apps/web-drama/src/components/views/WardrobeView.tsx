"use client";

// 戏服与道具 · cinematic 三列布局：
//   左侧 1.0 — 已穿戴槽位（5 部位卡：发型 / 上衣 / 下装 / 鞋 / 配饰）
//   中间 1.4 — 演员预览（穿戴效果叠加）+ 套装信息条
//   右侧 1.4 — 仓库列表（搜索 + 部位标签 + 品质过滤 + 网格）

import * as React from "react";
import {
  Award,
  Crown,
  Eye,
  Filter,
  Glasses,
  Lock,
  Search,
  Shirt,
  Sparkles,
  Star,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import type {
  ClothingItem,
  EquipSlot,
  EquippedSlots,
  ClothingCategory,
} from "@ai-star-eco/types/wardrobe";
import { Button, Card, Chip } from "@/components/premium";
import {
  formatCny,
  QUALITY_GRADIENT,
  QUALITY_LABEL,
  QUALITY_TONE,
} from "@/lib/cast-derive";

interface Props {
  artists: Artist[];
  database: ClothingItem[];
}

const SLOTS: { key: EquipSlot; label: string; icon: LucideIcon }[] = [
  { key: "hair", label: "发型", icon: Sparkles },
  { key: "top", label: "上衣", icon: Shirt },
  { key: "bottom", label: "下装", icon: Shirt },
  { key: "shoes", label: "鞋", icon: Star },
  { key: "accessory", label: "配饰", icon: Glasses },
];

const CATEGORY_LABEL: Record<ClothingCategory, string> = {
  hair: "发型",
  top: "上衣",
  bottom: "下装",
  shoes: "鞋",
  accessory: "配饰",
  outfit: "套装",
};

const RARITY_TONE: Record<ClothingItem["rarity"], "accent" | "violet" | "info" | "neutral"> = {
  legendary: "accent",
  epic: "violet",
  rare: "info",
  common: "neutral",
};

const RARITY_LABEL: Record<ClothingItem["rarity"], string> = {
  legendary: "传奇",
  epic: "史诗",
  rare: "稀有",
  common: "普通",
};

const RARITY_GRADIENT: Record<ClothingItem["rarity"], string> = {
  legendary: "linear-gradient(135deg, rgba(212,175,106,0.5), rgba(234,215,168,0.3))",
  epic: "linear-gradient(135deg, rgba(164,76,255,0.5), rgba(61,224,255,0.3))",
  rare: "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(76,224,160,0.3))",
  common: "linear-gradient(135deg, rgba(86,81,106,0.5), rgba(38,31,54,0.4))",
};

type RarityFilter = "all" | ClothingItem["rarity"];
type CategoryFilter = "all" | EquipSlot;

const RARITY_FILTERS: { id: RarityFilter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "全部", icon: Filter },
  { id: "legendary", label: "传奇", icon: Crown },
  { id: "epic", label: "史诗", icon: Award },
  { id: "rare", label: "稀有", icon: Star },
  { id: "common", label: "普通", icon: Eye },
];

export function WardrobeView({ artists, database }: Props) {
  const [activeArtistId, setActiveArtistId] = React.useState(artists[0]?.id ?? "");
  const [equipped, setEquipped] = React.useState<EquippedSlots>({
    hair: database.find((c) => c.category === "hair") ?? null,
    top: database.find((c) => c.category === "top") ?? null,
    bottom: database.find((c) => c.category === "bottom") ?? null,
    shoes: database.find((c) => c.category === "shoes") ?? null,
    accessory: database.find((c) => c.category === "accessory") ?? null,
  });
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all");
  const [rarityFilter, setRarityFilter] = React.useState<RarityFilter>("all");

  const activeArtist = artists.find((a) => a.id === activeArtistId) ?? artists[0];

  const filteredDb = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return database.filter((c) => {
      if (c.category === "outfit") return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (rarityFilter !== "all" && c.rarity !== rarityFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [database, query, categoryFilter, rarityFilter]);

  function equip(item: ClothingItem) {
    if (item.isLocked) return;
    if (item.category === "outfit") return;
    setEquipped((prev) => ({ ...prev, [item.category as EquipSlot]: item }));
  }
  function unequip(slot: EquipSlot) {
    setEquipped((prev) => ({ ...prev, [slot]: null }));
  }

  const totalValue = SLOTS.reduce(
    (sum, s) => sum + (equipped[s.key]?.price ?? 0),
    0,
  );
  const equippedCount = SLOTS.filter((s) => equipped[s.key] != null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 标题 + 演员选择 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">演员造型 · 戏服与道具</div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            戏服与{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              道具
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
            {database.filter((c) => c.category !== "outfit").length} 件单品 ·
            已装备 {equippedCount} / {SLOTS.length} 部位 · 当前套装价值 {formatCny(totalValue)}
          </div>
        </div>
        <ArtistSelector artists={artists} activeId={activeArtistId} onSelect={setActiveArtistId} />
      </div>

      {/* 主体：左槽位 + 中预览 + 右仓库 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.4fr", gap: 18 }}>
        {/* 左侧已穿戴槽位 */}
        <Card style={{ padding: "22px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>已装备槽位</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SLOTS.map((slot) => {
              const item = equipped[slot.key];
              const Icon = slot.icon;
              return (
                <div
                  key={slot.key}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    background: item
                      ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    border: item
                      ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                      : "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Icon size={13} color={item ? "var(--accent)" : "var(--fg-3)"} />
                    <div
                      className="eyebrow"
                      style={{ fontSize: 10, color: item ? "var(--accent)" : "var(--fg-3)" }}
                    >
                      {slot.label}
                    </div>
                  </div>
                  {item ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--radius-sm)",
                          background: RARITY_GRADIENT[item.rarity],
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--fg-0)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}
                        >
                          {RARITY_LABEL[item.rarity]} · {formatCny(item.price)}
                        </div>
                      </div>
                      <button
                        onClick={() => unequip(slot.key)}
                        title="卸下"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--fg-3)",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>未装备</div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 22,
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: "var(--gradient-gold)",
              color: "#1a1410",
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: 0.6, opacity: 0.7, marginBottom: 4 }}
            >
              当前套装价值
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {formatCny(totalValue)}
            </div>
          </div>
        </Card>

        {/* 中间演员预览 */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              minHeight: 460,
              background: QUALITY_GRADIENT[activeArtist?.quality ?? "common"],
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.16), transparent 55%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7))",
              }}
            />

            <div style={{ position: "absolute", top: 18, left: 18, display: "flex", gap: 8 }}>
              <Chip tone={QUALITY_TONE[activeArtist?.quality ?? "common"]}>
                {QUALITY_LABEL[activeArtist?.quality ?? "common"]}
              </Chip>
              <Chip tone="neutral">LV {activeArtist?.level ?? 1}</Chip>
            </div>

            {/* 已装备物品悬浮卡片 */}
            <div
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {SLOTS.map((slot) => {
                const item = equipped[slot.key];
                if (!item) return null;
                return (
                  <div
                    key={slot.key}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: "var(--radius-pill)",
                      background: "rgba(0,0,0,0.55)",
                      border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                      fontSize: 11,
                      color: "var(--fg-0)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: RARITY_GRADIENT[item.rarity],
                      }}
                    />
                    <span className="mono" style={{ color: "var(--fg-3)", fontSize: 9 }}>
                      {slot.label}
                    </span>
                    <span style={{ color: "var(--fg-1)" }}>{item.name}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  color: "var(--fg-0)",
                }}
              >
                {activeArtist?.name ?? "未选择演员"}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 6,
                  letterSpacing: 0.4,
                }}
              >
                {equippedCount === SLOTS.length
                  ? "套装齐全 · 可保存为预设"
                  : `还差 ${SLOTS.length - equippedCount} 部位`}
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              gap: 8,
            }}
          >
            <Button
              variant="primary"
              size="sm"
              disabled={equippedCount < SLOTS.length}
              style={{ flex: 1 }}
            >
              <Wand2 size={13} /> 保存为套装预设
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setEquipped({ hair: null, top: null, bottom: null, shoes: null, accessory: null })
              }
            >
              <X size={13} /> 全部卸下
            </Button>
          </div>
        </Card>

        {/* 右侧仓库 */}
        <Card glass style={{ padding: "22px 22px", display: "flex", flexDirection: "column" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>仓库</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line-2)",
              marginBottom: 12,
            }}
          >
            <Search size={13} color="var(--fg-2)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索单品名或标签…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg-0)",
                fontSize: 12,
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            <FilterBtn active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
              全部
            </FilterBtn>
            {SLOTS.map((s) => (
              <FilterBtn
                key={s.key}
                active={categoryFilter === s.key}
                onClick={() => setCategoryFilter(s.key)}
              >
                {s.label}
              </FilterBtn>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {RARITY_FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <FilterBtn
                  key={f.id}
                  tone="violet"
                  active={rarityFilter === f.id}
                  onClick={() => setRarityFilter(f.id)}
                >
                  <Icon size={11} style={{ marginRight: 4 }} />
                  {f.label}
                </FilterBtn>
              );
            })}
          </div>

          <div
            className="mono"
            style={{ fontSize: 10.5, color: "var(--fg-2)", marginBottom: 10, letterSpacing: 0.4 }}
          >
            匹配 {filteredDb.length} 件
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              maxHeight: 580,
            }}
          >
            {filteredDb.map((item) => {
              const isEquipped =
                item.category !== "outfit" &&
                equipped[item.category as EquipSlot]?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => equip(item)}
                  disabled={item.isLocked}
                  style={{
                    background: isEquipped
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    border: isEquipped
                      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                      : "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    padding: 10,
                    textAlign: "left",
                    cursor: item.isLocked ? "not-allowed" : "pointer",
                    opacity: item.isLocked ? 0.55 : 1,
                    fontFamily: "var(--font-sans)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: "var(--radius-sm)",
                      background: RARITY_GRADIENT[item.rarity],
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45))",
                      }}
                    />
                    {item.isLocked && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Lock size={20} color="rgba(255,255,255,0.85)" />
                      </div>
                    )}
                    {item.isNew && !item.isLocked && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: "var(--gradient-gold)",
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          color: "#1a1410",
                          fontWeight: 700,
                          letterSpacing: 0.5,
                        }}
                      >
                        NEW
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--fg-0)",
                        marginBottom: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Chip tone={RARITY_TONE[item.rarity]}>{RARITY_LABEL[item.rarity]}</Chip>
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "var(--accent)",
                          marginLeft: "auto",
                          fontWeight: 600,
                        }}
                      >
                        {formatCny(item.price)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── helper 子组件 ────────────────────────────────────────────────────────

function FilterBtn({
  active,
  onClick,
  children,
  tone = "accent",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "accent" | "violet";
}) {
  const color = tone === "accent" ? "var(--accent)" : "var(--extra-violet)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: 11,
        background: active
          ? `color-mix(in srgb, ${color} 14%, transparent)`
          : "transparent",
        border: active
          ? `1px solid color-mix(in srgb, ${color} 50%, transparent)`
          : "1px solid var(--line-2)",
        color: active ? color : "var(--fg-1)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        transition: "background 160ms, border-color 160ms",
      }}
    >
      {children}
    </button>
  );
}

function ArtistSelector({
  artists,
  activeId,
  onSelect,
}: {
  artists: Artist[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const active = artists.find((a) => a.id === activeId) ?? artists[0];
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)",
          color: "var(--fg-0)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: QUALITY_GRADIENT[active?.quality ?? "common"],
          }}
        />
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{active?.name ?? "选择演员"}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--fg-2)", letterSpacing: 0.4 }}>
            {QUALITY_LABEL[active?.quality ?? "common"]}
          </div>
        </div>
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              width: 260,
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              zIndex: 31,
              padding: 8,
            }}
          >
            {artists.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onSelect(a.id);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  borderRadius: "var(--radius-sm)",
                  background:
                    a.id === activeId ? "rgba(212,175,106,0.10)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-0)",
                  fontFamily: "var(--font-sans)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: QUALITY_GRADIENT[a.quality],
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                    {QUALITY_LABEL[a.quality]} · LV {a.level}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
