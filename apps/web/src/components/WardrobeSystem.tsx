"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Shirt, Search, Filter,
  ShoppingBag, Heart, Shuffle, Save, X, Check, Lock,
  Star, TrendingUp, ArrowLeft, Eye, Download
} from 'lucide-react';
import type { ClothingItem, EquippedSlots, EquipSlot, SavedOutfit } from "@/types/wardrobe";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import { WardrobeApi, StoreApi } from "@/api";
import {
  RARITY_COLORS, RARITY_STAR_COUNT,
  WARDROBE_CATEGORY_OPTIONS, EQUIP_SLOT_LABELS,
} from "@/constants/wardrobe-ui";

interface WardrobeSystemProps {
  lang: 'zh' | 'en';
  onBack: () => void;
  activeSinger: any;
}

export function WardrobeSystem({ lang, onBack, activeSinger }: WardrobeSystemProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [equippedItems, setEquippedItems] = useState<EquippedSlots>({
    top: null, bottom: null, accessory: null, shoes: null, hair: null,
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);

  const [clothingDatabase, setClothingDatabase] = useState<ClothingItem[]>(CLOTHING_DATABASE);
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    WardrobeApi.listClothing()
      .then(list => { if (!cancelled && list.length > 0) setClothingDatabase(list); })
      .catch(() => { /* mock 兜底 */ });
    WardrobeApi.listOutfits()
      .then(wire => {
        if (cancelled || !wire || wire.length === 0) return;
        const outfits: SavedOutfit[] = wire.map(o => {
          const slots: EquippedSlots = { top: null, bottom: null, accessory: null, shoes: null, hair: null };
          for (const [k, itemId] of Object.entries(o.slots)) {
            const item = (clothingDatabase.find(c => c.id === itemId)) || null;
            (slots as any)[k] = item;
          }
          return { id: o.id, name: o.name, items: slots, createdAt: o.createdAt };
        });
        setSavedOutfits(outfits);
      })
      .catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选服装
  const filteredClothing = clothingDatabase.filter(item => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const requiresPurchase = (item: ClothingItem): boolean =>
    (item.saleStatus ?? "FREE") === "PAID" && !item.owned && (item.priceCredits ?? 0) > 0;

  const isBlocked = (item: ClothingItem): boolean =>
    item.isLocked || (item.saleStatus === "LOCKED");

  const doPurchase = async (item: ClothingItem) => {
    setPendingPurchase(item.id);
    try {
      await StoreApi.redeem("WARDROBE", item.id);
      setClothingDatabase(prev => prev.map(c =>
        c.id === item.id ? { ...c, owned: true } : c
      ));
      setToast({ type: "ok", msg: `已购买：${item.name}` });
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "购买失败";
      setToast({ type: "err", msg });
    } finally {
      setPendingPurchase(null);
      setTimeout(() => setToast(null), 2500);
    }
  };

  // 装备/卸下服装；如果是 PAID 且未拥有，走购买流程（成功后再装备）
  const toggleEquip = async (item: ClothingItem) => {
    if (isBlocked(item)) return;
    if (item.category === 'outfit') return;
    if (requiresPurchase(item)) {
      const confirmed = typeof window !== "undefined"
        ? window.confirm(`购买「${item.name}」需消耗 ${item.priceCredits} 积分，确定？`)
        : true;
      if (!confirmed) return;
      await doPurchase(item);
      return;
    }
    const category = item.category as EquipSlot;
    if (equippedItems[category]?.id === item.id) {
      setEquippedItems({ ...equippedItems, [category]: null });
    } else {
      setEquippedItems({ ...equippedItems, [category]: item });
    }
  };

  // 收藏切换
  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // 随机搭配
  const randomOutfit = () => {
    const available = clothingDatabase.filter(item => !item.isLocked);
    const slots: EquipSlot[] = ['top', 'bottom', 'accessory', 'shoes', 'hair'];
    const newOutfit: EquippedSlots = { top: null, bottom: null, accessory: null, shoes: null, hair: null };
    slots.forEach(cat => {
      const items = available.filter(item => item.category === cat);
      if (items.length > 0) {
        newOutfit[cat] = items[Math.floor(Math.random() * items.length)];
      }
    });
    setEquippedItems(newOutfit);
  };

  // 保存套装
  const saveOutfit = () => {
    const outfit: SavedOutfit = {
      id: Date.now().toString(),
      name: `套装 ${savedOutfits.length + 1}`,
      items: { ...equippedItems },
      createdAt: new Date().toISOString(),
    };
    setSavedOutfits([...savedOutfits, outfit]);
  };

  // 分类数据（附 count）
  const categories = WARDROBE_CATEGORY_OPTIONS.map(opt => ({
    ...opt,
    count: opt.id === 'all' ? clothingDatabase.length : clothingDatabase.filter(i => i.category === opt.id).length,
  }));
  const rarityColors = RARITY_COLORS;

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {toast && (
        <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-bold border ${
          toast.type === "ok"
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>{toast.msg}</div>
      )}
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Shirt className="w-3 h-3"/> {lang === 'zh' ? '时尚衣橱系统' : 'Fashion Wardrobe'}
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? '服装换装中心' : 'Wardrobe System'}</h2>
          <p className="text-gray-400 text-sm">{lang === 'zh' ? '200+服装配件，打造独一无二的造型' : '200+ items to create your unique style'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5 h-10 px-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {lang === 'zh' ? '返回' : 'Back'}
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-12 gap-6">
        {/* 左侧：分类和服装列表 */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          {/* 搜索和筛选 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input 
                placeholder={lang === 'zh' ? '搜索服装...' : 'Search clothing...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black/50 border-white/10 h-12 focus:border-pink-500/50"
              />
            </div>
            <Button variant="outline" className="border-white/10 hover:bg-white/5 px-4">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* 分类标签 */}
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 ${
                    selectedCategory === cat.id 
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' 
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {cat.label}
                  <Badge variant="outline" className="ml-2 text-xs border-white/20">{cat.count}</Badge>
                </Button>
              );
            })}
          </div>

          {/* 服装网格 */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              <AnimatePresence mode="popLayout">
                {filteredClothing.map((item, index) => {
                  const isEquipped = Object.values(equippedItems).some(e => e?.id === item.id);
                  const isFavorited = favorites.includes(item.id);
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Card className={`relative bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-pink-500/30 transition-all cursor-pointer group overflow-hidden ${
                        isEquipped ? 'ring-2 ring-pink-500/50' : ''
                      } ${item.isLocked ? 'opacity-50' : ''}`}>
                        {/* 标签 */}
                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                          <div className="flex flex-col gap-1">
                            {item.isNew && (
                              <Badge className="bg-green-500/80 text-white text-xs border-0 font-bold">NEW</Badge>
                            )}
                            {item.isTrending && (
                              <Badge className="bg-orange-500/80 text-white text-xs border-0 font-bold flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />HOT
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                            className="h-7 w-7 bg-black/60 backdrop-blur-sm hover:bg-black/80"
                          >
                            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                          </Button>
                        </div>

                        <CardContent className="p-0" onClick={() => toggleEquip(item)}>
                          <div className="relative aspect-square overflow-hidden">
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                            
                            {/* 锁定遮罩 */}
                            {item.isLocked && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                <Lock className="w-8 h-8 text-white/50" />
                              </div>
                            )}

                            {/* 装备标识 */}
                            {isEquipped && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div className="bg-pink-500/90 text-white rounded-full p-3 shadow-lg">
                                  <Check className="w-6 h-6" />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`font-bold text-sm ${rarityColors[item.rarity]} line-clamp-1`}>
                                {item.name}
                              </h4>
                              <div className="flex gap-0.5">
                                {[...Array(RARITY_STAR_COUNT[item.rarity])].map((_, i) => (
                                  <Star key={i} className={`w-3 h-3 fill-current ${rarityColors[item.rarity].split(' ')[0]}`} />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`text-xs ${rarityColors[item.rarity]}`}>
                                {item.rarity.toUpperCase()}
                              </Badge>
                              <span className="text-yellow-400 font-mono font-bold text-sm">
                                {item.isLocked || item.saleStatus === "LOCKED" ? (
                                  <Lock className="w-4 h-4" />
                                ) : item.owned ? (
                                  <span className="text-green-400">{lang === 'zh' ? '已拥有' : 'Owned'}</span>
                                ) : (item.saleStatus ?? 'FREE') === 'PAID' && (item.priceCredits ?? 0) > 0 ? (
                                  <span>{item.priceCredits}⭐</span>
                                ) : (
                                  <span className="text-cyan-300">{lang === 'zh' ? '免费' : 'Free'}</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* 右侧：预览和操作 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 3D预览区 */}
          <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 flex-1 flex flex-col">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-pink-400" />
                  {lang === 'zh' ? '实时预览' : 'Live Preview'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={randomOutfit} className="border-white/10 hover:bg-white/5">
                    <Shuffle className="w-4 h-4 mr-1" />
                    {lang === 'zh' ? '随机' : 'Random'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-transparent to-transparent pointer-events-none" />
              
              {/* 角色预览 */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full blur-3xl opacity-20" />
                <div className="relative w-64 h-64 rounded-full p-2 bg-gradient-to-tr from-pink-400 via-purple-500 to-cyan-500" style={{ animation: 'spin 20s linear infinite' }}>
                  <div className="w-full h-full rounded-full border-8 border-[#0c0c0e] overflow-hidden" style={{ animation: 'spin 20s linear infinite reverse' }}>
                    <img src={activeSinger.avatar} alt={activeSinger.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-black text-white mb-4">{activeSinger.name}</h3>

              {/* 当前装备 */}
              <div className="w-full space-y-2">
                <div className="text-sm font-bold text-gray-400 mb-3">{lang === 'zh' ? '当前装备' : 'Equipped Items'}:</div>
                {(['top', 'bottom', 'accessory', 'shoes', 'hair'] as const).map(cat => {
                  const item = equippedItems[cat];
                  return (
                    <div key={cat} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-xs text-gray-400 capitalize">
                        {EQUIP_SLOT_LABELS[cat]}
                      </span>
                      {item ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${rarityColors[item.rarity].split(' ')[0]}`}>{item.name}</span>
                          <Button size="icon" variant="ghost" onClick={() => setEquippedItems({ ...equippedItems, [cat]: null })} className="h-6 w-6">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">{lang === 'zh' ? '未装备' : 'Empty'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>

            {/* 操作按钮 */}
            <div className="p-4 border-t border-white/5 space-y-3">
              <Button className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold">
                <Save className="w-4 h-4 mr-2" />
                {lang === 'zh' ? '保存套装' : 'Save Outfit'} ({savedOutfits.length})
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <Download className="w-4 h-4 mr-2" />
                  {lang === 'zh' ? '导出' : 'Export'}
                </Button>
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  {lang === 'zh' ? '商店' : 'Shop'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}