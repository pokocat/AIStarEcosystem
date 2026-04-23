"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WardrobePageV2 — 游戏装备风格的衣帽间。
// 入口：/producer/wardrobe
//
// 三栏布局：
//   左列：物品浏览（分类 + 已拥有/商店 + 搜索 + 网格卡片）
//   中列：Artist 形象 + 锻造按钮 + 生成结果与 CTA
//   右列：5 个装备槽（缩略图 / 名称 / 稀有度 / 购买价 / 品牌 / 卸下）
//
// 交互要点：
//   - 已拥有物品点击即装备（不消耗积分）
//   - 商店付费物品点击 → 确认 Dialog → StoreApi.redeem + 本地余额扣减
//   - "生成形象"按钮消耗 WARDROBE_FORGE_COST，完成后在中央展示新形象
//   - 生成结果下方双 CTA：保存为新形象（saveForgeResult）/ 重新锻造（再扣费）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shirt, Crown, Footprints, Sparkles, ShoppingBag, Search, Lock,
  Check, Hammer, Coins, Sparkle, Trash2, Tag, X,
} from "lucide-react";

import type { Artist } from "@/types/artist";
import type {
  ClothingCategory, ClothingItem, EquipSlot, EquippedSlots,
} from "@/types/wardrobe";
import type { Rarity, ID } from "@/types/_shared";
import type { ForgeResult } from "@/types/appearance-forge";

import * as WardrobeApi from "@/api/wardrobe";
import * as StoreApi from "@/api/store";
import * as AccountApi from "@/api/account";
import { listForgeHistory, saveForgeResult } from "@/api/appearance-forge";

import { useProducerShell } from "@/lib/producer-shell-context";
import { formatCredits } from "@/lib/format";
import { toast } from "@/lib/toast";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";

import {
  RARITY_COLORS, RARITY_GLOW, EQUIP_SLOT_LABELS,
  WARDROBE_CATEGORY_OPTIONS,
} from "@/constants/wardrobe-ui";
import {
  WARDROBE_FORGE_COST, EQUIP_SLOT_ORDER, BRAND_OVERLAY,
} from "@/constants/wardrobe-v2-ui";

// ── 工具 ───────────────────────────────────────────────────────────────────

const RARITY_LABEL: Record<Rarity, string> = {
  common: "普通", rare: "稀有", epic: "史诗", legendary: "传说",
};

const EMPTY_SLOTS: EquippedSlots = {
  top: null, bottom: null, accessory: null, shoes: null, hair: null,
};

function isEquipable(item: ClothingItem): item is ClothingItem & { category: EquipSlot } {
  return item.category !== "outfit";
}

/** 判定商品是否需要付费（SaleStatus=PAID 或有正积分价）。 */
function isPaid(item: ClothingItem): boolean {
  if (item.saleStatus === "PAID") return true;
  if (item.saleStatus === "LOCKED" || item.isLocked) return true;
  if ((item.priceCredits ?? 0) > 0) return true;
  return false;
}

/** 读取物品真实需付积分数；LOCKED 与无积分价时回落 item.price。 */
function itemCreditCost(item: ClothingItem): number {
  return item.priceCredits ?? item.price ?? 0;
}

// ── 主组件 ─────────────────────────────────────────────────────────────────

