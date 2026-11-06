import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, Send } from 'lucide-react';
import type { Lang } from '../../translations';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

// ── Per-step context (mirrors WizardAIAdvisor content) ──
const STEP_CONTEXT = [
  {
    zh: {
      title: '01 · 基础身份',
      tips: ['如何取一个好的艺名？', '什么类型适合我的风格？', '如何设置吸引人的标签？'],
      quickTags: ['艺名策略', 'MCN推荐', '标签矩阵', '定位分析'],
    },
    en: {
      title: '01 · Basic Identity',
      tips: ['How to choose a great artist name?', 'Which type fits my style?', 'What tags attract fans?'],
      quickTags: ['Name Tips', 'MCN Match', 'Tag Matrix', 'Positioning'],
    },
    responses: {
      zh: [
        '好的艺名通常简短、独特且朗朗上口，建议2-4个字，避免与知名艺人重名。结合赛博朋克元素，如「霓虹」「像素」「量子」前缀可以增加科技感和辨识度。',
        '艺人类型选择建议根据您的实际才能和目标受众来定。偶像型适合全面发展，歌手型需要强调声乐表现，舞蹈师型则要突出肢体张力。',
        '标签是粉丝发现您的入口，建议组合：艺术风格（赛博朋克/暗黑/全息）+ 才能标签（高音天后/编曲达人）+ 个性标签（神秘系/元气系）构成三维标签矩阵。',
        'MCN掌门人推荐根据设计风格和职业背景智能匹配，「超现实」风格搭配「网红」背景潜力最高，「赛博机甲」搭配「科学家」背景则适合科技IP路线。',
      ],
      en: [
        'Great artist names are short, unique, and memorable — 2-3 words with a cyberpunk edge like "Neon," "Pixel," or "Quantum" prefixes boost tech appeal and recognition.',
        'Choose your artist type based on real strengths. Idol fits all-rounders, Singer highlights vocals, Dancer emphasizes physical expression.',
        'Tags are how fans discover you. Combine: style tags (Cyberpunk/Gothic/Holo) + skill tags (High Note Queen/Beat Maker) + personality tags (Mysterious/Energetic) for a 3D tag matrix.',
        'MCN recommendations are matched by design style + career background. "Hyperreal" + "Influencer" has top potential, while "Cyber Mecha" + "Scientist" suits tech IP routes.',
      ],
    },
  },
  {
    zh: {
      title: '02 · AI形象锻造',
      tips: ['哪种设计风格最吸粉？', '如何搭配视觉元素？', '形象色系怎么选？'],
      quickTags: ['赛博朋克', '未来主义', '暗黑哥特', '全息梦幻', '复古蒸汽'],
    },
    en: {
      title: '02 · AI Appearance',
      tips: ['Which style gains most fans?', 'How to balance visual elements?', 'How to choose a color palette?'],
      quickTags: ['Cyberpunk', 'Futuristic', 'Dark Gothic', 'Holographic', 'Steampunk'],
    },
    responses: {
      zh: [
        '赛博朋克风格（机械义肢/全息护目镜）在Z世代中最受欢迎，平均互动率提升37%。暗黑哥特适合神秘路线，光棱翅膀提升「仙气值」。选择与您的性格最匹配的风格最为重要。',
        '视觉搭配遵循「主视觉+辅助元素+点缀细节」三层结构。主色不超过2种，点缀色1种，保持统一视觉语言能有效提高品牌识别度。',
        '色系建议：科技感选青紫（#06B6D4 + #A855F7），温暖系选粉金，暗黑系选深红暗紫。颜色应与您的艺人类型气质相符，形成视觉与人设的统一。',
      ],
      en: [
        'Cyberpunk style (Mech Limbs/Holo Goggles) resonates most with Gen-Z, boosting engagement ~37%. Dark Gothic suits mystery personas, Prism Wings add ethereal energy.',
        'Layer visuals: Main theme → Supporting elements → Accent details. Max 2 primary colors + 1 accent. Consistent visual language greatly improves brand recognition.',
        'Color guidance: Tech vibe = Cyan+Purple (#06B6D4+#A855F7), Warm = Pink+Gold, Dark = Deep Red+Violet. Colors should align with your artist personality for unified branding.',
      ],
    },
  },
  {
    zh: {
      title: '03 · 个性光谱',
      tips: ['MBTI怎么影响粉丝？', '情绪光谱如何配置？', '人设标签怎么选？'],
      quickTags: ['MBTI推荐', '情绪配置', '说话风格', '人设标签'],
    },
    en: {
      title: '03 · Personality',
      tips: ['How does MBTI affect fans?', 'How to set emotion spectrum?', 'Which persona tags work?'],
      quickTags: ['MBTI Tips', 'Emotion Setup', 'Speaking Style', 'Persona Tags'],
    },
    responses: {
      zh: [
        'MBTI在粉丝运营中有重要作用：ENFP/ENFJ型最容易引发情感共鸣，INTJ型具有神秘感和深度，ISFP型有艺术气质。建议选择与真实性格接近的类型以保持一致性。',
        '情绪光谱中「喜悦感」和「温暖度」偏高的组合在流量获取上最占优势，「爆发力」高则适合演唱会型艺人，「锋芒度」高则适合说唱和摇滚路线。',
        '人设标签建议优先选择3-5个互补型标签。「学霸人设+治愈系」适合知识付费，「颜值担当+神秘系」适合时尚代言，「全能型+反差萌」适合综艺发展。',
      ],
      en: [
        'MBTI shapes fan connection: ENFP/ENFJ creates strongest emotional resonance, INTJ brings depth and mystery, ISFP radiates artistic sensitivity. Choose what matches your real personality for consistency.',
        'High Joy+Warmth combo is best for organic growth; high Intensity suits concert-type artists; high Edge works for rap and rock routes.',
        'Pick 3-5 complementary persona tags. "Scholar+Healing" suits knowledge monetization, "Visual+Mysterious" suits fashion deals, "All-Rounder+Gap Moe" suits variety shows.',
      ],
    },
  },
  {
    zh: {
      title: '04 · 专属特质',
      tips: ['天赋值如何分配？', '特殊标签有什么效果？', '如何平衡多项才能？'],
      quickTags: ['专注型分配', '均衡型分配', '稀有标签', '才能公式'],
    },
    en: {
      title: '04 · Traits & Vocal',
      tips: ['Optimal talent distribution?', 'How do special tags work?', 'Balancing multiple talents?'],
      quickTags: ['Focus Build', 'Balanced Build', 'Rare Tags', 'Talent Formula'],
    },
    responses: {
      zh: [
        '⚡ 天赋分配建议：专注型（单项80+）适合主攻单一方向冲击顶流，平衡型（各项60-70）适合综艺和代言。主打项建议不低于75分以确保竞争力。',
        '特殊标签如「音域跨越6个八度」「0.01秒节拍精准度」能大幅提升稀有度评级，直接影响孵化成功率和初始粉丝基础，高价值标签组合可以触发彩蛋评分。',
        '才能平衡公式：主才能×1.5 + 辅助才能×1.0 + 特色才能×0.8 = 综合潜力分。建议2主+1辅+1特色的黄金分配方式，兼顾专精与多元。',
      ],
      en: [
        '⚡ Talent tips: Focus type (80+ in one skill) excels at becoming a top specialist. Balanced type (60-70 each) suits variety shows and endorsements. Main talent should stay ≥75 for competitiveness.',
        'Special tags like "6-Octave Range" or "0.01s Beat Precision" significantly boost rarity rating, directly impacting incubation success and debut fanbase. Rare tag combos can trigger bonus scores.',
        'Talent formula: Main×1.5 + Support×1.0 + Specialty×0.8 = Overall Potential. The golden ratio: 2 main + 1 support + 1 specialty balances specialization with versatility.',
      ],
    },
  },
  {
    zh: {
      title: '05 · 技能树',
      tips: ['技能点如何分配？', '哪些技能最有价值？', '如何解锁稀有技能？'],
      quickTags: ['核心技能', '跨界融合', '稀有解锁', '变现技能'],
    },
    en: {
      title: '05 · Skill Tree',
      tips: ['How to allocate skill points?', 'Which skills are most valuable?', 'How to unlock rare skills?'],
      quickTags: ['Core Skills', 'Cross-Discipline', 'Rare Unlock', 'Revenue Skills'],
    },
    responses: {
      zh: [
        '技能树建议优先点亮「核心才能」主干，再横向扩展「跨界融合」支线。主干技能对收益影响最大，建议前期集中投入，中后期再扩展辅助技能。',
        '高价值技能推荐：「病毒式传播」（商业价值+40%）、「情感共鸣」（粉丝留存+35%）、「舞台魅力」（现场效果+50%）。这三项是流量变现的核心杠杆。',
        '稀有技能解锁通常需要满足前置技能要求+特定天赋值门槛。建议先规划终极目标技能，再反推所需的技能路径和天赋分配方案。',
      ],
      en: [
        'Start by maxing your Core Talent trunk, then branch into Cross-Discipline skills. Trunk skills deliver the highest ROI — invest early, expand to support skills mid-to-late stage.',
        'Top value skills: "Viral Spread" (+40% commercial value), "Emotional Resonance" (+35% fan retention), "Stage Charisma" (+50% live performance). These three are the core levers for traffic monetization.',
        'Rare skill unlocks require prerequisites + talent thresholds. Plan from your ultimate goal skill backwards to map out the required skill path and talent distribution.',
      ],
    },
  },
  {
    zh: {
      title: '06 · 粉丝商业',
      tips: ['如何设定粉丝目标？', '商业变现最佳策略？', '如何提高粉丝黏性？'],
      quickTags: ['粉丝定位', '变现路径', '应援色选择', '商业防护'],
    },
    en: {
      title: '06 · Fan Business',
      tips: ['How to set fan goals?', 'Best monetization strategy?', 'How to boost fan retention?'],
      quickTags: ['Fan Target', 'Revenue Path', 'Support Color', 'Brand Shield'],
    },
    responses: {
      zh: [
        '粉丝目标建议遵循阶梯式规划：初期1-10万（内容积累期），中期10-100万（品牌建立期），百万以上需专项运营方案。平台分发配合内容节奏是关键。',
        '商业变现最优路径：直播打赏（变现最快）→ 品牌代言（收益最高）→ NFT数字藏品（长尾价值）→ 演出版权（规模化收益）。建议建立多元化收入结构降低风险。',
        '❤️ 提升粉丝黏性的核心是「情感连接+独家内容+参与感」三角模型。定期互动、专属福利、粉丝共创是留住深度粉丝的最有效手段，建议每周至少一次深度互动。',
      ],
      en: [
        'Fan goal ladder: Phase 1: 10K-100K (content accumulation), Phase 2: 100K-1M (brand building), Phase 3: 1M+ (needs dedicated ops plan). Distribution timing with content rhythm is critical.',
        'Best monetization path: Live tipping (fastest ROI) → Brand deals (highest revenue) → NFT collectibles (long-tail) → Performance rights (scalable). Diversify income streams to reduce risk.',
        '❤️ Fan retention triangle: Emotional Connection + Exclusive Content + Participation. Regular interaction, exclusive perks, and fan co-creation are the most effective deep-fan retention tools. Aim for at least one deep interaction weekly.',
      ],
    },
  },
  {
    zh: {
      title: '07 · 出道预览',
      tips: ['如何导出艺人卡片？', '稀有度如何提升？', '如何分享到社交媒体？'],
      quickTags: ['卡片导出', '稀有度评分', '社媒分享', '出道礼包'],
    },
    en: {
      title: '07 · Debut Preview',
      tips: ['How to export the card?', 'How to boost rarity?', 'How to share to social?'],
      quickTags: ['Export Card', 'Rarity Score', 'Social Share', 'Debut Pack'],
    },
    responses: {
      zh: [
        '艺人卡片支持多种导出格式：PNG高清图（适合社交媒体分享）、ZIP完整礼包（含全部艺人数据）、分享链接（一键传播）。建议选择赛博朋克主题配色以获得最佳视觉效果。',
        '出道礼包内容：艺人档案卡（印刷质量）+ 能力雷达图 + 技能树截图 + 稀有度徽章 + 数字签名证书。填写完整度越高，礼包内容越丰富，建议确保7个步骤全部完成。',
        '社交媒体分享建议：Instagram首选竖版（9:16），Twitter/X首选方形（1:1），微博建议正文强调「AI艺人」特色并添加话题标签，可有效提升自然曝光。',
      ],
      en: [
        'Export formats: High-res PNG (social-ready), ZIP pack (full artist data), Share link (one-click spread). The Cyberpunk card theme delivers the best visual impact for social posts.',
        'Debut pack: Artist Profile Card (print quality) + Ability Radar + Skill Tree screenshot + Rarity Badge + Digital Certificate. More complete data = richer pack — make sure all 7 steps are filled.',
        'Social tips: Instagram → vertical 9:16, Twitter/X → square 1:1, Weibo/TikTok → mention "AI Artist" in caption + trending hashtags for maximum organic reach.',
      ],
    },
  },
];

