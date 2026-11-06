/**
 * 合规工具 - 整合授权与审核相关功能
 */

import React, { useState } from 'react';
import { Shield, FileCheck, Layers, Search, Grid3X3 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { LicenseVault } from './LicenseVault';
import { ContentReviewWorkbench } from './ContentReviewWorkbench';
import { WatermarkCenter } from './WatermarkCenter';
import { InfringementPatrol } from './InfringementPatrol';

type TabId = 'license' | 'review' | 'watermark' | 'patrol';

export const ComplianceTools = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('license');

  const tabs = [
    { id: 'license' as const, icon: FileCheck, labelZh: '授权台账', labelEn: 'License', color: '#06b6d4' },
    { id: 'review' as const, icon: Shield, labelZh: '内容审核', labelEn: 'Review', color: '#a855f7' },
    { id: 'watermark' as const, icon: Layers, labelZh: '水印管理', labelEn: 'Watermark', color: '#22c55e' },
    { id: 'patrol' as const, icon: Search, labelZh: '侵权巡查', labelEn: 'Patrol', color: '#f59e0b' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 via-green-400 to-amber-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '合规工具' : 'Compliance Tools'}
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { boxShadow: `0 0 20px ${tab.color}40`, border: `1px solid ${tab.color}30` } : undefined}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{zh ? tab.labelZh : tab.labelEn}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeComplianceTab"
                    className="absolute inset-0 rounded-xl -z-10 bg-white/5"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'license' && <LicenseVault lang={lang} />}
        {activeTab === 'review' && <ContentReviewWorkbench lang={lang} />}
        {activeTab === 'watermark' && <WatermarkCenter lang={lang} />}
        {activeTab === 'patrol' && <InfringementPatrol lang={lang} />}
      </div>
    </div>
  );
};
