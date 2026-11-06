import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, BadgeCheck, Bot, Calendar, CheckCircle2, Crown, Heart, Mic2, Music, Play, Sparkles, TrendingUp, User, Users,
} from 'lucide-react';
import type { Lang } from '../translations';

const L = (zh: string, en: string) => ({ zh, en });
type LT = { zh: string; en: string };

const Heading = ({ badge, title, desc, color }: { badge: string; title: string; desc: string; color: string }) => (
  <div className="text-center max-w-4xl mx-auto mb-14">
    <span className="inline-flex rounded-full px-3 py-1 text-xs mb-4 border" style={{ color, borderColor: `${color}50`, background: `${color}14` }}>{badge}</span>
    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
    <p className="text-gray-400 mt-4 font-light">{desc}</p>
  </div>
);

/* ─────────────── 1. Artist profile card preview ─────────────── */

const TALENTS: Array<[LT, number, string]> = [
  [L('唱功', 'Vocals'), 92, '#22d3ee'], [L('演技', 'Acting'), 56, '#a855f7'], [L('舞蹈', 'Dance'), 78, '#ec4899'],
  [L('主持', 'Hosting'), 52, '#f59e0b'], [L('喜剧', 'Comedy'), 44, '#22c55e'], [L('综艺感', 'Variety'), 70, '#ef4444'],
];

