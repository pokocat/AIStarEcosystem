// 短剧模板（爆款赛道）—— 极速模式预填 + 模板广场展示共用真源。
// 这是「可用的少量精选模板」：真预填 theme/genre/duration；更大的「社区模板库」标注即将上线。

export interface DramaTemplate {
  id: string;
  title: string;
  /** 赛道标签 */
  track: string;
  genre: string;
  durationSec: number;
  /** 预填到「短剧主题 / 灵感」的一句话梗概 */
  theme: string;
  /** 卡片简介 */
  blurb: string;
}

export const DRAMA_TEMPLATES: DramaTemplate[] = [
  {
    id: "tpl-sweet-ceo",
    title: "隐藏总裁的甜宠日常",
    track: "甜宠",
    genre: "甜宠",
    durationSec: 60,
    theme: "外卖小哥其实是隐藏总裁，雨夜送餐救下落难的前女友，旧情复燃。",
    blurb: "强反差人设 + 雨夜救美，第一镜抓人，适合女频甜宠起号。",
  },
  {
    id: "tpl-counterattack",
    title: "废柴逆袭打脸局",
    track: "逆袭爽剧",
    genre: "逆袭爽剧",
    durationSec: 60,
    theme: "被全家轻视的废柴回村，三天后带着百万订单回归，当众打脸势利亲戚。",
    blurb: "强冲突 + 爽点密集，反转打脸结构，男频通杀。",
  },
  {
    id: "tpl-mystery",
    title: "失忆悬疑·重逢真相",
    track: "悬疑",
    genre: "悬疑",
    durationSec: 90,
    theme: "失忆的总裁在咖啡馆偶遇前妻，一杯拿铁勾起被尘封的车祸真相。",
    blurb: "悬念钩子 + 情感反转，适合中长竖屏连续剧。",
  },
  {
    id: "tpl-ancient",
    title: "古装宫斗·一夜翻身",
    track: "古装",
    genre: "古装",
    durationSec: 60,
    theme: "冷宫弃妃凭一手医术救下太后，一夜之间从弃子变成后宫风暴中心。",
    blurb: "古风质感 + 阶层翻转，强视觉，适合古装赛道。",
  },
  {
    id: "tpl-bring-goods",
    title: "带货剧情·种草反转",
    track: "带货",
    genre: "都市情感",
    durationSec: 30,
    theme: "闺蜜吐槽她土，她用一件单品完成职场逆袭，自然带出商品卖点。",
    blurb: "30 秒短平快 + 商品自然植入点位，适合电商短剧。",
  },
  {
    id: "tpl-village",
    title: "乡村温情·返乡创业",
    track: "乡村",
    genre: "都市情感",
    durationSec: 90,
    theme: "城里白领辞职回乡，用直播把滞销的果园做成网红打卡地，带动全村。",
    blurb: "温情治愈 + 正能量，适合乡村振兴 / 助农题材。",
  },
];

export function getDramaTemplate(id: string | null | undefined): DramaTemplate | undefined {
  if (!id) return undefined;
  return DRAMA_TEMPLATES.find((t) => t.id === id);
}
