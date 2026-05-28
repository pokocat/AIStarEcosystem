"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AssetCenterPage — 素材中心（数字资产库 + 文案库 2 tab 复合页）。
// 与 figma 原型一致的双 tab 切换；layout 已提供滚动壳，本页不重复 bg-black + sticky。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion } from "motion/react";
import { Package, FileText, type LucideIcon } from "lucide-react";
import { AssetVaultPanel } from "./AssetVaultPanel";
import { CopyVaultPanel } from "./CopyVaultPanel";

type AssetTabId = "assets" | "copy";

interface TabDef {
  id: AssetTabId;
  label: string;
  icon: LucideIcon;
  color: string;
}

const TABS: TabDef[] = [
  { id: "assets", label: "数字资产库", icon: Package,  color: "#06b6d4" },
  { id: "copy",   label: "文案库",     icon: FileText, color: "#a855f7" },
];

export function AssetCenterPage() {
  const [activeTab, setActiveTab] = React.useState<AssetTabId>("assets");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: "var(--font-display)" }}>
          素材中心
        </h1>
        <div className="flex items-center gap-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
                style={isActive ? { boxShadow: `0 0 20px ${tab.color}40`, border: `1px solid ${tab.color}30` } : undefined}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeAssetTab"
                    className="absolute inset-0 rounded-xl -z-10 bg-white/5"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {activeTab === "assets" && <AssetVaultPanel />}
      {activeTab === "copy" && <CopyVaultPanel />}
    </div>
  );
}

export default AssetCenterPage;
