"use client";

import React, { useState, useMemo } from 'react';
import {
  Shirt, Scissors, Sparkles, Star, Lock, Check, Search,
  Grid3X3, ShoppingBag, Eye, Crown, Gem, Filter, Plus
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";
import { type Artist, type ArtistType, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from './ArtistTypes';

type ItemCategory = 'outfit' | 'hair' | 'accessory' | 'makeup' | 'background';
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface WardrobeItem {
  id: string;
  name: { zh: string; en: string };
  category: ItemCategory;
  rarity: Rarity;
  owned: boolean;
  equipped: boolean;
  price: number;
  forTypes: ArtistType[] | 'all';
  preview: string; // emoji placeholder
}

const RARITY_STYLES: Record<Rarity, { color: string; bg: string; border: string; zh: string; en: string }> = {
  common: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-600/30', zh: '普通', en: 'Common' },
  rare: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', zh: '稀有', en: 'Rare' },
  epic: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', zh: '史诗', en: 'Epic' },
  legendary: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', zh: '传说', en: 'Legendary' },
};

const CATEGORY_CONFIG: Record<ItemCategory, { icon: any; zh: string; en: string }> = {
  outfit: { icon: Shirt, zh: '服装', en: 'Outfit' },
  hair: { icon: Scissors, zh: '发型', en: 'Hair' },
  accessory: { icon: Gem, zh: '配饰', en: 'Accessory' },
  makeup: { icon: Sparkles, zh: '妆容', en: 'Makeup' },
  background: { icon: Grid3X3, zh: '背景', en: 'Background' },
};

// Type-specific wardrobe items
const WARDROBE_ITEMS: WardrobeItem[] = [
  // Singer outfits
  { id: 'w1', name: { zh: '赛博朋克演出服', en: 'Cyberpunk Stage Outfit' }, category: 'outfit', rarity: 'epic', owned: true, equipped: true, price: 0, forTypes: ['singer', 'idol'], preview: '🎸' },
  { id: 'w2', name: { zh: '录音棚休闲装', en: 'Studio Casual' }, category: 'outfit', rarity: 'common', owned: true, equipped: false, price: 0, forTypes: ['singer'], preview: '🎧' },
  { id: 'w3', name: { zh: '红毯晚礼服', en: 'Red Carpet Gown' }, category: 'outfit', rarity: 'legendary', owned: false, equipped: false, price: 5800, forTypes: ['actor', 'idol', 'singer'], preview: '👗' },
  // Actor outfits
  { id: 'w4', name: { zh: '古装戏服', en: 'Period Costume' }, category: 'outfit', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['actor'], preview: '🎭' },
  { id: 'w5', name: { zh: '动作片战斗服', en: 'Action Combat Suit' }, category: 'outfit', rarity: 'epic', owned: false, equipped: false, price: 3200, forTypes: ['actor'], preview: '🥋' },
  // Dancer outfits
  { id: 'w6', name: { zh: '街舞运动装', en: 'Street Dance Wear' }, category: 'outfit', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['dancer'], preview: '🩰' },
  { id: 'w7', name: { zh: '芭蕾裙', en: 'Ballet Tutu' }, category: 'outfit', rarity: 'epic', owned: false, equipped: false, price: 2800, forTypes: ['dancer'], preview: '💃' },
  // Host outfits
  { id: 'w8', name: { zh: '主持人西装', en: 'Host Suit' }, category: 'outfit', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['host', 'entertainer'], preview: '🤵' },
  // Idol outfits
  { id: 'w9', name: { zh: '应援色打歌服', en: 'Fan Color Stage Wear' }, category: 'outfit', rarity: 'legendary', owned: false, equipped: false, price: 6800, forTypes: ['idol'], preview: '💎' },
  { id: 'w10', name: { zh: '偶像日常便装', en: 'Idol Casual' }, category: 'outfit', rarity: 'common', owned: true, equipped: false, price: 0, forTypes: ['idol'], preview: '🧢' },
  // Universal
  { id: 'w11', name: { zh: '全能运动套装', en: 'All-Round Sports Set' }, category: 'outfit', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: 'all', preview: '🏅' },
  // Hair
  { id: 'h1', name: { zh: '霓虹渐变长发', en: 'Neon Gradient Long' }, category: 'hair', rarity: 'epic', owned: true, equipped: true, price: 0, forTypes: 'all', preview: '💇' },
  { id: 'h2', name: { zh: '朋克短发', en: 'Punk Short' }, category: 'hair', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: 'all', preview: '✂️' },
  { id: 'h3', name: { zh: '古典盘发', en: 'Classical Updo' }, category: 'hair', rarity: 'rare', owned: false, equipped: false, price: 1200, forTypes: ['actor', 'idol'], preview: '👸' },
  { id: 'h4', name: { zh: '运动马尾', en: 'Sport Ponytail' }, category: 'hair', rarity: 'common', owned: true, equipped: false, price: 0, forTypes: ['dancer', 'host'], preview: '🏃' },
  // Accessory
  { id: 'a1', name: { zh: 'LED发光耳机', en: 'LED Glowing Headset' }, category: 'accessory', rarity: 'epic', owned: true, equipped: true, price: 0, forTypes: ['singer', 'idol'], preview: '🎧' },
  { id: 'a2', name: { zh: '钻石麦克风', en: 'Diamond Microphone' }, category: 'accessory', rarity: 'legendary', owned: false, equipped: false, price: 8800, forTypes: ['singer', 'host', 'entertainer'], preview: '🎤' },
  { id: 'a3', name: { zh: '导演对讲机', en: 'Director Walkie-Talkie' }, category: 'accessory', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['actor'], preview: '📟' },
  { id: 'a4', name: { zh: '粉丝应援棒', en: 'Fan Light Stick' }, category: 'accessory', rarity: 'epic', owned: false, equipped: false, price: 3600, forTypes: ['idol'], preview: '🪄' },
  // Makeup
  { id: 'm1', name: { zh: '赛博霓虹妆', en: 'Cyber Neon Makeup' }, category: 'makeup', rarity: 'epic', owned: true, equipped: true, price: 0, forTypes: 'all', preview: '💄' },
  { id: 'm2', name: { zh: '清纯素颜妆', en: 'Natural Look' }, category: 'makeup', rarity: 'common', owned: true, equipped: false, price: 0, forTypes: 'all', preview: '🌸' },
  { id: 'm3', name: { zh: '舞台烟熏妆', en: 'Stage Smokey Eye' }, category: 'makeup', rarity: 'rare', owned: false, equipped: false, price: 1500, forTypes: ['singer', 'dancer', 'idol'], preview: '🔥' },
  // Background
  { id: 'b1', name: { zh: '霓虹城市天际线', en: 'Neon City Skyline' }, category: 'background', rarity: 'epic', owned: true, equipped: true, price: 0, forTypes: 'all', preview: '🌃' },
  { id: 'b2', name: { zh: '录音棚', en: 'Recording Studio' }, category: 'background', rarity: 'common', owned: true, equipped: false, price: 0, forTypes: ['singer'], preview: '🎵' },
  { id: 'b3', name: { zh: '片场布景', en: 'Film Set' }, category: 'background', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['actor'], preview: '🎬' },
  { id: 'b4', name: { zh: '偶像舞台', en: 'Idol Stage' }, category: 'background', rarity: 'legendary', owned: false, equipped: false, price: 7200, forTypes: ['idol', 'singer', 'dancer'], preview: '✨' },
  { id: 'b5', name: { zh: '直播间', en: 'Live Stream Room' }, category: 'background', rarity: 'rare', owned: true, equipped: false, price: 0, forTypes: ['host', 'entertainer'], preview: '📺' },
];

export const WardrobePage = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [tab, setTab] = useState<'owned' | 'shop'>('owned');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];

  const filteredItems = useMemo(() => {
    let items = WARDROBE_ITEMS.filter(item =>
      item.forTypes === 'all' || item.forTypes.includes(activeArtist.type)
    );
    if (category !== 'all') items = items.filter(i => i.category === category);
    if (tab === 'owned') items = items.filter(i => i.owned);
    if (tab === 'shop') items = items.filter(i => !i.owned);
    if (search) items = items.filter(i => (zh ? i.name.zh : i.name.en).toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [category, tab, search, activeArtist.type, zh]);

  const ownedCount = WARDROBE_ITEMS.filter(i => i.owned && (i.forTypes === 'all' || i.forTypes.includes(activeArtist.type))).length;
  const equippedCount = WARDROBE_ITEMS.filter(i => i.equipped).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '造型与道具库' : 'Wardrobe & Props'}</h1>
          <p className="text-gray-400 font-light mt-1 flex items-center gap-2">
            <span>{typeConf.icon}</span>
            {zh ? `${ARTIST_TYPE_LABELS[activeArtist.type].zh}专属道具 + 通用道具` : `${ARTIST_TYPE_LABELS[activeArtist.type].en} Exclusive + Universal`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-center bg-gray-900/50 border border-white/5 rounded-lg px-4 py-2">
            <div className="text-lg font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{ownedCount}</div>
            <div className="text-[10px] text-gray-500">{zh ? '已拥有' : 'Owned'}</div>
          </div>
          <div className="text-center bg-gray-900/50 border border-white/5 rounded-lg px-4 py-2">
            <div className="text-lg font-bold text-purple-400" style={{ fontFamily: "var(--font-display)" }}>{equippedCount}</div>
            <div className="text-[10px] text-gray-500">{zh ? '已装备' : 'Equipped'}</div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategory('all')}
          className={`px-3 py-1.5 text-xs rounded-full border transition ${category === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
          {zh ? '全部' : 'All'}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as ItemCategory[]).map(cat => {
          const conf = CATEGORY_CONFIG[cat];
          const Icon = conf.icon;
          return (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-1 ${category === cat ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
              <Icon className="w-3 h-3" /> {zh ? conf.zh : conf.en}
            </button>
          );
        })}
      </div>

      {/* Owned / Shop toggle + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex border border-white/10 rounded-lg overflow-hidden">
          <button onClick={() => setTab('owned')} className={`px-4 py-2 text-xs transition ${tab === 'owned' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
            {zh ? '已拥有' : 'Owned'}
          </button>
          <button onClick={() => setTab('shop')} className={`px-4 py-2 text-xs transition ${tab === 'shop' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
            <ShoppingBag className="w-3 h-3 inline mr-1" />{zh ? '商店' : 'Shop'}
          </button>
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none transition"
            placeholder={zh ? '搜索道具...' : 'Search items...'} />
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredItems.map((item, i) => {
          const rarity = RARITY_STYLES[item.rarity];
          return (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .03 }}
              onClick={() => setSelectedItem(item)}
              className={`relative bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition hover:border-white/20 group ${item.equipped ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/5'}`}>
              {/* Rarity indicator */}
              {(item.rarity === 'legendary' || item.rarity === 'epic') && (
                <div className={`absolute top-0 right-0 w-12 h-12 rounded-full blur-xl ${item.rarity === 'legendary' ? 'bg-amber-500/15' : 'bg-purple-500/15'}`} />
              )}

              {/* Preview */}
              <div className={`w-full aspect-square rounded-lg ${rarity.bg} flex items-center justify-center mb-3 relative`}>
                <span className="text-3xl">{item.preview}</span>
                {item.equipped && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
                {!item.owned && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-xs font-semibold truncate mb-1">{zh ? item.name.zh : item.name.en}</div>
              <div className="flex items-center justify-between">
                <Badge className={`text-[10px] ${rarity.color} ${rarity.bg} border-0 px-1.5`}>{zh ? rarity.zh : rarity.en}</Badge>
                {!item.owned && <span className="text-[10px] text-amber-400 font-bold">¥{item.price.toLocaleString()}</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shirt className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">{zh ? '暂无道具' : 'No Items'}</h3>
          <p className="text-xs text-gray-500 mt-1">{zh ? '尝试切换分类或查看商店' : 'Try switching categories or check the shop'}</p>
        </div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}
              className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
              <div className={`w-24 h-24 rounded-xl ${RARITY_STYLES[selectedItem.rarity].bg} flex items-center justify-center mx-auto mb-4`}>
                <span className="text-5xl">{selectedItem.preview}</span>
              </div>
              <h3 className="text-lg font-bold text-center mb-1" style={{ fontFamily: "var(--font-display)" }}>{zh ? selectedItem.name.zh : selectedItem.name.en}</h3>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge className={`text-xs ${RARITY_STYLES[selectedItem.rarity].color} ${RARITY_STYLES[selectedItem.rarity].bg} border-0`}>{zh ? RARITY_STYLES[selectedItem.rarity].zh : RARITY_STYLES[selectedItem.rarity].en}</Badge>
                <Badge className="text-xs bg-white/5 text-gray-400 border-0">{zh ? CATEGORY_CONFIG[selectedItem.category].zh : CATEGORY_CONFIG[selectedItem.category].en}</Badge>
              </div>
              <div className="text-xs text-gray-500 text-center mb-4">
                {selectedItem.forTypes === 'all' ? (zh ? '通用 — 所有艺人类型可用' : 'Universal — Available for all types') :
                  (zh ? '适用: ' : 'For: ') + selectedItem.forTypes.map(t => zh ? ARTIST_TYPE_LABELS[t].zh : ARTIST_TYPE_LABELS[t].en).join(', ')}
              </div>
              <div className="flex gap-2">
                {selectedItem.owned ? (
                  <Button className={`flex-1 ${selectedItem.equipped ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-r from-cyan-500 to-purple-600'}`}>
                    {selectedItem.equipped ? (zh ? '取消装备' : 'Unequip') : (zh ? '装备' : 'Equip')}
                  </Button>
                ) : (
                  <Button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90">
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" /> {zh ? `购买 ¥${selectedItem.price.toLocaleString()}` : `Buy ¥${selectedItem.price.toLocaleString()}`}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedItem(null)} className="border-white/10 text-gray-400">{zh ? '关闭' : 'Close'}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
