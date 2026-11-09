'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Loader2, PencilLine, Plus, RefreshCw, Shuffle, X } from 'lucide-react';
import type { StudioVideoTakeInfo, StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
import type { StudioTakeChange } from '@ai-star-eco/types/ip-studio-scenes';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { dialogFocus } from '@/ip/dialog-focus';
import { videoTaskPrice } from '@/canvas-bridge/studio-video-tasks';
import { describeStudioVideoPrice, studioVideoPriceQuery, useStudioVideoPrice } from '@/canvas-bridge/studio-video-price';
import { AiMark } from '../studio-ai-icon';
import { scriptMissing } from './scene-script-check';
import { FissionIcon } from './fission-icon';
import { applyChanges, changeSegments, latestRewrites, latestVariables, sampleTakes, TAKE_COUNTS, takeModes, takePriceQuery, takeScript,
  type TakeMode, type TakeVariable } from './scene-video-takes';

/** 交给页面提交的一条：怎么来的，以及换过的脚本（原样没有）。 */
export interface MoreTake { take: StudioVideoTakeInfo; text?: string }
type Way = TakeMode | 'edit';

const WAYS: { way: Way; title: string; note: string }[] = [
  { way: 'same', title: '原样', note: '同一个脚本，画面各不相同' },
  { way: 'variables', title: '换变量', note: '替换人物、场景等说法，不用 AI' },
  { way: 'rewrite', title: 'AI 改写', note: 'AI 编导为每条重写一版' },
  { way: 'edit', title: '自己改', note: '放回设置，改完再生成' },
];
const WAY_ICON = { same: Copy, variables: Shuffle, edit: PencilLine } as const;

/**
 * 「视频裂变」（2026-11-09 用户要求：「重新编辑」和「再次生成」合成一个入口，并参考带货子应用的派生变体）。
 * 左边选怎么变、几条、变量；右边逐条预览要交出去的脚本。只负责选和看，找变量、写脚本、提交都由页面做（同一套草稿、计费和恢复规则）。
 */
export function VideoMoreDialog({ task, modelName, free, busy, textBlocker, nodes, onClose, onFind, onWrite, onGenerate, onEdit, onConfirm }: {
  task: StudioVideoTask; modelName?: string;
  /** 演示模式：不扣积分。 */
  free: boolean; busy: boolean;
  /** 找变量、AI 改写用的文字模型现在不能用的原因。 */
  textBlocker?: string;
  /** 这条任务所在草稿的节点：找变量、改写的结果在这里（页面会接着读未完成的任务）。 */
  nodes: CanvasNodeData[];
  onClose: () => void;
  onFind: () => Promise<void>;
  onWrite: (changes: StudioTakeChange[][]) => Promise<void>;
  /** 全部交上去了返回 true，弹窗关掉。 */
  onGenerate: (takes: MoreTake[]) => Promise<boolean>;
  onEdit: () => void;
  /** 提交结果没确认的那次（找变量、改写）：同一个请求编号再交一次。 */
  onConfirm: (node: CanvasNodeData) => void;
}) {
  const base = task.request;
  const script = takeScript(base);
  const modes = takeModes(base);
  const reasonOf = (way: Way) => way === 'edit' ? (task.input ? undefined : '这条没有保存设置') : modes.find(m => m.mode === way)?.reason;
  const [way, setWay] = useState<Way>(() => modes[0].reason ? 'edit' : 'same');
  const [count, setCount] = useState(2);
  const [seed, setSeed] = useState(1);
  const [shown, setShown] = useState(0);

  const found = latestVariables(nodes, task.id, script);
  const foundKey = `${found.node?.id ?? ''}:${found.status ?? ''}:${found.node?.metadata?.content?.length ?? 0}`;
  const [variables, setVariables] = useState<TakeVariable[]>(found.variables);
  // 找到新的一批才换掉页面上改过的变量；轮询换对象不算。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setVariables(found.variables); setSeed(1); }, [foundKey]);
  const changes = useMemo(() => sampleTakes(variables, count, seed), [variables, count, seed]);

  const rewrites = latestRewrites(nodes, task.id);
  const writing = rewrites.some(n => n.metadata?.status === 'loading');
  const batchFits = rewrites.length > 0 && rewrites[0].metadata?.studio?.sceneTake?.total === count;
  const written = rewrites.filter(n => n.metadata?.status === 'success' && (n.metadata.content || '').trim());

  // 价格：普通视频和「生成视频」按钮旁同一个报价；长视频和复刻按实际用量结算，写约数。
  const direct = base?.kind === 'direct' && base.video?.video ? base.video : undefined;
  const directKey = !free && direct ? JSON.stringify([direct.model, direct.video, direct.durationSec, direct.aspectRatio]) : '';
  const directQuery = useMemo(() => directKey && direct
    ? studioVideoPriceQuery(direct.model, direct.video!, direct.durationSec ?? base?.configuration?.duration ?? 0, direct.aspectRatio ?? base?.configuration?.ratio ?? '9:16') : undefined,
  // directKey 已包含报价用到的全部字段；任务轮询会换对象，不能按对象重报。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [directKey]);
  const directPrice = describeStudioVideoPrice(useStudioVideoPrice(directQuery), null);
  const [estimate, setEstimate] = useState<number>();
  useEffect(() => {
    if (free || !base || base.kind === 'direct') return;
    const query = takePriceQuery(base);
    if (!query) return;
    const abort = new AbortController();
    videoTaskPrice(query, abort.signal).then(p => { if (!abort.signal.aborted) setEstimate(p.estimated); }, () => undefined);
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [free, task.id]);
  const each = free ? 0 : direct ? directPrice?.shown : estimate;
  const priceFor = (n: number) => free ? '免费' : each === undefined ? '' : `${direct ? '' : '约 '}${(each * n).toLocaleString('zh-CN')} 积分${direct && directPrice?.from ? '起' : ''}`;
  const textPrice = free ? '免费' : '按实际用量结算';

  const takes: MoreTake[] = way === 'same' ? Array.from({ length: count }, () => ({ take: { of: task.id, mode: 'same' } }))
    : way === 'variables' ? changes.map(c => ({ take: { of: task.id, mode: 'variables', changes: c }, text: applyChanges(script, c) }))
    : written.map(n => ({ take: { of: task.id, mode: 'rewrite', changes: n.metadata?.studio?.sceneTake?.changes }, text: scriptMissing(n.metadata?.content || '').body }));
  const generate = () => void onGenerate(takes).then(done => { if (done) onClose(); });

  type Action = { label: string; ai?: boolean; price?: string; blocker?: string; run?: () => void };
  const action: Action = way === 'edit' ? { label: '去修改', blocker: reasonOf('edit'), run: onEdit }
    : reasonOf(way) ? { label: `生成 ${count} 条`, blocker: reasonOf(way) }
    : way === 'same' ? { label: `生成 ${count} 条`, price: priceFor(count), run: generate }
    : way === 'variables' ? { label: `生成 ${count} 条`, price: priceFor(count), run: generate,
      blocker: found.status === 'loading' ? '正在找变量' : !variables.length ? '请先找变量' : !changes[0]?.length ? '请至少保留一处变量' : undefined }
    : writing ? { label: '正在写脚本', ai: true }
    : batchFits && written.length ? { label: `生成 ${written.length} 条`, price: priceFor(written.length), run: generate }
    : { label: `写 ${count} 版脚本`, ai: true, price: textPrice, blocker: textBlocker || (found.status === 'loading' ? '正在找变量' : undefined), run: () => void onWrite(changes) };
  const disabled = busy || !!action.blocker || !action.run;

  const total = way === 'rewrite' && batchFits ? rewrites.length : count;
  const at = Math.min(shown, total - 1);
  useEffect(() => { if (shown > total - 1) setShown(Math.max(0, total - 1)); }, [shown, total]);

  const spec = [modelName, base?.configuration?.duration ? `${base.configuration.duration} 秒` : '', base?.configuration?.ratio, base?.configuration?.tier?.toUpperCase()].filter(Boolean);
  const closeable = useRef(onClose); closeable.current = onClose;

  return <div className="video-more-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="video-more" role="dialog" aria-modal="true" aria-labelledby="video-more-title" ref={dialogFocus} tabIndex={-1}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeable.current(); } }}>
      <header className="video-more-head">
        <span className="video-more-head-icon" aria-hidden="true"><FissionIcon size={20}/></span>
        <div>
          <h2 id="video-more-title">视频裂变</h2>
          <p><span title={task.title}>{task.title}</span>{spec.map(s => <span key={s}>{s}</span>)}</p>
        </div>
        <button type="button" className="video-more-close" aria-label="关闭" onClick={onClose}><X size={16} strokeWidth={1.6}/></button>
      </header>
      <div className="video-more-body">
        <div className="video-more-controls">
          <section aria-labelledby="video-more-way">
            <h3 id="video-more-way">每条怎么变</h3>
            <div className="video-more-ways" role="radiogroup" aria-labelledby="video-more-way" onKeyDown={e => {
              // 单选组的键盘约定：方向键在几种方式之间移动并选中。
              const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = WAYS[(WAYS.findIndex(w => w.way === way) + step + WAYS.length) % WAYS.length].way;
              setWay(next);
              (e.currentTarget.querySelector(`[data-way="${next}"]`) as HTMLElement | null)?.focus();
            }}>
              {WAYS.map(w => { const Icon = w.way === 'rewrite' ? null : WAY_ICON[w.way]; const reason = reasonOf(w.way);
                return <button key={w.way} type="button" role="radio" aria-checked={way === w.way} tabIndex={way === w.way ? 0 : -1} data-way={w.way}
                  className={`video-more-way${w.way === 'rewrite' ? ' is-ai' : ''}${reason ? ' is-limited' : ''}`} onClick={() => setWay(w.way)}>
                  <span className="video-more-way-icon" aria-hidden="true">{Icon ? <Icon size={15} strokeWidth={1.6}/> : <AiMark size={13}/>}</span>
                  <span><b>{w.title}</b><small>{reason ?? w.note}</small></span>
                </button>; })}
            </div>
          </section>
          {way !== 'edit' && <section aria-labelledby="video-more-count">
            <h3 id="video-more-count">生成条数</h3>
            <div className="scene-choice-row" role="group" aria-labelledby="video-more-count">
              {TAKE_COUNTS.map(n => <button key={n} type="button" aria-pressed={n === count} onClick={() => setCount(n)}>{n} 条</button>)}
            </div>
          </section>}
          {(way === 'variables' || way === 'rewrite') && !reasonOf(way) && <Variables way={way} status={found.status} node={found.node} variables={variables} busy={busy}
            textBlocker={textBlocker} textPrice={textPrice} onChange={setVariables} onShuffle={() => setSeed(s => s + 1)} onFind={() => void onFind()} onConfirm={onConfirm}/>}
        </div>
        <div className="video-more-preview">
          {way === 'edit' ? <div className="video-more-edit">
            <PencilLine size={22} strokeWidth={1.4} aria-hidden="true"/>
            <p>放回这条视频的脚本、素材和设置，改完点「生成视频」。</p>
            <p>新视频和这条放在一起，已生成的视频保留。</p>
          </div> : <>
            <div className="video-more-tabs" role="tablist" aria-label="逐条预览" onKeyDown={e => {
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (at + step + total) % total;
              setShown(next);
              (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
            }}>
              {Array.from({ length: total }, (_, i) => { const node = way === 'rewrite' && batchFits ? rewrites[i] : undefined;
                return <button key={i} type="button" role="tab" aria-selected={i === at} tabIndex={i === at ? 0 : -1} onClick={() => setShown(i)} data-state={node?.metadata?.status}>
                  第 {i + 1} 条{node?.metadata?.status === 'loading' && <Loader2 size={11} className="studio-gallery-spinner" aria-label="正在写"/>}</button>; })}
            </div>
            <Preview way={way} script={script} change={way === 'rewrite' && batchFits ? rewrites[at]?.metadata?.studio?.sceneTake?.changes ?? [] : changes[at] ?? []}
              node={way === 'rewrite' && batchFits ? rewrites[at] : undefined} busy={busy} onConfirm={onConfirm}/>
          </>}
        </div>
      </div>
      <footer className="video-more-foot">
        <p className="video-more-foot-note">{action.blocker
          ?? (way === 'rewrite' && batchFits && written.length < rewrites.length && !writing ? `${rewrites.length - written.length} 版没写成，只生成写好的 ${written.length} 条`
          // 写好之后又改了条数：写好的那几版还在，改回原来的条数就能直接生成。
          : way === 'rewrite' && rewrites.length > 0 && !batchFits ? `已写好 ${rewrites.length} 版，选 ${rewrites.length} 条可直接生成` : '')}</p>
        {way === 'rewrite' && rewrites.length > 0 && !writing && batchFits && <button type="button" className="video-more-secondary" disabled={busy || !!textBlocker}
          onClick={() => void onWrite(changes)}><RefreshCw size={13} strokeWidth={1.6}/>重新写</button>}
        <button type="button" className="scene-go is-compact" disabled={disabled} onClick={action.run}>
          {busy || (way === 'rewrite' && writing) ? <Loader2 size={14} className="studio-gallery-spinner"/> : action.ai ? <AiMark size={13}/> : null}
          <span>{action.label}</span>{action.price && <small>{action.price}</small>}
        </button>
      </footer>
    </div>
  </div>;
}

function Variables({ way, status, node, variables, busy, textBlocker, textPrice, onChange, onShuffle, onFind, onConfirm }: {
  way: 'variables' | 'rewrite'; status?: string; node?: CanvasNodeData; variables: TakeVariable[]; busy: boolean; textBlocker?: string; textPrice: string;
  onChange: (next: TakeVariable[]) => void; onShuffle: () => void; onFind: () => void; onConfirm: (node: CanvasNodeData) => void;
}) {
  const unconfirmed = status === 'loading' && !node?.metadata?.studio?.runId && node?.metadata?.errorDetails;
  const find = <button type="button" className="scene-ai-button" disabled={busy || !!textBlocker} onClick={onFind} title={textBlocker}>
    <AiMark size={11}/>{node ? '重新找' : '找变量'}</button>;
  return <section aria-labelledby="video-more-vars" className="video-more-vars">
    <div className="video-more-vars-head">
      <h3 id="video-more-vars">变量{way === 'rewrite' && <small>选填</small>}</h3>
      {variables.length > 0 && status === 'success' && <button type="button" className="video-more-link" onClick={onShuffle}><Shuffle size={12} strokeWidth={1.6}/>换一组</button>}
      {status !== 'loading' && node && find}
    </div>
    {status === 'loading' ? unconfirmed
      ? <p className="video-more-vars-note">提交结果待确认。<button type="button" className="video-more-link" disabled={busy} onClick={() => onConfirm(node!)}>确认原任务</button></p>
      : <p className="video-more-vars-note"><Loader2 size={13} className="studio-gallery-spinner"/>正在从脚本里找可以替换的说法…</p>
    : !node ? <div className="video-more-vars-empty">
        <p>{way === 'rewrite' ? '找出人物、场景、开场等说法，每条按一组变化改写。不找也可以，AI 编导会自己换。' : '从脚本里找出人物、场景、开场等可以替换的说法。'}</p>
        <div>{find}<small>{textPrice}</small></div>
      </div>
    : status === 'error' ? <p className="video-more-vars-note is-error">没有找到：{node.metadata?.errorDetails || '请重新找'}</p>
    : !variables.length ? <p className="video-more-vars-note">这个脚本里没有适合替换的说法。</p>
    : <ul className="video-more-var-list">{variables.map(v => <VariableRow key={v.id} variable={v} onChange={next => onChange(variables.map(x => x.id === v.id ? next : x))}/>)}</ul>}
  </section>;
}

function VariableRow({ variable: v, onChange }: { variable: TakeVariable; onChange: (next: TakeVariable) => void }) {
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim();
    if (value && value !== v.from && !v.values.includes(value)) onChange({ ...v, values: [...v.values, value] });
    setDraft(''); setAdding(false);
  };
  return <li className={v.on ? undefined : 'is-off'}>
    <label className="video-more-var-head">
      <input type="checkbox" checked={v.on} onChange={e => onChange({ ...v, on: e.target.checked })}/>
      <b>{v.name}</b><span title={v.from}>原文「{v.from}」</span>
    </label>
    <div className="video-more-var-values">
      {v.values.map(value => <span key={value} className="video-more-chip" title={value}>{value}
        <button type="button" aria-label={`删除「${value}」`} onClick={() => onChange({ ...v, values: v.values.filter(x => x !== value) })}><X size={10} strokeWidth={2}/></button></span>)}
      {adding ? <input className="video-more-chip-input" autoFocus value={draft} maxLength={80} placeholder="换成…" aria-label={`给「${v.name}」添加一个替换`}
        onChange={e => setDraft(e.target.value)} onBlur={add}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') { e.stopPropagation(); setDraft(''); setAdding(false); } }}/>
        : <button type="button" className="video-more-chip-add" onClick={() => setAdding(true)}><Plus size={11} strokeWidth={1.8}/>添加</button>}
    </div>
  </li>;
}

function Preview({ way, script, change, node, busy, onConfirm }: {
  way: TakeMode; script: string; change: StudioTakeChange[]; node?: CanvasNodeData; busy: boolean; onConfirm: (node: CanvasNodeData) => void;
}) {
  const status = node?.metadata?.status;
  const summary = way === 'same' ? <span className="video-more-change is-plain">原脚本</span>
    : change.length ? change.map(c => <span key={c.from} className="video-more-change" title={`原文「${c.from}」`}><em>{c.name}</em>{c.to}</span>)
    : <span className="video-more-change is-plain">{way === 'rewrite' ? 'AI 编导自己换开场、人物和台词' : '还没有找变量'}</span>;
  let body;
  if (way === 'rewrite') {
    // 还没写：先看原脚本里哪些地方会改（标出来不换），写好后这里换成新脚本。
    if (!node) body = <>
      <p className="video-more-plan is-note">写好后这里换成新脚本。下面是原脚本{change.length ? '，标出的是这一条要改的地方' : ''}。</p>
      <p className="video-more-script is-original">{changeSegments(script, change, true)
        .map((part, i) => part.change ? <mark key={i} title={`改成「${part.change.to}」`}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</p>
    </>;
    else if (status === 'loading') body = !node.metadata?.studio?.runId && node.metadata?.errorDetails
      ? <p className="video-more-plan">提交结果待确认。<button type="button" className="video-more-link" disabled={busy} onClick={() => onConfirm(node)}>确认原任务</button></p>
      : <div className="video-more-skeleton" aria-label="正在写脚本"><i/><i/><i/><i/><i/></div>;
    else if (status === 'error') body = <p className="video-more-plan is-error">这一版没写成：{node.metadata?.errorDetails || '请重新写'}</p>;
    else body = <p className="video-more-script">{scriptMissing(node.metadata?.content || '').body}</p>;
  } else body = <p className="video-more-script">{changeSegments(script, way === 'variables' ? change : [])
    .map((part, i) => part.change ? <mark key={i} title={`${part.change.name}：原文「${part.change.from}」`}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</p>;
  return <div className="video-more-card" role="tabpanel">
    <div className="video-more-changes">{summary}</div>
    {body}
  </div>;
}
