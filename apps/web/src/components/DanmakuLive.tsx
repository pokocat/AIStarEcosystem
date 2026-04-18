"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Gift, Heart, MessageCircle, Send, Flame, Star, Sparkles, Zap, ThumbsUp, X } from 'lucide-react';
import type { Lang } from "../translations";

// --- Danmaku Bullet ---
interface DanmakuItem {
  id: number;
  text: string;
  user: string;
  color: string;
  y: number;
  speed: number;
  ts: number;
}

const COLORS = ['text-white', 'text-pink-400', 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-purple-400', 'text-orange-300'];
const MOCK_USERS = ['CyberFan', 'NeonLover', 'LunaSimp', 'PRISMArmy', 'BladeX', 'Crystal✨', 'StarDust', 'MC粉丝', 'PRISM7号'];
const MOCK_MSGS_ZH = [
  '太好听了！！', '🔥🔥🔥', '永远支持！', 'Neon V最棒！', '循环一万遍', '泪目了', '太燃了吧',
  '这个节奏绝了', '出专辑！', '❤️❤️❤️', '打call！', '直拍在哪里', '哇哦哦哦',
  '第一次听就爱了', '什么时候巡演', '冲冲冲', '不够听啊', '神曲预定',
];
const MOCK_MSGS_EN = [
  'Amazing!!', '🔥🔥🔥', 'Forever support!', 'Neon V best!', 'On repeat!!', 'So emotional', 'Fire!!',
  'This beat is insane', 'Drop the album!', '❤️❤️❤️', 'Cheering!', 'Where is the fancam', 'Wooow',
  'Loved it first listen', 'When is the tour?', 'Lets goooo', 'Need more!', 'Hit song confirmed',
];

const GIFT_TYPES = [
  { id: 'heart', emoji: '❤️', name_zh: '小心心', name_en: 'Heart', cost: 1 },
  { id: 'star', emoji: '⭐', name_zh: '星星', name_en: 'Star', cost: 5 },
  { id: 'rocket', emoji: '🚀', name_zh: '火箭', name_en: 'Rocket', cost: 50 },
  { id: 'crown', emoji: '👑', name_zh: '皇冠', name_en: 'Crown', cost: 100 },
  { id: 'diamond', emoji: '💎', name_zh: '钻石', name_en: 'Diamond', cost: 500 },
];

const REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '😭', label: 'Cry' },
  { emoji: '🤩', label: 'Wow' },
];

// --- Floating emoji burst ---
interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

