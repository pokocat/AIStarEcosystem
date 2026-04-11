"use client";

import { useDeferredValue, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ArrowLeft, Check, Crown, Eye, Filter, Heart, Lock, Save, Search, Shirt, ShoppingBag, Shuffle, Star, TrendingUp, X } from "lucide-react";
import type { ClothingCategory, SingerDetail, WardrobeItem } from "@/types/contracts/singers";

interface WardrobeSystemProps {
  lang: "zh" | "en";
  onBack: () => void;
  activeSinger: SingerDetail;
  catalog: WardrobeItem[];
}

const rarityColors = {
  common: "text-gray-400 border-gray-400/20",
  rare: "text-blue-400 border-blue-400/20",
  epic: "text-purple-400 border-purple-400/20",
  legendary: "text-yellow-400 border-yellow-400/20"
} as const;

export function WardrobeSystem({ lang, onBack, activeSinger, catalog }: WardrobeSystemProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [equippedItems, setEquippedItems] = useState<Record<Exclude<ClothingCategory, "outfit">, WardrobeItem | null>>({
    top: null,
    bottom: null,
    accessory: null,
    shoes: null,
    hair: null
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<{ id: string; name: string }[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredClothing = catalog.filter((item) => {
    const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) || item.tags.some((tag) => tag.toLowerCase().includes(deferredSearchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const toggleEquip = (item: WardrobeItem) => {
    if (item.isLocked || item.category === "outfit") return;
    const category = item.category as keyof typeof equippedItems;
    setEquippedItems((current) => ({
      ...current,
      [category]: current[category]?.id === item.id ? null : item
    }));
  };

  const toggleFavorite = (itemId: string) => {
    setFavorites((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const randomOutfit = () => {
    const availableItems = catalog.filter((item) => !item.isLocked && item.category !== "outfit");
    const categories = ["top", "bottom", "accessory", "shoes", "hair"] as const;
    const nextItems = { top: null, bottom: null, accessory: null, shoes: null, hair: null } as typeof equippedItems;

    categories.forEach((category) => {
      const candidates = availableItems.filter((item) => item.category === category);
      nextItems[category] = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    });

    setEquippedItems(nextItems);
  };

  const saveOutfit = () => {
    setSavedOutfits((current) => [...current, { id: `outfit-${Date.now()}`, name: `${lang === "zh" ? "套装" : "Outfit"} ${current.length + 1}` }]);
  };

  const categories = [
    { id: "all", label: lang === "zh" ? "全部" : "All", count: catalog.length },
    { id: "top", label: lang === "zh" ? "上衣" : "Top", count: catalog.filter((item) => item.category === "top").length },
    { id: "bottom", label: lang === "zh" ? "下装" : "Bottom", count: catalog.filter((item) => item.category === "bottom").length },
    { id: "accessory", label: lang === "zh" ? "配饰" : "Accessory", count: catalog.filter((item) => item.category === "accessory").length },
    { id: "shoes", label: lang === "zh" ? "鞋子" : "Shoes", count: catalog.filter((item) => item.category === "shoes").length },
    { id: "hair", label: lang === "zh" ? "发型" : "Hair", count: catalog.filter((item) => item.category === "hair").length }
  ];

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Shirt className="w-3 h-3" /> {lang === "zh" ? "时尚衣橱系统" : "Fashion Wardrobe"}
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === "zh" ? "服装换装中心" : "Wardrobe System"}</h2>
          <p className="text-gray-400 text-sm">{lang === "zh" ? "200+服装配件，打造独一无二的造型" : "200+ items to create your unique style"}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5 h-10 px-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {lang === "zh" ? "返回" : "Back"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input placeholder={lang === "zh" ? "搜索服装..." : "Search clothing..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-10 bg-black/50 border-white/10 h-12 focus:border-pink-500/50" />
            </div>
            <Button variant="outline" className="border-white/10 hover:bg-white/5 px-4">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map((category) => (
              <Button key={category.id} variant={selectedCategory === category.id ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(category.id)} className={`flex-shrink-0 ${selectedCategory === category.id ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : "border-white/10 hover:bg-white/5"}`}>
                {category.label}
                <Badge variant="outline" className="ml-2 text-xs border-white/20">
                  {category.count}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              <AnimatePresence mode="popLayout">
                {filteredClothing.map((item, index) => {
                  const isEquipped = Object.values(equippedItems).some((equipped) => equipped?.id === item.id);
                  const isFavorited = favorites.includes(item.id);

                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.02 }}>
                      <Card className={`relative bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-pink-500/30 transition-all cursor-pointer group overflow-hidden ${isEquipped ? "ring-2 ring-pink-500/50" : ""} ${item.isLocked ? "opacity-50" : ""}`}>
                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                          <div className="flex flex-col gap-1">
                            {item.isNew && <Badge className="bg-green-500/80 text-white text-xs border-0 font-bold">NEW</Badge>}
                            {item.isTrending && (
                              <Badge className="bg-orange-500/80 text-white text-xs border-0 font-bold flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />HOT
                              </Badge>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); toggleFavorite(item.id); }} className="h-7 w-7 bg-black/60 backdrop-blur-sm hover:bg-black/80">
                            <Heart className={`w-4 h-4 ${isFavorited ? "fill-red-500 text-red-500" : "text-white"}`} />
                          </Button>
                        </div>

                        <CardContent className="p-0" onClick={() => toggleEquip(item)}>
                          <div className="relative aspect-square overflow-hidden">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                            {item.isLocked && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                <Lock className="w-8 h-8 text-white/50" />
                              </div>
                            )}
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
                              <h4 className={`font-bold text-sm ${rarityColors[item.rarity]} line-clamp-1`}>{item.name}</h4>
                              <div className="flex gap-0.5">
                                {[...Array(item.rarity === "legendary" ? 5 : item.rarity === "epic" ? 4 : item.rarity === "rare" ? 3 : 2)].map((_, starIndex) => (
                                  <Star key={`${item.id}-${starIndex}`} className={`w-3 h-3 fill-current ${rarityColors[item.rarity].split(" ")[0]}`} />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`text-xs ${rarityColors[item.rarity]}`}>
                                {item.rarity.toUpperCase()}
                              </Badge>
                              <span className="text-yellow-400 font-mono font-bold text-sm">{item.isLocked ? <Lock className="w-4 h-4" /> : `¥${item.price}`}</span>
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

        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 flex-1 flex flex-col">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-pink-400" />
                  {lang === "zh" ? "实时预览" : "Live Preview"}
                </span>
                <Button size="sm" variant="outline" onClick={randomOutfit} className="border-white/10 hover:bg-white/5">
                  <Shuffle className="w-4 h-4 mr-1" />
                  {lang === "zh" ? "随机" : "Random"}
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-transparent to-transparent pointer-events-none" />
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full blur-3xl opacity-20" />
                <div className="relative w-64 h-64 rounded-full p-2 bg-gradient-to-tr from-pink-400 via-purple-500 to-cyan-500" style={{ animation: "spin 20s linear infinite" }}>
                  <div className="w-full h-full rounded-full border-8 border-[#0c0c0e] overflow-hidden" style={{ animation: "spin 20s linear infinite reverse" }}>
                    <img src={activeSinger.avatarUrl} alt={activeSinger.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-black text-white mb-4">{activeSinger.name}</h3>
              <div className="w-full space-y-2">
                <div className="text-sm font-bold text-gray-400 mb-3">{lang === "zh" ? "当前装备" : "Equipped Items"}:</div>
                {(["top", "bottom", "accessory", "shoes", "hair"] as const).map((category) => {
                  const item = equippedItems[category];
                  return (
                    <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-xs text-gray-400 capitalize">{category}</span>
                      {item ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${rarityColors[item.rarity].split(" ")[0]}`}>{item.name}</span>
                          <Button size="icon" variant="ghost" onClick={() => setEquippedItems((current) => ({ ...current, [category]: null }))} className="h-6 w-6">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">{lang === "zh" ? "未装备" : "Empty"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>

            <div className="p-4 border-t border-white/5 space-y-3">
              <Button onClick={saveOutfit} className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold">
                <Save className="w-4 h-4 mr-2" />
                {lang === "zh" ? "保存套装" : "Save Outfit"} ({savedOutfits.length})
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  {lang === "zh" ? "商店" : "Shop"}
                </Button>
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <Crown className="w-4 h-4 mr-2" />
                  {lang === "zh" ? "收藏" : "Favorites"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
