/**
 * NotificationCenter — 全局通知中心
 * P4 新增：跨角色消息推送 · 审核结果/系统告警/合同到期/任务分配 · 已读管理
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, CheckCircle2, AlertTriangle, Clock, FileText,
  Shield, Zap, Users, X, ChevronRight, Filter,
  Eye, Trash2, MailOpen, AlertCircle, Radio,
  TrendingUp, Scissors, Music, Award
} from 'lucide-react';
import type { Lang } from '../translations';

// ─── Types ───────────────────────────────────────────────────────
type NotiCategory = 'all' | 'review' | 'alert' | 'contract' | 'task' | 'system';
type NotiPriority = 'critical' | 'high' | 'normal' | 'low';
type NotiRole = 'mcn' | 'producer' | 'studio' | 'reviewer' | 'matrix' | 'celebrity';

interface Notification {
  id: string; title: string; titleEn: string;
  body: string; bodyEn: string;
  category: NotiCategory; priority: NotiPriority;
  role: NotiRole; read: boolean;
  createdAt: string; actionLabel?: string; actionLabelEn?: string;
  icon: React.ComponentType<any>; color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1', title: '直播间流量异常告警', titleEn: 'Live Room Traffic Alert',
    body: '张艺星DY直播间流量在过去1小时下降42%，当前在线12.8万，建议立即投流干预',
    bodyEn: 'DY live traffic dropped 42% in 1h, 128K online. Recommend immediate boost intervention.',
    category: 'alert', priority: 'critical', role: 'matrix', read: false,
    createdAt: '2分钟前', actionLabel: '立即投流', actionLabelEn: 'Boost Now',
    icon: AlertTriangle, color: '#ef4444',
  },
  {
    id: 'n2', title: '合同到期提醒', titleEn: 'Contract Expiry Reminder',
    body: '张艺星MCN独家签约协议将在89天后到期（2027-01-14），请提前启动续签流程',
    bodyEn: 'Zhang Yi Xing MCN exclusive contract expires in 89 days (2027-01-14). Start renewal process.',
    category: 'contract', priority: 'high', role: 'mcn', read: false,
    createdAt: '15分钟前', actionLabel: '申请续签', actionLabelEn: 'Request Renewal',
    icon: FileText, color: '#f59e0b',
  },
  {
    id: 'n3', title: '审核结果通知', titleEn: 'Review Result',
    body: '「林音宝护肤产品口播稿-效果版」已通过运营初审，进入合作方复审阶段',
    bodyEn: '"Lin Yin Bao Skincare Script-Effect Ver." passed Ops First review. Now in Partner Review.',
    category: 'review', priority: 'normal', role: 'studio', read: false,
    createdAt: '32分钟前', actionLabel: '查看详情', actionLabelEn: 'View Details',
    icon: CheckCircle2, color: '#22c55e',
  },
  {
    id: 'n4', title: '紧急制作任务分配', titleEn: 'Urgent Task Assigned',
    body: '「张艺星618直播回放-切片任务」被标记为紧急，截止时间今日18:00，请立即处理',
    bodyEn: '"Zhang Yi Xing 618 Live Clip Task" marked URGENT, due today 18:00. Handle immediately.',
    category: 'task', priority: 'critical', role: 'studio', read: false,
    createdAt: '1小时前', actionLabel: '立即开始', actionLabelEn: 'Start Now',
    icon: Scissors, color: '#ef4444',
  },
  {
    id: 'n5', title: '侵权巡查发现新预警', titleEn: 'New IP Infringement Alert',
    body: '林音宝日常Vlog混剪内容在DY平台发现疑似未授权使用，置信度72%，需法务复核',
    bodyEn: 'Suspected unauthorized use of Lin Yin Bao Vlog content found on DY, 72% confidence. Legal review needed.',
    category: 'alert', priority: 'high', role: 'reviewer', read: false,
    createdAt: '2小时前', actionLabel: '创建工单', actionLabelEn: 'File Ticket',
    icon: Shield, color: '#f59e0b',
  },
  {
    id: 'n6', title: '艺人孵化里程碑达成', titleEn: 'Artist Milestone Achieved',
    body: '张艺星全平台粉丝突破1000万，触发A→S级晋升评估流程，请查看成长档案',
    bodyEn: 'Zhang Yi Xing total fans hit 10M. A→S class promotion evaluation triggered. Check growth tracker.',
    category: 'system', priority: 'high', role: 'mcn', read: true,
    createdAt: '3小时前', actionLabel: '查看档案', actionLabelEn: 'View Profile',
    icon: Award, color: '#a855f7',
  },
  {
    id: 'n7', title: '收益结算单已生成', titleEn: 'Revenue Settlement Ready',
    body: '5月份艺人收益分成结算单已生成，张艺星应收¥24,800，林音宝应收¥12,400，请确认',
    bodyEn: 'May revenue split statement ready. Zhang: ¥24,800, Lin: ¥12,400. Please confirm.',
    category: 'system', priority: 'normal', role: 'mcn', read: true,
    createdAt: '5小时前', actionLabel: '查看结算', actionLabelEn: 'View Settlement',
    icon: TrendingUp, color: '#22c55e',
  },
  {
    id: 'n8', title: '内容发布池待审内容', titleEn: 'Content Pool Pending Review',
    body: '发布池中有3条内容已达到推送条件，等待运营人员最终确认发布，请及时处理',
    bodyEn: '3 content pieces in pool meet publish criteria, awaiting final operator approval.',
    category: 'task', priority: 'normal', role: 'matrix', read: true,
    createdAt: '6小时前', actionLabel: '前往审核', actionLabelEn: 'Review Now',
    icon: Radio, color: '#06b6d4',
  },
  {
    id: 'n9', title: '系统维护通知', titleEn: 'System Maintenance Notice',
    body: '平台将于本周六00:00-04:00进行例行维护升级，期间部分功能暂停服务，请提前安排工作',
    bodyEn: 'Platform maintenance this Saturday 00:00-04:00. Some features offline. Plan accordingly.',
    category: 'system', priority: 'low', role: 'mcn', read: true,
    createdAt: '1天前', icon: Bell, color: '#6b7280',
  },
  {
    id: 'n10', title: '品牌合作请求待处理', titleEn: 'Brand Collab Request Pending',
    body: '品牌方「安踏运动」已提交肖战品牌授权申请（¥580万），处于合作方复审阶段，需本人确认',
    bodyEn: 'Anta Sports submitted brand authorization request for Xiao Zhan (¥5.8M). Pending artist confirmation.',
    category: 'review', priority: 'high', role: 'celebrity', read: false,
    createdAt: '2天前', actionLabel: '查看申请', actionLabelEn: 'View Request',
    icon: Users, color: '#f59e0b',
  },
];

const CATEGORY_CFG: Record<NotiCategory, { zh: string; en: string; color: string; icon: React.ComponentType<any> }> = {
  all:      { zh: '全部', en: 'All', color: '#6b7280', icon: Bell },
  review:   { zh: '审核结果', en: 'Review', color: '#22c55e', icon: CheckCircle2 },
  alert:    { zh: '系统告警', en: 'Alerts', color: '#ef4444', icon: AlertTriangle },
  contract: { zh: '合同提醒', en: 'Contracts', color: '#f59e0b', icon: FileText },
  task:     { zh: '任务分配', en: 'Tasks', color: '#06b6d4', icon: Scissors },
  system:   { zh: '系统通知', en: 'System', color: '#a855f7', icon: Zap },
};

const PRIORITY_BADGE: Record<NotiPriority, { zh: string; en: string; color: string; bg: string }> = {
  critical: { zh: '严重', en: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25' },
  high:     { zh: '重要', en: 'HIGH',     color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  normal:   { zh: '普通', en: 'NORMAL',   color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
  low:      { zh: '低',   en: 'LOW',      color: 'text-gray-700', bg: 'bg-gray-700/10 border-gray-700/20' },
};

const ROLE_LABEL: Record<NotiRole, { zh: string; en: string; color: string }> = {
  mcn:       { zh: 'MCN掌门人', en: 'MCN Boss', color: '#ef4444' },
  producer:  { zh: 'AI音乐制作人', en: 'AI Producer', color: '#a855f7' },
  studio:    { zh: '制作/剪辑端', en: 'Studio', color: '#22c55e' },
  reviewer:  { zh: '审核/法务端', en: 'Reviewer', color: '#f97316' },
  matrix:    { zh: '矩阵打歌', en: 'Matrix', color: '#ec4899' },
  celebrity: { zh: '明星端', en: 'Celebrity', color: '#f59e0b' },
};

interface Props { lang: Lang; }

export const NotificationCenter = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [category, setCategory] = useState<NotiCategory>('all');
  const [notiList, setNotiList] = useState(NOTIFICATIONS);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = notiList.filter(n => {
    const catMatch = category === 'all' || n.category === category;
    const readMatch = !showUnreadOnly || !n.read;
    return catMatch && readMatch;
  });

  const unreadCount = notiList.filter(n => !n.read).length;
  const criticalCount = notiList.filter(n => n.priority === 'critical' && !n.read).length;

  const markRead = (id: string) => {
    setNotiList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotiList(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNoti = (id: string) => {
    setNotiList(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '通知中心' : 'Notification Center'}
            {unreadCount > 0 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/25">
                {unreadCount} {zh ? '条未读' : 'unread'}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '跨角色消息 · 审核结果 · 系统告警 · 合同到期 · 任务分配' : 'Cross-role messages · Review results · Alerts · Contract reminders · Tasks'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${showUnreadOnly ? 'bg-white/10 text-white border-white/20' : 'border-white/8 text-gray-500 hover:border-white/20'}`}>
            <Filter className="w-3.5 h-3.5" />{zh ? '仅未读' : 'Unread only'}
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
              <MailOpen className="w-3.5 h-3.5" />{zh ? '全部已读' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          <span className="text-[10px] text-red-400 flex-1 font-bold">
            {zh ? `${criticalCount}条严重告警需要立即处理` : `${criticalCount} critical alerts require immediate attention`}
          </span>
        </div>
      )}

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(CATEGORY_CFG) as [NotiCategory, typeof CATEGORY_CFG[NotiCategory]][]).map(([key, cfg]) => {
          const CatIcon = cfg.icon;
          const count = key === 'all' ? notiList.length : notiList.filter(n => n.category === key).length;
          const unread = key === 'all' ? unreadCount : notiList.filter(n => n.category === key && !n.read).length;
          return (
            <button key={key} onClick={() => setCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${category === key ? 'text-white border-white/20 bg-white/8' : 'border-white/5 text-gray-500 hover:border-white/15'}`}
              style={category === key ? { borderColor: `${cfg.color}35`, background: `${cfg.color}08` } : {}}>
              <CatIcon className="w-3.5 h-3.5" style={{ color: category === key ? cfg.color : undefined }} />
              <span style={{ color: category === key ? '#fff' : undefined }}>{zh ? cfg.zh : cfg.en}</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${unread > 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-600'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 text-gray-600">
              <Bell className="w-10 h-10 mx-auto mb-3 text-gray-800" />
              <div className="text-sm">{zh ? '暂无通知' : 'No notifications'}</div>
            </motion.div>
          ) : (
            filtered.map((noti, i) => {
              const NIcon = noti.icon;
              const catCfg = CATEGORY_CFG[noti.category];
              const priCfg = PRIORITY_BADGE[noti.priority];
              const roleCfg = ROLE_LABEL[noti.role];
              return (
                <motion.div key={noti.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition group ${
                    !noti.read ? 'bg-white/[0.03] border-white/8' :
                    noti.priority === 'critical' ? 'bg-red-500/3 border-red-500/12' :
                    'bg-gray-900/30 border-white/4 opacity-70'
                  }`}>
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${noti.color}15`, border: `1px solid ${noti.color}30` }}>
                    <NIcon className="w-4 h-4" style={{ color: noti.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold ${noti.read ? 'text-gray-400' : 'text-white'}`}>{zh ? noti.title : noti.titleEn}</span>
                      {/* Unread dot */}
                      {!noti.read && <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{zh ? noti.body : noti.bodyEn}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Priority badge */}
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${priCfg.bg} ${priCfg.color}`}>
                        {zh ? priCfg.zh : priCfg.en}
                      </span>
                      {/* Category */}
                      <span className="text-[9px] font-semibold" style={{ color: catCfg.color }}>
                        {zh ? catCfg.zh : catCfg.en}
                      </span>
                      {/* Role */}
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/8 font-semibold" style={{ color: roleCfg.color }}>
                        {zh ? roleCfg.zh : roleCfg.en}
                      </span>
                      {/* Time */}
                      <span className="text-[9px] text-gray-700 ml-auto">{noti.createdAt}</span>
                    </div>

                    {/* Action button */}
                    {noti.actionLabel && (
                      <div className="mt-2.5">
                        <button onClick={() => markRead(noti.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                            noti.priority === 'critical' ? 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20' :
                            noti.priority === 'high' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20' :
                            'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                          }`}>
                          <ChevronRight className="w-3 h-3" />
                          {zh ? noti.actionLabel : noti.actionLabelEn}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    {!noti.read && (
                      <button onClick={() => markRead(noti.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                        title={zh ? '标为已读' : 'Mark read'}>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteNoti(noti.id)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition"
                      title={zh ? '删除' : 'Delete'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {filtered.length > 0 && (
        <div className="text-center text-[10px] text-gray-700 pt-2">
          {zh ? `共 ${filtered.length} 条通知` : `${filtered.length} notifications total`}
        </div>
      )}
    </div>
  );
};
