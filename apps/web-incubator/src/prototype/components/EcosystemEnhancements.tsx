import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, BarChart3, CheckCircle2, Film, Mic2, Radio, Sparkles, UserRound, Wand2,
} from 'lucide-react';
import type { Lang } from '../translations';
import { SOLUTION_CONFIGS, getSolutionLabel, type LocalizedText, type SolutionId } from '../data/ipPlatform';

type VerticalId = keyof typeof SOLUTION_CONFIGS;

const ARTIST_META = {
  accent: '#a855f7',
  image: 'https://images.unsplash.com/photo-1767661667474-4f2a197c9a51?auto=format&fit=crop&w=1000&q=85',
  description: { zh: '孵化 AI 艺人，生产音乐、短剧和直播内容，并组建完整的娱乐团队。', en: 'Incubate AI artists across music, drama and live content, with a full entertainment team.' },
  points: [{ zh: '形象、声线与才艺', en: 'Identity, voice and talent' }, { zh: '多领域内容矩阵', en: 'Multi-format content' }, { zh: '粉丝与商业经营', en: 'Fandom and monetization' }],
};

const solutionMeta = (id: SolutionId) => {
  if (id === 'ai-artist' || id === 'ecosystem') return { name: getSolutionLabel(id), ...ARTIST_META };
  const config = SOLUTION_CONFIGS[id as VerticalId];
  return {
    name: config.name,
    accent: config.accent,
    image: config.image,
    description: config.description,
    points: config.capabilities.slice(0, 3).map(item => item.title),
  };
};

const SectionHeading = ({ eyebrow, title, desc, color }: { eyebrow: string; title: string; desc?: string; color: string }) => (
  <div className="text-center max-w-3xl mx-auto mb-12">
    <div className="text-xs uppercase tracking-[.24em] mb-4" style={{ color }}>{eyebrow}</div>
    <h2 className="text-4xl md:text-5xl font-black text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
    {desc && <p className="text-gray-400 mt-4">{desc}</p>}
  </div>
);

/* ─────────────── 1. "What do you want to do?" scenario picker ─────────────── */

const SCENARIOS: Array<{ goal: LocalizedText; solution: SolutionId }> = [
  { goal: { zh: '孵化一位 AI 艺人', en: 'Incubate an AI artist' }, solution: 'ai-artist' },
  { goal: { zh: '做连续更新的短剧', en: 'Produce serial dramas' }, solution: 'ai-drama' },
  { goal: { zh: '用剧情带货', en: 'Sell through stories' }, solution: 'story-commerce' },
  { goal: { zh: '打造虚拟偶像', en: 'Launch a virtual idol' }, solution: 'virtual-idol' },
  { goal: { zh: '让创始人持续发声', en: 'Keep a founder visible' }, solution: 'digital-founder' },
  { goal: { zh: '给企业做数字员工', en: 'Build a digital employee' }, solution: 'corporate-ip' },
  { goal: { zh: '打造品牌角色', en: 'Create a brand character' }, solution: 'brand-ip' },
  { goal: { zh: '推广一座城市', en: 'Promote a city' }, solution: 'city-ip' },
  { goal: { zh: '让传统文化出圈', en: 'Bring heritage to life' }, solution: 'culture-ip' },
  { goal: { zh: '做 AI 教育导师', en: 'Build an AI tutor' }, solution: 'education-ip' },
  { goal: { zh: '开发动漫角色', en: 'Develop anime characters' }, solution: 'anime-ip' },
  { goal: { zh: '运营品牌社群', en: 'Run a brand community' }, solution: 'social-ip' },
];

