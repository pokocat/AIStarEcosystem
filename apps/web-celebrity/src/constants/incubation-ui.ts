// AI 艺人孵化 · UI 配置（阶段、平台、资产类型、工具箱）。
// 路演演示用；工具箱里的能力目前点了只提示「正在完善中」。

import {
  AudioLines,
  BookOpen,
  Boxes,
  Briefcase,
  Clapperboard,
  Film,
  Handshake,
  Image as ImageIcon,
  LineChart,
  Mic,
  MountainSnow,
  Network,
  Package,
  Palette,
  ScrollText,
  Scissors,
  Send,
  Sparkles,
  UserRound,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type {
  AccountStatus,
  ArtistDeal,
  ArtistWork,
  AssetKind,
  IncubationStageId,
  MatrixPlatform,
} from "@/mocks/incubation";

export const INCUBATION_STAGES: {
  id: IncubationStageId;
  label: string;
  desc: string;
  steps: string[];
}[] = [
  { id: "look", label: "形象定制", desc: "定长相、定造型，存成可复用的人物资产", steps: ["形象设定图", "多套造型", "三视图与表情"] },
  { id: "persona", label: "人设与声音", desc: "写人设档案，选好专属声音", steps: ["人设档案", "口头禅与口吻", "专属声音"] },
  { id: "content", label: "内容试产", desc: "做第一批短剧和短视频，看哪种内容接得住", steps: ["首部短剧", "口播短视频", "数据复盘"] },
  { id: "matrix", label: "矩阵运营", desc: "主号带子号，多平台同步更新", steps: ["开通矩阵账号", "分平台排期", "粉丝增长"] },
  { id: "commerce", label: "商业变现", desc: "接代言、植入和带货", steps: ["品牌合作", "短剧植入", "直播带货"] },
];

export function stageIndex(id: IncubationStageId): number {
  return INCUBATION_STAGES.findIndex((s) => s.id === id);
}

export const PLATFORM_META: Record<MatrixPlatform, { label: string; short: string; color: string }> = {
  douyin: { label: "抖音", short: "抖", color: "#1f1a14" },
  xhs: { label: "小红书", short: "红", color: "#ff2442" },
  wechat: { label: "视频号", short: "视", color: "#07c160" },
  kuaishou: { label: "快手", short: "快", color: "#ff6a00" },
  bilibili: { label: "B 站", short: "B", color: "#fb7299" },
  weibo: { label: "微博", short: "微", color: "#e6162d" },
};

export const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; tone: "success" | "accent" | "neutral" }> = {
  active: { label: "运营中", tone: "success" },
  growing: { label: "起号中", tone: "accent" },
  pending: { label: "待开通", tone: "neutral" },
};

export const ASSET_KIND_META: Record<AssetKind, { label: string; prefix: string; icon: LucideIcon; desc: string }> = {
  person: { label: "人物", prefix: "DH", icon: UserRound, desc: "形象、造型、三视图" },
  ip: { label: "IP", prefix: "IP", icon: Sparkles, desc: "栏目、品牌化的内容系列" },
  scene: { label: "场景", prefix: "SC", icon: MountainSnow, desc: "常用拍摄场景" },
  product: { label: "产品", prefix: "PD", icon: Package, desc: "合作商品的标准素材" },
  voice: { label: "声音", prefix: "VO", icon: Mic, desc: "专属音色与配音" },
  style: { label: "风格", prefix: "ST", icon: Palette, desc: "画面色调与质感" },
};

export const ASSET_KIND_ORDER: AssetKind[] = ["person", "ip", "scene", "product", "voice", "style"];

export const WORK_KIND_META: Record<ArtistWork["kind"], { label: string; icon: LucideIcon }> = {
  drama: { label: "短剧", icon: Film },
  talk: { label: "口播", icon: Mic },
  commerce: { label: "带货视频", icon: Package },
  story: { label: "剧情短片", icon: Clapperboard },
};

