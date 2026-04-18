"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, X, Check, CheckCheck, Trash2, Heart, TrendingUp,
  Music, Shield, Users, Sparkles, AlertCircle, Zap
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";
import type { Notification } from "@/types/notification";
import { NOTIFICATION_ICON_MAP as ICON_MAP } from "@/constants/notification-ui";
import { NotificationsApi } from "@/api";

interface NotificationPanelProps {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

export const NotificationPanel = ({ lang, open, onClose, notifications, setNotifications }: NotificationPanelProps) => {
  const zh = lang === 'zh';
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === 'all' ? notifications : notifications.filter(n => !n.read);

  const markAllRead = () => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    NotificationsApi.markAllNotificationsRead().catch(() => { /* optimistic: tolerate failure */ });
  };
  const markRead = (id: string) => {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    NotificationsApi.markNotificationRead(id).catch(() => { /* optimistic */ });
  };
  const removeNotif = (id: string) => {
    setNotifications(ns => ns.filter(n => n.id !== id));
    NotificationsApi.deleteNotification(id).catch(() => { /* optimistic */ });
  };

  // 鼠标离开浮层后 800ms 自动关闭；鼠标再次进入取消关闭
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    leaveTimer.current = setTimeout(() => onClose(), 800);
  };
  useEffect(() => {
    if (!open) cancelClose();
    return cancelClose;
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[100]" />
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] max-h-[520px] bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[110] flex flex-col overflow-hidden">
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
                          <span className={`text-xs font-semibold truncate ${notif.read ? 'text-gray-400' : 'text-white'}`}>{notif.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{notif.desc}</p>
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
