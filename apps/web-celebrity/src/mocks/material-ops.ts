// ─────────────────────────────────────────────────────────────────────────────
// 素材运营演示数据 —— 移植自「素材运营平台」原型 data.js，对齐复用类型，
// 颜色改用 creator 调色板 hex，商品/脚本/视频用 product_id 显式互链。
// 组件默认渲染直接 import 这些数组；用户动作走 api/material-ops.ts（mock + localStorage）。
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTE } from "@/constants/material-ops-ui";
import type { Product } from "@ai-star-eco/types/product";
import type {
  MaterialProduct,
  MaterialVideo,
  ScriptAsset,
  ViralHit,
} from "@/components/material-ops/types";

const today = "2026-05-26";
const productLink = (id: string) =>
  `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${id}&origin_type=pc_buyin_selection_decision`;

// ── 商品（复用真实选品 id；accentColor/audience 等为素材运营展示扩展） ──
export const MATERIAL_PRODUCTS: MaterialProduct[] = [
  {
    id: "3485332505048038713",
    name: "一次性水槽过滤网干湿分离水池漏网洗碗池碗槽防堵",
    category: "日用百货",
    link: productLink("3485332505048038713"),
    images: [],
    sellingPoints: "水槽过滤残渣 / 干湿分离 / 用完即扔 / 9.9 元高佣样品",
    sellingPointList: ["水槽过滤残渣", "干湿分离", "用完即扔", "9.9 元高佣样品"],
    usageCount: 324,
    source: "manual",
    priceCents: 990,
    commissionRate: 50,
    stock: 18240,
    accentColor: PALETTE.amber,
    audience: ["做饭人", "租房厨房", "宝妈"],
    suggestedAngles: ["水槽堵塞", "饭后收尾", "厨房懒人清洁"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3706263707349811466",
    name: "保鲜膜套食品级一次性食品保鲜膜碗罩防串味加厚",
    category: "日用百货",
    link: productLink("3706263707349811466"),
    images: [],
    sellingPoints: "食品级碗罩 / 加厚防串味 / 大小碗适配 / 9.9 元囤货",
    sellingPointList: ["食品级碗罩", "加厚防串味", "大小碗适配", "9.9 元囤货"],
    usageCount: 168,
    source: "manual",
    priceCents: 990,
    commissionRate: 15,
    stock: 14680,
    accentColor: PALETTE.teal,
    audience: ["宝妈", "独居人群", "厨房囤货"],
    suggestedAngles: ["冰箱串味", "剩菜保鲜", "一拉一套"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3548176134007053937",
    name: "【夏季爆款】夏季大人儿童孕婴儿通用精油贴可爱便携植物精油防护贴",
    category: "日用百货",
    link: productLink("3548176134007053937"),
    images: [],
    sellingPoints: "植物精油贴 / 夏季出门常备 / 衣角背包可贴 / 便携小包装",
    sellingPointList: ["植物精油贴", "夏季出门常备", "衣角背包可贴", "便携小包装"],
    usageCount: 96,
    source: "manual",
    priceCents: 990,
    commissionRate: 50,
    stock: 10320,
    accentColor: PALETTE.rose,
    audience: ["宝妈", "户外出行", "夏季家庭"],
    suggestedAngles: ["带娃出门", "夏季常备", "衣角背包贴"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3819840696727240859",
    name: "【爱❤️助力】酒精湿巾80抽消毒湿巾一次性家用大号酒精",
    category: "日用百货",
    link: productLink("3819840696727240859"),
    images: [],
    sellingPoints: "80抽大包装 / 家用酒精湿巾 / 大张耐擦 / 22.9 高佣样品",
    sellingPointList: ["80抽大包装", "家用酒精湿巾", "大张耐擦", "22.9 高佣样品"],
    usageCount: 132,
    source: "manual",
    priceCents: 2290,
    commissionRate: 50,
    stock: 8200,
    accentColor: PALETTE.violet,
    audience: ["上班族", "租房党", "通勤人群"],
    suggestedAngles: ["外卖到手", "工位清洁", "家车办公室常备"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3737779702866247934",
    name: "一次性保鲜膜套食品级家用冰箱饭菜水果密封松紧口保鲜悬挂抽取式",
    category: "日用百货",
    link: productLink("3737779702866247934"),
    images: [],
    sellingPoints: "抽取式保鲜膜套 / 松紧口密封 / 冰箱饭菜防串味 / 挂袋收纳",
    sellingPointList: ["抽取式保鲜膜套", "松紧口密封", "冰箱饭菜防串味", "挂袋收纳"],
    usageCount: 74,
    source: "manual",
    priceCents: 1990,
    commissionRate: 40,
    stock: 6480,
    accentColor: PALETTE.violetDeep,
    audience: ["租房党", "独居人群", "厨房小户型"],
    suggestedAngles: ["小厨房收纳", "剩菜保鲜", "直播抢购"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "3819075223949541738",
    name: "【小眼妹精选】保鲜膜套【500】食品级一次性防尘保鲜碗罩【翻盖抽取式",
    category: "日用百货",
    link: productLink("3819075223949541738"),
    images: [],
    sellingPoints: "500只装 / 翻盖抽取 / 防尘保鲜碗罩 / 9.9 低价引流",
    sellingPointList: ["500只装", "翻盖抽取", "防尘保鲜碗罩", "9.9 低价引流"],
    usageCount: 202,
    source: "manual",
    priceCents: 990,
    commissionRate: 20,
    stock: 18800,
    accentColor: PALETTE.teal,
    audience: ["学生党", "宝妈", "家庭厨房"],
    suggestedAngles: ["宿舍水果", "宝妈冰箱", "500只囤货"],
    createdAt: today,
    updatedAt: today,
  },
];

export function getProduct(id?: string): MaterialProduct | undefined {
  if (!id) return undefined;
  return MATERIAL_PRODUCTS.find((p) => p.id === id);
}

// 类目 → 展示主题色，给商品库里非素材运营的商品补默认 accentColor（缩略图走真实图 / 首字）。
const CATEGORY_ACCENT: Record<string, string> = {
  美妆: PALETTE.rose,
  食品饮料: PALETTE.teal,
  "数码 3C": PALETTE.violet,
  服饰: PALETTE.violetDeep,
  日用百货: PALETTE.amber,
  母婴: PALETTE.peach,
  运动: PALETTE.violetDeep,
  其他: PALETTE.teal,
};

/**
 * 任意系统商品（Product）→ 展示用 MaterialProduct。
 * 素材运营自带的 6 个用其完整富数据；商品库里的其它商品按类目补主题色，
 * 卖点串拆成 chip 列表。缩略图统一走 ProductThumb（真实 images / 首字 monogram）。
 * 供新建脚本商品选择器 / 脚本列表展示复用。
 */
export function toMaterialProduct(p: Product): MaterialProduct {
  const rich = MATERIAL_PRODUCTS.find((m) => m.id === p.id);
  if (rich) return rich;
  const accentColor = CATEGORY_ACCENT[p.category] ?? CATEGORY_ACCENT["其他"];
  const points = (p.sellingPoints ?? "")
    .split(/[/、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    ...p,
    accentColor,
    sellingPointList: points,
    audience: [],
    suggestedAngles: [],
  };
}

// ── 脚本资产（9 条；10s 短视频分镜；product_id 指向真实选品） ────────────────
export const SCRIPT_ASSETS: ScriptAsset[] = [
  {
    id: "asset-2604", kind: "viral_clone", name: "厨房崩溃 · 水槽过滤网", tier: "S",
    category: "日用百货", hook_type: "痛点", audience: ["做饭人", "租房厨房", "宝妈"],
    platforms: ["douyin", "wechat"], duration_sec: 10, product_id: "3485332505048038713",
    blocks: [
      { kind: "hook", label: "堵水槽开场", dur: 2, text: "洗个碗，水槽又堵了？别用手抠。", shot: "俯拍水槽，饭渣菜叶堆住下水口，水位慢慢上来" },
      { kind: "scene", label: "痛点放大", dur: 2, text: "油腻饭渣一抓，真的很崩溃。", shot: "手套刚碰到残渣立刻缩回，字幕弹出“太脏了”" },
      { kind: "product", label: "产品上场", dur: 2, text: "套上这个一次性过滤网，边缘压平。", shot: "手把过滤网套在水槽口，镜头给到网面和弹性边缘" },
      { kind: "effect", label: "效果演示", dur: 2, text: "水能下去，饭渣全兜住。", shot: "倒半碗剩菜汤，水流走，残渣留在网兜里" },
      { kind: "cta", label: "收尾转化", dur: 2, text: "用完一提就扔，9块9先囤一包。", shot: "拎起网兜丢进垃圾桶，包装和价格贴片同框" },
    ],
    metrics: { uses_count: 312, ctr_pct: 9.2, diversity_pct: 58, completion_pct: 76, best_video: { script_id: "video-2604-001", plays: "812w", likes: "32w", gmv: "¥184,200" }, last_used_at: "2026-05-26T14:36:00Z" },
    source: { type: "viral", ref_id: "v3", original_url: "https://v.douyin.com/iY7xRk8R", cloned_from: null, author: "@厨房收尾员" },
    tags: ["厨房", "水槽", "懒人清洁", "9块9"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2598", kind: "my_script", name: "冰箱串味 · 食品碗罩", tier: "S",
    category: "日用百货", hook_type: "痛点", audience: ["宝妈", "独居人群", "厨房囤货"],
    platforms: ["douyin", "xhs"], duration_sec: 10, product_id: "3706263707349811466",
    blocks: [
      { kind: "hook", label: "开冰箱钩子", dur: 2, text: "冰箱一打开，全是剩菜味？", shot: "镜头从冰箱门内侧推出来，字幕“串味警告”" },
      { kind: "scene", label: "真实场景", dur: 2, text: "半碗汤、切好的水果，最怕没盖严。", shot: "桌上摆汤碗和水果盘，保鲜膜皱成一团放旁边" },
      { kind: "product", label: "一拉一套", dur: 2, text: "这个碗罩一拉就套住，大小碗都能包。", shot: "手快速撑开碗罩，套住圆碗和盘子各一次" },
      { kind: "effect", label: "密封展示", dur: 2, text: "汤汁不乱晃，水果也不沾味。", shot: "轻晃碗盘，边缘贴合，切到冰箱分层摆放" },
      { kind: "cta", label: "下单理由", dur: 2, text: "9块9一包，厨房抽屉常备。", shot: "抽屉里抽出一只碗罩，包装和价格贴片定格" },
    ],
    metrics: { uses_count: 142, ctr_pct: 8.7, diversity_pct: 68, completion_pct: 72, best_video: { script_id: "video-2598-001", plays: "162w", likes: "6.4w", gmv: "¥98,400" }, last_used_at: "2026-05-24T16:20:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2401", author: "陈彬彬" },
    tags: ["冰箱", "保鲜", "碗罩", "防串味"], cover_color: PALETTE.rose, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2591", kind: "template", name: "带娃出门 · 精油防护贴", tier: "A",
    category: "日用百货", hook_type: "场景", audience: ["宝妈", "户外出行", "夏季家庭"],
    platforms: ["xhs", "douyin"], duration_sec: 10, product_id: "3548176134007053937",
    blocks: [
      { kind: "hook", label: "夏天出门", dur: 2, text: "夏天带娃下楼，包里一定放这个。", shot: "妈妈推开家门，孩子背包特写，字幕“出门前10秒”" },
      { kind: "scene", label: "痛点环境", dur: 2, text: "小区花园、露营、晚饭后散步都用得上。", shot: "快切草地、露营椅、傍晚小区路灯三个场景" },
      { kind: "product", label: "贴片动作", dur: 2, text: "植物精油贴撕开，贴在衣角或背包上。", shot: "手撕开贴片，贴到孩子衣角和书包侧袋" },
      { kind: "effect", label: "体验表达", dur: 2, text: "味道清清爽爽，不用往身上抹。", shot: "孩子跑动，贴片在衣角轻晃，妈妈闻一下点头" },
      { kind: "cta", label: "囤货收口", dur: 2, text: "9块9一包，夏天出门前贴一片。", shot: "贴片小包装铺开，价格贴片和“出门常备”同框" },
    ],
    metrics: { uses_count: 96, ctr_pct: 7.1, diversity_pct: 71, completion_pct: 68, best_video: { script_id: "video-2591-001", plays: "24w", likes: "8.8w", gmv: "¥21,400" }, last_used_at: "2026-05-22T09:00:00Z" },
    source: { type: "viral", ref_id: "v2", original_url: "https://www.xiaohongshu.com/...", cloned_from: null, author: "@夏天带娃记" },
    tags: ["夏季", "带娃", "户外", "精油贴"], cover_color: PALETTE.teal, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2585", kind: "viral_clone", name: "外卖到手 · 酒精湿巾", tier: "A",
    category: "日用百货", hook_type: "习惯", audience: ["上班族", "租房党", "通勤人群"],
    platforms: ["xhs"], duration_sec: 10, product_id: "3819840696727240859",
    blocks: [
      { kind: "hook", label: "外卖钩子", dur: 2, text: "外卖到手，我第一步不是拆袋。", shot: "外卖袋放到桌上，手停在袋口前，字幕“先别急”" },
      { kind: "scene", label: "使用场景", dur: 2, text: "桌面、手机、门把手，顺手擦一遍。", shot: "湿巾依次擦桌面、手机壳和门把手，三连快切" },
      { kind: "product", label: "产品特写", dur: 2, text: "80抽大包装，抽出来不连张。", shot: "包装开盖，一张湿巾被顺手抽出，镜头给到湿润质感" },
      { kind: "effect", label: "使用反馈", dur: 2, text: "大张够用，擦完不黏手。", shot: "一张湿巾擦完整张小桌，手背轻拍桌面" },
      { kind: "cta", label: "价格收口", dur: 2, text: "家里、车里、工位都放一包。", shot: "三处摆放快切，最后定格包装和价格" },
    ],
    metrics: { uses_count: 56, ctr_pct: 7.8, diversity_pct: 74, completion_pct: 64, best_video: { script_id: "video-2585-001", plays: "14w", likes: "4.2w", gmv: "¥12,600" }, last_used_at: "2026-05-20T11:30:00Z" },
    source: { type: "viral", ref_id: "v4", original_url: "https://v.douyin.com/iA8sLm2X", cloned_from: null, author: "@工位生活家" },
    tags: ["酒精湿巾", "外卖", "工位", "清洁"], cover_color: PALETTE.violet, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2480", kind: "template", name: "直播切片 · 抽取式保鲜套", tier: "B",
    category: "日用百货", hook_type: "紧迫", audience: ["宝妈", "厨房囤货", "中老年"],
    platforms: ["douyin", "kuaishou"], duration_sec: 10, product_id: "3737779702866247934",
    blocks: [
      { kind: "hook", label: "主播开场", dur: 2, text: "剩菜别再拿盘子压了，真的不稳。", shot: "直播间俯拍，一只盘子盖碗晃了一下差点滑落" },
      { kind: "scene", label: "痛点展示", dur: 2, text: "冰箱一挤，汤汁就容易蹭得到处都是。", shot: "碗盘塞进冰箱，盘盖倾斜，字幕“尴尬”" },
      { kind: "product", label: "抽取演示", dur: 2, text: "抽取式保鲜膜套，拉一个直接套。", shot: "从挂袋里抽出一只，单手撑开套住饭碗" },
      { kind: "effect", label: "对比效果", dur: 2, text: "松紧口贴住碗边，叠放也省心。", shot: "两个碗上下叠放，边缘贴合特写" },
      { kind: "cta", label: "直播收口", dur: 2, text: "限时囤装，厨房挂一袋随手抽。", shot: "挂在厨房墙面，主播手指小黄车方向" },
    ],
    metrics: { uses_count: 41, ctr_pct: 6.5, diversity_pct: 48, completion_pct: 58, best_video: { script_id: "video-2480-001", plays: "6.2w", likes: "1.4w", gmv: "¥18,400" }, last_used_at: "2026-05-15T22:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["直播", "保鲜", "抽取式", "厨房"], cover_color: PALETTE.violetDeep, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2477", kind: "my_script", name: "租房厨房 · 挂抽保鲜套", tier: "A",
    category: "日用百货", hook_type: "空间", audience: ["租房党", "独居人群", "厨房小户型"],
    platforms: ["douyin", "wechat"], duration_sec: 10, product_id: "3737779702866247934",
    blocks: [
      { kind: "hook", label: "小厨房开场", dur: 2, text: "租房厨房小，保鲜膜别再乱塞抽屉。", shot: "狭窄厨房抽屉拉开，保鲜膜盒和杂物挤在一起" },
      { kind: "scene", label: "真实困扰", dur: 2, text: "每次找半天，最后还是盖不严。", shot: "手翻抽屉找东西，碗口保鲜膜松掉翘边" },
      { kind: "product", label: "挂墙动作", dur: 2, text: "这袋直接挂起来，随手一抽。", shot: "把抽取袋挂到墙钩，单手抽出一只保鲜套" },
      { kind: "effect", label: "顺手套碗", dur: 2, text: "碗、盘、水果盆，十秒全盖好。", shot: "三种容器快速套好，镜头跟手移动" },
      { kind: "cta", label: "生活化收尾", dur: 2, text: "小厨房想清爽，这种小东西真有用。", shot: "整理后的台面干净，包装挂在墙边，字幕“厨房常备”" },
    ],
    metrics: { uses_count: 24, ctr_pct: 7.4, diversity_pct: 79, completion_pct: 71, best_video: { script_id: "video-2461", plays: "8w", likes: "2.1w", gmv: "¥7,200" }, last_used_at: "2026-05-18T14:00:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2604", author: "陈彬彬" },
    tags: ["租房", "收纳", "保鲜", "厨房"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2412", kind: "template", name: "宿舍水果 · 翻盖碗罩", tier: "B",
    category: "日用百货", hook_type: "剧情", audience: ["学生党", "宿舍党", "水果爱好者"],
    platforms: ["douyin"], duration_sec: 10, product_id: "3819075223949541738",
    blocks: [
      { kind: "hook", label: "宿舍冲突", dur: 2, text: "室友：你这半盘水果，怎么又没盖？", shot: "宿舍桌面，切好的水果露在空气里，室友从旁边入镜吐槽" },
      { kind: "scene", label: "尴尬痛点", dur: 2, text: "纸巾盖不住，保鲜膜又撕得乱七八糟。", shot: "纸巾被风吹起，保鲜膜粘成一团，字幕“翻车”" },
      { kind: "product", label: "翻盖抽取", dur: 2, text: "翻盖抽一只碗罩，直接套上。", shot: "打开翻盖包装，抽出碗罩套住水果盘" },
      { kind: "effect", label: "宿舍适配", dur: 2, text: "盘子、泡面碗、小盆都能用。", shot: "三种宿舍容器快速切换，碗罩贴合边缘" },
      { kind: "cta", label: "宿舍囤货", dur: 2, text: "500只一包，宿舍四个人都够用。", shot: "四个室友一人抽一只，包装和价格贴片收尾" },
    ],
    metrics: { uses_count: 18, ctr_pct: 5.4, diversity_pct: 82, completion_pct: 81, best_video: { script_id: "video-2334", plays: "2.4w", likes: "8k", gmv: "¥1,800" }, last_used_at: "2026-04-28T10:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["宿舍", "水果", "翻盖抽取", "碗罩"], cover_color: PALETTE.teal, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2401", kind: "template", name: "宝妈冰箱 · 500只碗罩", tier: "S",
    category: "日用百货", hook_type: "反差", audience: ["宝妈", "家庭厨房", "囤货人群"],
    platforms: ["douyin", "xhs"], duration_sec: 10, product_id: "3819075223949541738",
    blocks: [
      { kind: "hook", label: "反差钩子", dur: 2, text: "我妈以前用盘子盖剩菜，现在全换这个。", shot: "一排盘子盖碗的老方法快切，镜头突然停住" },
      { kind: "scene", label: "旧方法对比", dur: 2, text: "盘子占地方，还容易串味。", shot: "冰箱里盘子叠盘子，门差点关不上" },
      { kind: "product", label: "新方法展示", dur: 2, text: "抽一只保鲜碗罩，套上就能放。", shot: "从翻盖盒抽出碗罩，套在剩菜碗上" },
      { kind: "effect", label: "冰箱整齐", dur: 2, text: "每个碗都盖好，冰箱一下清爽。", shot: "俯拍冰箱层架，碗盘整齐摆放，标签贴日期" },
      { kind: "cta", label: "家庭囤货", dur: 2, text: "500只一包，家里真的消耗得很快。", shot: "妈妈顺手抽一只，镜头定格包装和厨房台面" },
    ],
    metrics: { uses_count: 184, ctr_pct: 8.4, diversity_pct: 62, completion_pct: 70, best_video: { script_id: "video-2398", plays: "482w", likes: "18w", gmv: "¥124,800" }, last_used_at: "2026-05-26T08:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["宝妈", "冰箱", "囤货", "碗罩"], cover_color: PALETTE.rose, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2398", kind: "my_script", name: "水槽清理 · 懒人收尾", tier: "B",
    category: "日用百货", hook_type: "情感", audience: ["做饭人", "懒人清洁", "家庭厨房"],
    platforms: ["douyin"], duration_sec: 10, product_id: "3485332505048038713",
    blocks: [
      { kind: "hook", label: "收尾共鸣", dur: 2, text: "做饭最烦的不是炒菜，是最后清水槽。", shot: "饭后厨房，灶台收干净，镜头转到脏水槽" },
      { kind: "emotion", label: "情绪放大", dur: 2, text: "菜叶、米粒、油渣，全卡在下水口。", shot: "微距拍下水口残渣，字幕逐个点名" },
      { kind: "product", label: "工具出现", dur: 2, text: "提前套个过滤网，洗完不用抠。", shot: "洗碗前先套网，手指压平边缘" },
      { kind: "effect", label: "饭后验证", dur: 2, text: "水槽冲干净，垃圾一兜带走。", shot: "水龙头冲洗，拎起网兜，水槽底部干净" },
      { kind: "cta", label: "口播收口", dur: 2, text: "这种小东西，真能少吵一架。", shot: "夫妻一人洗碗一人递网，包装贴片轻轻弹出" },
    ],
    metrics: { uses_count: 12, ctr_pct: 4.6, diversity_pct: 42, completion_pct: 52, best_video: { script_id: "video-2398", plays: "6w", likes: "1.2k", gmv: "¥640" }, last_used_at: "2026-05-10T10:00:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2604", author: "陈彬彬" },
    tags: ["水槽", "饭后收尾", "家庭", "懒人清洁"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
];

export function getScript(id?: string): ScriptAsset | undefined {
  if (!id) return undefined;
  return SCRIPT_ASSETS.find((s) => s.id === id);
}

// ── 视频资产（字段对齐 RenderOutput；product_id + script_id 互链） ──────────────
export const VIDEO_ASSETS: MaterialVideo[] = [
  {
    id: "video-2604-001", script_id: "asset-2604", product_id: "3485332505048038713", kind: "baseline",
    name: "水槽过滤网 · 基线版", status: "ready", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-001", scene: "home-kitchen", weather: "sunny", lighting: "natural", role_relation: "个人", voice: "voice-fem-01" },
    metrics: { plays: "812w", likes: "32w", ctr_pct: 9.2, gmv: "¥184,200", completion_pct: 78, comments: 4820 },
    video_url: "https://aiartist.oss-cn-hangzhou.aliyuncs.com/videos/%E4%B8%80%E6%AC%A1%E6%80%A7%E6%B0%B4%E6%A7%BD%E8%BF%87%E6%BB%A4%E7%BD%91.mp4",
    cover_color: PALETTE.amber,
    created_at: "2026-05-26T14:36:00Z", generated_at: "2026-05-26T14:48:12Z", render_cost_sec: 134, model: "sora-zh-v3", parent_video_id: null,
  },
  {
    id: "video-2604-002", script_id: "asset-2604", product_id: "3485332505048038713", kind: "variant",
    name: "饭后收尾 · 水流测试", status: "ready", parent_video_id: "video-2604-001", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-004", scene: "home-kitchen", weather: "sunny", lighting: "warm", role_relation: "夫妻", voice: "voice-fem-02" },
    metrics: { plays: "162w", likes: "8.4w", ctr_pct: 8.7, gmv: "¥98,400", completion_pct: 71, comments: 1240 },
    cover_color: PALETTE.rose,
    created_at: "2026-05-26T15:20:00Z", generated_at: "2026-05-26T15:32:48Z", render_cost_sec: 152, model: "sora-zh-v3",
  },
  {
    id: "video-2604-003", script_id: "asset-2604", product_id: "3485332505048038713", kind: "variant",
    name: "租房厨房 · 夜间清理", status: "ready", parent_video_id: "video-2604-001", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-001", scene: "rental-kitchen", weather: "rainy", lighting: "cool", role_relation: "个人", voice: "voice-male-01" },
    metrics: { plays: "48w", likes: "1.8w", ctr_pct: 6.4, gmv: "¥18,400", completion_pct: 64, comments: 380 },
    cover_color: PALETTE.violet,
    created_at: "2026-05-26T15:45:00Z", generated_at: "2026-05-26T15:58:30Z", render_cost_sec: 168, model: "sora-zh-v3",
  },
  {
    id: "video-2604-004", script_id: "asset-2604", product_id: "3485332505048038713", kind: "variant",
    name: "家庭厨房 · 渲染中", status: "rendering", parent_video_id: "video-2604-001", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-002", scene: "home-kitchen", weather: "sunny", lighting: "natural", role_relation: "家人", voice: "voice-male-02" },
    metrics: null, cover_color: PALETTE.violetDeep,
    created_at: "2026-05-26T10:14:00Z", generated_at: null, render_cost_sec: null, model: "sora-zh-v3",
    progress_pct: 64, eta_sec: 42, stage: "场景合成",
  },
  {
    id: "video-2480-001", script_id: "asset-2480", product_id: "3737779702866247934", kind: "baseline",
    name: "一次性保鲜膜套 · 抽取演示", status: "ready", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-003", scene: "home-kitchen", weather: "sunny", lighting: "natural", role_relation: "主播", voice: "voice-fem-01" },
    metrics: { plays: "6.2w", likes: "1.4w", ctr_pct: 6.5, gmv: "¥18,400", completion_pct: 58, comments: 220 },
    video_url: "https://aiartist.oss-cn-hangzhou.aliyuncs.com/videos/%E4%B8%80%E6%AC%A1%E6%80%A7%E4%BF%9D%E9%B2%9C%E8%86%9C%E5%A5%97.mp4",
    cover_color: PALETTE.violetDeep,
    created_at: "2026-05-29T10:10:00Z", generated_at: "2026-05-29T10:10:00Z", render_cost_sec: null, model: "oss-seed", parent_video_id: null,
  },
  {
    id: "video-2591-001", script_id: "asset-2591", product_id: "3548176134007053937", kind: "baseline",
    name: "精油贴 · 夏季爆款", status: "ready", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-007", scene: "outdoor-park", weather: "sunny", lighting: "natural", role_relation: "母子", voice: "voice-fem-02" },
    metrics: { plays: "24w", likes: "8.8w", ctr_pct: 7.1, gmv: "¥21,400", completion_pct: 68, comments: 540 },
    video_url: "https://aiartist.oss-cn-hangzhou.aliyuncs.com/videos/%E5%A4%8F%E5%AD%A3%E7%88%86%E6%AC%BE%E7%B2%BE%E6%B2%B9%E8%B4%B42.mp4",
    cover_color: PALETTE.teal,
    created_at: "2026-05-29T10:12:00Z", generated_at: "2026-05-29T10:12:00Z", render_cost_sec: null, model: "oss-seed", parent_video_id: null,
  },
  {
    id: "video-2591-002", script_id: "asset-2591", product_id: "3548176134007053937", kind: "variant",
    name: "精油贴 · 贴片特写", status: "ready", parent_video_id: "video-2591-001", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-007", scene: "outdoor-park", weather: "sunny", lighting: "soft", role_relation: "母子", voice: "voice-fem-02" },
    metrics: { plays: "8.6w", likes: "2.9w", ctr_pct: 6.8, gmv: "¥6,800", completion_pct: 64, comments: 180 },
    video_url: "https://aiartist.oss-cn-hangzhou.aliyuncs.com/videos/%E7%B2%BE%E6%B2%B9%E8%B4%B4.mp4",
    cover_color: PALETTE.teal,
    created_at: "2026-05-29T10:14:00Z", generated_at: "2026-05-29T10:14:00Z", render_cost_sec: null, model: "oss-seed",
  },
  {
    id: "video-2585-001", script_id: "asset-2585", product_id: "3819840696727240859", kind: "baseline",
    name: "外卖到手 · 工位擦拭", status: "ready", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-005", scene: "office-desk", weather: "sunny", lighting: "soft", role_relation: "个人", voice: "voice-fem-01" },
    metrics: { plays: "14w", likes: "4.2w", ctr_pct: 7.8, gmv: "¥12,600", completion_pct: 64, comments: 480 },
    cover_color: PALETTE.violet,
    created_at: "2026-05-22T11:30:00Z", generated_at: "2026-05-22T11:42:00Z", render_cost_sec: 96, model: "sora-zh-v3", parent_video_id: null,
  },
  {
    id: "video-2598-001", script_id: "asset-2598", product_id: "3706263707349811466", kind: "baseline",
    name: "冰箱串味 · 食品碗罩", status: "ready", duration_sec: 10, aspect_ratio: "9:16",
    variant_config: { character: "human-006", scene: "home-kitchen", weather: "sunny", lighting: "warm", role_relation: "母女", voice: "voice-fem-03" },
    metrics: { plays: "162w", likes: "6.4w", ctr_pct: 8.7, gmv: "¥98,400", completion_pct: 72, comments: 2410 },
    cover_color: PALETTE.rose,
    created_at: "2026-05-24T16:20:00Z", generated_at: "2026-05-24T16:33:00Z", render_cost_sec: 112, model: "sora-zh-v3", parent_video_id: null,
  },
];

// ── 爆款雷达 ─────────────────────────────────────────────────────────────────
export const VIRAL_HITS: ViralHit[] = [
  {
    id: "v1", platform: "douyin", plays: "4820000", likes: "180000", author: "@厨房收尾员",
    title: "洗碗水槽堵住了，别再用手抠", cat: "日用百货", cat_color: PALETTE.amber, duration: 10, postedAt: "14h",
    hook: "洗个碗，水槽又堵了？别用手抠。",
    structure: [
      { t: "0-2s", label: "堵水槽钩子", text: "俯拍水槽积水，饭渣堵在下水口", tag: "痛点" },
      { t: "2-4s", label: "脏手反应", text: "手套碰到油渣立刻缩回，字幕“太崩溃”", tag: "情绪" },
      { t: "4-6s", label: "产品动作", text: "一次性过滤网套上水槽口，边缘压平", tag: "产品" },
      { t: "6-8s", label: "效果验证", text: "倒剩菜汤，水流走，残渣留在网兜", tag: "效果" },
      { t: "8-10s", label: "价格收口", text: "拎起扔掉，9块9囤一包", tag: "CTA" },
    ],
    tags: ["厨房", "水槽", "懒人清洁", "9块9"], score: 92, risk: 0, reproduces: 184,
  },
  {
    id: "v2", platform: "xhs", plays: "1240000", likes: "88000", author: "@冰箱整理术",
    title: "剩菜别再拿盘子压，冰箱真的会串味", cat: "日用百货", cat_color: PALETTE.teal, duration: 10, postedAt: "2d",
    hook: "冰箱一打开，全是剩菜味？",
    structure: [
      { t: "0-2s", label: "冰箱钩子", text: "打开冰箱，字幕弹出“串味警告”", tag: "共鸣" },
      { t: "2-4s", label: "旧方法翻车", text: "盘子盖碗晃动，保鲜膜粘成一团", tag: "痛点" },
      { t: "4-6s", label: "一拉一套", text: "保鲜碗罩撑开，圆碗盘子各套一次", tag: "产品" },
      { t: "6-8s", label: "密封展示", text: "轻晃汤碗，边缘贴合，冰箱分层摆放", tag: "效果" },
      { t: "8-10s", label: "囤货理由", text: "9块9一包，厨房抽屉常备", tag: "CTA" },
    ],
    tags: ["冰箱", "保鲜", "碗罩", "防串味"], score: 87, risk: 1, reproduces: 96,
  },
  {
    id: "v3", platform: "douyin", plays: "8120000", likes: "320000", author: "@夏天带娃记",
    title: "夏天带娃下楼，衣角贴一片再出门", cat: "日用百货", cat_color: PALETTE.rose, duration: 10, postedAt: "6h",
    hook: "夏天带娃下楼，包里一定放这个。",
    structure: [
      { t: "0-2s", label: "出门钩子", text: "妈妈开门，孩子背包特写", tag: "场景" },
      { t: "2-4s", label: "户外快切", text: "小区草地、露营椅、傍晚散步三连切", tag: "环境" },
      { t: "4-6s", label: "贴片动作", text: "撕开植物精油贴，贴衣角和背包", tag: "产品" },
      { t: "6-8s", label: "体验表达", text: "孩子跑动，妈妈闻一下点头", tag: "体验" },
      { t: "8-10s", label: "夏季常备", text: "9块9一包，出门前贴一片", tag: "CTA" },
    ],
    tags: ["夏季", "带娃", "户外", "精油贴"], score: 95, risk: 0, reproduces: 312,
  },
  {
    id: "v4", platform: "douyin", plays: "2310000", likes: "94000", author: "@工位生活家",
    title: "外卖到手，先别急着拆袋", cat: "日用百货", cat_color: PALETTE.violet, duration: 10, postedAt: "1d",
    hook: "外卖到手，我第一步不是拆袋。",
    structure: [
      { t: "0-2s", label: "反常识钩子", text: "外卖袋放桌上，手停在袋口前", tag: "钩子" },
      { t: "2-4s", label: "擦拭场景", text: "桌面、手机、门把手三连擦", tag: "场景" },
      { t: "4-6s", label: "产品特写", text: "80抽大包装，抽出一张不连张", tag: "产品" },
      { t: "6-8s", label: "大张够用", text: "一张湿巾擦完整张小桌", tag: "效果" },
      { t: "8-10s", label: "常备收口", text: "家里、车里、工位都放一包", tag: "CTA" },
    ],
    tags: ["酒精湿巾", "外卖", "工位", "清洁"], score: 81, risk: 0, reproduces: 56,
  },
];

// 效果回流表格行
export const LOOP_ROWS = [
  { id: "asset-2604", title: "水槽过滤网 · 厨房收尾", plat: "douyin", plays: "812w", ctr: 9.2, gmv: "¥184,200", diff: 78, status: "爆款", toneVar: PALETTE.teal },
  { id: "asset-2598", title: "食品碗罩 · 冰箱串味", plat: "xhs", plays: "24w", ctr: 7.4, gmv: "¥21,400", diff: 65, status: "稳定", toneVar: PALETTE.violet },
  { id: "asset-2591", title: "精油贴 · 夏天带娃", plat: "douyin", plays: "8.6w", ctr: 4.1, gmv: "¥6,800", diff: 42, status: "同质化", toneVar: PALETTE.amber },
  { id: "asset-2585", title: "酒精湿巾 · 外卖到手", plat: "douyin", plays: "162w", ctr: 8.7, gmv: "¥98,400", diff: 81, status: "爆款", toneVar: PALETTE.teal },
  { id: "asset-2401", title: "500只碗罩 · 宝妈冰箱", plat: "wechat", plays: "5.2w", ctr: 3.2, gmv: "¥4,200", diff: 36, status: "同质化", toneVar: PALETTE.amber },
  { id: "asset-2477", title: "抽取式保鲜套 · 租房厨房", plat: "douyin", plays: "0.8w", ctr: 1.8, gmv: "¥420", diff: 22, status: "低质", toneVar: PALETTE.rose },
] as const;
