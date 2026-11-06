/**
 * 变现中心 - 整合变现项目和收益管理
 */

import React, { useState } from 'react';
import { Wallet, ShoppingBag, TrendingUp, Coins, Package } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { FinancePage } from './FinancePage';
import { MOCK_ARTISTS } from './ArtistTypes';

type TabId = 'projects' | 'revenue';

export const MonetizationCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('projects');

  const tabs = [
    { id: 'projects' as const, icon: ShoppingBag, labelZh: '变现项目', labelEn: 'Projects', color: '#06b6d4' },
    { id: 'revenue' as const, icon: TrendingUp, labelZh: '收益概览', labelEn: 'Revenue', color: '#22c55e' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '变现中心' : 'Monetization Center'}
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
                    layoutId="activeMonetizationTab"
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
        {activeTab === 'projects' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">{zh ? '活跃变现项目' : 'Active Projects'}</h2>
                <p className="text-sm text-gray-500">{zh ? '管理广告投放和产品推广' : 'Manage ads and product promotions'}</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: '品牌A广告投放', type: '广告', status: '进行中', revenue: '¥12,500' },
                  { name: '产品B推广', type: '产品', status: '进行中', revenue: '¥8,300' },
                  { name: '品牌C联名', type: '联名', status: '待确认', revenue: '¥25,000' },
                ].map((project, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl border border-white/10 bg-gray-900/50 hover:border-white/20 transition"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white">{project.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        project.status === '进行中' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{project.type}</span>
                      <span className="text-cyan-400 font-bold">{project.revenue}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'revenue' && <FinancePage lang={lang} activeArtist={MOCK_ARTISTS[0]} />}
      </div>
    </div>
  );
};
