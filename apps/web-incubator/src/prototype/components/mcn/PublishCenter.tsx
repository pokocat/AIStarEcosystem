/**
 * 发布中心 - 整合发布池、内容日历、全网分发
 */

import React, { useEffect, useState } from 'react';
import { Zap, Calendar, Globe, List } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { PublishPool } from './PublishPool';
import { ContentCalendar } from './ContentCalendar';
import { DistributionPage } from './DistributionPage';
import { MOCK_ARTISTS } from './ArtistTypes';
import { POOL_EVENT, readPool } from './publishPoolStore';

type TabId = 'pool' | 'calendar' | 'distribution';

export const PublishCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('pool');
  // 3 sample items await review; works exported from the AI 导演台 add to that.
  const [incoming, setIncoming] = useState(() => readPool().length);
  useEffect(() => {
    const sync = () => setIncoming(readPool().length);
    window.addEventListener(POOL_EVENT, sync);
    return () => window.removeEventListener(POOL_EVENT, sync);
  }, []);

  const tabs = [
    { id: 'pool' as const, icon: Zap, labelZh: '发布池', labelEn: 'Publish Pool', color: '#06b6d4', badge: String(3 + incoming) },
    { id: 'calendar' as const, icon: Calendar, labelZh: '内容日历', labelEn: 'Calendar', color: '#a855f7', badge: '12' },
    { id: 'distribution' as const, icon: Globe, labelZh: '全网分发', labelEn: 'Distribution', color: '#22c55e' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '发布中心' : 'Publish Center'}
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
                {tab.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-gray-300">{tab.badge}</span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activePublishTab"
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
        {activeTab === 'pool' && <PublishPool lang={lang} />}
        {activeTab === 'calendar' && <ContentCalendar lang={lang} />}
        {activeTab === 'distribution' && <DistributionPage lang={lang} activeArtist={MOCK_ARTISTS[0]} />}
      </div>
    </div>
  );
};
