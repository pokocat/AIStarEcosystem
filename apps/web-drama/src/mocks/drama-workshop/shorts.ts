// 短视频工坊 — 设计真源 v4 screens-shorts-v4.jsx:
// 五种格式(各带示例点子 + 分镜节拍)+ 我的短视频资产。
import type { EngineKey } from "@/components/drama-ui/engine-tag";

export interface ShortBeat {
  /** 时长(秒) */
  dur: number;
  /** 画面 / 视频脚本 */
  visual: string;
  /** 语音口播 */
  vo: string;
  engine: EngineKey | "fx";
}

export interface ShortFormat {
  key: string;
  name: string;
  tip: string;
  from: string;
  to: string;
  sample: string;
  /** 成片总时长(秒) */
  dur: number;
  beats: ShortBeat[];
}

export const SHORT_FORMATS: ShortFormat[] = [
  {
    key: "sell", name: "口播带货", tip: "种草 · 转化", from: "#f97316", to: "#e11d48",
    sample: "一支熬夜也能撑住的精华,油皮姐妹真的别错过", dur: 30,
    beats: [
      { dur: 4, visual: "产品特写,侧光打出质感,瓶身缓缓旋转", vo: "还在为熬夜暗沉发愁?", engine: "fx" },
      { dur: 9, visual: "数字人主播出镜,手持产品对镜讲解", vo: "这支精华我连用 28 天,毛孔肉眼可见变细", engine: "avatar" },
      { dur: 9, visual: "使用前后对比分屏,左暗沉右透亮", vo: "成分表干净,孕妈也能用,关键是不贵", engine: "fx" },
      { dur: 8, visual: "数字人比心 + 购物车浮层弹出", vo: "点下方小黄车,今晚直播价再砍 50", engine: "avatar" },
    ],
  },
  {
    key: "know", name: "知识科普", tip: "涨知识 · 收藏", from: "#06b6d4", to: "#3b82f6",
    sample: "3 个被你忽略的手机摄影技巧,拍出电影感", dur: 35,
    beats: [
      { dur: 5, visual: "黑底白字大标题动效:90% 的人都拍错了", vo: "为什么你拍的总是不好看?", engine: "fx" },
      { dur: 10, visual: "数字人讲解,身后浮现示意图", vo: "第一,关掉自动模式,锁定曝光", engine: "avatar" },
      { dur: 12, visual: "实拍对比:错误示范 vs 正确示范", vo: "第二,贴近主体,让背景虚化", engine: "fx" },
      { dur: 8, visual: "三个要点字幕逐条收束 + 关注引导", vo: "记住这三点,小白也能出片", engine: "avatar" },
    ],
  },
  {
    key: "hook", name: "剧情钩子", tip: "引流 · 看正片", from: "#f97316", to: "#e11d48",
    sample: "她在婚礼当天,收到了三年前自己的失踪启事", dur: 25,
    beats: [
      { dur: 4, visual: "婚礼现场全景,新娘转身,镜头怼脸特写", vo: "——这是我最好的一天", engine: "fx" },
      { dur: 7, visual: "新郎掏出泛黄纸张,特写失踪启事", vo: "直到他掏出那张纸", engine: "fx" },
      { dur: 8, visual: "新娘瞳孔地震,回忆闪回碎片化剪辑", vo: "上面失踪的人,是我自己", engine: "fx" },
      { dur: 6, visual: "黑屏 + 剧名字幕 + 看正片引导", vo: "完整故事,点击主页第一集", engine: "fx" },
    ],
  },
  {
    key: "host", name: "数字人播报", tip: "日更 · 资讯", from: "#a78bfa", to: "#6366f1",
    sample: "今日科技圈三件大事,一分钟看完", dur: 40,
    beats: [
      { dur: 5, visual: "数字人坐播报台,身后大屏栏目包装", vo: "大家好,今天是 6 月 12 日", engine: "avatar" },
      { dur: 12, visual: "画中画:左主播右新闻配图", vo: "第一条,行业重磅消息……", engine: "avatar" },
      { dur: 13, visual: "切换第二条,数据图表浮层", vo: "第二条,值得关注的数据……", engine: "avatar" },
      { dur: 10, visual: "主播总结 + 明日预告字幕", vo: "以上就是今天的播报,我们明天见", engine: "avatar" },
    ],
  },
  {
    key: "remix", name: "热点二创", tip: "蹭热点 · 起量", from: "#10b981", to: "#22d3ee",
    sample: "用这个热门 BGM,讲讲打工人的一天", dur: 28,
    beats: [
      { dur: 4, visual: "热门卡点开场,标题钩子弹出", vo: "(热门 BGM 前奏)", engine: "fx" },
      { dur: 8, visual: "快剪:闹钟、挤地铁、赶电梯", vo: "早八人的痛,谁懂啊", engine: "fx" },
      { dur: 9, visual: "反转:摸鱼、下班、奶茶,节奏放松", vo: "但只要熬到下班,世界都亮了", engine: "fx" },
      { dur: 7, visual: "定格金句字幕 + 合拍引导", vo: "打工人,评论区报到", engine: "fx" },
    ],
  },
];

export const SHORT_IDEAS = [
  "一支熬夜也能撑住的精华,油皮姐妹别错过",
  "3 个手机摄影技巧,拍出电影感",
  "她在婚礼当天收到自己的失踪启事",
  "今日科技圈三件大事,一分钟看完",
  "租房党必看,100 块改造出租屋",
  "为什么猫咪总在凌晨四点发疯?",
];

export interface ShortVideoItem {
  id: string;
  title: string;
  fmt: string;
  dur: string;
  from: string;
  to: string;
  status: "done" | "rendering" | "draft";
  plays: string;
}

export const MY_SHORTS: ShortVideoItem[] = [
  { id: "s1", title: "熬夜精华 · 转化版", fmt: "口播带货", dur: "0:32", from: "#f97316", to: "#e11d48", status: "done", plays: "2.4w" },
  { id: "s2", title: "手机摄影三技巧",   fmt: "知识科普", dur: "0:35", from: "#06b6d4", to: "#3b82f6", status: "done", plays: "8,612" },
  { id: "s3", title: "《落地窗后》预告", fmt: "剧情钩子", dur: "0:24", from: "#f97316", to: "#e11d48", status: "rendering", plays: "—" },
  { id: "s4", title: "科技播报 0612",    fmt: "数字人播报", dur: "0:41", from: "#a78bfa", to: "#6366f1", status: "draft", plays: "—" },
];
