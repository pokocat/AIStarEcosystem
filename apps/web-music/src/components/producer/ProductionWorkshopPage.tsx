"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ProductionWorkshopPage — 制作工坊（切片 / 数字人 / 混剪批量 3 tab 复合页）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion } from "motion/react";
import { Scissors, User, Layers, type LucideIcon } from "lucide-react";
import { ClipStudioPanel } from "./ClipStudioPanel";
import { DigitalPersonPanel } from "./DigitalPersonPanel";
import { BatchMixPanel } from "./BatchMixPanel";

type WorkshopTabId = "clip" | "digital_person" | "batch_mix";

interface TabDef {
  id: WorkshopTabId;
  label: string;
  icon: LucideIcon;
  color: string;
}

const TABS: TabDef[] = [
  { id: "clip",           label: "切片制作", icon: Scissors, color: "#06b6d4" },
  { id: "digital_person", label: "AI 数字人", icon: User,     color: "#a855f7" },
  { id: "batch_mix",      label: "混剪批量",  icon: Layers,   color: "#f59e0b" },
];

export function ProductionWorkshopPage() {
  const [activeTab, setActiveTab] = React.useState<WorkshopTabId>("clip");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: "var(--font-display)" }}>
          制作工坊
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
                    layoutId="activeWorkshopTab"
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
      {activeTab === "clip" && <ClipStudioPanel />}
      {activeTab === "digital_person" && <DigitalPersonPanel />}
      {activeTab === "batch_mix" && <BatchMixPanel />}
    </div>
  );
}

export default ProductionWorkshopPage;
