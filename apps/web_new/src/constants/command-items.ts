// ─────────────────────────────────────────────────────────────────────────────
// command-items.ts — 命令面板静态项（页面 / 快捷操作）。
// artist 条目在运行时基于 MOCK_ARTISTS 动态生成，不在此处。
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard, Users, Music, Wand2, Shirt, Globe,
  Shield, Heart, Wallet, Settings, Plus, Sparkles,
} from "lucide-react";
import type { CommandItem } from "@/types/navigation";

export const PAGE_ITEMS: CommandItem[] = [
  { id: "p-overview",     type: "page", icon: LayoutDashboard, label: "经纪大盘",    desc: "总览与数据",    keywords: ["dashboard", "overview", "大盘", "总览"],          pageId: "overview" },
  { id: "p-artists",      type: "page", icon: Users,           label: "MCN与孵化",   desc: "艺人矩阵管理",  keywords: ["mcn", "artists", "艺人", "矩阵"],                  pageId: "artists" },
  { id: "p-incubator",    type: "page", icon: Wand2,           label: "AI艺人孵化",  desc: "孵化新AI艺人",  keywords: ["incubator", "孵化", "新建", "create"],             pageId: "incubator" },
  { id: "p-studio",       type: "page", icon: Music,           label: "创作工坊",    desc: "内容创作",      keywords: ["studio", "workshop", "工坊", "创作", "music"],     pageId: "studio" },
  { id: "p-wardrobe",     type: "page", icon: Shirt,           label: "造型与道具",  desc: "装扮与形象",    keywords: ["wardrobe", "造型", "衣服", "style"],               pageId: "wardrobe" },
  { id: "p-distribution", type: "page", icon: Globe,           label: "全网分发",    desc: "内容分发",      keywords: ["distribution", "分发", "发布", "publish"],         pageId: "distribution" },
  { id: "p-copyright",    type: "page", icon: Shield,          label: "版权资产",    desc: "版权管理",      keywords: ["copyright", "版权", "ip"],                         pageId: "copyright" },
  { id: "p-community",    type: "page", icon: Heart,           label: "粉丝社群",    desc: "粉丝运营",      keywords: ["community", "粉丝", "社群", "fan"],                pageId: "community" },
  { id: "p-finance",      type: "page", icon: Wallet,          label: "商业变现",    desc: "收益管理",      keywords: ["finance", "变现", "收益", "money", "revenue"],    pageId: "finance" },
  { id: "p-settings",     type: "page", icon: Settings,        label: "设置",        desc: "账号与偏好",    keywords: ["settings", "设置", "config"],                      pageId: "settings" },
];

export const ACTION_ITEMS: CommandItem[] = [
  { id: "a-new-artist", type: "action", icon: Plus,      label: "创建新艺人",  desc: "启动AI孵化向导", keywords: ["new", "create", "新建", "创建", "孵化"], pageId: "incubator" },
  { id: "a-generate",   type: "action", icon: Sparkles,  label: "AI 快速生成", desc: "生成内容",       keywords: ["generate", "ai", "生成"],              pageId: "studio" },
];
