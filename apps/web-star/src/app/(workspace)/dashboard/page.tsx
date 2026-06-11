"use client";

// 工作台总览 — KPI 卡 × 6、IP 授权链路状态、待处理事项聚合。

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, BadgeCheck, Bot, Building2, ChevronRight, Clock, Coins,
  Database, Film, Globe, Handshake, Key, Layers, TrendingUp, Zap,
} from "lucide-react";
import type { StarIpAsset, StarIpAssetType, StarOverview } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { IP_AUTH_META, IP_STATUS_CFG, IP_ASSET_TYPES } from "@/constants/star-ui";
import { formatWanYuan } from "@/lib/format";
import { PageHeader, LoadingList } from "@/components/star/page-kit";

const PENDING_ITEMS: { module: StarOverview["pendingByModule"][number]["module"]; href: string; color: string; icon: typeof Key; text: string }[] = [
  { module: "ipAuth", href: "/ip-auth", color: "#6366f1", icon: Key, text: "项IP授权待推进" },
  { module: "cooperation", href: "/cooperation", color: "#f43f5e", icon: Handshake, text: "个带货授权申请待审批" },
  { module: "whitelist", href: "/whitelist", color: "#06b6d4", icon: BadgeCheck, text: "个报白账号待审" },
  { module: "digitalHuman", href: "/digital-human", color: "#a855f7", icon: Bot, text: "个数字人授权待审" },
  { module: "aiLikeness", href: "/ai-likeness", color: "#ec4899", icon: Bot, text: "个AI形象授权待审" },
  { module: "contentReview", href: "/content-review", color: "#f97316", icon: Film, text: "条内容待审核" },
  { module: "productOnboard", href: "/product-onboard", color: "#22c55e", icon: Layers, text: "件商品待明星处理" },
  { module: "brandAuth", href: "/brand-auth", color: "#3b82f6", icon: Building2, text: "个品牌授权待处理" },
];

export default function DashboardPage() {
  const { overview, refreshOverview } = useStarShell();
  const [ipAssets, setIpAssets] = React.useState<StarIpAsset[] | null>(null);

  React.useEffect(() => {
    void refreshOverview();
    StarWorkbenchApi.listIpAssets().then(setIpAssets).catch(() => setIpAssets([]));
  }, [refreshOverview]);

  if (!overview) {
    return (
      <div className="p-6 space-y-5 max-w-5xl">
        <PageHeader title="工作台总览" sub="明星 IP 授权与商业运营全景" />
        <LoadingList rows={3} />
      </div>
    );
  }

  const kpis = [
    { label: "IP授权进度", value: `${overview.ipActiveCount}/${overview.ipTotalCount}`, color: "#6366f1", icon: Key, sub: "项已激活" },
    { label: "待处理授权", value: String(overview.pendingTotal), color: "#f59e0b", icon: Clock, sub: "跨所有模块" },
    { label: "商品库数量", value: String(overview.productLibraryCount), color: "#22c55e", icon: Database, sub: "件可带货" },
    { label: "品牌合作", value: String(overview.activeBrandDeals), color: "#3b82f6", icon: Building2, sub: "已激活授权" },
    { label: "本月GMV", value: formatWanYuan(overview.monthGmvCents), color: "#ec4899", icon: TrendingUp, sub: `环比${overview.monthGmvDeltaPercent >= 0 ? "+" : ""}${overview.monthGmvDeltaPercent}%` },
    { label: "分成收益", value: formatWanYuan(overview.monthRevenueCents), color: "#eab308", icon: Coins, sub: "本月待结算" },
  ];

  const pendingRows = PENDING_ITEMS
    .map((item) => ({ ...item, count: overview.pendingByModule.find((m) => m.module === item.module)?.count ?? 0 }))
    .filter((item) => item.count > 0);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <PageHeader title="工作台总览" sub="明星 IP 授权与商业运营全景" />

      {/* KPI 网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k, i) => {
          const KIcon = k.icon;
          return (
            <div
              key={k.label}
              className="star-card star-card-hover px-4 py-3.5 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.color}12` }}>
                <KIcon className="w-4 h-4" style={{ color: k.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] truncate" style={{ color: "var(--ink-1)" }}>{k.label}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--ink-2)" }}>{k.sub}</div>
              </div>
              <div className="text-lg font-black shrink-0 tabular" style={{ color: k.color }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* IP 授权链路状态 */}
      <div className="star-card p-4" style={{ borderColor: "#6366f126", background: "#6366f105" }}>
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4" style={{ color: "#6366f1" }} />
          <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>IP授权链路状态</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {IP_ASSET_TYPES.map((type: StarIpAssetType, i) => {
            const auth = ipAssets?.find((a) => a.type === type);
            const meta = IP_AUTH_META[type];
            const sc = auth ? IP_STATUS_CFG[auth.status] : null;
            const Icon = meta.icon;
            return (
              <React.Fragment key={type}>
                <Link
                  href="/ip-auth"
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl shrink-0 min-w-[86px] transition hover:-translate-y-0.5"
                  style={{
                    background: `${meta.color}0a`,
                    border: `1px solid ${auth?.status === "active" ? `${meta.color}55` : `${meta.color}1f`}`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  <span className="text-[10px] font-bold" style={{ color: "var(--ink-0)" }}>{meta.label}</span>
                  <span className="text-[9px] font-bold" style={{ color: sc?.color ?? "var(--ink-2)" }}>{sc?.label ?? "—"}</span>
                </Link>
                {i < IP_ASSET_TYPES.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--ink-2)" }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px]" style={{ color: "var(--ink-2)" }}>
          <Globe className="w-3 h-3" style={{ color: "#6366f1" }} />
          <span>授权链：明星录入 → 技术公司接收 → 火山引擎部署 → AI系统激活</span>
        </div>
      </div>

      {/* 待处理事项 */}
      {pendingRows.length > 0 && (
        <div className="star-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" style={{ color: "var(--star-gold)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>待处理事项</span>
          </div>
          <div className="space-y-1.5">
            {pendingRows.map((x) => {
              const XIcon = x.icon;
              return (
                <Link key={x.module} href={x.href} className="group flex items-center gap-3 p-2.5 rounded-xl text-left transition hover:bg-[var(--bg-2)]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${x.color}14` }}>
                    <XIcon className="w-4 h-4" style={{ color: x.color }} />
                  </div>
                  <span className="text-[13px] flex-1" style={{ color: "var(--ink-1)" }}>
                    <span className="font-black tabular mr-0.5" style={{ color: x.color }}>{x.count}</span> {x.text}
                  </span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--ink-2)" }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {pendingRows.length === 0 && (
        <div className="star-card p-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#16a34a14" }}>
            <AlertCircle className="w-4 h-4" style={{ color: "var(--ok)" }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>全部处理完毕</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--ink-1)" }}>当前没有待审批的商务请求，新申请会实时出现在这里。</div>
          </div>
        </div>
      )}
    </div>
  );
}
