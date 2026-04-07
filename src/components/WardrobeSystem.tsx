import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Shirt, Footprints, Crown, Sparkles, Search, Filter, 
  ShoppingBag, Heart, Shuffle, Save, X, Check, Lock,
  Star, TrendingUp, Zap, ArrowLeft, Eye, Download
} from 'lucide-react';

interface ClothingItem {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'accessory' | 'shoes' | 'hair' | 'outfit';
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  tags: string[];
  isLocked?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
}

interface WardrobeSystemProps {
  lang: 'zh' | 'en';
  onBack: () => void;
  activeSinger: any;
}

export function WardrobeSystem({ lang, onBack, activeSinger }: WardrobeSystemProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [equippedItems, setEquippedItems] = useState({
    top: null as ClothingItem | null,
    bottom: null as ClothingItem | null,
    accessory: null as ClothingItem | null,
    shoes: null as ClothingItem | null,
    hair: null as ClothingItem | null,
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<any[]>([]);

  // 服装库数据
  const clothingDatabase: ClothingItem[] = [
    // 上衣系列
    { id: 't1', name: lang === 'zh' ? '赛博夹克' : 'Cyber Jacket', category: 'top', imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300', rarity: 'epic', price: 299, tags: ['cyberpunk', 'jacket'], isNew: true },
    { id: 't2', name: lang === 'zh' ? '霓虹T恤' : 'Neon Tee', category: 'top', imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300', rarity: 'common', price: 99, tags: ['casual', 'neon'], isTrending: true },
    { id: 't3', name: lang === 'zh' ? '全息外套' : 'Holo Coat', category: 'top', imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300', rarity: 'legendary', price: 999, tags: ['hologram', 'premium'], isLocked: true },
    { id: 't4', name: lang === 'zh' ? '战术背心' : 'Tactical Vest', category: 'top', imageUrl: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=300', rarity: 'rare', price: 399, tags: ['tactical', 'military'] },
    { id: 't5', name: lang === 'zh' ? '发光卫衣' : 'LED Hoodie', category: 'top', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300', rarity: 'rare', price: 299, tags: ['led', 'hoodie'], isNew: true },
    
    // 下装系列
    { id: 'b1', name: lang === 'zh' ? '霓虹裤' : 'Neon Pants', category: 'bottom', imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300', rarity: 'common', price: 199, tags: ['pants', 'neon'] },
    { id: 'b2', name: lang === 'zh' ? '机械战裤' : 'Mech Pants', category: 'bottom', imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300', rarity: 'epic', price: 499, tags: ['mechanical', 'combat'] },
    { id: 'b3', name: lang === 'zh' ? '数据流裙' : 'Data Skirt', category: 'bottom', imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300', rarity: 'rare', price: 399, tags: ['skirt', 'digital'], isTrending: true },
    { id: 'b4', name: lang === 'zh' ? '量子短裤' : 'Quantum Shorts', category: 'bottom', imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=300', rarity: 'legendary', price: 799, tags: ['shorts', 'quantum'], isLocked: true },
    
    // 配饰系列
    { id: 'a1', name: lang === 'zh' ? '全息护目镜' : 'Holo Goggles', category: 'accessory', imageUrl: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300', rarity: 'epic', price: 599, tags: ['goggles', 'tech'] },
    { id: 'a2', name: lang === 'zh' ? '赛博项圈' : 'Cyber Collar', category: 'accessory', imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300', rarity: 'rare', price: 299, tags: ['collar', 'neon'], isNew: true },
    { id: 'a3', name: lang === 'zh' ? '数据耳机' : 'Data Headset', category: 'accessory', imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=300', rarity: 'legendary', price: 1299, tags: ['headset', 'premium'], isLocked: true },
    { id: 'a4', name: lang === 'zh' ? '发光手环' : 'LED Bracelet', category: 'accessory', imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300', rarity: 'common', price: 99, tags: ['bracelet', 'led'], isTrending: true },
    
    // 鞋子系列
    { id: 's1', name: lang === 'zh' ? '霓虹战靴' : 'Neon Boots', category: 'shoes', imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=300', rarity: 'rare', price: 399, tags: ['boots', 'combat'] },
    { id: 's2', name: lang === 'zh' ? '悬浮鞋' : 'Hover Shoes', category: 'shoes', imageUrl: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=300', rarity: 'legendary', price: 1499, tags: ['hover', 'future'], isLocked: true },
    { id: 's3', name: lang === 'zh' ? '数据跑鞋' : 'Data Sneakers', category: 'shoes', imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300', rarity: 'common', price: 199, tags: ['sneakers', 'casual'], isNew: true },
    { id: 's4', name: lang === 'zh' ? '机械战鞋' : 'Mech Boots', category: 'shoes', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300', rarity: 'epic', price: 699, tags: ['mechanical', 'heavy'], isTrending: true },
    
    // 发型系列
    { id: 'h1', name: lang === 'zh' ? '霓虹双马尾' : 'Neon Twintails', category: 'hair', imageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300', rarity: 'rare', price: 399, tags: ['twintails', 'colorful'] },
    { id: 'h2', name: lang === 'zh' ? '量子短发' : 'Quantum Bob', category: 'hair', imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300', rarity: 'common', price: 199, tags: ['short', 'modern'], isNew: true },
    { id: 'h3', name: lang === 'zh' ? '全息长发' : 'Holo Long Hair', category: 'hair', imageUrl: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300', rarity: 'legendary', price: 999, tags: ['long', 'hologram'], isLocked: true },
    { id: 'h4', name: lang === 'zh' ? '数据马尾' : 'Data Ponytail', category: 'hair', imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300', rarity: 'epic', price: 499, tags: ['ponytail', 'tech'], isTrending: true },
  ];

  // 筛选服装
  const filteredClothing = clothingDatabase.filter(item => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // 装备/卸下服装
  const toggleEquip = (item: ClothingItem) => {
    if (item.isLocked) return;
    
    const category = item.category as keyof typeof equippedItems;
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
    const categories = ['top', 'bottom', 'accessory', 'shoes', 'hair'] as const;
    const newOutfit: any = {};
    
    categories.forEach(cat => {
      const items = available.filter(item => item.category === cat);
      if (items.length > 0) {
        newOutfit[cat] = items[Math.floor(Math.random() * items.length)];
      }
    });
    
    setEquippedItems(newOutfit);
  };

  // 保存套装
  const saveOutfit = () => {
    const outfit = {
      id: Date.now().toString(),
      name: `${lang === 'zh' ? '套装' : 'Outfit'} ${savedOutfits.length + 1}`,
      items: { ...equippedItems },
      createdAt: new Date()
    };
    setSavedOutfits([...savedOutfits, outfit]);
  };

  // 稀有度颜色
  const rarityColors = {
    common: 'text-gray-400 border-gray-400/20',
    rare: 'text-blue-400 border-blue-400/20',
    epic: 'text-purple-400 border-purple-400/20',
    legendary: 'text-yellow-400 border-yellow-400/20'
  };

  const rarityGlow = {
    common: 'shadow-gray-500/10',
    rare: 'shadow-blue-500/20',
    epic: 'shadow-purple-500/30',
    legendary: 'shadow-yellow-500/40'
  };

  // 分类数据
  const categories = [
    { id: 'all', label: lang === 'zh' ? '全部' : 'All', icon: ShoppingBag, count: clothingDatabase.length },
    { id: 'top', label: lang === 'zh' ? '上衣' : 'Top', icon: Shirt, count: clothingDatabase.filter(i => i.category === 'top').length },
    { id: 'bottom', label: lang === 'zh' ? '下装' : 'Bottom', icon: Shirt, count: clothingDatabase.filter(i => i.category === 'bottom').length },
    { id: 'accessory', label: lang === 'zh' ? '配饰' : 'Accessory', icon: Crown, count: clothingDatabase.filter(i => i.category === 'accessory').length },
    { id: 'shoes', label: lang === 'zh' ? '鞋子' : 'Shoes', icon: Footprints, count: clothingDatabase.filter(i => i.category === 'shoes').length },
    { id: 'hair', label: lang === 'zh' ? '发型' : 'Hair', icon: Sparkles, count: clothingDatabase.filter(i => i.category === 'hair').length },
  ];

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
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
                                {[...Array(item.rarity === 'legendary' ? 5 : item.rarity === 'epic' ? 4 : item.rarity === 'rare' ? 3 : 2)].map((_, i) => (
                                  <Star key={i} className={`w-3 h-3 fill-current ${rarityColors[item.rarity].split(' ')[0]}`} />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`text-xs ${rarityColors[item.rarity]}`}>
                                {item.rarity.toUpperCase()}
                              </Badge>
                              <span className="text-yellow-400 font-mono font-bold text-sm">
                                {item.isLocked ? <Lock className="w-4 h-4" /> : `¥${item.price}`}
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
                        {cat === 'top' ? (lang === 'zh' ? '上衣' : 'Top') :
                         cat === 'bottom' ? (lang === 'zh' ? '下装' : 'Bottom') :
                         cat === 'accessory' ? (lang === 'zh' ? '配饰' : 'Accessory') :
                         cat === 'shoes' ? (lang === 'zh' ? '鞋子' : 'Shoes') :
                         (lang === 'zh' ? '发型' : 'Hair')}
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