export const WORK_STATUS_META: Record<ArtistWork["status"], { label: string; tone: "published" | "rendering" | "draft" }> = {
  published: { label: "已发布", tone: "published" },
  producing: { label: "制作中", tone: "rendering" },
  planning: { label: "筹备中", tone: "draft" },
};

export const DEAL_STATUS_META: Record<ArtistDeal["status"], { label: string; tone: "success" | "warning" | "accent" }> = {
  signed: { label: "已签约", tone: "accent" },
  negotiating: { label: "沟通中", tone: "warning" },
  delivered: { label: "已交付", tone: "success" },
};

export interface IncubationTool {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}

/** 孵化工具箱：数字资产、短剧、视频、运营变现四组能力 */
export const INCUBATION_TOOLBOX: { id: string; title: string; sub: string; tools: IncubationTool[] }[] = [
  {
    id: "assets",
    title: "数字资产",
    sub: "人物、IP、场景、产品、声音、风格六类资产，带版本、可复用",
    tools: [
      { id: "asset-person", title: "人物形象", desc: "上传照片或写一段描述，生成形象设定图和多套造型。", icon: UserRound },
      { id: "asset-voice", title: "专属声音", desc: "录一段声音做克隆，或从内置音色里挑一个。", icon: AudioLines },
      { id: "asset-scene", title: "场景与产品", desc: "常用场景、合作商品做成标准素材，出片时直接引用。", icon: Boxes },
      { id: "asset-style", title: "风格库", desc: "从爆款作品里提炼色调和质感，保证每条视频风格一致。", icon: Palette },
    ],
  },
  {
    id: "drama",
    title: "短剧创作",
    sub: "从选题到分镜，艺人就是剧里的演员",
    tools: [
      { id: "drama-knowledge", title: "短剧知识库", desc: "开场钩子、题材结构、人设搭配、植入写法，写剧本前先查。", icon: BookOpen },
      { id: "drama-script", title: "AI 编剧", desc: "一句话出故事大纲和分集剧情，按艺人人设写台词。", icon: ScrollText },
      { id: "drama-director", title: "AI 导演台", desc: "按剧本拆片段、写分镜，逐段出分镜图和视频。", icon: Clapperboard },
      { id: "drama-cast", title: "演员档期", desc: "同一个艺人跨剧出演，长相和声音每一镜都一致。", icon: Film },
    ],
  },
  {
    id: "video",
    title: "视频生产",
    sub: "口播、带货、剧情短片，批量出片",
    tools: [
      { id: "video-gen", title: "AI 视频生成", desc: "文字或图片出视频，支持首尾帧和多张参考图。", icon: Video },
      { id: "video-talk", title: "数字人口播", desc: "写好文案，艺人自己出镜讲，口型和声音对得上。", icon: Mic },
      { id: "video-commerce", title: "带货视频", desc: "选商品、套脚本模板，一次出多条不同版本。", icon: Wand2 },
      { id: "video-mixcut", title: "批量混剪", desc: "同一批素材剪出几十条不重复的成片。", icon: Scissors },
      { id: "video-image", title: "AI 图片", desc: "海报、封面、种草图，按场景一步出图。", icon: ImageIcon },
    ],
  },
  {
    id: "ops",
    title: "运营与变现",
    sub: "账号矩阵、分发、数据和商单",
    tools: [
      { id: "ops-matrix", title: "矩阵账号", desc: "主号、剧情号、带货号、切片号分工，多平台统一管理。", icon: Network },
      { id: "ops-publish", title: "一键分发", desc: "同一条内容按平台改标题和封面，定时发到各个账号。", icon: Send },
      { id: "ops-data", title: "数据复盘", desc: "按艺人、账号、内容类型看播放和转化，找到值得加码的方向。", icon: LineChart },
      { id: "ops-deal", title: "商单对接", desc: "品牌方按人设和粉丝画像找艺人，报价、排期、交付在一处走完。", icon: Handshake },
      { id: "ops-agency", title: "经纪管理", desc: "合同、授权范围和分成比例，跟着艺人走。", icon: Briefcase },
    ],
  },
];
