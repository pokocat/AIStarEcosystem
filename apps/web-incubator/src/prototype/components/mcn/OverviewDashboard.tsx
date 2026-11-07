/**
 * 工作台总览 — 只回答三个问题：今天要处理什么、生意表现如何、作品做到哪了。
 * 待办与生产进度读取 AI 导演台和发布池的本地数据，指标随首页方案切换。
 */
import React, { useMemo } from 'react';
import {
  ArrowUpRight, ChevronRight, Clapperboard, Plus, Sparkles, CheckCircle2, CircleDashed, Film,
} from 'lucide-react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Lang } from '../../translations';
import { getSolutionLabel, type SolutionId } from '../../data/ipPlatform';
import { ROLE_GROUPS } from '../../data/roleIpSystem';
import { MOCK_ARTISTS, type Artist } from './ArtistTypes';
import { ActivityFeed } from './ActivityFeed';
import { listSnapshots, loadWorks } from './director/studioStorage';
import { TRACKS } from './workshopData';
import { readPool, SAMPLE_POOL_COUNT } from './publishPoolStore';
import {
  kpisFor, REVENUE_SERIES, REVENUE_TREND, STANDING_TODOS, TODO_TONES, TONE_ORDER, type TodoTone,
} from './overviewData';

type LT = { zh: string; en: string };

interface Props {
  lang: Lang;
  solutionId: SolutionId;
  activeArtist: Artist;
  onNavigate: (route: string) => void;
  /** Open the AI 导演台 on a saved project (switches the active artist first). */
  /** Opens that exact project (scope) in the AI 导演. */
  onOpenProject: (artistId: string, scope: string) => void;
}

interface Todo { tone: TodoTone; text: string; go: () => void }

const Card = ({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0 ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const LinkButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-0.5 text-xs text-slate-500 transition hover:text-violet-600">
    {children}<ChevronRight className="h-3.5 w-3.5" />
  </button>
);

const ago = (ts: number, zh: boolean) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return zh ? '刚刚' : 'just now';
  if (m < 60) return zh ? `${m} 分钟前` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return zh ? `${h} 小时前` : `${h}h ago`;
  return zh ? `${Math.round(h / 24)} 天前` : `${Math.round(h / 24)}d ago`;
};

const WORK_STATUS: Record<string, { label: LT; color: string; bg: string }> = {
  Published: { label: { zh: '已发布', en: 'Published' }, color: '#047857', bg: '#ecfdf5' },
  Review: { label: { zh: '审核中', en: 'In review' }, color: '#b45309', bg: '#fffbeb' },
  Draft: { label: { zh: '草稿', en: 'Draft' }, color: '#475569', bg: '#f1f5f9' },
};

