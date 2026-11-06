import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Cpu, Radio, RefreshCw, Sparkles, TrendingUp, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { Lang } from '../translations';
import { SOLUTION_CONFIGS, type LocalizedText, type SolutionId } from '../data/ipPlatform';

type Target = Exclude<SolutionId, 'ecosystem' | 'ai-artist'> | '#ip-types';

interface Stage {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  key: string;
  title: LocalizedText;
  desc: LocalizedText;
  outputs: { zh: string[]; en: string[] };
  metric: { value: LocalizedText; label: LocalizedText };
  target: Target;
}

// Each stage links to the solution that best demonstrates it ('#ip-types' scrolls to the type picker).
const STAGES: Stage[] = [
  {
    icon: Sparkles, color: '#22d3ee', key: 'DEFINE', target: '#ip-types',
    title: { zh: '定义 IP', en: 'Define' },
    desc: { zh: '选择类型、定位、受众与商业方向', en: 'Type, positioning, audience and business model' },
    outputs: { zh: ['IP 类型', '人设定位', '受众画像'], en: ['IP type', 'Positioning', 'Audience'] },
    metric: { value: { zh: '1 天', en: '1 day' }, label: { zh: '完成定位', en: 'to position' } },
  },
  {
    icon: Users, color: '#818cf8', key: 'BUILD', target: 'digital-founder',
    title: { zh: '构建身份', en: 'Build' },
    desc: { zh: '形象、声音、人格、世界观与知识库', en: 'Visual, voice, persona, world and knowledge' },
    outputs: { zh: ['形象', '声线', '知识库'], en: ['Visual', 'Voice', 'Knowledge'] },
    metric: { value: { zh: '3 天', en: '3 days' }, label: { zh: '资产就绪', en: 'assets ready' } },
  },
  {
    icon: Cpu, color: '#a855f7', key: 'CREATE', target: 'ai-drama',
    title: { zh: '生产内容', en: 'Create' },
    desc: { zh: '短剧、音乐、口播、课程与剧情带货', en: 'Drama, music, speech, courses and commerce stories' },
    outputs: { zh: ['短剧', '音乐', '口播'], en: ['Drama', 'Music', 'Speech'] },
    metric: { value: { zh: '10×', en: '10×' }, label: { zh: '产能提升', en: 'output' } },
  },
  {
    icon: Radio, color: '#ec4899', key: 'DISTRIBUTE', target: 'virtual-idol',
    title: { zh: '矩阵运营', en: 'Distribute' },
    desc: { zh: '多账号发布、粉丝互动与增长运营', en: 'Multi-account publishing, fandom and growth' },
    outputs: { zh: ['多账号', '粉丝社群', '增长'], en: ['Accounts', 'Fandom', 'Growth'] },
    metric: { value: { zh: '24/7', en: '24/7' }, label: { zh: '持续在线', en: 'always on' } },
  },
  {
    icon: TrendingUp, color: '#f59e0b', key: 'MONETIZE', target: 'brand-ip',
    title: { zh: '授权变现', en: 'Monetize' },
    desc: { zh: '版权、广告、联名、带货与价值评估', en: 'Rights, ads, collabs, commerce and valuation' },
    outputs: { zh: ['版权', '联名', '带货'], en: ['Rights', 'Collabs', 'Commerce'] },
    metric: { value: { zh: '5+', en: '5+' }, label: { zh: '变现渠道', en: 'revenue streams' } },
  },
];

const TRACK_GRADIENT = `linear-gradient(90deg, ${STAGES.map(s => s.color).join(', ')})`;