const WELCOME = {
  zh: (title: string) =>
    `我是 **AI孵化顾问**，现在协助您完成 **${title}** 阶段。\n\n点击下方快捷问题，或直接向我提问！`,
  en: (title: string) =>
    `I'm your **AI Incubation Advisor** for the **${title}** stage.\n\nPick a quick question or ask me anything!`,
};

// ──────────────────────────────────────────────────
export function WizardInlineChat({ lang, step }: { lang: Lang; step: number }) {
  const zh = lang === 'zh';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [responseIdx, setResponseIdx] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ctx = STEP_CONTEXT[Math.min(step, STEP_CONTEXT.length - 1)];
  const quickTips = zh ? ctx.zh.tips : ctx.en.tips;
  const quickTags = zh ? ctx.zh.quickTags : ctx.en.quickTags;
  const stepTitle = zh ? ctx.zh.title : ctx.en.title;

  /* ── Init / reinit on step or lang change ── */
  const initChat = useCallback(
    (s: number) => {
      const c = STEP_CONTEXT[Math.min(s, STEP_CONTEXT.length - 1)];
      const title = zh ? c.zh.title : c.en.title;
      setMessages([
        {
          id: `welcome-${s}-${lang}`,
          role: 'ai',
          text: zh ? WELCOME.zh(title) : WELCOME.en(title),
        },
      ]);
      setResponseIdx(0);
      setTyping(false);
      setInput('');
    },
    [zh, lang],
  );

  useEffect(() => {
    initChat(step);
  }, [step, initChat]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Send helpers ── */
  const handlePrompt = (text: string) => {
    if (!text.trim() || typing) return;
    const responses = zh ? ctx.responses.zh : ctx.responses.en;
    const resp = responses[responseIdx % responses.length];
    setMessages(prev => [...prev, { id: `${Date.now()}-user`, role: 'user', text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: `${Date.now()}-ai`, role: 'ai', text: resp }]);
      setTyping(false);
      setResponseIdx(i => i + 1);
    }, 700 + Math.random() * 500);
  };

  const handleSend = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput('');
    handlePrompt(txt);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">

      {/* ── Chat header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-black/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-gray-300">{zh ? 'AI孵化顾问' : 'AI Advisor'}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-cyan-400/60 font-mono border border-cyan-500/15 rounded px-1 py-0.5 bg-cyan-500/5 truncate max-w-[80px]">
            {stepTitle}
          </span>
          <button
            onClick={() => initChat(step)}
            title={zh ? '重置对话' : 'Reset chat'}
            className="text-gray-600 hover:text-gray-400 transition p-1 rounded hover:bg-white/5"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5`}>
            {msg.role === 'ai' && (
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              </div>
            )}
            <div
              className={`rounded-xl px-2.5 py-2 max-w-[90%] ${
                msg.role === 'ai'
                  ? 'bg-white/[0.04] border border-white/[0.06]'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex gap-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-2.5 py-2 flex items-center gap-1 h-7">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1 h-1 rounded-full bg-cyan-400 inline-block"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* ── Quick prompt chips ── */}
      <div className="shrink-0 px-2.5 pt-2 pb-1 border-t border-white/[0.04] bg-black/10 space-y-1.5">
        {/* Step tips */}
        <div className="flex flex-col gap-1">
          {quickTips.map((tip, i) => (
            <button
              key={i}
              onClick={() => handlePrompt(tip)}
              disabled={typing}
              className="text-left text-[10px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-gray-400 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-cyan-500/60 mr-1">›</span>{tip}
            </button>
          ))}
        </div>
        {/* Quick tag chips */}
        <div className="flex gap-1 flex-wrap">
          {quickTags.map((tag, i) => (
            <button
              key={i}
              onClick={() => setInput(prev => prev + (prev ? ', ' : '') + tag)}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 p-2.5 border-t border-white/[0.06] bg-black/20">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={zh ? '向AI顾问提问...' : 'Ask the AI advisor...'}
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            className="w-7 h-7 shrink-0 rounded-lg bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
