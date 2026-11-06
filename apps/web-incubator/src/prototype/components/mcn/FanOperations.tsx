/**
 * 粉丝运营 - 公域运营 + 私域运营
 */

import React, { useState } from 'react';
import { Users, TrendingUp, MessageCircle, UserPlus, Smartphone, QrCode, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { CommunityPage } from './CommunityPage';
import { MOCK_ARTISTS } from './ArtistTypes';

type TabId = 'public' | 'private';

export const FanOperations = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<TabId>('public');

  const tabs = [
    { id: 'public' as const, icon: TrendingUp, labelZh: '公域运营', labelEn: 'Public Domain', color: '#06b6d4', desc: '引流+转化' },
    { id: 'private' as const, icon: MessageCircle, labelZh: '私域运营', labelEn: 'Private Domain', color: '#a855f7', desc: '朋友圈+社群+客服' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '粉丝运营' : 'Fan Operations'}
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
                <div className="text-left">
                  <div>{zh ? tab.labelZh : tab.labelEn}</div>
                  <div className="text-[9px] text-gray-500">{tab.desc}</div>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeFanTab"
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
        {activeTab === 'public' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">{zh ? '公域引流工具' : 'Public Domain Tools'}</h2>
                <p className="text-sm text-gray-500">{zh ? '从公域平台引流至私域' : 'Convert public traffic to private domain'}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-cyan-500/30 transition cursor-pointer group"
                >
                  <QrCode className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '二维码生成' : 'QR Code Generator'}</h3>
                  <p className="text-xs text-gray-500">{zh ? '生成个人微信/企微二维码' : 'Generate WeChat QR codes'}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-purple-500/30 transition cursor-pointer group"
                >
                  <Share2 className="w-10 h-10 text-purple-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '落地页管理' : 'Landing Pages'}</h3>
                  <p className="text-xs text-gray-500">{zh ? '创建引流落地页' : 'Create conversion landing pages'}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-green-500/30 transition cursor-pointer group"
                >
                  <UserPlus className="w-10 h-10 text-green-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '转化追踪' : 'Conversion Tracking'}</h3>
                  <p className="text-xs text-gray-500">{zh ? '监控公域→私域转化率' : 'Track public to private conversion'}</p>
                </motion.div>
              </div>

              <div className="p-6 rounded-xl border border-white/10 bg-gray-900/50">
                <h3 className="text-sm font-bold text-white mb-4">{zh ? '转化数据概览' : 'Conversion Overview'}</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: zh ? '公域曝光' : 'Exposure', value: '125K', color: 'text-cyan-400' },
                    { label: zh ? '点击引流' : 'Clicks', value: '8.2K', color: 'text-purple-400' },
                    { label: zh ? '添加私域' : 'Added', value: '1.5K', color: 'text-green-400' },
                    { label: zh ? '转化率' : 'Conv. Rate', value: '18.3%', color: 'text-amber-400' },
                  ].map((stat, i) => (
                    <div key={i} className="text-center">
                      <div className={`text-2xl font-bold ${stat.color} mb-1`} style={{ fontFamily: 'var(--font-display)' }}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'private' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">{zh ? '私域运营工具' : 'Private Domain Tools'}</h2>
                <p className="text-sm text-gray-500">{zh ? '朋友圈、社群、私信管理' : 'Moments, groups, and DM management'}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-cyan-500/30 transition cursor-pointer group"
                >
                  <Smartphone className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '朋友圈管理' : 'Moments Manager'}</h3>
                  <p className="text-xs text-gray-500 mb-3">{zh ? '定时发布、内容库' : 'Schedule posts, content library'}</p>
                  <div className="text-[10px] text-gray-600">{zh ? '今日已发：3条' : 'Posted today: 3'}</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-purple-500/30 transition cursor-pointer group"
                >
                  <Users className="w-10 h-10 text-purple-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '社群运营' : 'Group Operations'}</h3>
                  <p className="text-xs text-gray-500 mb-3">{zh ? '群发消息、活动管理' : 'Mass messaging, events'}</p>
                  <div className="text-[10px] text-gray-600">{zh ? '管理社群：5个' : 'Groups: 5'}</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-6 rounded-xl border border-white/10 bg-gray-900/50 hover:border-green-500/30 transition cursor-pointer group"
                >
                  <MessageCircle className="w-10 h-10 text-green-400 mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{zh ? '私信客服' : 'DM Support'}</h3>
                  <p className="text-xs text-gray-500 mb-3">{zh ? '智能回复、客户标签' : 'Auto-reply, customer tags'}</p>
                  <div className="text-[10px] text-gray-600">{zh ? '待回复：12条' : 'Pending: 12'}</div>
                </motion.div>
              </div>

              {/* 使用已有的社群组件 */}
              <CommunityPage lang={lang} activeArtist={MOCK_ARTISTS[0]} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