export const IPLifecycleJourney = ({ lang, onSelectSolution }: { lang: Lang; onSelectSolution: (id: SolutionId) => void }) => {
  const zh = lang === 'zh';
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setInterval(() => setActive(i => (i + 1) % STAGES.length), 3200);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion]);

  const go = (stage: Stage) => {
    if (stage.target === '#ip-types') document.querySelector('#ip-types')?.scrollIntoView({ behavior: 'smooth' });
    else onSelectSolution(stage.target);
  };

  return (
    <section className="relative px-6 py-28 border-y border-white/5 bg-gray-950/40 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `radial-gradient(60% 50% at 50% 60%, ${STAGES[active].color}14, transparent 70%)`, transition: 'background 600ms ease' }} />
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs text-amber-400 uppercase tracking-[.24em] mb-4">{zh ? 'IP 全生命周期' : 'IP LIFECYCLE'}</div>
          <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '从一个想法，到可持续经营的数字资产' : 'From an Idea to an Operable Digital Asset'}
          </h2>
          <p className="text-gray-400 mt-5">
            {zh ? '五个阶段，一条流水线。每一步的产出都会沉淀为下一步的资产。' : 'Five stages, one pipeline. Every output becomes an asset for the next step.'}
          </p>
        </div>

        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {/* Track: dim base line plus a gradient fill that grows to the active stage. */}
          <div aria-hidden className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-white/10">
            <motion.div className="absolute inset-y-0 left-0 h-[2px] -top-[0.5px] rounded-full"
              style={{ background: TRACK_GRADIENT, backgroundSize: `${100 * (STAGES.length - 1) / Math.max(active, 0.0001)}% 100%`, boxShadow: `0 0 12px ${STAGES[active].color}` }}
              animate={{ width: `${(active / (STAGES.length - 1)) * 100}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeInOut' }} />
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {STAGES.map((stage, index) => {
              const isActive = index === active;
              const reached = index <= active;
              const exampleName = stage.target === '#ip-types' ? null : SOLUTION_CONFIGS[stage.target].name[lang];
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex flex-col" onMouseEnter={() => setActive(index)}>
                  <button type="button" onClick={() => setActive(index)} aria-label={stage.title[lang]}
                    className="hidden md:flex relative mx-auto mb-6 w-14 h-14 items-center justify-center rounded-2xl border bg-black transition-all duration-500"
                    style={{
                      borderColor: reached ? `${stage.color}99` : 'rgba(255,255,255,.12)',
                      boxShadow: isActive ? `0 0 0 6px ${stage.color}1f, 0 0 32px ${stage.color}80` : 'none',
                    }}>
                    {isActive && !reduceMotion && (
                      <motion.span aria-hidden className="absolute inset-0 rounded-2xl border" style={{ borderColor: stage.color }}
                        initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
                    )}
                    <Icon className="w-5 h-5 transition-colors duration-500" style={{ color: reached ? stage.color : '#6b7280' }} />
                  </button>

                  <motion.button type="button" onClick={() => go(stage)} whileHover={reduceMotion ? undefined : { y: -4 }}
                    className="group relative flex-1 overflow-hidden rounded-2xl border p-5 text-left flex flex-col transition-[border-color,background-color,box-shadow] duration-500"
                    style={{
                      borderColor: isActive ? `${stage.color}66` : 'rgba(255,255,255,.08)',
                      background: isActive ? `linear-gradient(180deg, ${stage.color}1a, rgba(0,0,0,.55) 70%)` : 'rgba(0,0,0,.35)',
                      boxShadow: isActive ? `0 24px 60px -30px ${stage.color}` : 'none',
                    }}>
                    <span aria-hidden className="pointer-events-none absolute -right-2 -top-5 text-[88px] font-black leading-none select-none transition-opacity duration-500"
                      style={{ fontFamily: 'var(--font-display)', color: stage.color, opacity: isActive ? 0.14 : 0.05 }}>
                      0{index + 1}
                    </span>

                    <div className="flex items-center gap-3 mb-4">
                      <span className="md:hidden flex w-9 h-9 items-center justify-center rounded-xl border" style={{ borderColor: `${stage.color}66` }}>
                        <Icon className="w-4 h-4" style={{ color: stage.color }} />
                      </span>
                      <span className="text-[10px] font-mono tracking-[.2em]" style={{ color: isActive ? stage.color : '#6b7280' }}>
                        0{index + 1} · {stage.key}
                      </span>
                    </div>

                    <h3 className="text-lg text-white font-bold">{stage.title[lang]}</h3>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed min-h-[2.5rem]">{stage.desc[lang]}</p>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {stage.outputs[lang].map(item => (
                        <span key={item} className="rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-500"
                          style={{ borderColor: isActive ? `${stage.color}55` : 'rgba(255,255,255,.1)', color: isActive ? '#e5e7eb' : '#9ca3af', background: isActive ? `${stage.color}12` : 'transparent' }}>
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-5">
                      <div className="flex items-baseline gap-2 border-t border-white/10 pt-4">
                        <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: stage.color }}>{stage.metric.value[lang]}</span>
                        <span className="text-xs text-gray-500">{stage.metric.label[lang]}</span>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs text-gray-400 group-hover:text-white transition-colors">
                        {exampleName ? `${zh ? '示例：' : 'Example: '}${exampleName}` : (zh ? '选择 IP 类型' : 'Choose an IP type')}
                        <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: stage.color }} />
                      </span>
                    </div>
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-gray-400">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            {zh ? '变现数据回流到定位与内容策略，进入下一轮迭代' : 'Revenue data flows back into positioning and content for the next cycle'}
          </div>
        </div>
      </div>
    </section>
  );
};