export const ScenarioPicker = ({ lang, onSelectSolution }: { lang: Lang; onSelectSolution: (id: SolutionId) => void }) => {
  const zh = lang === 'zh';
  const [index, setIndex] = useState(0);
  const scenario = SCENARIOS[index];
  const meta = solutionMeta(scenario.solution);

  return (
    <section id="scenarios" className="px-6 py-24 border-b border-white/5">
      <div className="max-w-7xl mx-auto">
        <SectionHeading eyebrow={zh ? '从你的目标开始' : 'Start From Your Goal'} title={zh ? '你想用 AI 做什么？' : 'What Do You Want to Build?'} desc={zh ? '选一个目标，我们推荐最合适的方案。' : 'Pick a goal and we will recommend the right solution.'} color="#22d3ee" />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-8 items-stretch">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 content-start">
            {SCENARIOS.map((item, i) => {
              const active = i === index;
              const color = solutionMeta(item.solution).accent;
              return (
                <button key={item.goal.en} type="button" onClick={() => setIndex(i)}
                  className="rounded-xl border px-3.5 py-3 text-left text-sm transition"
                  style={active ? { borderColor: color, background: `${color}1f`, color: '#fff', boxShadow: `0 0 20px ${color}30` } : { borderColor: 'rgba(255,255,255,.1)', color: '#9ca3af' }}>
                  <span className="text-xs block mb-1" style={{ color: active ? color : '#4b5563' }}>{zh ? '我想' : 'I want to'}</span>
                  {item.goal[lang]}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={scenario.solution} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .3 }}
              className="relative min-h-[360px] rounded-3xl overflow-hidden border" style={{ borderColor: `${meta.accent}50` }}>
              <img src={meta.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/20" />
              <div className="relative h-full p-7 flex flex-col">
                <span className="self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white" style={{ background: `${meta.accent}cc` }}>
                  <Sparkles className="w-3.5 h-3.5" /> {zh ? '为你推荐' : 'Recommended'}
                </span>
                <div className="mt-auto">
                  <h3 className="text-3xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{meta.name[lang]}</h3>
                  <p className="text-sm text-gray-300 mt-3 max-w-lg leading-relaxed">{meta.description[lang]}</p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {meta.points.map(point => (
                      <span key={point.en} className="inline-flex items-center gap-1.5 rounded-full bg-black/50 border border-white/15 px-3 py-1.5 text-xs text-white/85">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: meta.accent }} /> {point[lang]}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => onSelectSolution(scenario.solution)}
                    className="mt-6 h-12 px-6 rounded-xl text-white font-semibold inline-flex items-center gap-2" style={{ background: meta.accent }}>
                    {zh ? '查看这个方案' : 'View this solution'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

/* ─────────────── 3. Product UI demo ─────────────── */

const DEMO_TABS = [
  { id: 'avatar', icon: UserRound, label: { zh: '形象生成', en: 'Avatar' }, color: '#ec4899', desc: { zh: '输入一句描述，生成多个风格方案，锁定后全平台复用。', en: 'Describe it once, get several styles, lock one and reuse it everywhere.' } },
  { id: 'voice', icon: Mic2, label: { zh: '声音克隆', en: 'Voice' }, color: '#a855f7', desc: { zh: '30 秒样本即可生成专属声线，可调节情绪和语速。', en: 'A 30-second sample creates a voice you can tune for mood and pace.' } },
  { id: 'content', icon: Film, label: { zh: '内容生产', en: 'Content' }, color: '#f59e0b', desc: { zh: '从剧本到分镜再到成片，一条流水线完成。', en: 'Script, storyboard and final cut in one pipeline.' } },
  { id: 'distribute', icon: Radio, label: { zh: '矩阵分发', en: 'Distribution' }, color: '#22d3ee', desc: { zh: '按平台习惯自动排期，多账号统一管理。', en: 'Auto-schedule per platform and manage every account in one place.' } },
  { id: 'analytics', icon: BarChart3, label: { zh: '数据看板', en: 'Analytics' }, color: '#22c55e', desc: { zh: '播放、粉丝、转化与收入实时追踪。', en: 'Track views, fans, conversions and revenue in real time.' } },
] as const;

const AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1535467728855-93fe6218a7b1?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1613698808499-f772ccb4f527?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1708616748538-bdd66d6a9e25?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1614583225154-5fcdda07019e?auto=format&fit=crop&w=400&q=80',
];

const DemoScreen = ({ tab, lang }: { tab: typeof DEMO_TABS[number]; lang: Lang }) => {
  const zh = lang === 'zh';
  const c = tab.color;
  if (tab.id === 'avatar') {
    return (
      <div className="grid grid-cols-[1fr_200px] gap-4 h-full">
        <div className="grid grid-cols-2 gap-3">
          {AVATAR_IMAGES.map((src, i) => (
            <div key={src} className="relative rounded-xl overflow-hidden border" style={{ borderColor: i === 0 ? c : 'rgba(255,255,255,.1)', boxShadow: i === 0 ? `0 0 0 2px ${c}55` : undefined }}>
              <img src={src} alt="" className="w-full h-full object-cover aspect-[4/3]" />
              {i === 0 && <span className="absolute top-2 left-2 rounded-md px-2 py-0.5 text-xs text-white" style={{ background: c }}>{zh ? '已锁定' : 'Locked'}</span>}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-xs text-gray-300 leading-relaxed">{zh ? '“赛博都市风的女歌手，银色短发，眼神冷静”' : '"Cyber-city singer, short silver hair, calm eyes"'}</div>
          {[[zh ? '写实度' : 'Realism', 78], [zh ? '风格强度' : 'Stylisation', 62], [zh ? '年龄感' : 'Age', 40]].map(([label, value]) => (
            <div key={label as string}>
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{value}</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} /></div>
            </div>
          ))}
          <div className="rounded-xl py-2.5 text-center text-xs text-white font-semibold" style={{ background: c }}>{zh ? '生成 4 个新方案' : 'Generate 4 more'}</div>
        </div>
      </div>
    );
  }
  if (tab.id === 'voice') {
    return (
      <div className="flex flex-col h-full gap-5">
        <div className="flex items-end gap-1 h-28">
          {Array.from({ length: 48 }).map((_, i) => (
            <motion.span key={i} className="flex-1 rounded-full" style={{ background: c, opacity: .35 + (i % 5) * .13 }}
              animate={{ height: [`${20 + ((i * 37) % 70)}%`, `${30 + ((i * 53) % 65)}%`, `${20 + ((i * 37) % 70)}%`] }}
              transition={{ duration: 1.4 + (i % 4) * .2, repeat: Infinity, ease: 'easeInOut' }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(zh ? [['情绪', '温柔'], ['语速', '1.0x'], ['音高', '+2']] : [['Mood', 'Warm'], ['Pace', '1.0x'], ['Pitch', '+2']]).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-base text-white font-bold mt-1">{v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-sm text-gray-300">{zh ? '“大家好，欢迎来到今晚的直播间！”' : '"Hi everyone, welcome to tonight\'s stream!"'}</div>
      </div>
    );
  }
  if (tab.id === 'content') {
    return (
      <div className="grid grid-cols-[180px_1fr] gap-4 h-full">
        <div className="space-y-2">
          {(zh ? ['第 1 场 · 雨夜码头', '第 2 场 · 档案室', '第 3 场 · 审讯室', '第 4 场 · 天台'] : ['Sc.1 · Rainy dock', 'Sc.2 · Archive', 'Sc.3 · Interrogation', 'Sc.4 · Rooftop']).map((scene, i) => (
            <div key={scene} className="rounded-lg px-3 py-2 text-xs border" style={i === 1 ? { borderColor: c, color: '#fff', background: `${c}20` } : { borderColor: 'rgba(255,255,255,.08)', color: '#9ca3af' }}>{scene}</div>
          ))}
        </div>
        <div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-lg border border-white/10 flex items-end p-1.5 text-xs text-gray-500" style={{ background: `linear-gradient(135deg, ${c}${i % 2 ? '22' : '38'}, rgba(0,0,0,.6))` }}>
                {zh ? `镜头 ${i + 1}` : `Shot ${i + 1}`}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full" style={{ background: c }} animate={{ width: ['30%', '86%', '30%'] }} transition={{ duration: 5, repeat: Infinity }} /></div>
            <span className="text-xs text-gray-400">{zh ? '成片渲染中' : 'Rendering'}</span>
          </div>
        </div>
      </div>
    );
  }
  if (tab.id === 'distribute') {
    const rows = zh
      ? [['短视频平台', '今天 12:00', '已发布'], ['长视频平台', '今天 18:00', '排期中'], ['社交媒体', '今天 20:30', '排期中'], ['海外平台 · 英文', '明天 09:00', '翻译中']]
      : [['Short video', 'Today 12:00', 'Published'], ['Long-form video', 'Today 18:00', 'Scheduled'], ['Social media', 'Today 20:30', 'Scheduled'], ['Global · English', 'Tomorrow 09:00', 'Translating']];
    return (
      <div className="space-y-2.5">
        {rows.map(([platform, time, status], i) => (
          <div key={platform} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c}20`, color: c }}><Radio className="w-4 h-4" /></span>
            <span className="flex-1 text-sm text-white">{platform}</span>
            <span className="text-xs text-gray-500 w-28">{time}</span>
            <span className="text-xs rounded-full px-2.5 py-1" style={i === 0 ? { background: '#22c55e25', color: '#4ade80' } : { background: `${c}20`, color: c }}>{status}</span>
          </div>
        ))}
      </div>
    );
  }
  const bars = [42, 58, 51, 74, 66, 88, 96];
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="grid grid-cols-3 gap-3">
        {(zh ? [['播放', '1.2 亿', '+18%'], ['新增粉丝', '86 万', '+24%'], ['收入', '¥320 万', '+31%']] : [['Views', '120M', '+18%'], ['New fans', '860K', '+24%'], ['Revenue', '¥3.2M', '+31%']]).map(([k, v, d]) => (
          <div key={k} className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="text-lg text-white font-black mt-1">{v}</div>
            <div className="text-xs" style={{ color: c }}>{d}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-2 rounded-xl bg-white/[0.02] border border-white/10 p-4 min-h-[120px]">
        {bars.map((v, i) => (
          <motion.span key={i} className="flex-1 rounded-t-md" style={{ background: `linear-gradient(${c}, ${c}40)` }}
            initial={{ height: 0 }} whileInView={{ height: `${v}%` }} viewport={{ once: true }} transition={{ delay: i * .06, duration: .5 }} />
        ))}
      </div>
    </div>
  );
};

export const ProductDemo = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [active, setActive] = useState(0);
  const tab = DEMO_TABS[active];
  return (
    <section id="product" className="px-6 py-28">
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow={zh ? '产品演示' : 'Product Tour'} title={zh ? '看看平台用起来是什么样' : 'See the Platform in Action'} desc={zh ? '从形象到数据，一个工作台完成。' : 'From avatar to analytics, all in one workspace.'} color="#22c55e" />
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0">
            {DEMO_TABS.map((item, i) => {
              const isActive = i === active;
              return (
                <button key={item.id} type="button" onClick={() => setActive(i)}
                  className="shrink-0 lg:shrink flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition"
                  style={isActive ? { borderColor: item.color, background: `${item.color}18` } : { borderColor: 'rgba(255,255,255,.08)' }}>
                  <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${item.color}20`, color: item.color }}><item.icon className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>{item.label[lang]}</span>
                    <span className="hidden lg:block text-xs text-gray-500 mt-0.5 leading-snug">{item.desc[lang]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#070b12] overflow-hidden" style={{ boxShadow: `0 30px 80px ${tab.color}18` }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-gray-400"><Wand2 className="w-3.5 h-3.5" style={{ color: tab.color }} /> AI Star Eco · {tab.label[lang]}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }} className="p-5 md:p-6 min-h-[340px]">
                <DemoScreen tab={tab} lang={lang} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─────────────── 4. Ecosystem FAQ data ─────────────── */

export const ECOSYSTEM_FAQ = [
  { q: { zh: '创作的 IP 版权归谁？', en: 'Who owns the IP I create?' }, a: { zh: '你创作的角色、内容与衍生作品版权归你所有，平台提供确权与授权记录。', en: 'You own the characters, content and derivatives; the platform records rights and licences.' } },
  { q: { zh: '我的数据和素材安全吗？', en: 'Are my data and assets safe?' }, a: { zh: '素材、形象与声音加密存储，只有你授权的成员可以调用。', en: 'Assets, likeness and voice are encrypted and only usable by members you approve.' } },
  { q: { zh: '可以导入自己的素材吗？', en: 'Can I use my own materials?' }, a: { zh: '支持导入剧本、图片、音频、知识文档和已有角色设定。', en: 'Import scripts, images, audio, documents and existing character sheets.' } },
  { q: { zh: '一个账号能同时用多个方案吗？', en: 'Can one account use several solutions?' }, a: { zh: '可以，同一个 IP 也能跨方案使用，例如虚拟偶像同时做剧情带货。', en: 'Yes — one IP can even span solutions, like a virtual idol doing story commerce.' } },
  { q: { zh: '需要专业团队吗？', en: 'Do I need a professional team?' }, a: { zh: '不需要，AI 完成大部分制作工作，你负责创意与决策。', en: 'No — AI handles most production while you make the creative calls.' } },
];
