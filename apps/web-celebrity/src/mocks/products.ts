// ─────────────────────────────────────────────────────────────────────────────
// mocks/products.ts — 商品库领域演示数据。
// ─────────────────────────────────────────────────────────────────────────────
//
// v0.26+: 改用「抖音商城选品库样例」6 条作为初始数据，与 server CelebrityProductSeeder
//          保持同源；id 直接使用抖音商品ID，便于人工核对。
//
// 内部演示用途：本文件中所有商品名 / 链接 / 价格 / 佣金率均为运营公开选品库的样例条目，
// 不构成商业关系。images 留空（[]）——前端有「📋 从抖音链接解析」按钮可即时抓图回填。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product } from "@ai-star-eco/types/product";

const link = (id: string) =>
  `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${id}&origin_type=pc_buyin_selection_decision`;

const today = "2026-05-23";

export const SEED_PRODUCTS: Product[] = [
  {
    id: "3485332505048038713",
    name: "一次性水槽过滤网干湿分离水池漏网洗碗池碗槽防堵",
    category: "日用百货",
    link: link("3485332505048038713"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 990,
    commissionRate: 50,
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3706263707349811466",
    name: "保鲜膜套食品级一次性食品保鲜膜碗罩防串味加厚",
    category: "日用百货",
    link: link("3706263707349811466"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 990,
    commissionRate: 15,
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3548176134007053937",
    name: "【夏季爆款】夏季大人儿童孕婴儿通用精油贴可爱便携植物精油防护贴",
    category: "日用百货",
    link: link("3548176134007053937"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 990,
    commissionRate: 50,
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3819840696727240859",
    name: "【爱❤️助力】酒精湿巾80抽消毒湿巾一次性家用大号酒精",
    category: "日用百货",
    link: link("3819840696727240859"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 2290,
    commissionRate: 50,
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3737779702866247934",
    name: "一次性保鲜膜套食品级家用冰箱饭菜水果密封松紧口保鲜悬挂抽取式",
    category: "日用百货",
    link: link("3737779702866247934"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 1990,
    commissionRate: 40,
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3819075223949541738",
    name: "【小眼妹精选】保鲜膜套【500】食品级一次性防尘保鲜碗罩【翻盖抽取式",
    category: "日用百货",
    link: link("3819075223949541738"),
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    priceCents: 990,
    commissionRate: 20,
    createdAt: today,
    updatedAt: today,
  },
];
