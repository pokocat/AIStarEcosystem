"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AssetVaultPanel — 数字资产库（素材中心子 tab）。
// 数据：@/api/asset.listAssets ；类型：@ai-star-eco/types/asset
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Upload, Eye, Download, GitBranch, Lock,
} from "lucide-react";
import type {
  Asset, AssetType, AssetStatus,
} from "@ai-star-eco/types/asset";
import { ASSETS as ASSETS_SEED } from "@/mocks/asset";
import {
  ASSET_TYPE_CONFIG,
  ASSET_STATUS_CONFIG,
  ASSET_AUTH_CONFIG,
  ASSET_VERSION_LABELS,
} from "@/constants/asset-ui";
import { AssetApi } from "@/api";

export function AssetVaultPanel() {
  const [assets, setAssets] = React.useState<Asset[]>(ASSETS_SEED);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<AssetType | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<AssetStatus | "all">("all");
  const [selectedAsset, setSelectedAsset] = React.useState<Asset | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AssetApi.listAssets().then(a => {
      if (cancelled) return;
      if (a.length > 0) setAssets(a);
    }).catch(() => { /* mock fallback */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = assets.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.partnerName.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const stats = [
    { label: "总资产", value: assets.length, color: "text-cyan-400" },
    { label: "可用",   value: assets.filter(a => a.status === "available").length, color: "text-emerald-400" },
    { label: "审核中", value: assets.filter(a => a.status === "reviewing").length, color: "text-amber-400" },
    { label: "已冻结", value: assets.filter(a => a.status === "frozen").length, color: "text-red-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>数字资产库</h1>
          <p className="text-xs text-gray-500 mt-1">素材入库 · 版本管理 · 权限控制 · 授权校验</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
            <Upload className="w-3.5 h-3.5" />批量入库
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition">
            <Plus className="w-3.5 h-3.5" />新增素材
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索素材名称..."
            className="bg-gray-900/50 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition w-52" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "video", "image", "audio", "model_3d", "material"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${typeFilter === t ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/15"}`}>
              {t === "all" ? "全部" : ASSET_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "available", "reviewing", "frozen"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${statusFilter === s ? "bg-white/10 text-white border border-white/20" : "bg-white/3 text-gray-500 border border-white/5 hover:border-white/15"}`}>
              {s === "all" ? "全部状态" : ASSET_STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((asset, i) => {
          const tCfg = ASSET_TYPE_CONFIG[asset.type];
          const sCfg = ASSET_STATUS_CONFIG[asset.status];
          const aCfg = ASSET_AUTH_CONFIG[asset.authStatus];
          const TypeIcon = tCfg.icon;
          const AuthIcon = aCfg.icon;
          const isSelected = selectedAsset?.id === asset.id;
          return (
            <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedAsset(isSelected ? null : asset)}
              className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${isSelected ? "border-purple-500/40 bg-purple-500/[0.03]" : "border-white/5 hover:border-white/15"} ${asset.status === "frozen" ? "opacity-60" : ""}`}>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${asset.thumbColor}15`, border: `1px solid ${asset.thumbColor}30` }}>
                  <TypeIcon className="w-6 h-6" style={{ color: asset.thumbColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{asset.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{asset.partnerName}</div>
                </div>
                {asset.status === "frozen" && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>{sCfg.label}</span>
                <span className={`text-[9px] flex items-center gap-0.5 ${aCfg.color}`}>
                  <AuthIcon className="w-2.5 h-2.5" />{aCfg.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.versions}</div>
                  <div className="text-[9px] text-gray-600">版本</div>
                </div>
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.usageCount}</div>
                  <div className="text-[9px] text-gray-600">使用</div>
                </div>
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.fileSize}</div>
                  <div className="text-[9px] text-gray-600">大小</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-500">{t}</span>
                ))}
              </div>

              {/* Expanded */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider">版本记录</div>
                    {ASSET_VERSION_LABELS.slice(0, asset.versions).map((v, vi) => (
                      <div key={vi} className="flex items-center justify-between text-[10px] text-gray-400 bg-black/20 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1.5"><GitBranch className="w-2.5 h-2.5" />V{asset.versions - vi} - {v}</span>
                        <div className="flex gap-2">
                          <button className="text-cyan-400 hover:text-cyan-300"><Eye className="w-3 h-3" /></button>
                          {vi === 0 && asset.status !== "frozen" && <button className="text-purple-400 hover:text-purple-300"><Download className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    ))}
                    {asset.status === "frozen" && (
                      <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                        <Lock className="w-3 h-3" />该资产已冻结，请联系授权方处理后再使用
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default AssetVaultPanel;
