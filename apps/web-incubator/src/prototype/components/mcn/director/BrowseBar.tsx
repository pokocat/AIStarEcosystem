/**
 * Work-area chrome for the AI 导演: the 画布 / 流程 browse switch, AI-follow, the 流程 step rail and
 * the chat's live one-click progress card. All read the same derived pipeline (see pipeline.ts).
 */
import React from 'react';
import { AlertCircle, Check, ChevronRight, Circle, Crosshair, LayoutDashboard, ListChecks, Loader2 } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { ProjectMode } from './directorData';
import { VIEW_LABELS } from './studioModel';
import type { PipelineStep, StepState } from './pipeline';

export type Browse = 'canvas' | 'flow';
type FlowView = PipelineStep['view'];

const StateIcon = ({ state, className = 'h-3.5 w-3.5' }: { state: StepState; className?: string }) => {
  if (state === 'done') return <Check className={`${className} text-emerald-600`} />;
  if (state === 'running') return <Loader2 className={`${className} animate-spin text-violet-600`} />;
  if (state === 'attention') return <AlertCircle className={`${className} text-amber-500`} />;
  return <Circle className={`${className} text-gray-300`} />;
};

interface BarProps {
  lang: Lang;
  browse: Browse;
  onBrowse: (b: Browse) => void;
  activity: PipelineStep | null;
  follow: boolean;
  onFollow: (on: boolean) => void;
}

/** 画布 / 流程 switch on the left; AI progress and 跟随 AI on the right. */
export const BrowseBar = ({ lang, browse, onBrowse, activity, follow, onFollow }: BarProps) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => (zh ? v.zh : v.en);
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
      <div role="tablist" aria-label={zh ? '浏览方式' : 'Browse as'} className="flex rounded-lg bg-gray-100 p-0.5">
        {([['canvas', LayoutDashboard, zh ? '画布' : 'Canvas'], ['flow', ListChecks, zh ? '流程' : 'Flow']] as const).map(([id, Icon, label]) => (
          <button key={id} type="button" role="tab" aria-selected={browse === id} onClick={() => onBrowse(id)}
            title={id === 'canvas' ? (zh ? '节点与连线，看整体结构' : 'Nodes and links, the whole structure') : (zh ? '按步骤：剧本 → 资产 → 分镜 → 成片' : 'Step by step: script → assets → shots → final')}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition ${browse === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <Icon className={`h-3.5 w-3.5 ${browse === id ? 'text-violet-600' : ''}`} />{label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {activity && (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 h-7 text-[12px] text-violet-800" role="status">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" />
            <span className="truncate">{zh ? 'AI 正在生成：' : 'AI is on: '}{t(activity.label)}{activity.detail ? ` ${t(activity.detail)}` : ''}</span>
          </span>
        )}
        {activity && !follow && (
          <button type="button" onClick={() => onFollow(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold" style={{ background: '#7c3aed', color: '#ffffff' }}>
            <Crosshair className="h-3.5 w-3.5" />{zh ? '回到 AI 当前进度' : 'Back to AI'}
          </button>
        )}
        <button type="button" role="switch" aria-checked={follow} onClick={() => onFollow(!follow)}
          title={zh ? 'AI 自动制作时，画布或流程跟着当前进度走；你自己操作时会暂停' : 'Follow the AI while it works; pauses when you take over'}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-[12px] text-gray-600 hover:bg-gray-50">
          <span className={`relative h-4 w-7 rounded-full transition ${follow ? 'bg-violet-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${follow ? 'left-3.5' : 'left-0.5'}`} />
          </span>
          {zh ? '跟随 AI' : 'Follow AI'}
        </button>
      </div>
    </div>
  );
};

const FLOW_ORDER: FlowView[] = ['script', 'assets', 'storyboard', 'final'];

/** 流程 step rail: vertical on desktop (horizontal on small screens), with each step's state. */
export const StepRail = ({ lang, mode, view, onView, status }: {
  lang: Lang; mode: ProjectMode; view: FlowView; onView: (v: FlowView) => void;
  status: Record<FlowView, { state: StepState; detail?: { zh: string; en: string } }>;
}) => {
  const zh = lang === 'zh';
  const labels = VIEW_LABELS(mode);
  return (
    <nav aria-label={zh ? '制作流程' : 'Production steps'}
      className="shrink-0 flex lg:flex-col gap-1 p-1.5 lg:w-[88px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-white overflow-x-auto">
      {FLOW_ORDER.map((id, i) => {
        const active = id === view;
        const s = status[id];
        return (
          <React.Fragment key={id}>
            {i > 0 && <span aria-hidden className="hidden lg:block mx-auto h-3 w-px bg-gray-200" />}
            <button type="button" onClick={() => onView(id)} aria-current={active ? 'step' : undefined}
              className={`relative shrink-0 w-[76px] lg:w-full rounded-xl px-1 py-2 flex flex-col items-center gap-0.5 transition ${active ? '' : 'hover:bg-gray-50'}`}
              style={active ? { background: '#f5f3ff', boxShadow: 'inset 0 0 0 1.5px #8b5cf6' } : undefined}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${s.state === 'done' ? 'bg-emerald-50' : s.state === 'running' ? 'bg-violet-100' : s.state === 'attention' ? 'bg-amber-50' : 'bg-gray-100'}`}>
                {s.state === 'todo' ? <span className="text-gray-500">{i + 1}</span> : <StateIcon state={s.state} />}
              </span>
              <span className={`text-[11px] font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>{labels[id][lang]}</span>
              <span className={`h-3 text-[10px] leading-3 ${s.state === 'attention' ? 'text-amber-600' : 'text-gray-400'}`}>{s.detail ? (zh ? s.detail.zh : s.detail.en) : ''}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

/** Live one-click progress in the chat: ticks as steps finish; each row jumps to its step. */
export const PipelineCard = ({ lang, steps, onJump }: { lang: Lang; steps: PipelineStep[]; onJump: (s: PipelineStep) => void }) => {
  const zh = lang === 'zh';
  const done = steps.filter(s => s.state === 'done').length;
  const running = steps.some(s => s.state === 'running');
  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
      <div className="flex items-center justify-between px-1.5 pb-1.5">
        <span className="text-[12px] font-semibold text-gray-900">{zh ? '一键制作进度' : 'One-click progress'}</span>
        <span className={`text-[11px] ${running ? 'text-violet-600' : done === steps.length ? 'text-emerald-600' : 'text-gray-500'}`}>
          {done === steps.length ? (zh ? '全部完成' : 'All done') : `${done}/${steps.length}`}
        </span>
      </div>
      <div className="mb-1.5 mx-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} />
      </div>
      <ul>
        {steps.map(s => (
          <li key={s.id}>
            <button type="button" onClick={() => onJump(s)}
              className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-gray-50 ${s.state === 'running' ? 'bg-violet-50/60' : ''}`}>
              <StateIcon state={s.state} />
              <span className={`flex-1 text-[12px] ${s.state === 'todo' ? 'text-gray-500' : 'text-gray-800'}`}>{zh ? s.label.zh : s.label.en}</span>
              {s.detail && <span className="text-[11px] tabular-nums text-gray-400">{zh ? s.detail.zh : s.detail.en}</span>}
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
