/**
 * "AI 生产中枢" for a solution homepage, after the AI 艺人孵化 homepage's production hub:
 * the solution's own workflow as live pipeline nodes, its hero stats as KPI tiles, and its
 * lead capabilities as engine cards. Authored in the homepage's dark classes (light-ui.css
 * remaps them in light mode).
 */
import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Cpu, Share2, Sparkles, TrendingUp, Video } from 'lucide-react';
import type { Lang } from '../../translations';
import type { SolutionConfig } from '../../data/ipPlatform';
import { getContentMode } from '../../data/ipEngines';
import { SectionHead } from './SectionHead';

const NODE_ICONS = [Sparkles, Video, Share2, TrendingUp];
const NODE_STATES = [
  { zh: '已接收', en: 'Received', color: '#22d3ee' },
  { zh: '生成中', en: 'Generating', color: '#a78bfa', live: true },
  { zh: '已连接', en: 'Connected', color: '#f472b6' },
  { zh: '追踪中', en: 'Tracking', color: '#fbbf24' },
];
const DELTAS = ['+18.4%', '+31.2%', '+24.8%'];

export const ProductionHub = ({ config, lang }: { config: SolutionConfig; lang: Lang }) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => (zh ? v.zh : v.en);
  const nodes = config.workflow.slice(0, 4);
  const engines = config.capabilities.slice(1, 3);
  const modes = config.preset.contentModes.map(m => t(getContentMode(m).name));
  return (
    <section className="px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHead eyebrow={zh ? `${config.name.zh} 生产线` : `${config.name.en} pipeline`} meta="LIVE · PIPELINE" accent={config.accent}
          title={zh ? `${config.name.zh}的 AI 生产中枢` : `The ${config.name.en} AI Production Hub`}
          desc={zh ? '一个工作台调度从创意、生成、分发到变现的整条生产线，每一步都实时可见。' : 'One workspace runs the whole line from idea and generation to distribution and revenue, live.'} />
        <div className="grid lg:grid-cols-[1.65fr_1fr] gap-3">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 p-5 md:p-6">
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
            <span aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" style={{ background: `${config.accent}26` }} />
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: '#34d399' }}>
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
                  {zh ? '生产线运行中' : 'Pipeline running'}
                </div>
                <h3 className="mt-2 text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{zh ? 'AI 内容生产中枢' : 'AI Content Hub'}</h3>
                <p className="mt-1 text-xs text-gray-500">{zh ? `一个工作台，调度${config.name.zh}的生产与增长。` : `One workspace for ${config.name.en} production and growth.`}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                <Cpu className="h-4 w-4" style={{ color: config.accent }} />
                <div className="leading-tight"><div className="eyebrow-mono text-gray-500">AI cluster</div><div className="font-mono text-[12px] text-white">98.7% ONLINE</div></div>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {nodes.map((step, i) => {
                const Icon = NODE_ICONS[i];
                const st = NODE_STATES[i];
                return (
                  <motion.div key={step.en} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="relative rounded-2xl border border-white/10 bg-black/40 p-4" style={{ boxShadow: st.live ? `inset 0 0 0 1px ${st.color}55` : undefined }}>
                    <div className="flex items-center justify-between">
                      <span className="eyebrow-mono text-gray-500">NODE 0{i + 1}</span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: st.color }}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.live ? 'animate-pulse' : ''}`} style={{ background: st.color }} />{zh ? st.zh : st.en}
                      </span>
                    </div>
                    <span className="mt-4 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}><Icon className="h-4 w-4" /></span>
                    <div className="mt-3 text-sm font-semibold text-white">{t(step)}</div>
                    <div className="mt-3 h-px overflow-hidden bg-white/10">
                      <motion.div className="h-full" style={{ background: st.color }} initial={{ width: '0%' }} whileInView={{ width: st.live ? '64%' : '100%' }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 + i * 0.1 }} />
                    </div>
                    {i < nodes.length - 1 && <ChevronRight aria-hidden className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full border border-white/10 bg-gray-900 p-0.5 text-gray-500 md:block" />}
                  </motion.div>
                );
              })}
            </div>

            <div className="relative mt-3 grid grid-cols-3 gap-3">
              {config.heroStats.slice(0, 3).map((s, i) => (
                <div key={s.label.en} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xl md:text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</span>
                    <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-emerald-300" style={{ background: 'rgb(16 185 129 / 0.12)' }}>{DELTAS[i]}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">{t(s.label)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {engines.map((c, i) => {
              const color = i ? config.secondary : config.accent;
              return (
                <div key={c.title.en} className="relative overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 p-5">
                  <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full blur-3xl" style={{ background: `${color}22` }} />
                  <div className="relative flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>{i ? <TrendingUp className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span>
                    <span className="rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider" style={{ color, borderColor: `${color}55` }}>{i ? 'GROWTH ENGINE' : 'NEW ENGINE'}</span>
                  </div>
                  <h4 className="relative mt-5 text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{t(c.title)}</h4>
                  <p className="relative mt-1.5 text-xs leading-relaxed text-gray-400">{t(c.description)}</p>
                  {i === 0 && modes.length > 0 && (
                    <div className="relative mt-4 flex flex-wrap gap-1.5">
                      {modes.slice(0, 3).map(m => <span key={m} className="rounded-md px-2 py-0.5 text-[11px]" style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}>{m}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
