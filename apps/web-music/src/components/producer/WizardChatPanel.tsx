"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WizardChatPanel — AI 孵化顾问（中间栏对话框形态，从 figma WizardInlineChat 移植）。
// 7 步上下文对齐 IncubationWizardV2 的 7 个 SECTIONS（origin/form/psyche/talent/
// craft/fandom/lore），每步切换时 chat 重置并 push 新 welcome。
//
// 视觉：用 app.css 的 token（--card / --border / --primary / --muted）替代 figma
// 原版的 cyan/gray 字面色，保持 web-music 的 Restrained dark 主题。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, Send } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Input } from "@ai-star-eco/ui/ui/input";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  text: string;
}

interface StepContext {
  title: string;
  tips: string[];
  quickTags: string[];
  responses: string[];
}

// 7 步上下文 —— 与 IncubationWizardV2 的 SECTIONS 一一对齐
const STEP_CONTEXT: StepContext[] = [
  {
    title: "01 · 基础设定",
    tips: ["如何取一个好的艺名？", "什么类型适合我的风格？", "如何设置吸引人的标签？"],
    quickTags: ["艺名策略", "MCN 推荐", "标签矩阵", "定位分析"],
    responses: [
      "好的艺名通常简短、独特且朗朗上口，建议 2-4 个字，避免与知名艺人重名。结合赛博朋克元素，如「霓虹」「像素」「量子」前缀可以增加科技感和辨识度。",
      "艺人类型选择建议根据您的实际才能和目标受众来定。偶像型适合全面发展，歌手型需要强调声乐表现，舞蹈师型则要突出肢体张力。",
      "标签是粉丝发现您的入口，建议组合：艺术风格（赛博朋克/暗黑/全息）+ 才能标签（高音天后/编曲达人）+ 个性标签（神秘系/元气系）构成三维标签矩阵。",
      "MCN 掌门人推荐根据设计风格和职业背景智能匹配，「超现实」风格搭配「网红」背景潜力最高，「赛博机甲」搭配「科学家」背景则适合科技 IP 路线。",
    ],
  },
  {
    title: "02 · 外貌设计",
    tips: ["哪种设计风格最吸粉？", "如何搭配视觉元素？", "形象色系怎么选？"],
    quickTags: ["赛博朋克", "未来主义", "暗黑哥特", "全息梦幻", "复古蒸汽"],
    responses: [
      "赛博朋克风格（机械义肢/全息护目镜）在 Z 世代中最受欢迎，平均互动率提升 37%。暗黑哥特适合神秘路线，光棱翅膀提升「仙气值」。选择与您的性格最匹配的风格最为重要。",
      "视觉搭配遵循「主视觉 + 辅助元素 + 点缀细节」三层结构。主色不超过 2 种，点缀色 1 种，保持统一视觉语言能有效提高品牌识别度。",
      "色系建议：科技感选青紫（#06B6D4 + #A855F7），温暖系选粉金，暗黑系选深红暗紫。颜色应与您的艺人类型气质相符，形成视觉与人设的统一。",
    ],
  },
  {
    title: "03 · 人格参数",
    tips: ["MBTI 怎么影响粉丝？", "情绪光谱如何配置？", "人设标签怎么选？"],
    quickTags: ["MBTI 推荐", "情绪配置", "说话风格", "人设标签"],
    responses: [
      "MBTI 在粉丝运营中有重要作用：ENFP/ENFJ 型最容易引发情感共鸣，INTJ 型具有神秘感和深度，ISFP 型有艺术气质。建议选择与真实性格接近的类型以保持一致性。",
      "情绪光谱中「喜悦感」和「温暖度」偏高的组合在流量获取上最占优势，「爆发力」高则适合演唱会型艺人，「锋芒度」高则适合说唱和摇滚路线。",
      "人设标签建议优先选择 3-5 个互补型标签。「学霸人设 + 治愈系」适合知识付费，「颜值担当 + 神秘系」适合时尚代言，「全能型 + 反差萌」适合综艺发展。",
    ],
  },
  {
    title: "04 · 才艺培养",
    tips: ["天赋值如何分配？", "特殊标签有什么效果？", "如何平衡多项才能？"],
    quickTags: ["专注型分配", "均衡型分配", "稀有标签", "才能公式"],
    responses: [
      "天赋分配建议：专注型（单项 80+）适合主攻单一方向冲击顶流，平衡型（各项 60-70）适合综艺和代言。主打项建议不低于 75 分以确保竞争力。",
      "特殊标签如「音域跨越 6 个八度」「0.01 秒节拍精准度」能大幅提升稀有度评级，直接影响孵化成功率和初始粉丝基础，高价值标签组合可以触发彩蛋评分。",
      "才能平衡公式：主才能 × 1.5 + 辅助才能 × 1.0 + 特色才能 × 0.8 = 综合潜力分。建议 2 主 + 1 辅 + 1 特色的黄金分配方式，兼顾专精与多元。",
    ],
  },
  {
    title: "05 · 专属特质",
    tips: ["专属维度怎么选？", "声线如何与类型匹配？", "舞蹈风格能跨界吗？"],
    quickTags: ["声线匹配", "舞种推荐", "主持风格", "戏路定位"],
    responses: [
      "专属维度按艺人类型激活：歌手解锁声域 + 音乐流派 + 音色，舞者解锁舞种 + 编舞偏好，主持人解锁主持风格，演员解锁戏路定位。建议聚焦 1-2 个核心专属维度做透。",
      "声线匹配建议：抒情女高音适合 R&B/流行，磁性男中音适合民谣/说唱，少年清亮音色适合 K-pop/J-pop。声线决定了后续合作和 BGM 选型的边界。",
      "舞蹈风格跨界要谨慎：街舞 + Hip-hop 是天然搭档，House + Pop 可融合，但芭蕾 + Punk 通常违和。跨界融合建议优先在节奏型和风格相近的舞种间组合。",
    ],
  },
  {
    title: "06 · 粉丝商业",
    tips: ["如何设定粉丝目标？", "商业变现最佳策略？", "如何提高粉丝黏性？"],
    quickTags: ["粉丝定位", "变现路径", "应援色选择", "商业防护"],
    responses: [
      "粉丝目标建议遵循阶梯式规划：初期 1-10 万（内容积累期），中期 10-100 万（品牌建立期），百万以上需专项运营方案。平台分发配合内容节奏是关键。",
      "商业变现最优路径：直播打赏（变现最快）→ 品牌代言（收益最高）→ NFT 数字藏品（长尾价值）→ 演出版权（规模化收益）。建议建立多元化收入结构降低风险。",
      "提升粉丝黏性的核心是「情感连接 + 独家内容 + 参与感」三角模型。定期互动、专属福利、粉丝共创是留住深度粉丝的最有效手段，建议每周至少一次深度互动。",
    ],
  },
  {
    title: "07 · 世界观",
    tips: ["背景故事怎么写？", "组合关系如何设定？", "如何与既有 IP 联动？"],
    quickTags: ["故事弧", "组合定位", "联动策略", "彩蛋设计"],
    responses: [
      "背景故事建议遵循「起源 → 转折 → 当下」三幕结构。起源给观众认同感，转折制造记忆点，当下连接现在的艺人状态。300-500 字最易传播。",
      "组合关系决定后续发展空间：主唱 + 副唱 + 舞担 + 门面 + Rap 是 5 人组的经典分工。同质化组合（5 主唱）虽强但缺看点，多元化组合更易出圈。",
      "与既有 IP 联动建议从「世界观相似度」入手：先选 2-3 个调性相近的 IP，再设计联动剧情。强 IP 联动可在出道 3 个月内带来 200% 以上的初始曝光增益。",
    ],
  },
];