export const ArtistProfilePreview = ({ lang, onEnter }: { lang: Lang; onEnter: () => void }) => {
  const zh = lang === 'zh';
  const facts: Array<[LT, LT]> = [
    [L('艺人类型', 'Type'), L('偶像 · 唱跳路线', 'Idol · singing & dance')],
    [L('声线', 'Voice'), L('清亮中音 · 带电子质感', 'Bright mezzo · electronic edge')],
    [L('风格', 'Style'), L('赛博都市 · 暗黑流行', 'Cyber-city · dark pop')],
    [L('核心受众', 'Audience'), L('18–30 岁 · 一二线城市', 'Ages 18–30 · major cities')],
  ];
  const business = zh ? ['数字专辑', '虚拟演唱会', '潮牌代言', '游戏联动', '周边授权'] : ['Digital albums', 'Virtual concerts', 'Fashion deals', 'Game tie-ins', 'Merch licensing'];

  return (
    <section id="profile" className="relative z-10 py-28 px-6">
      <div className="container mx-auto max-w-6xl">
        <Heading badge={zh ? '艺人档案' : 'Artist Profile'} title={zh ? '孵化完成后，你会得到一位完整的艺人' : 'What a Finished AI Artist Looks Like'} desc={zh ? '形象、声音、才艺、受众和商业方向，全部沉淀在一张可经营的档案里。' : 'Identity, voice, talents, audience and business paths — all in one operable profile.'} color="#22d3ee" />
        <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-stretch">
          <motion.div initial={{ opacity: 0, y: 24, rotate: -2 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true }} transition={{ duration: .6 }}
            className="relative rounded-3xl overflow-hidden min-h-[460px] border border-cyan-500/30" style={{ boxShadow: '0 30px 80px rgba(34,211,238,.15)' }}>
            <img src="/images/artist-neon-v.webp" alt="NEON V" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="relative h-full p-6 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs text-cyan-300 border border-cyan-500/30"><BadgeCheck className="w-3.5 h-3.5" /> {zh ? '已出道' : 'Debuted'}</span>
                <span className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-1.5 text-xs text-white font-bold">LV.12</span>
              </div>
              <div className="mt-auto">
                <div className="text-xs text-gray-300">{zh ? 'AI 艺人 · 编号 AS-0417' : 'AI Artist · ID AS-0417'}</div>
                <div className="text-5xl text-white font-black tracking-tight mt-1" style={{ fontFamily: 'var(--font-display)' }}>NEON V</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(zh ? [['86 万', '粉丝'], ['26', '作品'], ['12', '合作']] : [['860K', 'Fans'], ['26', 'Works'], ['12', 'Deals']]).map(([v, k]) => (
                    <div key={k} className="rounded-xl bg-black/55 backdrop-blur border border-white/10 py-2.5 text-center">
                      <div className="text-lg text-white font-black">{v}</div>
                      <div className="text-xs text-gray-400">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="rounded-3xl border border-white/10 bg-gray-900/40 p-6 md:p-8 flex flex-col">
            <div className="grid sm:grid-cols-2 gap-3">
              {facts.map(([k, v]) => (
                <div key={k.en} className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                  <div className="text-xs text-gray-500">{k[lang]}</div>
                  <div className="text-sm text-white font-semibold mt-1">{v[lang]}</div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{zh ? '才艺能力' : 'Talents'}</div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {TALENTS.map(([name, value, color], i) => (
                  <div key={name.en}>
                    <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-300">{name[lang]}</span><span className="font-mono" style={{ color }}>{value}</span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} whileInView={{ width: `${value}%` }} viewport={{ once: true }} transition={{ duration: .8, delay: i * .08 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{zh ? '可发展的商业方向' : 'Business Paths'}</div>
              <div className="flex flex-wrap gap-2">
                {business.map(item => <span key={item} className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200">{item}</span>)}
              </div>
            </div>
            <button type="button" onClick={onEnter} className="mt-auto pt-6 self-start inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
              {zh ? '创建我的艺人档案' : 'Create my artist profile'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─────────────── 2. Seven-stage incubation path ─────────────── */

const STAGES: Array<{ icon: React.ComponentType<{ className?: string }>; name: LT; you: LT; ai: LT; output: LT; time: LT }> = [
  { icon: User, name: L('角色设定', 'Persona'), you: L('描述你想要的艺人', 'Describe the artist you want'), ai: L('生成人设、背景故事与世界观', 'Builds persona, backstory and world'), output: L('角色设定书', 'Persona bible'), time: L('第 1 天', 'Day 1') },
  { icon: Sparkles, name: L('形象与声音', 'Look & Voice'), you: L('挑选喜欢的形象方案', 'Pick your favourite look'), ai: L('生成形象与专属声线并锁定', 'Creates and locks look and voice'), output: L('形象 + 声线', 'Look + voice'), time: L('第 2–3 天', 'Days 2–3') },
  { icon: Mic2, name: L('才艺训练', 'Talent Training'), you: L('选择主攻方向', 'Choose a focus'), ai: L('训练唱功、演技、舞蹈等 6 项能力', 'Trains 6 skills incl. vocals, acting and dance'), output: L('才艺雷达图', 'Talent radar'), time: L('第 4–7 天', 'Days 4–7') },
  { icon: Music, name: L('首支作品', 'First Release'), you: L('确认歌曲或短剧方向', 'Approve the song or drama'), ai: L('完成词曲、MV 或短剧制作', 'Produces the song, MV or drama'), output: L('出道作品', 'Debut work'), time: L('第 2 周', 'Week 2') },
  { icon: Heart, name: L('直播与粉丝', 'Live & Fans'), you: L('设定直播时间', 'Set a live schedule'), ai: L('驱动直播、回复粉丝、组织应援', 'Runs streams, replies and fan projects'), output: L('粉丝社群', 'Fan community'), time: L('第 3–4 周', 'Weeks 3–4') },
  { icon: Crown, name: L('商业合作', 'Brand Deals'), you: L('审核合作邀约', 'Review offers'), ai: L('匹配品牌、生成方案与内容', 'Matches brands and drafts content'), output: L('首个商单', 'First deal'), time: L('第 2 个月', 'Month 2') },
  { icon: Users, name: L('团队扩展', 'Build a Team'), you: L('决定扩展方向', 'Decide where to grow'), ai: L('配置制作人、经纪人等数字团队', 'Adds digital producers and managers'), output: L('艺人矩阵', 'Artist roster'), time: L('第 3 个月', 'Month 3') },
];

export const IncubationPath = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  const Icon = stage.icon;
  return (
    <section id="incubation-path" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black">
      <div className="container mx-auto max-w-6xl">
        <Heading badge={zh ? '孵化路线' : 'Incubation Path'} title={zh ? '7 个阶段，从一个想法到一位明星' : 'Seven Stages From an Idea to a Star'} desc={zh ? '每一步都清楚：你负责决策，AI 负责执行。' : 'Every step is clear: you decide, AI executes.'} color="#a855f7" />
        <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-6">
          <ol className="relative space-y-1.5">
            <span aria-hidden className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-cyan-500/60 via-purple-500/60 to-pink-500/60" />
            {STAGES.map((item, i) => {
              const isActive = i === active;
              return (
                <li key={item.name.en}>
                  <button type="button" onClick={() => setActive(i)} className={`relative w-full flex items-center gap-3 rounded-xl px-1.5 py-2 text-left transition ${isActive ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                    <span className={`relative z-10 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${i <= active ? 'text-white bg-gradient-to-br from-cyan-500 to-purple-600' : 'text-gray-500 bg-gray-900 border border-white/10'}`}>{i + 1}</span>
                    <span className={`flex-1 text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-400'}`}>{item.name[lang]}</span>
                    <span className="text-xs text-gray-600">{item.time[lang]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .3 }}
              className="rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 via-gray-900/60 to-black p-6 md:p-8">
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white"><Icon className="w-6 h-6" /></span>
                <div>
                  <div className="text-xs text-purple-300">{zh ? `阶段 ${active + 1} / 7` : `Stage ${active + 1} of 7`} · {stage.time[lang]}</div>
                  <h3 className="text-3xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{stage.name[lang]}</h3>
                </div>
              </div>
              <div className="mt-8 grid md:grid-cols-3 gap-3">
                {([[L('你来做', 'You do'), stage.you, User, '#22d3ee'], [L('AI 来做', 'AI does'), stage.ai, Bot, '#a855f7'], [L('得到什么', 'You get'), stage.output, CheckCircle2, '#ec4899']] as const).map(([label, value, ItemIcon, color]) => (
                  <div key={label.en} className="rounded-2xl bg-black/40 border border-white/10 p-5">
                    <div className="flex items-center gap-2 text-xs" style={{ color }}><ItemIcon className="w-4 h-4" /> {label[lang]}</div>
                    <div className="text-base text-white font-semibold mt-3 leading-snug">{value[lang]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {STAGES.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-8 bg-gradient-to-r from-cyan-400 to-purple-500' : i < active ? 'w-3 bg-purple-500/60' : 'w-3 bg-white/10'}`} />)}
                </div>
                <button type="button" onClick={() => setActive(i => (i + 1) % STAGES.length)} className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white">
                  {active === STAGES.length - 1 ? (zh ? '从头查看' : 'Start over') : (zh ? '下一阶段' : 'Next stage')} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

/* ─────────────── 3. Operations dashboard ─────────────── */

const FAN_GROWTH = [12, 18, 25, 31, 42, 48, 57, 63, 70, 78, 82, 86];
const REVENUE: Array<[LT, number, string]> = [
  [L('品牌合作', 'Brand deals'), 38, '#ec4899'], [L('直播打赏', 'Live tips'), 26, '#a855f7'],
  [L('音乐版权', 'Music royalties'), 21, '#22d3ee'], [L('授权周边', 'Licensing & merch'), 15, '#f59e0b'],
];

const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8 mt-3">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
};

export const OperationsDashboard = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  const max = Math.max(...FAN_GROWTH);
  const coords = FAN_GROWTH.map((v, i) => [(i / (FAN_GROWTH.length - 1)) * 100, 100 - (v / max) * 84]);
  const points = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const kpis: Array<[LT, string, string, React.ComponentType<{ className?: string }>, string, number[]]> = [
    [L('粉丝总数', 'Total fans'), zh ? '86 万' : '860K', '+12%', Users, '#22d3ee', [3, 4, 4, 5, 6, 6, 7, 8]],
    [L('本月播放', 'Monthly plays'), zh ? '3200 万' : '32M', '+28%', Play, '#a855f7', [2, 3, 3, 5, 4, 6, 7, 9]],
    [L('直播互动', 'Live engagement'), zh ? '18 万' : '180K', '+9%', Heart, '#ec4899', [5, 4, 6, 5, 7, 6, 7, 8]],
    [L('本月收入', 'Monthly revenue'), zh ? '¥85 万' : '¥850K', '+31%', TrendingUp, '#f59e0b', [2, 3, 4, 4, 6, 7, 8, 10]],
  ];
  const tasks: Array<[string, LT, string, LT]> = [
    ['10:00', L('发布新单曲预告', 'Post single teaser'), '#22d3ee', L('内容', 'Content')],
    ['15:00', L('审核潮牌联名脚本', 'Review fashion collab script'), '#ec4899', L('商务', 'Business')],
    ['20:00', L('2 小时粉丝直播', '2-hour fan livestream'), '#a855f7', L('直播', 'Live')],
  ];
  // Donut segments for the revenue mix.
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <section id="operations" className="relative z-10 py-28 px-6 overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[10%] top-[20%] w-[420px] h-[420px] rounded-full blur-[120px] bg-pink-500/15" />
        <div className="absolute right-[8%] bottom-[5%] w-[460px] h-[460px] rounded-full blur-[120px] bg-cyan-500/12" />
      </div>
      <div className="container mx-auto max-w-6xl relative">
        <Heading badge={zh ? '艺人经营' : 'Artist Operations'} title={zh ? '出道之后，每一天都在增长' : 'After Debut, Growth Every Day'} desc={zh ? '粉丝、内容、直播与收入在一个面板里实时追踪。' : 'Track fans, content, live and revenue in one dashboard.'} color="#ec4899" />
        <div className="relative rounded-[28px] p-px overflow-hidden" style={{ boxShadow: '0 40px 120px rgba(236,72,153,.18)' }}>
          <motion.div aria-hidden className="absolute -inset-[60%]" style={{ background: 'conic-gradient(from 0deg, #ec4899, transparent 25%, #22d3ee, transparent 55%, #a855f7, transparent 85%)' }}
            animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} />
          <div className="relative rounded-[27px] bg-[#060912] p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <span className="relative p-[2px] rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500">
                  <img src="/images/artist-neon-v.webp" alt="" className="w-11 h-11 rounded-full object-cover border-2 border-black" />
                </span>
                <div>
                  <div className="text-base text-white font-bold">NEON V</div>
                  <div className="text-xs text-gray-500">{zh ? '经营看板 · 近 12 周' : 'Dashboard · last 12 weeks'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-red-300 bg-red-500/10 border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> {zh ? '直播中 · 1.8 万在线' : 'LIVE · 18K watching'}
                </span>
                <span className="text-xs text-gray-600">{zh ? '示例数据' : 'Sample data'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpis.map(([label, value, change, KIcon, color, spark], i) => (
                <motion.div key={label.en} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .07 }} whileHover={{ y: -4 }}
                  className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${color}35`, background: `linear-gradient(145deg, ${color}18, rgba(255,255,255,.01) 60%)` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{label[lang]}</span>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}25`, color }}><KIcon className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className="text-2xl md:text-3xl text-white font-black mt-2 whitespace-nowrap" style={{ fontFamily: 'var(--font-display)' }}>{value}</div>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">▲ {change}</div>
                  <Sparkline values={spark} color={color} />
                </motion.div>
              ))}
            </div>

            <div className="mt-4 grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white font-semibold">{zh ? '粉丝增长（万）' : 'Fan growth (10K)'}</div>
                  <span className="text-xs rounded-full px-2.5 py-1 text-pink-300 bg-pink-500/10 border border-pink-500/30">{zh ? '12 周 +617%' : '+617% in 12 wks'}</span>
                </div>
                <div className="relative mt-4">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-56 overflow-visible">
                    <defs>
                      <linearGradient id="fan-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity=".45" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0" /></linearGradient>
                      <linearGradient id="fan-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#ec4899" /></linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,.06)" vectorEffect="non-scaling-stroke" />)}
                    <clipPath id="fan-reveal">
                      <motion.rect x="0" y="-10" height="120" initial={{ width: reduce ? 100 : 0 }} whileInView={{ width: 100 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeOut' }} />
                    </clipPath>
                    <g clipPath="url(#fan-reveal)">
                      <polygon points={`0,100 ${points} 100,100`} fill="url(#fan-area)" />
                      <polyline points={points} fill="none" stroke="url(#fan-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 6px #ec4899)' }} />
                    </g>
                  </svg>
                  {/* Glowing end point with the latest value */}
                  <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${lastX}%`, top: `${(lastY / 100) * 224}px` }}>
                    {!reduce && <motion.span className="absolute inset-0 rounded-full bg-pink-500" animate={{ scale: [1, 2.6], opacity: [.6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
                    <span className="relative block w-3 h-3 rounded-full bg-white border-2 border-pink-500" />
                    <span className="absolute right-4 -top-9 whitespace-nowrap rounded-lg bg-pink-500 px-2.5 py-1 text-xs text-white font-bold shadow-lg">{zh ? '86 万' : '860K'}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2"><span>W1</span><span>W6</span><span>W12</span></div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-sm text-white font-semibold mb-4">{zh ? '收入构成' : 'Revenue mix'}</div>
                  <div className="flex items-center gap-5">
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="12" />
                        {REVENUE.map(([label, value, color], i) => {
                          const length = (value / 100) * C;
                          const segment = (
                            <motion.circle key={label.en} cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="butt"
                              strokeDasharray={`${length} ${C}`} strokeDashoffset={-offset}
                              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: .2 + i * .15 }}
                              style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                          );
                          offset += length;
                          return segment;
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg text-white font-black">{zh ? '¥85万' : '¥850K'}</span>
                        <span className="text-xs text-gray-500">{zh ? '本月' : 'This month'}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {REVENUE.map(([label, value, color]) => (
                        <div key={label.en} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                          <span className="text-gray-400 flex-1">{label[lang]}</span>
                          <span className="font-semibold" style={{ color }}>{value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-center gap-2 text-sm text-white font-semibold mb-4"><Calendar className="w-4 h-4 text-cyan-400" /> {zh ? '今日安排' : 'Today'}</div>
                  <ol className="relative space-y-3 pl-4">
                    <span aria-hidden className="absolute left-[3px] top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400 via-pink-500 to-purple-500 opacity-50" />
                    {tasks.map(([time, label, color, tag]) => (
                      <li key={label.en} className="relative flex items-center gap-3 text-sm">
                        <span className="absolute -left-4 w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                        <span className="text-xs font-mono w-11" style={{ color }}>{time}</span>
                        <span className="text-gray-200 flex-1">{label[lang]}</span>
                        <span className="text-xs rounded-full px-2 py-0.5" style={{ color, background: `${color}18` }}>{tag[lang]}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