export function WardrobePageV2({ activeArtist }: { activeArtist: Artist }) {
  const { refetchWallet } = useProducerShell();

  // 数据
  const [catalog, setCatalog] = React.useState<ClothingItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [ownedIds, setOwnedIds] = React.useState<Set<ID>>(new Set());
  const [purchasedPrices, setPurchasedPrices] = React.useState<Record<ID, number>>({});
  const [equipped, setEquipped] = React.useState<EquippedSlots>(EMPTY_SLOTS);
  const [balance, setBalance] = React.useState<number>(0);

  // 过滤
  const [activeCategory, setActiveCategory] = React.useState<"all" | ClothingCategory>("all");
  const [tab, setTab] = React.useState<"owned" | "shop">("shop");
  const [search, setSearch] = React.useState("");

  // 锻造
  type ForgePhase = "idle" | "generating" | "result";
  const [phase, setPhase] = React.useState<ForgePhase>("idle");
  const [forgeResult, setForgeResult] = React.useState<ForgeResult | null>(null);

  // 购买确认
  const [pendingPurchase, setPendingPurchase] = React.useState<ClothingItem | null>(null);
  const [purchasing, setPurchasing] = React.useState(false);

  // ── 初始化 ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([WardrobeApi.listClothing(), AccountApi.getMyWallet().catch(() => null)])
      .then(([items, wallet]) => {
        if (cancelled) return;
        setCatalog(items);
        if (wallet) setBalance(wallet.totalBalance);
      })
      .catch(() => toast.error("加载衣帽间失败", { description: "请稍后再试" }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 预拉一次 forge history 触发 mock 层对"无种子艺人"的形象合成，
  // 防止之后保存新形象时把艺人画廊的种子形象挤成空。仅用于副作用。
  React.useEffect(() => {
    listForgeHistory(activeArtist.id).catch(() => { /* 静默：不影响主流程 */ });
  }, [activeArtist.id]);

  // 初始默认进入商店 tab；有已拥有物品时切到"已拥有"
  React.useEffect(() => {
    if (ownedIds.size > 0 && tab === "shop") {
      // 保留用户当前选择，不强制切换
    }
  }, [ownedIds, tab]);

  // ── 过滤后的物品列表 ─────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    return catalog.filter(item => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      const owned = ownedIds.has(item.id);
      if (tab === "owned" && !owned) return false;
      if (tab === "shop" && owned) return false;
      if (search.trim()) {
        const key = search.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(key)
          && !item.tags.some(t => t.toLowerCase().includes(key))) return false;
      }
      return true;
    });
  }, [catalog, activeCategory, tab, search, ownedIds]);

  const equippedList = React.useMemo(
    () => EQUIP_SLOT_ORDER.map(slot => ({ slot, item: equipped[slot] })),
    [equipped],
  );

  const totalEquippedValue = React.useMemo(
    () => equippedList.reduce((sum, { item }) => {
      if (!item) return sum;
      const paid = purchasedPrices[item.id];
      return sum + (paid ?? itemCreditCost(item));
    }, 0),
    [equippedList, purchasedPrices],
  );

  // ── 装备 / 卸下 ──────────────────────────────────────────────────────────
  const doEquip = (item: ClothingItem) => {
    if (!isEquipable(item)) return;
    setEquipped(prev => ({ ...prev, [item.category]: item }));
  };

  const doUnequip = (slot: EquipSlot) => {
    setEquipped(prev => ({ ...prev, [slot]: null }));
  };

  const handleItemClick = (item: ClothingItem) => {
    const owned = ownedIds.has(item.id);
    if (!isEquipable(item)) return; // outfit 整套暂不走装备槽
    if (owned) {
      doEquip(item);
      toast.success(`已试穿：${item.name}`);
      return;
    }
    if (isPaid(item)) {
      setPendingPurchase(item);
      return;
    }
    // 免费商品：直接拥有并装备
    setOwnedIds(prev => {
      const next = new Set(prev); next.add(item.id); return next;
    });
    setPurchasedPrices(prev => ({ ...prev, [item.id]: 0 }));
    doEquip(item);
    toast.success(`已入库：${item.name}`, { description: "免费物品已自动装备" });
  };

  // ── 购买确认流程 ─────────────────────────────────────────────────────────
  const confirmPurchase = async () => {
    const item = pendingPurchase;
    if (!item) return;
    const cost = itemCreditCost(item);
    if (cost > balance) {
      toast.error("积分不足", { description: `还差 ${formatCredits(cost - balance)} 积分` });
      return;
    }
    setPurchasing(true);
    try {
      await StoreApi.redeem("WARDROBE", item.id);
      setBalance(b => b - cost);
      setOwnedIds(prev => {
        const next = new Set(prev); next.add(item.id); return next;
      });
      setPurchasedPrices(prev => ({ ...prev, [item.id]: cost }));
      doEquip(item);
      toast.success(`已购买：${item.name}`, {
        description: `消耗 ${formatCredits(cost)} 积分，已自动装备`,
      });
      setPendingPurchase(null);
      refetchWallet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "购买失败";
      toast.error("购买失败", { description: msg });
    } finally {
      setPurchasing(false);
    }
  };

  // ── 锻造 ─────────────────────────────────────────────────────────────────
  const hasAnyEquipped = equippedList.some(({ item }) => item !== null);
  const canForge = hasAnyEquipped && balance >= WARDROBE_FORGE_COST && phase !== "generating";

  const runForge = async () => {
    if (balance < WARDROBE_FORGE_COST) {
      toast.error("积分不足", {
        description: `本次锻造需 ${formatCredits(WARDROBE_FORGE_COST)} 积分`,
      });
      return;
    }
    if (!hasAnyEquipped) {
      toast.info("请先装备服饰", { description: "至少装备一件才能锻造" });
      return;
    }
    setPhase("generating");
    try {
      const req: WardrobeApi.WardrobeLookRequest = {
        artistId: activeArtist.id,
        equipped: Object.fromEntries(
          EQUIP_SLOT_ORDER
            .map(slot => [slot, equipped[slot]?.id])
            .filter(([, v]) => !!v),
        ) as Partial<Record<EquipSlot, ID>>,
        costCredits: WARDROBE_FORGE_COST,
      };
      const result = await WardrobeApi.generateLook(req);
      setBalance(b => b - WARDROBE_FORGE_COST);
      setForgeResult(result);
      setPhase("result");
      refetchWallet();
      toast.success("锻造完成", {
        description: `消耗 ${formatCredits(WARDROBE_FORGE_COST)} 积分`,
      });
    } catch (err) {
      setPhase("idle");
      const msg = err instanceof Error ? err.message : "锻造失败";
      toast.error("锻造失败", { description: msg });
    }
  };

  const handleSaveForge = async () => {
    if (!forgeResult) return;
    try {
      await saveForgeResult(forgeResult);
      toast.success("已保存到形象库", {
        description: "可在 AI 形象锻造页查看",
      });
      setPhase("idle");
      setForgeResult(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存失败";
      toast.error("保存失败", { description: msg });
    }
  };

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* 顶栏：标题 + 余额 */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            形象装备台 · 衣帽间
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            给 {activeArtist.name} 挑选服饰，锻造本场形象
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/5 px-4 py-2">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-200">
              {formatCredits(balance)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-amber-400/70">credits</span>
          </div>
        </div>
      </header>

      {/* 三栏主体 */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* 左：物品浏览 */}
        <section className="lg:col-span-4 flex flex-col gap-3 rounded-2xl border border-white/5 bg-gray-950/60 p-4">
          <CatalogPanel
            catalog={catalog}
            filtered={filtered}
            loading={loading}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            tab={tab} setTab={setTab}
            search={search} setSearch={setSearch}
            ownedIds={ownedIds}
            equipped={equipped}
            onClickItem={handleItemClick}
          />
        </section>

        {/* 中：形象 + 锻造 */}
        <section className="lg:col-span-5 flex flex-col gap-3 rounded-2xl border border-white/5 bg-gradient-to-b from-gray-950/80 to-gray-900/40 p-4">
          <AvatarStage
            artist={activeArtist}
            equipped={equipped}
            phase={phase}
            forgeResult={forgeResult}
          />
          <ForgeControls
            phase={phase}
            canForge={canForge}
            hasAnyEquipped={hasAnyEquipped}
            balance={balance}
            onForge={runForge}
            onSave={handleSaveForge}
            onReforge={runForge}
          />
        </section>

        {/* 右：装备槽 */}
        <section className="lg:col-span-3 flex flex-col gap-3 rounded-2xl border border-white/5 bg-gray-950/60 p-4">
          <EquippedPanel
            slots={equippedList}
            purchasedPrices={purchasedPrices}
            totalValue={totalEquippedValue}
            onUnequip={doUnequip}
          />
        </section>
      </div>

      {/* 购买确认 Dialog */}
      <PurchaseDialog
        item={pendingPurchase}
        balance={balance}
        loading={purchasing}
        onCancel={() => !purchasing && setPendingPurchase(null)}
        onConfirm={confirmPurchase}
      />
    </div>
  );
}

