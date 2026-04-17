"use client";

import React, { useState } from 'react';
import {
  Heart, Users, MessageCircle, Trophy, Gift, TrendingUp,
  Star, Crown, Zap, Bell, Send, ThumbsUp, Share2, BarChart3,
  CalendarDays, UserPlus, Award, Flame, Sparkles
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import { type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from './ArtistTypes';
import { FAN_TIERS, FAN_GROWTH, ACTIVITIES, EVENTS } from "@/mocks/community";
import {
  ACTION_COLORS, ACTION_ICONS,
  EVENT_ICONS, EVENT_STATUS_STYLES,
} from "@/constants/community-ui";

export const CommunityPage = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];
  const isIdol = activeArtist.type === 'idol';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '粉丝社群管理' : 'Fan Community'}</h1>
          <p className="text-gray-400 font-light mt-1">
            {isIdol && <span className="text-indigo-400 mr-1">💎</span>}
            {zh ? (isIdol ? '偶像粉丝运营加成 +50%' : '粉丝运营、互动活动、社群数据') : (isIdol ? 'Idol fan bonus +50%' : 'Fan operations, events & analytics')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 text-gray-400 gap-1 text-xs"><Bell className="w-3.5 h-3.5" /> {zh ? '群发通知' : 'Notify All'}</Button>
          <Button className="bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 gap-2"><Sparkles className="w-4 h-4" /> {zh ? '创建活动' : 'New Event'}</Button>
        </div>
      </div>

      {/* Fan tier cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {FAN_TIERS.map((tier, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className={`${tier.bg} border border-white/5 rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{tier.icon}</span>
              <span className={`text-xs ${tier.color} font-semibold`}>{tier.name}</span>
            </div>
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{tier.count.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Growth chart */}
        <div className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '粉丝增长趋势' : 'Fan Growth'}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={FAN_GROWTH}>
              <defs>
                <linearGradient id="gFans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#555" fontSize={11} />
              <YAxis stroke="#555" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="fans" stroke="#ec4899" fill="url(#gFans)" strokeWidth={2} />
              <Area type="monotone" dataKey="active" stroke="#06b6d4" fill="url(#gActive)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-[10px]">
            <span className="flex items-center gap-1 text-pink-400"><div className="w-2 h-2 rounded-full bg-pink-400" />{zh ? '总粉丝' : 'Total'}</span>
            <span className="flex items-center gap-1 text-cyan-400"><div className="w-2 h-2 rounded-full bg-cyan-400" />{zh ? '活跃粉丝' : 'Active'}</span>
          </div>
        </div>

        {/* Live activity feed */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '实时动态' : 'Live Feed'}</h3>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {ACTIVITIES.map((act, i) => {
              const ActIcon = ACTION_ICONS[act.type];
              return (
                <motion.div key={act.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .08 }}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-sm">{act.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs"><span className="font-semibold text-white">{act.user}</span> <span className="text-gray-500">{act.action}</span></div>
                    <div className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1">
                      <ActIcon className={`w-3 h-3 ${ACTION_COLORS[act.type]}`} /> {act.time} {zh ? '前' : 'ago'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '互动活动' : 'Events & Activities'}</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {EVENTS.map((event, i) => {
            const EvIcon = EVENT_ICONS[event.type];
            const st = EVENT_STATUS_STYLES[event.status];
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-pink-500/20 transition cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center"><EvIcon className="w-4 h-4 text-pink-400" /></div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{event.date}</span>
                </div>
                <h4 className="font-bold text-sm mb-2">{event.title}</h4>
                {event.participants > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3 h-3" /> {event.participants.toLocaleString()} {zh ? '参与' : 'joined'}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick reply bar */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
        <div className="flex gap-3">
          <input className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-pink-500/40 focus:outline-none transition"
            placeholder={zh ? '发布社群公告或回复粉丝...' : 'Post announcement or reply to fans...'} />
          <Button className="bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 gap-1"><Send className="w-4 h-4" /> {zh ? '发布' : 'Post'}</Button>
        </div>
      </div>
    </div>
  );
};