export const DanmakuOverlay = ({ lang, isPlaying, artistName }: { lang: Lang; isPlaying: boolean; artistName: string }) => {
  const zh = lang === 'zh';
  const [danmakuItems, setDanmakuItems] = useState<DanmakuItem[]>([]);
  const [danmakuOn, setDanmakuOn] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [giftNotif, setGiftNotif] = useState<{ emoji: string; user: string; name: string } | null>(null);
  const [liveCount, setLiveCount] = useState(1247);
  const idRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-generate danmaku
  useEffect(() => {
    if (!isPlaying || !danmakuOn) return;
    const interval = setInterval(() => {
      const msgs = zh ? MOCK_MSGS_ZH : MOCK_MSGS_EN;
      const item: DanmakuItem = {
        id: idRef.current++,
        text: msgs[Math.floor(Math.random() * msgs.length)],
        user: MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        y: 10 + Math.random() * 60,
        speed: 8 + Math.random() * 6,
        ts: Date.now(),
      };
      setDanmakuItems(prev => [...prev.slice(-30), item]);
    }, 1200 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, [isPlaying, danmakuOn, zh]);

  // Remove old danmaku
  useEffect(() => {
    const timer = setInterval(() => {
      setDanmakuItems(prev => prev.filter(d => Date.now() - d.ts < 12000));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Simulate live count fluctuation
  useEffect(() => {
    const t = setInterval(() => setLiveCount(c => c + Math.floor(Math.random() * 5) - 2), 3000);
    return () => clearInterval(t);
  }, []);

  // Send danmaku
  const sendDanmaku = () => {
    if (!inputText.trim()) return;
    const item: DanmakuItem = {
      id: idRef.current++,
      text: inputText,
      user: 'Me',
      color: 'text-cyan-400',
      y: 10 + Math.random() * 60,
      speed: 10,
      ts: Date.now(),
    };
    setDanmakuItems(prev => [...prev.slice(-30), item]);
    setInputText('');
    setShowInput(false);
  };

  // Send gift
  const sendGift = (gift: typeof GIFT_TYPES[0]) => {
    setGiftNotif({ emoji: gift.emoji, user: 'CyberFan_01', name: zh ? gift.name_zh : gift.name_en });
    setShowGifts(false);
    setTimeout(() => setGiftNotif(null), 3000);
  };

  // Send reaction
  const sendReaction = useCallback((emoji: string) => {
    const burst: FloatingEmoji[] = Array.from({ length: 5 }, (_, i) => ({
      id: idRef.current++,
      emoji,
      x: 70 + Math.random() * 25,
      delay: i * 0.1,
    }));
    setFloatingEmojis(prev => [...prev, ...burst]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !burst.find(b => b.id === e.id)));
    }, 2500);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Live count badge */}
      <div className="absolute top-3 left-3 pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-red-500/80 backdrop-blur-sm rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] text-white font-semibold">LIVE</span>
          <span className="text-[10px] text-white/80">{liveCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Toggle danmaku */}
      <div className="absolute top-3 right-3 pointer-events-auto flex items-center gap-2">
        <button onClick={() => setDanmakuOn(!danmakuOn)}
          className={`text-[10px] px-2 py-1 rounded-full border backdrop-blur-sm transition ${danmakuOn ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-gray-500 bg-black/30'}`}>
          {zh ? (danmakuOn ? '弹幕开' : '弹幕关') : (danmakuOn ? 'Danmaku ON' : 'Danmaku OFF')}
        </button>
      </div>

      {/* Danmaku bullets */}
      {danmakuOn && danmakuItems.map(item => (
        <motion.div key={item.id}
          initial={{ x: '110%', opacity: 0 }}
          animate={{ x: '-110%', opacity: 1 }}
          transition={{ duration: item.speed, ease: 'linear' }}
          style={{ top: `${item.y}%` }}
          className={`absolute whitespace-nowrap text-sm ${item.color} pointer-events-none`}
          >
          <span className="bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs">
            <span className="text-gray-500 mr-1">{item.user}</span>
            {item.text}
          </span>
        </motion.div>
      ))}

      {/* Gift notification */}
      <AnimatePresence>
        {giftNotif && (
          <motion.div
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -200, opacity: 0 }}
            className="absolute bottom-28 left-3 pointer-events-none">
            <div className="bg-gradient-to-r from-pink-500/80 to-purple-500/80 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-2">
              <span className="text-xl">{giftNotif.emoji}</span>
              <div>
                <div className="text-xs font-semibold text-white">{giftNotif.user}</div>
                <div className="text-[10px] text-white/80">{zh ? '送出了' : 'sent'} {giftNotif.name}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating emoji reactions */}
      {floatingEmojis.map(fe => (
        <motion.div key={fe.id}
          initial={{ y: 0, opacity: 1, scale: 0.5 }}
          animate={{ y: -180, opacity: 0, scale: 1.2 }}
          transition={{ duration: 2, delay: fe.delay, ease: 'easeOut' }}
          style={{ right: `${fe.x}%` }}
          className="absolute bottom-32 text-2xl pointer-events-none">
          {fe.emoji}
        </motion.div>
      ))}

      {/* Bottom interaction bar */}
      <div className="absolute bottom-20 left-0 right-0 px-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* Chat input toggle */}
          <AnimatePresence>
            {showInput ? (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                className="flex-1 flex items-center gap-2">
                <input value={inputText} onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendDanmaku()}
                  autoFocus
                  className="flex-1 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-pink-500/30 focus:outline-none"
                  placeholder={zh ? '发弹幕...' : 'Send danmaku...'} />
                <button onClick={sendDanmaku} className="p-2 bg-pink-500/80 rounded-full"><Send className="w-3.5 h-3.5 text-white" /></button>
                <button onClick={() => setShowInput(false)} className="p-1.5 rounded-full bg-black/30"><X className="w-3 h-3 text-gray-400" /></button>
              </motion.div>
            ) : (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => setShowInput(true)}
                className="p-2.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full">
                <MessageCircle className="w-4 h-4 text-white" />
              </motion.button>
            )}
          </AnimatePresence>

          {!showInput && (
            <>
              {/* Reaction buttons */}
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-1 py-1 border border-white/5">
                {REACTIONS.map(r => (
                  <button key={r.label} onClick={() => sendReaction(r.emoji)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition text-sm active:scale-125">
                    {r.emoji}
                  </button>
                ))}
              </div>

              {/* Gift button */}
              <div className="relative">
                <button onClick={() => setShowGifts(!showGifts)}
                  className="p-2.5 bg-gradient-to-r from-pink-500/80 to-amber-500/80 backdrop-blur-sm rounded-full">
                  <Gift className="w-4 h-4 text-white" />
                </button>
                <AnimatePresence>
                  {showGifts && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                      className="absolute bottom-12 right-0 bg-gray-900/95 border border-white/10 rounded-xl p-3 backdrop-blur-xl min-w-[180px]">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">{zh ? '送礼物' : 'Send Gift'}</div>
                      <div className="grid grid-cols-5 gap-2">
                        {GIFT_TYPES.map(g => (
                          <button key={g.id} onClick={() => sendGift(g)}
                            className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg hover:bg-white/5 transition">
                            <span className="text-xl">{g.emoji}</span>
                            <span className="text-[8px] text-gray-500">{g.cost}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
