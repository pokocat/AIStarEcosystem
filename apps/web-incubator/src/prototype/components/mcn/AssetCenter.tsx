/**
 * 素材中心 - 整合数字资产库和文案库
 */

import React, { useState } from 'react';
import { Package, FileText, Image, Video, Music as MusicIcon, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { AssetVault } from './AssetVault';
import { CopyVault } from './CopyVault';

type TabId = 'assets' | 'copy';

export const AssetCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('assets');

  const tabs = [
    { id: 'assets' as const, icon: Package, labelZh: '数字资产库', labelEn: 'Digital Assets', color: '#06b6d4' },
    { id: 'copy' as const, icon: FileText, labelZh: '文案库', labelEn: 'Copy Library', color: '#a855f7' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '素材中心' : 'Asset Center'}
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { boxShadow: `0 0 20px ${tab.color}40`, border: `1px solid ${tab.color}30` } : undefined}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{zh ? tab.labelZh : tab.labelEn}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeAssetTab"
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
        {activeTab === 'assets' && <AssetVault lang={lang} />}
        {activeTab === 'copy' && <CopyVault lang={lang} />}
      </div>
    </div>
  );
};