function welcome(title: string): string {
  return `我是 **AI 孵化顾问**，现在协助您完成 **${title}** 阶段。\n\n点击下方快捷问题，或直接向我提问。`;
}

export interface WizardChatPanelProps {
  /** 当前章节索引（0..6）；切换时 chat 自动重置并按新步骤的 STEP_CONTEXT 重新欢迎 */
  step: number;
}

export function WizardChatPanel({ step }: WizardChatPanelProps) {
  const clampedStep = Math.min(Math.max(step, 0), STEP_CONTEXT.length - 1);
  const ctx = STEP_CONTEXT[clampedStep]!;

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [responseIdx, setResponseIdx] = React.useState(0);
  const endRef = React.useRef<HTMLDivElement>(null);

  const initChat = React.useCallback((s: number) => {
    const c = STEP_CONTEXT[Math.min(Math.max(s, 0), STEP_CONTEXT.length - 1)]!;
    setMessages([{ id: `welcome-${s}`, role: "ai", text: welcome(c.title) }]);
    setResponseIdx(0);
    setTyping(false);
    setInput("");
  }, []);

  React.useEffect(() => {
    initChat(clampedStep);
  }, [clampedStep, initChat]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handlePrompt = (text: string) => {
    if (!text.trim() || typing) return;
    const resp = ctx.responses[responseIdx % ctx.responses.length]!;
    setMessages(prev => [...prev, { id: `${Date.now()}-user`, role: "user", text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: `${Date.now()}-ai`, role: "ai", text: resp }]);
      setTyping(false);
      setResponseIdx(i => i + 1);
    }, 700 + Math.random() * 500);
  };

  const handleSend = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    handlePrompt(txt);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
          </div>
          <span className="text-xs font-semibold truncate">AI 孵化顾问</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded border border-primary/20 bg-primary/5 px-1 py-0.5 font-mono text-[9px] text-primary truncate max-w-[88px]">
            {ctx.title}
          </span>
          <button
            type="button"
            onClick={() => initChat(clampedStep)}
            title="重置对话"
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-xl px-2.5 py-2 ${
                msg.role === "ai"
                  ? "border border-border bg-muted/50"
                  : "border border-primary/30 bg-primary/10"
              }`}
            >
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{msg.text}</p>
            </div>
          </div>
        ))}

        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-1.5"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
              </div>
              <div className="flex h-7 items-center gap-1 rounded-xl border border-border bg-muted/50 px-2.5 py-2">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="inline-block h-1 w-1 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Quick chips */}
      <div className="shrink-0 space-y-1.5 border-t border-border bg-background/30 px-2.5 py-2">
        <div className="flex flex-col gap-1">
          {ctx.tips.map((tip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handlePrompt(tip)}
              disabled={typing}
              className="text-left text-[10px] px-2 py-1 rounded-lg border border-border bg-secondary/40 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-primary/60 mr-1">›</span>
              {tip}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {ctx.quickTags.map((tag, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInput(prev => prev + (prev ? "，" : "") + tag)}
              className="rounded-full border border-border bg-secondary/30 px-1.5 py-0.5 text-[9px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-2.5 py-2.5">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="向 AI 顾问提问..."
            className="h-8 flex-1 text-xs"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || typing}
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default WizardChatPanel;