// ── 子组件：左列物品面板 ─────────────────────────────────────────────────────

interface CatalogPanelProps {
  catalog: ClothingItem[];
  filtered: ClothingItem[];
  loading: boolean;
  activeCategory: "all" | ClothingCategory;
  setActiveCategory: (v: "all" | ClothingCategory) => void;
  tab: "owned" | "shop";
  setTab: (v: "owned" | "shop") => void;
  search: string;
  setSearch: (v: string) => void;
  ownedIds: Set<ID>;
  equipped: EquippedSlots;
  onClickItem: (item: ClothingItem) => void;
}

function CatalogPanel({
  catalog, filtered, loading,
  activeCategory, setActiveCategory,
  tab, setTab, search, setSearch,
  ownedIds, equipped, onClickItem,
}: CatalogPanelProps) {
  const ownedCount = ownedIds.size;
  const shopCount = catalog.length - ownedCount;

  return (
    <>
      {/* Tab：已拥有 / 商店 */}
      <div className="flex overflow-hidden rounded-xl border border-white/10">
        <button
          onClick={() => setTab("owned")}
          className={`flex-1 px-3 py-2 text-xs transition ${
            tab === "owned" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          已拥有 <span className="opacity-60">({ownedCount})</span>
        </button>
        <button
          onClick={() => setTab("shop")}
          className={`flex-1 px-3 py-2 text-xs transition flex items-center justify-center gap-1 ${
            tab === "shop" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          商店 <span className="opacity-60">({shopCount})</span>
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索名称或标签..."
          className="w-full rounded-lg border border-white/10 bg-gray-900/50 py-2 pl-10 pr-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none"
        />
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-1.5">
        {WARDROBE_CATEGORY_OPTIONS.filter(opt => opt.id !== "outfit").map(opt => {
          const Icon = opt.icon;
          const active = activeCategory === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setActiveCategory(opt.id)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                active
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"
              }`}
            >
              <Icon className="h-3 w-3" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 网格 */}
      <div className="min-h-[260px]">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shirt className="mb-2 h-8 w-8 text-gray-600" />
            <p className="text-xs text-gray-500">
              {tab === "owned" ? "还没有已拥有的物品，去商店逛逛" : "没有匹配的商品"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                index={idx}
                owned={ownedIds.has(item.id)}
                equipped={
                  isEquipable(item) && equipped[item.category]?.id === item.id
                }
                onClick={() => onClickItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── 子组件：物品卡片 ─────────────────────────────────────────────────────────

function ItemCard({
  item, index, owned, equipped, onClick,
}: {
  item: ClothingItem;
  index: number;
  owned: boolean;
  equipped: boolean;
  onClick: () => void;
}) {
  const brand = BRAND_OVERLAY[item.id];
  const rarityColor = RARITY_COLORS[item.rarity];
  const glow = RARITY_GLOW[item.rarity];
  const paid = !owned && isPaid(item);
  const locked = item.isLocked || item.saleStatus === "LOCKED";
  const cost = itemCreditCost(item);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className={`group relative overflow-hidden rounded-xl border bg-gray-900/60 p-2 text-left transition hover:-translate-y-0.5 ${
        equipped
          ? "border-cyan-400/50 shadow-[0_0_20px] shadow-cyan-500/20"
          : `border-white/10 hover:border-white/25 hover:shadow-[0_0_18px] hover:${glow}`
      }`}
    >
      {/* 稀有度光晕 */}
      {(item.rarity === "legendary" || item.rarity === "epic") && (
        <div
          className={`pointer-events-none absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl ${
            item.rarity === "legendary" ? "bg-yellow-500/20" : "bg-purple-500/20"
          }`}
        />
      )}

      {/* 缩略图 */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-800">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-full w-full object-cover transition group-hover:scale-105"
          loading="lazy"
        />
        {/* 角标：装备中 / 已拥有 / 锁 */}
        {equipped ? (
          <div className="absolute left-1 top-1 flex h-5 items-center gap-0.5 rounded-full bg-cyan-500 px-1.5 text-[9px] font-bold text-black">
            <Check className="h-2.5 w-2.5" /> 装备中
          </div>
        ) : owned ? (
          <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-emerald-500/90 flex items-center justify-center">
            <Check className="h-3 w-3 text-black" />
          </div>
        ) : locked ? (
          <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-gray-900/80 flex items-center justify-center">
            <Lock className="h-3 w-3 text-gray-300" />
          </div>
        ) : null}

        {/* 品牌赞助角标 */}
        {brand && (
          <div
            className="absolute right-1 top-1 rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-white"
            style={{ backgroundColor: brand.accent }}
          >
            {brand.brand}
          </div>
        )}

        {/* 新品 / 趋势 */}
        {item.isNew && !brand && (
          <div className="absolute right-1 top-1 rounded-sm bg-pink-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
            新品
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <div className="truncate text-[11px] font-semibold text-white">{item.name}</div>
          <Badge className={`shrink-0 border px-1 text-[8px] ${rarityColor} bg-transparent`}>
            {RARITY_LABEL[item.rarity]}
          </Badge>
        </div>
        {paid ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Coins className="h-3 w-3" />
            <span className="font-bold">{formatCredits(cost)}</span>
            {locked && <Lock className="ml-1 h-2.5 w-2.5 opacity-60" />}
          </div>
        ) : (
          <div className="text-[10px] text-emerald-400">{owned ? "已拥有" : "免费"}</div>
        )}
      </div>
    </motion.button>
  );
}

// ── 子组件：中央形象台 ──────────────────────────────────────────────────────

function AvatarStage({
  artist, equipped, phase, forgeResult,
}: {
  artist: Artist;
  equipped: EquippedSlots;
  phase: "idle" | "generating" | "result";
  forgeResult: ForgeResult | null;
}) {
  const showing = phase === "result" && forgeResult ? "result" : phase;
  // 装备贴纸：右侧浮动缩略图链，直观表示当前挂在身上的装备
  const equippedItems = EQUIP_SLOT_ORDER.map(slot => ({ slot, item: equipped[slot] }))
    .filter(({ item }) => item !== null) as { slot: EquipSlot; item: ClothingItem }[];

  return (
    <div className="relative flex h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gray-900/40">
      {/* 背景光束 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(103,232,249,0.08),transparent_60%)]" />

      <AnimatePresence mode="wait">
        {showing === "generating" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="h-24 w-24 rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
              />
              <Hammer className="absolute inset-0 m-auto h-8 w-8 text-cyan-300" />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-cyan-200">正在锻造形象...</div>
              <div className="mt-1 text-xs text-gray-500">融合 {equippedItems.length} 件装备</div>
            </div>
          </motion.div>
        )}

        {showing === "result" && forgeResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative h-full w-full"
          >
            <img
              src={forgeResult.image}
              alt="锻造结果"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-2">
              <Badge className="border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                <Sparkle className="mr-1 h-3 w-3" /> 新锻造
              </Badge>
              <div className="text-[10px] text-gray-400">草稿 · 未保存</div>
            </div>
          </motion.div>
        )}

        {showing === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-cyan-500/10 blur-2xl" />
              <img
                src={artist.avatar}
                alt={artist.name}
                className="relative h-48 w-48 rounded-full border-4 border-white/10 object-cover shadow-2xl"
              />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{artist.name}</div>
              <div className="text-xs text-gray-500">
                当前装备 {equippedItems.length} 件 · 点击物品即可试穿
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右侧装备浮动条（idle + generating 可见；result 时淡出给结果图让位） */}
      {showing !== "result" && equippedItems.length > 0 && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          <AnimatePresence>
            {equippedItems.map(({ slot, item }) => (
              <motion.div
                key={slot}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-11 w-11 overflow-hidden rounded-lg border border-white/20 bg-gray-900 shadow-lg"
                title={`${EQUIP_SLOT_LABELS[slot]}：${item.name}`}
              >
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── 子组件：锻造按钮组 ──────────────────────────────────────────────────────

function ForgeControls({
  phase, canForge, hasAnyEquipped, balance,
  onForge, onSave, onReforge,
}: {
  phase: "idle" | "generating" | "result";
  canForge: boolean;
  hasAnyEquipped: boolean;
  balance: number;
  onForge: () => void;
  onSave: () => void;
  onReforge: () => void;
}) {
  if (phase === "result") {
    const canReforge = balance >= WARDROBE_FORGE_COST;
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
        <div className="text-center text-xs text-cyan-200">
          满意就保存；不满意再锻造一次（每次消耗 {formatCredits(WARDROBE_FORGE_COST)} 积分）
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onSave}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90"
          >
            <Check className="mr-1 h-4 w-4" /> 保存为新形象
          </Button>
          <Button
            variant="outline"
            onClick={onReforge}
            disabled={!canReforge}
            className="flex-1 border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
          >
            <Hammer className="mr-1 h-4 w-4" /> 重新锻造 (-{formatCredits(WARDROBE_FORGE_COST)})
          </Button>
        </div>
      </div>
    );
  }

  const insufficientFunds = balance < WARDROBE_FORGE_COST;
  let hint = "";
  if (!hasAnyEquipped) hint = "至少装备一件服饰";
  else if (insufficientFunds) hint = `积分不足（需 ${formatCredits(WARDROBE_FORGE_COST)}）`;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/60 p-3">
      <Button
        onClick={onForge}
        disabled={!canForge}
        className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 py-6 text-base font-bold hover:opacity-90 disabled:opacity-40"
      >
        <Hammer className="mr-2 h-5 w-5" />
        {phase === "generating"
          ? "锻造中..."
          : `生成形象 · 消耗 ${formatCredits(WARDROBE_FORGE_COST)} 积分`}
      </Button>
      {hint && <div className="mt-2 text-center text-[11px] text-amber-400/80">{hint}</div>}
    </div>
  );
}

// ── 子组件：右列装备槽 ───────────────────────────────────────────────────────

function EquippedPanel({
  slots, purchasedPrices, totalValue, onUnequip,
}: {
  slots: { slot: EquipSlot; item: ClothingItem | null }[];
  purchasedPrices: Record<ID, number>;
  totalValue: number;
  onUnequip: (slot: EquipSlot) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">装备槽</div>
          <div className="text-[10px] text-gray-500">本套总价值</div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">
          <Coins className="h-3 w-3" />
          <span className="text-xs font-bold">{formatCredits(totalValue)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {slots.map(({ slot, item }) => (
          <SlotCard
            key={slot}
            slot={slot}
            item={item}
            purchasedPrice={item ? purchasedPrices[item.id] : undefined}
            onUnequip={() => onUnequip(slot)}
          />
        ))}
      </div>
    </>
  );
}

function SlotCard({
  slot, item, purchasedPrice, onUnequip,
}: {
  slot: EquipSlot;
  item: ClothingItem | null;
  purchasedPrice: number | undefined;
  onUnequip: () => void;
}) {
  const Icon = SLOT_ICON[slot];
  if (!item) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-gray-950/40 p-3 text-gray-500">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-gray-900/60">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold">{EQUIP_SLOT_LABELS[slot]}</div>
          <div className="text-[10px]">未装备</div>
        </div>
      </div>
    );
  }
  const brand = BRAND_OVERLAY[item.id];
  const rarityColor = RARITY_COLORS[item.rarity];
  const displayPrice = purchasedPrice ?? itemCreditCost(item);
  const priceLabel =
    purchasedPrice !== undefined
      ? purchasedPrice === 0 ? "免费获得" : `购入 ${formatCredits(purchasedPrice)}`
      : `价值 ${formatCredits(displayPrice)}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/5 to-transparent p-2.5"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Icon className="h-3 w-3 text-cyan-300" />
          <span className="text-[10px] uppercase tracking-wider text-cyan-300/70">
            {EQUIP_SLOT_LABELS[slot]}
          </span>
        </div>
        <div className="truncate text-xs font-semibold text-white">{item.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Badge className={`border px-1 text-[8px] ${rarityColor} bg-transparent`}>
            {RARITY_LABEL[item.rarity]}
          </Badge>
          {brand && (
            <span
              className="rounded-sm px-1 text-[8px] font-bold tracking-widest text-white"
              style={{ backgroundColor: brand.accent }}
            >
              {brand.brand}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-300">
          <Tag className="h-2.5 w-2.5" />
          {priceLabel}
        </div>
      </div>
      <button
        onClick={onUnequip}
        aria-label="卸下"
        className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-500 transition hover:border-red-400/40 hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

const SLOT_ICON: Record<EquipSlot, React.ComponentType<{ className?: string }>> = {
  top: Shirt,
  bottom: Shirt,
  accessory: Crown,
  shoes: Footprints,
  hair: Sparkles,
};

// ── 子组件：购买确认 Dialog ──────────────────────────────────────────────────

function PurchaseDialog({
  item, balance, loading, onCancel, onConfirm,
}: {
  item: ClothingItem | null;
  balance: number;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cost = item ? itemCreditCost(item) : 0;
  const afterBalance = balance - cost;
  const notEnough = afterBalance < 0;
  const brand = item ? BRAND_OVERLAY[item.id] : undefined;

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="border-white/10 bg-gray-950">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> 购买确认
              </DialogTitle>
              <DialogDescription>购买后自动入库并装备到当前艺人</DialogDescription>
            </DialogHeader>

            <div className="flex gap-4">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10">
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                {brand && (
                  <div
                    className="absolute right-1 top-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white"
                    style={{ backgroundColor: brand.accent }}
                  >
                    {brand.brand}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-base font-bold text-white">{item.name}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge className={`border px-1 text-[9px] ${RARITY_COLORS[item.rarity]} bg-transparent`}>
                    {RARITY_LABEL[item.rarity]}
                  </Badge>
                  <Badge className="border border-white/10 bg-white/5 px-1 text-[9px] text-gray-300">
                    {EQUIP_SLOT_LABELS[item.category as EquipSlot] ?? item.category}
                  </Badge>
                  {brand && (
                    <Badge className="border border-amber-400/30 bg-amber-500/10 px-1 text-[9px] text-amber-200">
                      品牌合作
                    </Badge>
                  )}
                </div>
                {item.tags.length > 0 && (
                  <div className="text-[11px] text-gray-500">
                    {item.tags.slice(0, 4).join(" · ")}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-white/10 bg-gray-900/60 p-3 text-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span>商品价格</span>
                <span className="font-bold text-amber-300">
                  <Coins className="mr-1 inline h-3 w-3" />
                  {formatCredits(cost)}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>当前余额</span>
                <span>{formatCredits(balance)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1">
                <span className="text-gray-300">购买后余额</span>
                <span className={notEnough ? "font-bold text-red-400" : "font-bold text-white"}>
                  {formatCredits(Math.max(afterBalance, 0))}
                  {notEnough && " · 不足"}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                <X className="mr-1 h-4 w-4" /> 取消
              </Button>
              <Button
                onClick={onConfirm}
                disabled={notEnough || loading}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
              >
                {loading ? "处理中..." : `支付 ${formatCredits(cost)} 积分`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
