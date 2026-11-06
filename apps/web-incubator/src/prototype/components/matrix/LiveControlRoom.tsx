/**
 * LiveControlRoom — 直播控制室
 * P3 新增：多账号直播同屏监控 · 实时GMV/弹幕/礼物 · 快捷切片 · 预警告警
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio, Eye, Heart, Gift, Zap, TrendingUp, Users, AlertTriangle,
  Scissors, ChevronRight, Wifi, WifiOff, Maximize2,
  MessageSquare, Play, Square, Volume2, Shield, Star, Flame
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type LiveStatus = 'live' | 'offline' | 'starting';
type PlatformKey = 'DY' | 'KS' | 'XHS' | 'VCH' | 'BL';

interface LiveRoom {
  id: string; accountName: string; platform: PlatformKey;
  artist: string; title: string; status: LiveStatus;
  viewers: number; viewersMax: number;
  gmv: number; gmvTarget: number;
  likes: number; gifts: number; comments: number;
  duration: string; network: 'excellent' | 'good' | 'poor';
  hotScore: number; clip_count: number;
}

interface DanmakuMsg {
  id: string; user: string; content: string;
  type: 'normal' | 'gift' | 'follow' | 'purchase';
  amount?: number; time: string;
}

interface Alert {
  id: string; level: 'critical' | 'warning' | 'info';
  msg: string; msgEn: string; roomId: string; time: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const LIVE_ROOMS: LiveRoom[] = [
  { id: 'lr1', accountName: '@张艺星官方',   platform: 'DY',  artist: '张艺星',
    title: '《星河》打榜直播·粉丝见面会', status: 'live', viewers: 128400, viewersMax: 180000,
    gmv: 48200, gmvTarget: 80000, likes: 892000, gifts: 2340, comments: 12800,
    duration: '02:14:33', network: 'excellent', hotScore: 94, clip_count: 8 },
  { id: 'lr2', accountName: '@林音宝护肤',   platform: 'XHS', artist: '林音宝',
    title: '换季护肤专场·精华测评直播', status: 'live', viewers: 42600, viewersMax: 60000,
    gmv: 22800, gmvTarget: 35000, likes: 340000, gifts: 890, comments: 5600,
    duration: '01:08:22', network: 'good', hotScore: 71, clip_count: 4 },
  { id: 'lr3', accountName: '@星河快手矩阵', platform: 'KS',  artist: '张艺星',
    title: '《星河》快手应援·同步开播', status: 'live', viewers: 18900, viewersMax: 25000,
    gmv: 8400, gmvTarget: 15000, likes: 128000, gifts: 420, comments: 3200,
    duration: '02:14:33', network: 'good', hotScore: 62, clip_count: 3 },
  { id: 'lr4', accountName: '@张艺星视频号', platform: 'VCH', artist: '张艺星',
    title: '《星河》视频号同步直播', status: 'offline', viewers: 0, viewersMax: 12000,
    gmv: 0, gmvTarget: 10000, likes: 0, gifts: 0, comments: 0,
    duration: '--:--:--', network: 'poor', hotScore: 0, clip_count: 0 },
  { id: 'lr5', accountName: '@林音宝DY',    platform: 'DY',  artist: '林音宝',
    title: '护肤好物分享·限时福利', status: 'starting', viewers: 0, viewersMax: 30000,
    gmv: 0, gmvTarget: 20000, likes: 0, gifts: 0, comments: 0,
    duration: '00:00:12', network: 'excellent', hotScore: 0, clip_count: 0 },
];

const DANMAKU: DanmakuMsg[] = [
  { id: 'd1', user: '星河应援团',  content: '张艺星加油！《星河》冲冲冲！', type: 'normal',  time: '刚刚' },
  { id: 'd2', user: '用户12345',   content: '',                            type: 'gift',    amount: 888, time: '5秒前' },
  { id: 'd3', user: '护肤控Linda', content: '林音宝真的好用！已下单！',    type: 'purchase', amount: 299, time: '8秒前' },
  { id: 'd4', user: '新粉丝小甜',  content: '',                            type: 'follow',  time: '10秒前' },
  { id: 'd5', user: '音乐爱好者',  content: '这首歌太好听了！',            type: 'normal',  time: '12秒前' },
  { id: 'd6', user: 'VIP用户007', content: '',                            type: 'gift',    amount: 6666, time: '15秒前' },
  { id: 'd7', user: '粉丝团长',   content: '冲榜第一！必须的！',          type: 'normal',  time: '18秒前' },
  { id: 'd8', user: '路人甲',     content: '护肤效果真的好！',            type: 'normal',  time: '20秒前' },
];

const ALERTS: Alert[] = [
  { id: 'a1', level: 'critical', msg: '张艺星DY直播间流量异常下降40%，建议立即发起投流', msgEn: 'DY traffic dropped 40% — recommend immediate boost', roomId: 'lr1', time: '2分钟前' },
  { id: 'a2', level: 'warning',  msg: '视频号账号已离线30分钟，请检查推流状态', msgEn: 'VCH account offline 30min — check stream status', roomId: 'lr4', time: '30分钟前' },
  { id: 'a3', level: 'info',     msg: '林音宝DY直播即将开始，请准备监控接入', msgEn: 'Lin Yin Bao DY live starting — prepare monitor', roomId: 'lr5', time: '刚刚' },
];

const PLATFORM_COLOR: Record<PlatformKey, string> = {
  DY: '#ff2d55', KS: '#ff6600', XHS: '#ff2442', VCH: '#07c160', BL: '#00aeec',
};

const NETWORK_CFG = {
  excellent: { zh: '优', en: 'EXC', color: 'text-emerald-400' },
  good:      { zh: '良', en: 'GOOD', color: 'text-amber-400' },
  poor:      { zh: '差', en: 'POOR', color: 'text-red-400' },
};

const STATUS_CFG: Record<LiveStatus, { zh: string; en: string; dot: string }> = {
  live:     { zh: '直播中', en: 'LIVE', dot: 'bg-red-500' },
  offline:  { zh: '未开播', en: 'Offline', dot: 'bg-gray-600' },
  starting: { zh: '准备中', en: 'Starting', dot: 'bg-amber-400' },
};

interface Props { lang: Lang; }

export const LiveControlRoom = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selectedRoom, setSelectedRoom] = useState<LiveRoom>(LIVE_ROOMS[0]);
  const [danmaku, setDanmaku] = useState(DANMAKU);
  const [tick, setTick] = useState(0);
  const [showAlerts, setShowAlerts] = useState(true);

  // Simulate live data refresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const liveRooms = LIVE_ROOMS.filter(r => r.status === 'live');
  const totalViewers = liveRooms.reduce((s, r) => s + r.viewers, 0);
  const totalGmv = liveRooms.reduce((s, r) => s + r.gmv, 0);
  const criticalAlerts = ALERTS.filter(a => a.level === 'critical');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '直播控制室' : 'Live Control Room'}
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {liveRooms.length} {zh ? '路直播进行中' : 'LIVE'}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '多账号同屏监控 · 实时数据 · 快捷切片 · 异常预警' : 'Multi-room monitor · Real-time · Quick clip · Alerts'}</p>
        </div>
        <div className="flex gap-2">
          {criticalAlerts.length > 0 && (
            <button onClick={() => setShowAlerts(!showAlerts)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />{criticalAlerts.length} {zh ? '个严重告警' : 'critical'}
            </button>
          )}
        </div>
      </div>

      {/* Alerts Banner */}
      <AnimatePresence>
        {showAlerts && ALERTS.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="space-y-1.5">
            {ALERTS.map(alert => (
              <div key={alert.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                alert.level === 'critical' ? 'bg-red-500/5 border-red-500/20' :
                alert.level === 'warning' ? 'bg-amber-500/5 border-amber-500/15' :
                'bg-blue-500/5 border-blue-500/15'
              }`}>
                {alert.level === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" /> :
                 alert.level === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> :
                 <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                <span className={`text-[10px] flex-1 ${alert.level === 'critical' ? 'text-red-400' : alert.level === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                  {zh ? alert.msg : alert.msgEn}
                </span>
                <span className="text-[9px] text-gray-600 shrink-0">{alert.time}</span>
                {alert.level === 'critical' && (
                  <button className="shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition">
                    {zh ? '立即处理' : 'Fix Now'}
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? '实时在线观众' : 'Total Viewers', value: `${(totalViewers / 10000).toFixed(1)}万`, color: '#06b6d4', icon: Eye },
          { label: zh ? '直播GMV合计' : 'Live GMV', value: `¥${(totalGmv / 10000).toFixed(1)}万`, color: '#22c55e', icon: Zap },
          { label: zh ? '直播间数量' : 'Live Rooms', value: liveRooms.length, color: '#ef4444', icon: Radio },
          { label: zh ? '今日切片数' : 'Clips Today', value: LIVE_ROOMS.reduce((s, r) => s + r.clip_count, 0), color: '#a855f7', icon: Scissors },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                <span className="text-[10px] text-gray-500">{k.label}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Main layout: room grid + detail + danmaku */}
      <div className="grid grid-cols-[200px_1fr_220px] gap-4 min-h-0">

        {/* Room List Sidebar */}
        <div className="space-y-2">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '直播间列表' : 'Rooms'}</div>
          {LIVE_ROOMS.map(room => {
            const sCfg = STATUS_CFG[room.status];
            const netCfg = NETWORK_CFG[room.network];
            return (
              <button key={room.id} onClick={() => setSelectedRoom(room)}
                className={`w-full text-left p-3 rounded-xl border transition ${selectedRoom.id === room.id ? 'bg-white/8 border-white/20' : 'bg-gray-900/50 border-white/5 hover:border-white/15'} ${room.status === 'offline' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sCfg.dot} ${room.status === 'live' ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] font-black shrink-0" style={{ color: PLATFORM_COLOR[room.platform] }}>{room.platform}</span>
                  <span className={`text-[8px] font-bold ml-auto ${netCfg.color}`}>
                    {room.status === 'live' ? (zh ? netCfg.zh : netCfg.en) : (zh ? sCfg.zh : sCfg.en)}
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-white truncate">{room.accountName}</div>
                {room.status === 'live' && (
                  <div className="text-[9px] text-gray-500 mt-0.5">{(room.viewers / 10000).toFixed(1)}万{zh ? '在线' : ''} · ¥{(room.gmv / 10000).toFixed(1)}万</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Room Detail */}
        <div className="space-y-3">
          <div className="bg-gray-900/50 border border-white/8 rounded-xl p-5">
            {/* Room header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${STATUS_CFG[selectedRoom.status].dot} ${selectedRoom.status === 'live' ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] font-black" style={{ color: PLATFORM_COLOR[selectedRoom.platform] }}>{selectedRoom.platform}</span>
                  <span className="text-sm font-bold text-white">{selectedRoom.accountName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${selectedRoom.status === 'live' ? 'bg-red-500/15 text-red-400' : selectedRoom.status === 'starting' ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-500'}`}>
                    {zh ? STATUS_CFG[selectedRoom.status].zh : STATUS_CFG[selectedRoom.status].en}
                  </span>
                </div>
                <div className="text-xs text-gray-400">{selectedRoom.title}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{selectedRoom.artist} · {selectedRoom.duration}</div>
              </div>
              <div className="flex gap-2">
                {selectedRoom.status === 'live' && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-400 text-[10px] font-bold hover:bg-pink-500/20 transition">
                    <Scissors className="w-3 h-3" />{zh ? '快捷切片' : 'Quick Clip'}
                  </button>
                )}
                <button className="p-2 rounded-lg border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated live monitor */}
            <div className="w-full h-48 rounded-xl bg-black border border-white/8 relative overflow-hidden mb-4">
              {selectedRoom.status === 'live' ? (
                <>
                  {/* Fake live gradient */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a0030 0%, #0d001a 40%, #001a0d 100%)' }} />
                  {/* Pulsing overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-black mb-1" style={{ color: PLATFORM_COLOR[selectedRoom.platform], fontFamily: 'var(--font-display)' }}>
                        {selectedRoom.artist}
                      </div>
                      <div className="text-xs text-white/60">{selectedRoom.title}</div>
                    </div>
                  </div>
                  {/* Live badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/90 text-white text-[10px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
                  </div>
                  {/* Duration */}
                  <div className="absolute top-3 right-3 text-[10px] font-mono text-white/70 bg-black/50 px-2 py-1 rounded">
                    {selectedRoom.duration}
                  </div>
                  {/* Bottom overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent flex items-end px-3 pb-2 justify-between">
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-white"><Eye className="w-3 h-3" />{(selectedRoom.viewers / 10000).toFixed(1)}万</span>
                      <span className="flex items-center gap-1 text-pink-400"><Heart className="w-3 h-3" />{(selectedRoom.likes / 10000).toFixed(0)}万</span>
                    </div>
                    <span className="text-emerald-400 text-[10px] font-bold">¥{selectedRoom.gmv.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                  {selectedRoom.status === 'starting'
                    ? <div className="text-center">
                        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <div className="text-amber-400 text-xs font-bold">{zh ? '准备中...' : 'Starting...'}</div>
                      </div>
                    : <div className="text-center">
                        <WifiOff className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <div className="text-[10px]">{zh ? '未开播' : 'Offline'}</div>
                      </div>}
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            {selectedRoom.status === 'live' && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: zh ? '在线观众' : 'Viewers', value: `${(selectedRoom.viewers / 10000).toFixed(1)}万`, max: selectedRoom.viewersMax, cur: selectedRoom.viewers, color: '#06b6d4', icon: Users },
                  { label: zh ? '直播GMV' : 'Live GMV', value: `¥${(selectedRoom.gmv / 10000).toFixed(1)}万`, max: selectedRoom.gmvTarget, cur: selectedRoom.gmv, color: '#22c55e', icon: TrendingUp },
                  { label: zh ? '热度指数' : 'Hot Score', value: selectedRoom.hotScore, max: 100, cur: selectedRoom.hotScore, color: '#ef4444', icon: Flame },
                ].map((m, i) => {
                  const MIcon = m.icon;
                  return (
                    <div key={i} className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MIcon className="w-3 h-3" style={{ color: m.color }} />
                        <span className="text-[9px] text-gray-500">{m.label}</span>
                      </div>
                      <div className="text-lg font-black mb-1.5" style={{ color: m.color, fontFamily: 'var(--font-display)' }}>{m.value}</div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((m.cur / m.max) * 100, 100)}%`, background: m.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: zh ? '发起切片任务' : 'Start Clip', color: '#ec4899', icon: Scissors },
              { label: zh ? '启动投流' : 'Boost', color: '#f59e0b', icon: Zap },
              { label: zh ? '提高音量' : 'Volume', color: '#06b6d4', icon: Volume2 },
              { label: zh ? '查看弹幕' : 'Danmaku', color: '#a855f7', icon: MessageSquare },
            ].map((action, i) => {
              const AIcon = action.icon;
              return (
                <button key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/8 bg-gray-900/50 hover:border-white/20 transition">
                  <AIcon className="w-4 h-4" style={{ color: action.color }} />
                  <span className="text-[9px] text-gray-400 text-center leading-tight">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Danmaku / Chat feed */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400">{zh ? '实时弹幕' : 'Live Danmaku'}</span>
            <div className="flex items-center gap-1 text-[9px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{zh ? '实时' : 'LIVE'}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 max-h-[480px]">
            <AnimatePresence initial={false}>
              {danmaku.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-2 rounded-lg ${
                    msg.type === 'gift' ? 'bg-amber-500/8 border border-amber-500/15' :
                    msg.type === 'purchase' ? 'bg-emerald-500/8 border border-emerald-500/15' :
                    msg.type === 'follow' ? 'bg-blue-500/8 border border-blue-500/15' :
                    'bg-white/3 border border-white/5'
                  }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                      {msg.type === 'gift' ? <Gift className="w-2.5 h-2.5 text-amber-400" /> :
                       msg.type === 'purchase' ? <Zap className="w-2.5 h-2.5 text-emerald-400" /> :
                       msg.type === 'follow' ? <Star className="w-2.5 h-2.5 text-blue-400" /> :
                       <Users className="w-2.5 h-2.5 text-gray-500" />}
                    </div>
                    <span className="text-[9px] text-gray-400 truncate">{msg.user}</span>
                    <span className="text-[8px] text-gray-700 ml-auto shrink-0">{msg.time}</span>
                  </div>
                  <div className={`text-[10px] leading-snug ${
                    msg.type === 'gift' ? 'text-amber-300' :
                    msg.type === 'purchase' ? 'text-emerald-300' :
                    msg.type === 'follow' ? 'text-blue-300' : 'text-gray-300'
                  }`}>
                    {msg.type === 'gift' ? `${zh ? '赠送礼物' : 'Gift'} ×${msg.amount}` :
                     msg.type === 'purchase' ? `${zh ? '下单购买' : 'Purchase'} ¥${msg.amount}` :
                     msg.type === 'follow' ? (zh ? '关注了直播间' : 'Just followed') :
                     msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="p-3 border-t border-white/5">
            <input placeholder={zh ? '向直播间发送消息...' : 'Send to room...'}
              className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition" />
          </div>
        </div>
      </div>
    </div>
  );
};
