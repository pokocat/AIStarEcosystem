import React, { useState } from 'react';
import {
  Bell, X, Check, CheckCheck, Trash2, Heart, TrendingUp,
  Music, Shield, Users, Sparkles, AlertCircle, Zap
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";

interface Notification {
  id: string;
  type: 'revenue' | 'fan' | 'content' | 'system' | 'achievement';
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
  time: string;
  read: boolean;
}

const ICON_MAP = {
  revenue: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
  fan: { icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  content: { icon: Music, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  system: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  achievement: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'revenue', title: { zh: 'Spotify 版税到账', en: 'Spotify Royalty Received' }, desc: { zh: '¥8,200 已到账，来自《Neon Tears》流媒体版税', en: '¥8,200 received from "Neon Tears" streaming royalty' }, time: '2min', read: false },
  { id: 'n2', type: 'achievement', title: { zh: '成就解锁: 万人迷', en: 'Achievement: Fan Magnet' }, desc: { zh: 'Neon V 粉丝突破 128K！', en: 'Neon V fans exceeded 128K!' }, time: '15min', read: false },
  { id: 'n3', type: 'fan', title: { zh: '新粉丝涌入', en: 'Fan Surge' }, desc: { zh: '过去1小时新增 520 名粉丝', en: '520 new fans in the past hour' }, time: '1h', read: false },
  { id: 'n4', type: 'content', title: { zh: '内容审核通过', en: 'Content Approved' }, desc: { zh: '《Cyber City Vibe》MV 已通过审核，可发布', en: '"Cyber City Vibe" MV approved, ready to publish' }, time: '2h', read: true },
  { id: 'n5', type: 'system', title: { zh: '系统维护通知', en: 'System Maintenance' }, desc: { zh: '4月20日 02:00-04:00 系统升级，部分功能暂停', en: 'System upgrade Apr 20 02:00-04:00' }, time: '5h', read: true },
  { id: 'n6', type: 'revenue', title: { zh: 'NFT #287 售出', en: 'NFT #287 Sold' }, desc: { zh: '¥4,800 收入，买家: CryptoFan_X', en: '¥4,800 revenue, buyer: CryptoFan_X' }, time: '8h', read: true },
  { id: 'n7', type: 'achievement', title: { zh: '里程碑: 百万播放', en: 'Milestone: 1M Plays' }, desc: { zh: '《Digital Sunset》总播放量突破 100 万！', en: '"Digital Sunset" exceeded 1M total plays!' }, time: '1d', read: true },
];

export const NotificationPanel = ({ lang, open, onClose }: { lang: Lang; open: boolean; onClose: () => void }) => {
  const zh = lang === 'zh';
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === 'all' ? notifications : notifications.filter(n => !n.read);

  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  const removeNotif = (id: string) => setNotifications(ns => ns.filter(n => n.id !== id));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40" />
          <motion.div initial={{ opacity: 0, y: -10, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-96 max-h-[520px] bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">{zh ? '通知中心' : 'Notifications'}</h3>
                {unreadCount > 0 && <Badge className="text-[10px] bg-red-500/10 text-red-400 border-0">{unreadCount}</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-cyan-400 hover:text-cyan-300 transition px-2 py-1 rounded hover:bg-cyan-500/10">
                    <CheckCheck className="w-3 h-3 inline mr-0.5" /> {zh ? '全部已读' : 'Read All'}
                  </button>
                )}
                <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-1 px-4 py-2 border-b border-white/5">
              {(['all', 'unread'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[10px] rounded-full transition ${filter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {f === 'all' ? (zh ? '全部' : 'All') : (zh ? `未读 (${unreadCount})` : `Unread (${unreadCount})`)}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-8 h-8 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">{zh ? '暂无通知' : 'No notifications'}</p>
                </div>
              ) : (
                filtered.map((notif, i) => {
                  const conf = ICON_MAP[notif.type];
                  const Icon = conf.icon;
                  return (
                    <motion.div key={notif.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .03 }}
                      onClick={() => markRead(notif.id)}
                      className={`flex gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition hover:bg-white/[0.02] ${!notif.read ? 'bg-white/[0.01]' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg ${conf.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${conf.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                          <span className={`text-xs font-semibold truncate ${notif.read ? 'text-gray-400' : 'text-white'}`}>{zh ? notif.title.zh : notif.title.en}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{zh ? notif.desc.zh : notif.desc.en}</p>
                        <span className="text-[10px] text-gray-600 mt-1 block">{notif.time} {zh ? '前' : 'ago'}</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeNotif(notif.id); }} className="text-gray-600 hover:text-red-400 transition shrink-0 mt-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
