import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Award, BarChart3, CheckCircle2, Cpu, Flame, Globe2, Heart, Layers, Lock, MessageCircle,
  Minus, Plus, Quote, Radio, Rocket, Shield, Sparkles, Star, TrendingUp, Zap,
} from 'lucide-react';
import type { Lang } from '../translations';
import { IP_AXES, ROLE_COUNT, ROLE_GROUPS, findRole, groupAverage } from '../data/roleIpSystem';

type LT = { zh: string; en: string };
const L = (zh: string, en: string): LT => ({ zh, en });

/* ═══════════════ Shared visual primitives ═══════════════ */

/** Soft drifting aurora blobs behind a section. */
export const SectionAurora = ({ colors }: { colors: string[] }) => {
  const reduce = useReducedMotion();
  const spots = [
    { left: '8%', top: '10%', size: 420 },
    { left: '62%', top: '0%', size: 520 },
    { left: '35%', top: '55%', size: 460 },
  ];
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {spots.map((spot, i) => (
        <motion.div key={i} className="absolute rounded-full blur-[110px]"
          style={{ left: spot.left, top: spot.top, width: spot.size, height: spot.size, background: colors[i % colors.length], opacity: .16 }}
          animate={reduce ? undefined : { x: [0, 40, -30, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
      <div className="absolute inset-0 opacity-[.35]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }} />
    </div>
  );
};

/** Card wrapped in a slowly rotating conic-gradient border. */
export const GradientBorder = ({ colors, active = true, radius = 24, className = '', children }: { colors: string[]; active?: boolean; radius?: number; className?: string; children: React.ReactNode }) => {
  const reduce = useReducedMotion();
  return (
    <div className={`relative p-px overflow-hidden ${className}`} style={{ borderRadius: radius }}>
      <motion.div aria-hidden className="absolute -inset-[60%]"
        style={{ background: `conic-gradient(from 0deg, ${colors.join(', ')}, ${colors[0]})`, opacity: active ? 1 : .25 }}
        animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
      <div className="relative h-full bg-[#070a12]" style={{ borderRadius: radius - 1 }}>{children}</div>
    </div>
  );
};

const SectionHeader = ({ badge, title, desc, color }: { badge: string; title: string; desc?: string; color: string }) => (
  <div className="text-center max-w-4xl mx-auto mb-16 relative">
    <motion.span initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs mb-5 border backdrop-blur"
      style={{ color, borderColor: `${color}55`, background: `${color}14`, boxShadow: `0 0 24px ${color}25` }}>
      <Sparkles className="w-3 h-3" /> {badge}
    </motion.span>
    <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>
      {title}
    </h2>
    {desc && <p className="text-base sm:text-lg text-gray-400 mt-5 max-w-2xl mx-auto leading-relaxed font-light">{desc}</p>}
  </div>
);

/* ═══════════════ 1. Workflow pipeline ═══════════════ */

const WORKFLOW_META = [
  { icon: Rocket, color: '#22d3ee', color2: '#3b82f6', output: L('AI 艺人', 'AI artist') },
  { icon: Cpu, color: '#a855f7', color2: '#6366f1', output: L('音乐 · 短剧 · 综艺', 'Music · Drama · Shows') },
  { icon: Layers, color: '#ec4899', color2: '#f43f5e', output: L('150+ 平台', '150+ platforms') },
  { icon: TrendingUp, color: '#f59e0b', color2: '#f97316', output: L('多元收益', 'Diverse revenue') },
];

export const WorkflowPipeline = ({ lang, tag, title, desc, steps }: { lang: Lang; tag: string; title: string; desc: string; steps: Array<{ title: string; desc: string }> }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  return (
    <section id="features" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#22d3ee', '#a855f7', '#ec4899']} />
      <div className="container mx-auto relative">
        <SectionHeader badge={tag} title={title} desc={desc} color="#a855f7" />
        <div className="relative max-w-6xl mx-auto">
          {/* Glowing pipeline with a travelling light */}
          <div aria-hidden className="hidden lg:block absolute left-[6%] right-[6%] top-[52px] h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899, #f59e0b)', opacity: .35 }} />
          {!reduce && (
            <motion.div aria-hidden className="hidden lg:block absolute top-[46px] w-24 h-[14px] rounded-full blur-md"
              style={{ background: 'linear-gradient(90deg, transparent, #fff, transparent)' }}
              animate={{ left: ['4%', '86%'] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }} />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => {
              const meta = WORKFLOW_META[i];
              const Icon = meta.icon;
              return (
                <motion.div key={step.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .12, duration: .6 }}
                  whileHover={{ y: -8 }} className="group relative">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      {!reduce && <motion.span aria-hidden className="absolute inset-0 rounded-full" style={{ border: `1px solid ${meta.color}` }} animate={{ scale: [1, 1.6], opacity: [.7, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * .6 }} />}
                      <span className="relative z-10 w-[104px] h-[104px] rounded-full flex items-center justify-center"
                        style={{ background: `radial-gradient(circle at 30% 30%, ${meta.color}55, ${meta.color2}22 60%, rgba(7,10,18,.95) 70%)`, boxShadow: `0 0 0 1px ${meta.color}55, 0 0 40px ${meta.color}45, inset 0 0 30px ${meta.color}30` }}>
                        <Icon className="w-9 h-9 text-white drop-shadow-[0_0_12px_rgba(255,255,255,.6)]" />
                      </span>
                    </div>
                  </div>
                  <GradientBorder colors={[meta.color, 'transparent', meta.color2, 'transparent']} active={false} className="transition-shadow duration-500 group-hover:shadow-[0_20px_60px_rgba(0,0,0,.4)]">
                    <div className="relative p-6 overflow-hidden min-h-[230px]">
                      <span aria-hidden className="absolute -right-1 -bottom-8 text-[110px] font-black leading-none select-none" style={{ color: meta.color, opacity: .07, fontFamily: 'var(--font-display)' }}>0{i + 1}</span>
                      <div className="text-xs font-mono tracking-[.2em]" style={{ color: meta.color }}>STEP 0{i + 1}</div>
                      <h3 className="text-xl text-white font-bold mt-2 tracking-tight">{step.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed mt-3">{step.desc}</p>
                      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white" style={{ background: `linear-gradient(135deg, ${meta.color}40, ${meta.color2}25)`, border: `1px solid ${meta.color}50` }}>
                        <Sparkles className="w-3 h-3" /> {zh ? '产出：' : 'Output: '}{meta.output[lang]}
                      </div>
                      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
                    </div>
                  </GradientBorder>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 3. Three-port flywheel ═══════════════ */

const PORTS = [
  { icon: Heart, color: '#ec4899', color2: '#f43f5e', image: 'https://images.unsplash.com/photo-1574613551425-9321df582f65?auto=format&fit=crop&w=900&q=80', title: L('艺人观赏台', 'Fan Platform'), sub: L('粉丝消费端 · C2C', 'Consumer · C2C'), desc: L('观看全部作品、支持偶像、收藏数字资产、参与投票决策，构建沉浸式追星体验。', 'Watch, support idols, collect digital assets and vote — an immersive fan experience.'), features: [L('追星互动', 'Fan interaction'), L('数字收藏', 'Collectibles'), L('投票共创', 'Voting')], stat: ['420万', '4.2M', L('活跃粉丝', 'Active fans')] },
  { icon: Rocket, color: '#22d3ee', color2: '#3b82f6', image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=80', title: L('生态创业者', 'Eco Entrepreneur'), sub: L('内容创作端 · Core', 'Creator · Core'), desc: L('孵化 AI 艺人、制作全域内容、运营艺人矩阵，实现多维度商业变现。', 'Incubate AI artists, create content, run the roster and monetize across channels.'), features: [L('AI 孵化', 'AI incubation'), L('内容制作', 'Production'), L('商业变现', 'Monetization')], stat: ['10万+', '100K+', L('创业者', 'Creators')] },
  { icon: Shield, color: '#a855f7', color2: '#6366f1', image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=900&q=80', title: L('专业发行机构', 'Pro Agency'), sub: L('B2B 赋能端 · Enterprise', 'B2B · Enterprise'), desc: L('提供导演服务、发行资源、版权管理与艺人签约，为生态注入专业能力。', 'Directing, distribution, rights management and signing bring professional power.'), features: [L('导演服务', 'Directing'), L('版权管理', 'Rights'), L('资源对接', 'Resources')], stat: ['300+', '300+', L('合作机构', 'Partner agencies')] },
];

export const ThreePortFlywheel = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  return (
    <section id="ecosystem" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#ec4899', '#22d3ee', '#a855f7']} />
      <div className="container mx-auto relative">
        <SectionHeader badge={zh ? '三端生态' : 'Three-Port Ecosystem'} title={zh ? '完整商业闭环，三端协同共赢' : 'One Loop, Three Ports, Shared Growth'} desc={zh ? '粉丝消费 × 创业孵化 × 机构赋能 = 无限增长飞轮' : 'Fans × Creators × Agencies = an endless growth flywheel'} color="#ec4899" />
        <div className="relative max-w-6xl mx-auto">
          {/* Flywheel rings behind the cards */}
          <div aria-hidden className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] pointer-events-none">
            <motion.div className="absolute inset-0 rounded-full" style={{ border: '1px dashed rgba(255,255,255,.12)' }} animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} />
            <motion.div className="absolute inset-16 rounded-full" style={{ background: 'conic-gradient(from 0deg, #ec489933, transparent 30%, #22d3ee33, transparent 63%, #a855f733, transparent)' }} animate={reduce ? undefined : { rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
          </div>
          <div className="relative grid md:grid-cols-3 gap-6 md:items-center">
            {PORTS.map((port, i) => {
              const Icon = port.icon;
              const core = i === 1;
              return (
                <motion.div key={port.title.en} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .15, duration: .6 }} whileHover={{ y: -10 }}
                  className={`group relative ${core ? 'md:-my-6 z-10' : ''}`}>
                  <GradientBorder colors={[port.color, 'transparent', port.color2, 'transparent']} active={core} radius={28}
                    className={core ? 'shadow-[0_30px_90px_rgba(34,211,238,.25)]' : ''}>
                    <div className="relative overflow-hidden" style={{ borderRadius: 27 }}>
                      <div className={`relative ${core ? 'h-52' : 'h-44'} overflow-hidden`}>
                        <img src={port.image} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${port.color}30, rgba(7,10,18,.2) 30%, #070a12)` }} />
                        <span className="absolute top-4 left-4 rounded-full px-3 py-1 text-xs text-white backdrop-blur" style={{ background: `${port.color}aa` }}>{port.sub[lang]}</span>
                        {core && <span className="absolute top-4 right-4 rounded-full px-3 py-1 text-xs text-black bg-white font-bold">{zh ? '核心端' : 'Core'}</span>}
                      </div>
                      <div className="relative px-6 pb-7 -mt-10 text-center">
                        <span className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-white"
                          style={{ background: `linear-gradient(135deg, ${port.color}, ${port.color2})`, boxShadow: `0 12px 34px ${port.color}60` }}>
                          <Icon className="w-7 h-7" />
                        </span>
                        <h3 className="text-2xl text-white font-black mt-5 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{port.title[lang]}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed mt-3">{port.desc[lang]}</p>
                        <div className="mt-5 flex justify-center gap-2 flex-wrap">
                          {port.features.map(feature => (
                            <span key={feature.en} className="text-xs rounded-full px-3 py-1" style={{ color: port.color, background: `${port.color}14`, border: `1px solid ${port.color}35` }}>{feature[lang]}</span>
                          ))}
                        </div>
                        <div className="mt-6 pt-5 border-t border-white/10">
                          <div className="text-3xl font-black" style={{ color: port.color, fontFamily: 'var(--font-display)' }}>{zh ? port.stat[0] as string : port.stat[1] as string}</div>
                          <div className="text-xs text-gray-500 mt-1">{(port.stat[2] as LT)[lang]}</div>
                        </div>
                      </div>
                    </div>
                  </GradientBorder>
                </motion.div>
              );
            })}
          </div>
          {/* Flow labels between the ports */}
          <div className="hidden md:flex justify-center gap-4 mt-12">
            {[L('粉丝消费 → 创作者收益', 'Fan spend → creator revenue'), L('创作者作品 → 机构发行', 'Creator works → agency release'), L('机构资源 → 粉丝体验', 'Agency resources → fan experience')].map((flow, i) => (
              <motion.span key={flow.en} initial={{ opacity: 0, scale: .9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: .5 + i * .12 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-gray-300 backdrop-blur">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: PORTS[i].color, boxShadow: `0 0 8px ${PORTS[i].color}` }} /> {flow[lang]}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 4. Role IP system: 4 ecosystem groups × role radar ═══════════════ */

/** Indices of the two strongest values, used as the role's signature abilities. */
const topValues = (values: number[]) => values.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 2).map(([, i]) => i);

const StepLabel = ({ n, color, className = 'mt-5', children }: { n: number; color: string; className?: string; children: React.ReactNode }) => (
  <div className={`${className} mb-2 flex items-center gap-2 text-xs text-gray-400`}>
    <span className="font-mono text-[10px]" style={{ color }}>0{n}</span>{children}
  </div>
);

const radarPoint = (index: number, value: number, radius = 120, c = 150) => {
  const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
  return [c + Math.cos(angle) * radius * (value / 100), c + Math.sin(angle) * radius * (value / 100)];
};

export const ArtistSystemRadar = ({ lang, onEnter }: { lang: Lang; onEnter: () => void }) => {
  const zh = lang === 'zh';
  const [groupIndex, setGroupIndex] = useState(0);
  const [roleIndex, setRoleIndex] = useState(0);
  // Clamp indices and fall back to safe defaults so a stale/partial data module (e.g. mid hot-reload) can't crash the page.
  const group = ROLE_GROUPS[Math.min(groupIndex, ROLE_GROUPS.length - 1)];
  const picked = group.roles[Math.min(roleIndex, group.roles.length - 1)];
  const role = {
    ...picked,
    ip: Array.isArray(picked?.ip) && picked.ip.length === IP_AXES.length ? picked.ip : IP_AXES.map(() => 0),
    skills: Array.isArray(picked?.skills) ? picked.skills : [],
    partners: Array.isArray(picked?.partners) ? picked.partners : [],
    outputs: Array.isArray(picked?.outputs) ? picked.outputs : [],
    value: Array.isArray(picked?.value) ? picked.value : [],
  };
  const color = group.color;
  const toPolygon = (values: number[]) => values.map((v, i) => radarPoint(i, v).join(',')).join(' ');
  const polygon = toPolygon(role.ip);
  const average = groupAverage(group);
  const signature = topValues(role.ip);
  const ipIndex = Math.round(role.ip.reduce((x, y) => x + y, 0) / role.ip.length);
  const pickGroup = (i: number) => { setGroupIndex(i); setRoleIndex(0); };
  const jumpTo = (en: string) => { const hit = findRole(en); if (hit) { setGroupIndex(hit.group); setRoleIndex(hit.role); } };

  return (
    <section id="artist-system" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#22d3ee', '#a855f7', color]} />
      <div className="container mx-auto relative">
        <SectionHeader badge={zh ? '角色 IP 体系' : 'Role IP System'}
          title={zh ? `一个娱乐生态，${ROLE_COUNT} 种角色 IP` : `One Ecosystem, ${ROLE_COUNT} Role IPs`}
          desc={zh ? '台前明星、幕后创作、娱乐经营、商业与粉丝，四类角色都能孵化成独立的 AI IP。所有角色用同一套 6 维 IP 价值模型衡量，可以横向对比。' : 'Stars, creators, operators, brands and fans — every role can be its own AI IP, measured on one shared 6-dimension IP value model.'}
          color="#a855f7" />

        {/* Ecosystem groups (same four layers as the AI entertainment IP galaxy) */}
        <div role="tablist" aria-label={zh ? '角色分组' : 'Role groups'} className="max-w-6xl mx-auto mb-3 flex flex-wrap justify-center gap-2">
          {ROLE_GROUPS.map((g, i) => {
            const active = i === groupIndex;
            const Icon = g.icon;
            return (
              <button key={g.name.en} type="button" role="tab" aria-selected={active} onClick={() => pickGroup(i)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition"
                style={active ? { background: `${g.color}26`, boxShadow: `inset 0 0 0 1px ${g.color}99, 0 0 24px ${g.color}33`, color: '#fff' } : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', color: '#9ca3af' }}>
                <Icon className="w-4 h-4" style={{ color: g.color }} />
                <span className={active ? 'font-bold' : ''}>{g.name[lang]}</span>
                <span className="text-[11px] font-mono" style={{ color: active ? g.color : '#6b7280' }}>{g.roles.length}</span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-500 mb-10">
          {group.sub[lang]}
          <span className="mx-2 text-gray-700">·</span>
          <a href="#ip-universe" className="hover:text-white transition" style={{ color }}>{zh ? '查看生态协作网络 ↓' : 'See the collaboration network ↓'}</a>
        </p>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,320px)] gap-6 items-center">
          {/* Roles in the group — right label is the role's top specialist skill */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
            {group.roles.map((item, i) => {
              const isActive = item === picked;
              return (
                <button key={item.name.en} type="button" onClick={() => setRoleIndex(i)}
                  className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-left transition overflow-hidden"
                  style={isActive ? { background: `linear-gradient(90deg, ${color}30, transparent)`, boxShadow: `inset 0 0 0 1px ${color}70` } : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }}>
                  {isActive && <motion.span layoutId="role-ip-bar" className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, opacity: isActive ? 1 : 0.45, boxShadow: isActive ? `0 0 10px ${color}` : undefined }} />
                  <span className={`text-sm ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}>{item.name[lang]}</span>
                  <span className="ml-auto text-xs" style={{ color: isActive ? color : '#6b7280' }}>{item.skills?.[0]?.[0]?.[lang] ?? ''}</span>
                </button>
              );
            })}
          </div>

          {/* Shared IP value radar, with the group average as a dashed reference */}
          <div>
            <div className="relative mx-auto w-[82%] sm:w-full max-w-[420px] aspect-square">
              <div aria-hidden className="absolute inset-[12%] rounded-full blur-3xl" style={{ background: color, opacity: .18 }} />
              <svg viewBox="0 0 300 300" className="relative w-full h-full">
                {[.25, .5, .75, 1].map(scale => (
                  <polygon key={scale} points={Array.from({ length: 6 }, (_, i) => radarPoint(i, scale * 100).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,.1)" />
                ))}
                {Array.from({ length: 6 }, (_, i) => { const [x, y] = radarPoint(i, 100); return <line key={i} x1="150" y1="150" x2={x} y2={y} stroke="rgba(255,255,255,.08)" />; })}
                <motion.polygon points={toPolygon(average)} initial={false} animate={{ points: toPolygon(average) }} transition={{ type: 'spring', stiffness: 90, damping: 15 }}
                  fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.2" strokeDasharray="4 4" />
                <motion.polygon points={polygon} initial={false} animate={{ points: polygon }} transition={{ type: 'spring', stiffness: 90, damping: 15 }}
                  fill={`${color}38`} stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
                {role.ip.map((v, i) => {
                  const [x, y] = radarPoint(i, v);
                  return <motion.circle key={i} r="4.5" fill="#fff" stroke={color} strokeWidth="2" initial={false} animate={{ cx: x, cy: y }} transition={{ type: 'spring', stiffness: 90, damping: 15 }} />;
                })}
              </svg>
              {IP_AXES.map((axis, i) => {
                const [x, y] = radarPoint(i, 122);
                const Icon = axis.icon;
                return (
                  <div key={axis.name.en} title={axis.desc[lang]} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-help" style={{ left: `${(x / 300) * 100}%`, top: `${(y / 300) * 100}%` }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}55` }}><Icon className="w-4 h-4" style={{ color }} /></span>
                    <span className="text-xs text-gray-300 mt-1 whitespace-nowrap">{axis.name[lang]} <span className="font-mono" style={{ color }}>{role.ip[i]}</span></span>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-center gap-5 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded" style={{ background: color }} />{role.name[lang]}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,.5)' }} />{zh ? `${group.name.zh}平均` : `${group.name.en} average`}</span>
            </div>
          </div>

          {/* IP value → skills → output → value → ecosystem partners */}
          <AnimatePresence mode="wait">
            <motion.div key={`${groupIndex}-${role.name.en}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .3 }}>
              <GradientBorder colors={[color, 'transparent', '#ffffff55', 'transparent']}>
                <div className="p-6">
                  <div className="text-xs text-gray-500">{group.name[lang]} · {zh ? '角色 IP' : 'Role IP'}</div>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-3xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{role.name[lang]}</div>
                      <div className="text-sm mt-1" style={{ color }}>{role.tagline[lang]}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-gray-500">{zh ? 'IP 指数' : 'IP index'}</div>
                      <div className="text-3xl font-black leading-none" style={{ fontFamily: 'var(--font-display)', color }}>{ipIndex}</div>
                    </div>
                  </div>

                  <StepLabel n={1} color={color} className="mt-5">{zh ? 'IP 价值优势' : 'IP strengths'}</StepLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {signature.map(i => (
                      <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-xs text-gray-400">{IP_AXES[i].name[lang]}</div>
                        <div className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color }}>{role.ip[i]}</div>
                      </div>
                    ))}
                  </div>

                  <StepLabel n={2} color={color}>{group.skillsAreCaps ? (zh ? '专业才艺（上限）' : 'Talents (cap)') : (zh ? '专业能力' : 'Specialist skills')}</StepLabel>
                  <div className="space-y-1.5">
                    {role.skills.map(([name, v]) => (
                      <div key={name.en} className="flex items-center gap-2 text-xs">
                        <span className="w-16 shrink-0 text-gray-300 truncate">{name[lang]}</span>
                        <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <motion.span className="block h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: .6 }} />
                        </span>
                        <span className="w-7 text-right font-mono" style={{ color }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <StepLabel n={3} color={color}>{zh ? '产出 → 变现' : 'Output → revenue'}</StepLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {role.outputs.map(item => <span key={item.en} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-300">{item[lang]}</span>)}
                    {role.value.map(item => <span key={item.en} className="rounded-full px-2.5 py-1 text-xs text-white" style={{ background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}66` }}>{item[lang]}</span>)}
                  </div>

                  <StepLabel n={4} color={color}>{zh ? '生态协同' : 'Works with'}</StepLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {role.partners.map(en => {
                      const hit = findRole(en);
                      if (!hit) return null;
                      const pg = ROLE_GROUPS[hit.group];
                      return (
                        <button key={en} type="button" onClick={() => jumpTo(en)} title={pg.name[lang]}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-200 hover:border-white/30 transition">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: pg.color }} />{pg.roles[hit.role].name[lang]}<ArrowRight className="w-3 h-3 text-gray-500" />
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 flex items-center gap-2 text-xs">
                    <Rocket className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                    <span className="text-gray-500 shrink-0">{zh ? '推荐起步' : 'Start with'}</span>
                    <span className="text-white font-semibold ml-auto text-right">{role.start[lang]}</span>
                  </div>
                  <button type="button" onClick={onEnter}
                    className="mt-4 w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-sm text-white font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/25 transition">
                    {zh ? `以「${role.name.zh}」开始孵化` : `Incubate a ${role.name.en}`} <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-500"><Award className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color }} />
                    {zh ? `IP 价值为示例画像，孵化后随作品与数据成长${group.skillsAreCaps ? '；才艺为该类型可培养的上限' : ''}` : `IP values are indicative and grow with work and data${group.skillsAreCaps ? '; talents are trainable caps' : ''}`}
                  </div>
                </div>
              </GradientBorder>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 5. Testimonial spotlight ═══════════════ */

const TESTIMONIALS = [
  { name: 'CyberLuna', role: L('独立制作人', 'Indie Producer'), avatar: 'https://images.unsplash.com/photo-1764546899196-b53061b1b609?auto=format&fit=crop&w=200&q=80', color: '#22d3ee', metric: ['¥10万+', '¥100K+', L('月收入', 'Monthly income')], quote: L('3 个月内我孵化了 5 个 AI 歌手，月收入突破 10 万。这个平台完全改变了我的职业路径。', 'I incubated 5 AI singers in 3 months and passed ¥100K a month. It changed my career.') },
  { name: 'NeonStudio', role: L('MCN 机构', 'MCN Agency'), avatar: 'https://images.unsplash.com/photo-1764545973653-94c40d993495?auto=format&fit=crop&w=200&q=80', color: '#a855f7', metric: ['+300%', '+300%', L('签约效率', 'Signing efficiency')], quote: L('作为专业发行机构，AI Star Eco 让我们的签约效率提升了 300%，内容质量远超预期。', 'As an agency, AI Star Eco tripled our signing efficiency, with quality beyond expectations.') },
  { name: 'PixelDream', role: L('粉丝用户', 'Fan'), avatar: 'https://images.unsplash.com/photo-1772987273687-4866382c146f?auto=format&fit=crop&w=200&q=80', color: '#ec4899', metric: ['365 天', '365 days', L('每天都有新作品', 'New releases daily')], quote: L('我在这里发现了很多独特的 AI 艺人，每天都能听到全新风格的音乐。', 'I found so many unique AI artists here, with fresh music every single day.') },
  { name: 'StarForge', role: L('全能制作人', 'Full-stack Creator'), avatar: 'https://images.unsplash.com/photo-1774813958486-4c180dcda729?auto=format&fit=crop&w=200&q=80', color: '#f59e0b', metric: ['4 个', '4', L('领域爆款', 'Domains with hits')], quote: L('从音乐到短剧，从综艺到游戏，我在一个平台上做出了 4 个不同领域的爆款内容。', 'Music, drama, variety and games — I made hits in 4 domains on one platform.') },
];

export const TestimonialSpotlight = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = TESTIMONIALS[active];

  useEffect(() => {
    if (paused || reduce) return;
    const timer = window.setTimeout(() => setActive(i => (i + 1) % TESTIMONIALS.length), 6000);
    return () => window.clearTimeout(timer);
  }, [active, paused, reduce]);

  return (
    <section id="testimonials" className="relative z-10 py-28 px-6 overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <SectionAurora colors={[item.color, '#6366f1', '#ec4899']} />
      <div className="container mx-auto relative">
        <SectionHeader badge={zh ? '用户之声' : 'Testimonials'} title={zh ? '来自生态创业者的真实反馈' : 'Voices From Our Community'} color="#22d3ee" />
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_260px] gap-6 items-stretch">
          <GradientBorder colors={[item.color, 'transparent', '#ffffff40', 'transparent']} radius={28}>
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .4 }}
                className="relative p-8 md:p-12 min-h-[340px] flex flex-col">
                <Quote aria-hidden className="absolute right-8 top-8 w-24 h-24" style={{ color: item.color, opacity: .12 }} />
                <div className="flex gap-1">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                <p className="mt-6 text-2xl md:text-3xl text-white font-bold leading-snug [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>“{item.quote[lang]}”</p>
                <div className="mt-auto pt-8 flex flex-wrap items-end justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <span className="relative p-[2px] rounded-full" style={{ background: `linear-gradient(135deg, ${item.color}, #fff6)` }}>
                      <img src={item.avatar} alt={item.name} className="w-14 h-14 rounded-full object-cover border-2 border-black" />
                    </span>
                    <div>
                      <div className="text-white font-bold">{item.name}</div>
                      <div className="text-sm text-gray-400">{item.role[lang]}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl px-5 py-3 text-right" style={{ background: `${item.color}18`, border: `1px solid ${item.color}45` }}>
                    <div className="text-3xl font-black whitespace-nowrap" style={{ color: item.color, fontFamily: 'var(--font-display)' }}>{zh ? item.metric[0] as string : item.metric[1] as string}</div>
                    <div className="text-xs text-gray-400">{(item.metric[2] as LT)[lang]}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </GradientBorder>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {TESTIMONIALS.map((t, i) => {
              const isActive = i === active;
              return (
                <button key={t.name} type="button" onClick={() => setActive(i)}
                  className="relative overflow-hidden flex items-center gap-3 rounded-2xl p-3 text-left transition"
                  style={isActive ? { background: `${t.color}18`, boxShadow: `inset 0 0 0 1px ${t.color}70` } : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }}>
                  <img src={t.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" style={{ outline: isActive ? `2px solid ${t.color}` : undefined }} />
                  <span className="min-w-0">
                    <span className={`block text-sm truncate ${isActive ? 'text-white font-semibold' : 'text-gray-400'}`}>{t.name}</span>
                    <span className="block text-xs text-gray-500 truncate">{t.role[lang]}</span>
                  </span>
                  {isActive && !reduce && !paused && (
                    <motion.span aria-hidden key={`bar-${active}`} className="absolute left-0 bottom-0 h-0.5" style={{ background: t.color }} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 6, ease: 'linear' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 6. Roadmap with a progress beam ═══════════════ */

const ROADMAP = [
  { phase: 'Phase 1', status: 'done', progress: 100, icon: Rocket, color: '#22c55e', title: L('基础孵化系统', 'Core Incubation'), items: [L('AI 歌手创建', 'AI singer creation'), L('音乐生成引擎', 'Music engine'), L('基础发行渠道', 'Basic distribution')] },
  { phase: 'Phase 2', status: 'active', progress: 65, icon: Globe2, color: '#22d3ee', title: L('全娱乐生态', 'Full Entertainment'), items: [L('10 大领域覆盖', '10 domains'), L('三端生态架构', 'Three-port ecosystem'), L('数字资产系统', 'Digital asset system')] },
  { phase: 'Phase 3', status: 'upcoming', progress: 0, icon: Lock, color: '#a855f7', title: L('Web3 深度融合', 'Web3 Integration'), items: [L('社区治理上线', 'Community governance'), L('跨链资产互通', 'Cross-chain assets'), L('去中心化版权', 'Decentralised rights')] },
  { phase: 'Phase 4', status: 'upcoming', progress: 0, icon: Star, color: '#ec4899', title: L('元宇宙演出', 'Metaverse Stage'), items: [L('虚拟演唱会', 'Virtual concerts'), L('AR 互动体验', 'AR experiences'), L('全息投影演出', 'Holographic shows')] },
] as const;

export const RoadmapBeam = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  // Nodes sit at 0/33/67/100% of the track; phase 2 is 65% of the way to phase 3.
  const beam = ((1 + .65) / (ROADMAP.length - 1)) * 100;
  return (
    <section id="roadmap" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#22c55e', '#22d3ee', '#a855f7']} />
      <div className="container mx-auto relative">
        <SectionHeader badge={zh ? '发展路线' : 'Roadmap'} title={zh ? '产品路线图' : 'Product Roadmap'} desc={zh ? '从 AI 歌手出发，一步步走向全娱乐与元宇宙舞台。' : 'From AI singers to full entertainment and the metaverse stage.'} color="#a855f7" />
        <div className="max-w-6xl mx-auto relative">
          <div className="hidden md:block relative h-2 mx-[12%] mb-10 rounded-full bg-white/5">
            <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: 'linear-gradient(90deg, #22c55e, #22d3ee)', boxShadow: '0 0 20px #22d3ee' }}
              initial={{ width: 0 }} whileInView={{ width: `${beam}%` }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeOut' }} />
            {!reduce && <motion.div aria-hidden className="absolute -top-1 h-4 w-16 rounded-full blur-md bg-white/70" animate={{ left: ['0%', `${beam - 6}%`] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />}
            {ROADMAP.map((r, i) => (
              <span key={r.phase} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-4 border-black" style={{ left: `${(i / (ROADMAP.length - 1)) * 100}%`, background: r.status === 'upcoming' ? '#374151' : r.color, boxShadow: r.status !== 'upcoming' ? `0 0 16px ${r.color}` : undefined }} />
            ))}
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {ROADMAP.map((r, i) => {
              const Icon = r.icon;
              const isActive = r.status === 'active';
              const isDone = r.status === 'done';
              const card = (
                <div className="relative p-6 h-full overflow-hidden">
                  <div aria-hidden className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-2xl" style={{ background: r.color, opacity: r.status === 'upcoming' ? .06 : .2 }} />
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: r.status === 'upcoming' ? 'rgba(255,255,255,.06)' : `linear-gradient(135deg, ${r.color}, ${r.color}88)` }}><Icon className="w-5 h-5" /></span>
                    <span className="text-xs rounded-full px-2.5 py-1 font-semibold" style={isDone ? { color: '#4ade80', background: '#22c55e20' } : isActive ? { color: '#67e8f9', background: '#22d3ee20' } : { color: '#6b7280', background: 'rgba(255,255,255,.05)' }}>
                      {isDone ? (zh ? '已完成' : 'Done') : isActive ? (zh ? '进行中' : 'In progress') : (zh ? '规划中' : 'Planned')}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-5">{r.phase}</div>
                  <h4 className="text-xl text-white font-black mt-1" style={{ fontFamily: 'var(--font-display)' }}>{r.title[lang]}</h4>
                  <ul className="mt-4 space-y-2">
                    {r.items.map(item => (
                      <li key={item.en} className="flex items-center gap-2 text-sm text-gray-400">
                        {isDone ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isActive ? r.color : '#4b5563' }} />}
                        {item[lang]}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>{zh ? '完成度' : 'Progress'}</span><span style={{ color: r.progress ? r.color : undefined }}>{r.progress}%</span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} whileInView={{ width: `${r.progress}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: .3 + i * .1 }} /></div>
                  </div>
                </div>
              );
              return (
                <motion.div key={r.phase} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .12 }} whileHover={{ y: -6 }} className={isActive ? 'md:-translate-y-3' : ''}>
                  {isActive
                    ? <GradientBorder colors={['#22d3ee', 'transparent', '#a855f7', 'transparent']} className="h-full shadow-[0_24px_70px_rgba(34,211,238,.2)]">{card}</GradientBorder>
                    : <div className="h-full rounded-3xl border border-white/10 bg-[#070a12]" style={isDone ? { borderColor: '#22c55e40' } : undefined}>{card}</div>}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 7. Tech stack with cursor spotlight ═══════════════ */

const TECH = [
  { name: 'AI Engine', desc: L('多模态大模型 · 自研模型', 'Multimodal models · in-house'), metric: L('10+ 引擎', '10+ engines'), icon: Cpu, color: '#22d3ee' },
  { name: 'Blockchain', desc: L('版权确权 · 资产追踪', 'Rights proof · asset tracking'), metric: L('秒级确权', 'Instant proof'), icon: Lock, color: '#a855f7' },
  { name: 'Real-time', desc: L('实时互动 · 全球加速', 'Live sync · global CDN'), metric: L('<80ms 延迟', '<80ms latency'), icon: Zap, color: '#f59e0b' },
  { name: 'Analytics', desc: L('智能数据分析引擎', 'Smart analytics engine'), metric: L('实时看板', 'Live dashboards'), icon: BarChart3, color: '#ec4899' },
  { name: 'Cloud Infra', desc: L('多云架构 · 弹性伸缩', 'Multi-cloud · auto-scale'), metric: L('99.9% 可用', '99.9% uptime'), icon: Globe2, color: '#22c55e' },
  { name: 'Security', desc: L('零信任安全架构', 'Zero-trust security'), metric: L('全链路加密', 'End-to-end encryption'), icon: Shield, color: '#ef4444' },
  { name: 'Streaming', desc: L('低延迟音视频流', 'Low-latency AV streams'), metric: L('4K 直播', '4K live'), icon: Radio, color: '#6366f1' },
  { name: 'Edge AI', desc: L('端侧 AI 推理加速', 'On-device inference'), metric: L('离线可用', 'Works offline'), icon: Flame, color: '#f97316' },
];

const TechCard = ({ tech, lang, index }: { tech: typeof TECH[number]; lang: Lang; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = tech.icon;
  const onMove = (event: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !ref.current) return;
    ref.current.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    ref.current.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  return (
    <motion.div ref={ref} onMouseMove={onMove} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }} whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#070a12] p-6">
      <div aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), ${tech.color}30, transparent 70%)` }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tech.color}, transparent)`, opacity: .6 }} />
      <div className="relative">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
          style={{ background: `linear-gradient(135deg, ${tech.color}35, ${tech.color}10)`, border: `1px solid ${tech.color}50`, boxShadow: `0 0 24px ${tech.color}25` }}>
          <Icon className="w-6 h-6" style={{ color: tech.color }} />
        </span>
        <div className="text-lg text-white font-bold mt-5 tracking-tight">{tech.name}</div>
        <div className="text-sm text-gray-500 mt-1">{tech.desc[lang]}</div>
        <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: tech.color }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tech.color }} /> {tech.metric[lang]}
        </div>
      </div>
    </motion.div>
  );
};

export const TechConstellation = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const reduce = useReducedMotion();
  return (
    <section id="tech" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#6366f1', '#22d3ee', '#ec4899']} />
      <div className="container mx-auto relative">
        <SectionHeader badge={zh ? '技术底座' : 'Tech Stack'} title={zh ? '前沿技术驱动' : 'Powered by Cutting-Edge Tech'} desc={zh ? '8 大技术模块协同，支撑从创作到变现的每一个环节。' : 'Eight technology modules power every step from creation to revenue.'} color="#6366f1" />
        <div className="relative max-w-6xl mx-auto">
          <div aria-hidden className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
            <motion.div className="w-[560px] h-[560px] rounded-full" style={{ background: 'conic-gradient(from 0deg, #6366f122, transparent 25%, #22d3ee22, transparent 50%, #ec489922, transparent 75%)' }}
              animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} />
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TECH.map((tech, i) => <TechCard key={tech.name} tech={tech} lang={lang} index={i} />)}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════ 8. FAQ showcase ═══════════════ */

const FAQS = [
  { q: L('什么是 AI 艺人孵化？', 'What is AI artist incubation?'), a: L('用 AI 孵化艺人，以及制作人、经纪人、粉丝运营等生态角色 IP，在音乐、短剧、直播、综艺等领域持续创作和商业变现。', 'Using AI to incubate artists and ecosystem role IPs such as producers, managers and fan leads, then create and earn across music, drama, live and variety.') },
  { q: L('除了艺人，还能孵化哪些角色？', 'Besides artists, which roles can I incubate?'), a: L(`台前明星、幕后创作、娱乐经营、商业与粉丝四类共 ${ROLE_COUNT} 种角色，都能孵化成独立的 AI IP，并在同一个生态里协作，比如歌手和词曲作者、制作人、粉丝代表一起出作品。`, `Stars, creators, operators and commerce & fandom — ${ROLE_COUNT} roles in all — can each be incubated as an AI IP and work together, e.g. a singer with a songwriter, producer and fan representative.`) },
  { q: L('需要专业技能才能开始吗？', 'Do I need professional skills?'), a: L('不需要。AI 会完成从形象、声音到制作、发行的技术环节，你只需要负责创意和决策。', 'No. AI handles identity, voice, production and distribution — you make the creative calls.') },
  { q: L('一个人可以运营多个艺人吗？', 'Can one person run several artists?'), a: L('可以。平台支持艺人矩阵管理，并能配置数字制作人和经纪人协助运营。', 'Yes. Manage a whole roster with digital producers and managers helping you.') },
  { q: L('如何赚取收入？', 'How do I earn revenue?'), a: L('通过音乐版权、直播打赏、品牌合作、虚拟演出、授权周边等多种渠道，平台统一结算。', 'Through royalties, live tips, brand deals, virtual shows and licensing, settled in one place.') },
  { q: L('我的版权如何保护？', 'How is my copyright protected?'), a: L('原创内容会自动生成版权证明，并支持跨平台追踪与维权。', 'Original work gets automatic proof of rights with cross-platform tracking and enforcement.') },
  { q: L('艺人形象和声音归谁？', 'Who owns the artist’s look and voice?'), a: L('你创建的艺人形象、声音与作品归你所有，可随时导出或授权给合作方。', 'You own the look, voice and works you create, and can export or license them anytime.') },
];

export const FaqShowcase = ({ lang, onEnter }: { lang: Lang; onEnter: () => void }) => {
  const zh = lang === 'zh';
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative z-10 py-28 px-6 overflow-hidden">
      <SectionAurora colors={['#f59e0b', '#a855f7', '#22d3ee']} />
      <div className="container mx-auto relative max-w-6xl grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-10">
        <div className="lg:sticky lg:top-28 self-start">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs border border-amber-500/40 bg-amber-500/10 text-amber-300"><Sparkles className="w-3 h-3" /> FAQ</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mt-5 tracking-tight [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '你可能想问的' : 'Questions You May Have'}</h2>
          <p className="text-gray-400 mt-4 leading-relaxed">{zh ? '关于孵化、收入、版权与运营，这里有最常见的答案。' : 'Common answers about incubation, revenue, rights and operations.'}</p>
          <GradientBorder colors={['#f59e0b', 'transparent', '#a855f7', 'transparent']} className="mt-8">
            <div className="p-6">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-pink-500 text-white"><MessageCircle className="w-5 h-5" /></span>
              <div className="text-lg text-white font-bold mt-4">{zh ? '还有其他问题？' : 'Still curious?'}</div>
              <p className="text-sm text-gray-400 mt-1">{zh ? '直接创建一位艺人，边体验边了解。' : 'Create an artist and learn as you go.'}</p>
              <button type="button" onClick={onEnter} className="mt-5 h-11 px-5 rounded-xl text-sm text-white font-semibold inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-pink-500">
                {zh ? '开始体验' : 'Try it now'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </GradientBorder>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <motion.div key={faq.q.en} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .06 }}
                className="relative overflow-hidden rounded-2xl border transition-colors"
                style={{ borderColor: isOpen ? 'rgba(245,158,11,.45)' : 'rgba(255,255,255,.08)', background: isOpen ? 'linear-gradient(135deg, rgba(245,158,11,.10), rgba(168,85,247,.06) 60%, transparent)' : 'rgba(7,10,18,.8)' }}>
                {isOpen && <motion.span layoutId="faq-accent" className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-pink-500" />}
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="w-full flex items-center gap-4 p-5 text-left">
                  <span className="text-sm font-mono w-7 shrink-0" style={{ color: isOpen ? '#fbbf24' : '#4b5563' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`flex-1 text-base font-semibold ${isOpen ? 'text-white' : 'text-gray-200'}`}>{faq.q[lang]}</span>
                  <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition"
                    style={isOpen ? { background: 'linear-gradient(135deg, #f59e0b, #ec4899)', color: '#fff', boxShadow: '0 0 18px rgba(245,158,11,.5)' } : { border: '1px solid rgba(255,255,255,.15)', color: '#9ca3af' }}>
                    {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .3 }} className="overflow-hidden">
                      <p className="px-5 pb-5 pl-16 text-sm text-gray-300 leading-relaxed">{faq.a[lang]}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