export const OverviewDashboard = ({ lang, solutionId, activeArtist, onNavigate, onOpenProject }: Props) => {
  const zh = lang === 'zh';
  const t = (v: LT) => (zh ? v.zh : v.en);
  const { focus, kpis } = kpisFor(solutionId);

  // Read once per visit: the overview remounts on every navigation.
  const projects = useMemo(() => listSnapshots(`${solutionId}:`).map(({ scope, snap }) => {
    const artistId = scope.slice(solutionId.length + 1).split('#')[0];
    const total = snap.nodes.length;
    const done = snap.nodes.filter(n => n.status === 'done').length;
    const missing = snap.assets.filter(a => a.status === 'missing').length;
    return {
      scope, artistId, snap, done, total, missing,
      pct: snap.exported ? 100 : total ? Math.round((done / total) * 100) : 0,
      artist: MOCK_ARTISTS.find(a => a.id === artistId),
    };
  }), [solutionId]);
  const poolCount = useMemo(() => SAMPLE_POOL_COUNT + readPool().length, []);
  const allWorks = useMemo(() => loadWorks(TRACKS), []);
  const works = allWorks.slice(0, 5);
  const workCount = allWorks.length;

  const todos: Todo[] = useMemo(() => {
    const list: Todo[] = [
      ...STANDING_TODOS.map(s => ({ tone: s.tone, text: t(s.text), go: () => onNavigate(s.route) })),
      { tone: 'today', text: zh ? `发布池有 ${poolCount} 条作品待审核` : `${poolCount} works awaiting review in the publish pool`, go: () => onNavigate('publish_center/pool') },
    ];
    for (const p of projects) {
      const name = p.snap.spec.name;
      if (p.missing > 0) {
        list.push({ tone: 'today', text: zh ? `《${name}》还有 ${p.missing} 个资产待确认` : `"${name}" has ${p.missing} assets to confirm`, go: () => onOpenProject(p.artistId, p.scope) });
      } else if (!p.snap.exported && p.total > 0 && p.done === p.total) {
        list.push({ tone: 'chance', text: zh ? `《${name}》已全部生成，可以导出成片` : `"${name}" is fully generated and ready to export`, go: () => onOpenProject(p.artistId, p.scope) });
      }
    }
    return list.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
  }, [projects, poolCount, zh]); // eslint-disable-line react-hooks/exhaustive-deps

  const hour = new Date().getHours();
  const greeting = zh
    ? (hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  const chartData = REVENUE_TREND.map(r => ({ ...r, name: t(r.month) }));

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
              <Sparkles className="h-3 w-3" />{t(getSolutionLabel(solutionId))}
            </span>
            <span>{new Date().toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? `${greeting}，欢迎回来` : `${greeting}, welcome back`}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {zh ? `今天有 ${todos.length} 件事需要处理 · 当前 IP：${activeArtist.name}` : `${todos.length} things need you today · Active IP: ${activeArtist.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('incubation')}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" />{zh ? '孵化角色 IP' : 'New role IP'}
          </button>
          <button type="button" onClick={() => onNavigate('studio')}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold shadow-sm transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#ffffff' }}>
            <Clapperboard className="h-3.5 w-3.5" />{zh ? '新建创作项目' : 'New project'}
          </button>
        </div>
      </header>

      {/* KPIs */}
      <section aria-label={t(focus)}>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">{zh ? `关键指标 · ${focus.zh}` : `Key metrics · ${focus.en}`}</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <button key={k.label.en} type="button" onClick={() => onNavigate(k.route)}
                className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-violet-200 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">{k.delta}</span>
                </div>
                <div className="mt-3 text-xl font-bold tracking-tight text-slate-900 md:text-2xl" style={{ fontFamily: 'var(--font-display)' }}>{k.value}</div>
                <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                  {t(k.label)}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* To-dos + production */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title={zh ? '今日待办' : 'Today'}
          action={<span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{todos.length}</span>}>
          <ul className="-mx-2 space-y-0.5">
            {todos.map((todo, i) => (
              <li key={i}>
                <button type="button" onClick={todo.go}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: TODO_TONES[todo.tone].color }} />
                  <span className="min-w-0 flex-1 text-[13px] text-slate-700 group-hover:text-slate-900">{todo.text}</span>
                  <span className="shrink-0 text-[10px] font-medium" style={{ color: TODO_TONES[todo.tone].color }}>{t(TODO_TONES[todo.tone].label)}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-3 flex flex-col" title={zh ? '生产进度' : 'Production'}
          action={<LinkButton onClick={() => onNavigate('production_workshop')}>{zh ? '制作工坊' : 'Workshop'}</LinkButton>}>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><Film className="h-5 w-5" /></span>
              <div className="mt-3 text-sm font-medium text-slate-800">{zh ? '还没有进行中的项目' : 'No projects in progress'}</div>
              <p className="mt-1 max-w-xs text-xs text-slate-500">{zh ? '在 AI 导演台新建项目后，进度会自动出现在这里。' : 'Projects you start in the AI Director show up here automatically.'}</p>
              <button type="button" onClick={() => onNavigate('studio')}
                className="mt-3 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50">
                {zh ? '新建创作项目' : 'New project'}
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {projects.slice(0, 4).map(p => {
                const state = p.snap.exported
                  ? { label: zh ? '已导出' : 'Exported', color: '#047857', Icon: CheckCircle2 }
                  : p.pct === 100
                    ? { label: zh ? '待导出' : 'Ready', color: '#0891b2', Icon: CheckCircle2 }
                    : { label: zh ? `生成中 ${p.done}/${p.total}` : `Generating ${p.done}/${p.total}`, color: '#7c3aed', Icon: CircleDashed };
                return (
                  <li key={p.scope}>
                    <button type="button" onClick={() => onOpenProject(p.artistId, p.scope)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/40">
                      {p.artist
                        ? <img src={p.artist.avatar} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Film className="h-4 w-4" /></span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-900">{p.snap.spec.name}</span>
                          {p.snap.spec.template !== p.snap.spec.name && (
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{p.snap.spec.template}</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: state.color }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1" style={{ color: state.color }}><state.Icon className="h-3 w-3" />{state.label}</span>
                          <span>{p.artist?.name ?? ''}{p.artist ? ' · ' : ''}{ago(p.snap.savedAt, zh)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
            {[
              { label: zh ? '进行中项目' : 'In progress', value: projects.filter(p => !p.snap.exported).length, route: 'production_workshop' },
              { label: zh ? '待审作品' : 'Awaiting review', value: poolCount, route: 'publish_center/pool' },
              { label: zh ? '作品库' : 'Library', value: workCount, route: 'works' },
            ].map(st => (
              <button key={st.label} type="button" onClick={() => onNavigate(st.route)}
                className="rounded-xl bg-slate-50 px-3 py-2.5 text-left transition hover:bg-violet-50">
                <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{st.value}</div>
                <div className="text-[11px] text-slate-500">{st.label}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Revenue + role IP layers */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={zh ? '收益趋势' : 'Revenue trend'}
          action={<LinkButton onClick={() => onNavigate('monetization_center/revenue')}>{zh ? '收益详情' : 'Details'}</LinkButton>}>
          <div className="mb-2 flex flex-wrap gap-3">
            {REVENUE_SERIES.map(s => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{t(s.label)}
              </span>
            ))}
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  {REVENUE_SERIES.map(s => (
                    <linearGradient key={s.key} id={`ov-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, color: '#0f172a' }} />
                {REVENUE_SERIES.map(s => (
                  <Area key={s.key} type="monotone" dataKey={s.key} name={t(s.label)} stroke={s.color} fill={`url(#ov-${s.key})`} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2" title={zh ? '角色 IP 矩阵' : 'Role IP matrix'}
          action={<LinkButton onClick={() => onNavigate('artist_hub')}>{zh ? '角色 IP 中心' : 'Role IP Center'}</LinkButton>}>
          <ul className="space-y-1">
            {ROLE_GROUPS.map((g, i) => {
              const Icon = g.icon;
              const count = i === 0 ? MOCK_ARTISTS.length : 0;
              return (
                <li key={g.name.en} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${g.color}14`, color: g.color }}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-slate-900">{t(g.name)}</div>
                    <div className="truncate text-[11px] text-slate-500">{g.roles.slice(0, 3).map(r => t(r.name)).join(' · ')}</div>
                  </div>
                  {count > 0 ? (
                    <span className="shrink-0 text-sm font-semibold text-slate-900">{count}<span className="ml-0.5 text-[11px] font-normal text-slate-400">{zh ? '个' : ''}</span></span>
                  ) : (
                    <button type="button" onClick={() => onNavigate('incubation')}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100" style={{ color: g.color }}>
                      {zh ? '孵化' : 'Start'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Recent works + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={zh ? '最近作品' : 'Recent works'}
          action={<LinkButton onClick={() => onNavigate('works')}>{zh ? '作品库' : 'Library'}</LinkButton>}>
          <ul className="divide-y divide-gray-100">
            {works.map(w => {
              const st = WORK_STATUS[w.status] ?? WORK_STATUS.Draft;
              return (
                <li key={w.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Film className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-slate-900">{w.title}</div>
                    <div className="text-[11px] text-slate-500">{w.date}{w.plays && w.plays !== '-' ? ` · ${w.plays} ${zh ? '播放' : 'plays'}` : ''}</div>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: st.color, background: st.bg }}>{t(st.label)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <ActivityFeed lang={lang} />
      </div>
    </div>
  );
};
