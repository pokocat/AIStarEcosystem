/**
 * 艺人中心 - 融合版
 *
 * 整合：我的艺人 + 明星签约 + 艺人市场
 * 提供一站式艺人获取与管理体验
 * 注：AI孵化入口统一从"概览页-快速启动"进入
 */

import React, { useState } from 'react';
import {
  Users, Star, Store, Coins, Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import { motion, AnimatePresence } from 'motion/react';
import type { Lang } from '../../translations';
import { MCNMatrix } from './MCNMatrix';
import { CelebritySigningCenter } from '../market/CelebritySigningCenter';
import { ArtistMarket } from '../market/ArtistMarket';

type TabId = 'my_artists' | 'celebrity' | 'market';

interface TabConfig {
  id: TabId;
  icon: React.ComponentType<any>;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  color: string;
  bg: string;
  badge?: string;
}

const TABS: TabConfig[] = [
  {
    id: 'my_artists',
    icon: Users,
    labelZh: '我的艺人',
    labelEn: 'My Artists',
    descZh: '管理我的艺人矩阵',
    descEn: 'Manage my artist matrix',
    color: '#06b6d4',
    bg: 'bg-cyan-500/10',
  },
  {
    id: 'celebrity',
    icon: Star,
    labelZh: '明星专区',
    labelEn: 'Celebrity Zone',
    descZh: '明星IP授权合作',
    descEn: 'Celebrity IP authorization',
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'market',
    icon: Store,
    labelZh: '艺人市场',
    labelEn: 'Artist Market',
    descZh: 'MCN二级市场交易',
    descEn: 'MCN secondary market',
    color: '#ec4899',
    bg: 'bg-pink-500/10',
  },
];

interface Props {
  lang: Lang;
  onNavigateWorkshop?: () => void;
  onIncubate?: () => void;
  onGoToTraining?: () => void;
}

export const ArtistHub = ({ lang, onNavigateWorkshop, onIncubate, onGoToTraining }: Props) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('my_artists');
  const [marketBalance, setMarketBalance] = useState(100000);
  const [showMarketWizard, setShowMarketWizard] = useState(false);

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header with Tabs */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-display)' }}>
                {zh ? 'AI艺人孵化' : 'AI Incubation'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {zh ? '管理你的AI艺人生态' : 'Manage your AI artist ecosystem'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* 孵化新艺人 — shown on my_artists tab */}
              {activeTab === 'my_artists' && onIncubate && (
                <Button
                  onClick={onIncubate}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white border-0 h-9 text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {zh ? '孵化新艺人' : 'New Artist'}
                </Button>
              )}

              {/* Market tab controls */}
              {activeTab === 'market' && (
                <>
                  <div className="flex items-center gap-2 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500 leading-none">{zh ? '余额' : 'Balance'}</div>
                      <div className="text-sm font-bold text-amber-400 leading-tight">⬡ {marketBalance.toLocaleString()}</div>
                    </div>
                  </div>
                  <Button onClick={() => setShowMarketWizard(true)}
                    className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-0 h-9 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />{zh ? '上架艺人' : 'List Artist'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                    transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                  style={isActive ? {
                    boxShadow: `0 0 20px ${tab.color}40`,
                    border: `1px solid ${tab.color}30`,
                  } : undefined}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? tab.color : undefined }}
                  />
                  <span>{zh ? tab.labelZh : tab.labelEn}</span>
                  {tab.badge && isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl -z-10"
                      style={{ background: tab.bg }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'my_artists' && (
              <MCNMatrix
                lang={lang}
                onNavigateWorkshop={onNavigateWorkshop}
              />
            )}

            {activeTab === 'celebrity' && (
              <CelebritySigningCenter lang={lang} onGoToTraining={onGoToTraining} />
            )}

            {activeTab === 'market' && (
              <ArtistMarket
                lang={lang}
                balance={marketBalance}
                setBalance={setMarketBalance}
                showWizard={showMarketWizard}
                setShowWizard={setShowMarketWizard}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
