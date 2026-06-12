// 首页创意推荐 — 设计真源 v4 screens-home-v3.jsx:
// 创意池(封面 + 一句话钩子,含个性化条目)+ 近期热点 + 题材标签与节拍。
export interface IdeaRec {
  cat: string;
  title: string;
  hook: string;
  from: string;
  to: string;
  personal?: boolean;
}

export const IDEA_POOL: IdeaRec[] = [
  { cat: "个人自传", title: "单亲妈妈的奋斗史", hook: "把我自己的经历拍成励志短剧:单亲妈妈白天送外卖晚上学剪辑,三年后带着女儿搬进新家", from: "#f59e0b", to: "#fb7185", personal: true },
  { cat: "反转", title: "婚礼上掏出的不是戒指", hook: "婚礼上新郎掏出的不是戒指,而是一张三年前的失踪人口启事——失踪的人是新娘", from: "#f97316", to: "#e11d48" },
  { cat: "穿越", title: "一觉醒来成了王府厨娘", hook: "现代美食博主穿越成王府厨娘,一道麻辣烫征服满朝文武,顺手搅动夺嫡棋局", from: "#a78bfa", to: "#6366f1" },
  { cat: "漫剧", title: "重生进自己追的漫画", hook: "社畜重生进自己追了十年的漫画,成了第 3 话就领盒饭的反派,开局先改剧本保命", from: "#06b6d4", to: "#3b82f6" },
  { cat: "重生", title: "重回高考前那个夏天", hook: "37 岁的我重回高考前的夏天,这一次我想替妈妈活一次", from: "#10b981", to: "#22d3ee" },
  { cat: "闪婚", title: "相亲角随手指了个首富", hook: '被悔婚后赌气在相亲角随手一指,指到了一位藏着商业帝国的"穷小子"', from: "#f472b6", to: "#fb7185" },
  { cat: "悬疑", title: "对面公寓深夜的灯", hook: "都市白领发现自己每天目睹的对面公寓命案,其实是为她量身设计的局", from: "#64748b", to: "#1e293b" },
  { cat: "公益", title: "大山里的图书角", hook: "城市青年到大山支教三年,一间小小的图书角点亮一群孩子的远方", from: "#34d399", to: "#22d3ee" },
  { cat: "宫斗", title: "冷宫醒来的第一夜", hook: "被赐死的贵妃重生回入宫前夜,这一世她不再隐忍,步步反杀", from: "#db2777", to: "#9333ea" },
];

export const HOT_TOPICS: { label: string; idea: string }[] = [
  { label: "世界杯看台被拍", idea: "世界杯看台上被镜头扫到的普通女孩,一夜爆红后的反转人生" },
  { label: "演唱会大屏告白", idea: "演唱会大屏突然打出十年前的告白,台下的她早已是别人新娘" },
  { label: "高铁邻座是前任", idea: "出差高铁邻座坐下的,竟是三年前不告而别的前任" },
];

export const IDEA_TAGS: Record<string, string[]> = {
  个人自传: ["真实改编", "励志", "情绪向"],
  反转: ["强反转", "高能", "上头"],
  穿越: ["穿越", "爽感", "金手指"],
  漫剧: ["漫改感", "二次元", "脑洞"],
  重生: ["重生", "弥补遗憾", "催泪"],
  闪婚: ["甜宠", "马甲", "下饭"],
  悬疑: ["烧脑", "设局", "反转"],
  公益: ["温暖", "纪实", "治愈"],
  宫斗: ["权谋", "打脸", "爽剧"],
};

export interface PreviewBeat {
  range: string;
  beat: string;
  est: string;
}

/** 创意推荐的"AI 会这样帮你拍"节拍(按题材推导) */
export function ideaBeats(cat: string): PreviewBeat[] {
  return [
    { range: "开场 3 秒", beat: "黄金钩子 · " + cat + "感拉满", est: "抓住划走的手" },
    { range: "第 1-3 集", beat: "立人设 · 抛出核心悬念", est: "约 75 秒/集" },
    { range: "中段", beat: "矛盾升级 · 每集一个反转钩子", est: "约 75 秒/集" },
    { range: "收束", beat: "高潮反杀 · 情绪兑现", est: "约 80 秒/集" },
  ];
}
