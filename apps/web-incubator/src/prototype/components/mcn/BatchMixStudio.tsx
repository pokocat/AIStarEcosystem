/**
 * 混剪批量 — 选模板 → 填素材槽（可直接用 AI 图片 / AI 视频生成的素材）→ 设变体策略 → 批量渲染，
 * 渲染完勾选变体送入 发布中心 › 发布池。去重策略越多，变体之间越不相似，越容易过平台查重。
 */
import React, { useMemo, useState } from 'react';
import { Check as CheckIcon, Film, Layers, Music, Send, Shuffle, Sparkles, Type } from 'lucide-react';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { FRAME_POOL } from './director/directorData';
import { addToPool, primeTimeSlot } from './publishPoolStore';
import { spend, useQuickGen } from './quickgen/quickgenStore';
import {
  Bar, Card, Check, Chips, Composer, Empty, Field, Pill, RunButton, SectionHead, SmallButton, Stats, ToolLayout,
  progressOf, today, uid, useNow, useStoredList, useToast, type Timed,
} from './batch/kit';

type LT = { zh: string; en: string };
type SlotKind = 'visual' | 'audio' | 'text';
interface Slot { id: string; label: LT; kind: SlotKind; optional?: boolean }
interface Template { id: string; name: LT; flow: LT; length: string; color: string; slots: Slot[] }
interface Fill { label: string; image?: string }
interface Variant { id: string; image: string; label: string; selected?: boolean; pooled?: boolean }
interface MixTask extends Timed {
  id: string; template: string; title: string; count: number; platform: string; options: string[]; similarity: number;
  cost: number; date: string; variants: Variant[];
}

const L = (zh: string, en: string): LT => ({ zh, en });
const PRICE_PER_VARIANT = 10;
const S = (id: string, zh: string, en: string, kind: SlotKind = 'visual', optional = false): Slot => ({ id, label: L(zh, en), kind, optional });
const TEMPLATES: Template[] = [
  { id: 'review', name: L('产品测评', 'Product review'), flow: L('开箱 → 功能讲解 → 使用感受 → 购买引导', 'Unbox → features → experience → CTA'), length: '0:45–1:20', color: '#0891b2',
    slots: [S('open', '开场片段', 'Opening'), S('product', '产品展示', 'Product'), S('demo', '功能演示', 'Demo'), S('cta', '结尾引导', 'CTA'), S('voice', '口播文案', 'Voice-over', 'text'), S('bgm', '背景音乐', 'Music', 'audio', true)] },
  { id: 'lifestyle', name: L('生活方式', 'Lifestyle'), flow: L('日常场景拼接 + 产品自然植入 + 节奏 BGM', 'Daily scenes + natural placement + rhythm'), length: '1:00–2:00', color: '#db2777',
    slots: [S('a', '场景一', 'Scene 1'), S('b', '场景二', 'Scene 2'), S('c', '场景三', 'Scene 3'), S('product', '产品特写', 'Product close-up'), S('bgm', '背景音乐', 'Music', 'audio')] },
  { id: 'highlight', name: L('高光集锦', 'Highlights'), flow: L('直播 / 活动高光 + 节奏剪切 + 动感配乐', 'Live highlights + rhythmic cuts + upbeat music'), length: '0:30–0:60', color: '#7c3aed',
    slots: [S('a', '高光一', 'Highlight 1'), S('b', '高光二', 'Highlight 2'), S('c', '高光三', 'Highlight 3'), S('bgm', '背景音乐', 'Music', 'audio')] },
  { id: 'tutorial', name: L('教程分解', 'Tutorial'), flow: L('步骤拆分 + 字幕引导 + 重点放大 + 成果展示', 'Steps + captions + zoom-ins + result'), length: '2:00–4:00', color: '#d97706',
    slots: [S('s1', '步骤一', 'Step 1'), S('s2', '步骤二', 'Step 2'), S('s3', '步骤三', 'Step 3'), S('result', '成果展示', 'Result'), S('voice', '讲解文案', 'Script', 'text')] },
  { id: 'story', name: L('故事短片', 'Story short'), flow: L('短故事结构 + 悬念设置 + 情感共鸣', 'Short arc + suspense + emotion'), length: '0:15–0:30', color: '#059669',
    slots: [S('hook', '悬念开场', 'Hook'), S('turn', '情节转折', 'Turn'), S('end', '情感收尾', 'Ending'), S('voice', '旁白', 'Narration', 'text', true)] },
];
const OPTIONS = [
  { id: 'bgm', icon: Music, label: L('换 BGM', 'Swap music'), sub: L('每条用不同配乐', 'Different track per variant') },
  { id: 'caption', icon: Type, label: L('换字幕样式', 'Caption styles'), sub: L('字体、颜色、位置轮换', 'Rotate font, colour, position') },
  { id: 'order', icon: Shuffle, label: L('打乱片段顺序', 'Shuffle segments'), sub: L('中段片段随机重排', 'Reorder the middle segments') },
  { id: 'cover', icon: Sparkles, label: L('换封面标题', 'Cover titles'), sub: L('自动生成多版封面文案', 'Generate several cover lines') },
];
const BGMS = [L('轻快电子', 'Light electro'), L('温暖吉他', 'Warm guitar'), L('动感鼓点', 'Punchy drums'), L('城市夜晚', 'City night')];
const PLATFORMS: Array<[string, string]> = [['DY', '抖音'], ['KS', '快手'], ['XHS', '小红书'], ['VCH', '视频号']];

/** Lower is better: every de-dup option makes variants less alike. */
const similarityFor = (options: string[]) => Math.max(12, 62 - options.length * 13);

export const BatchMixStudio = ({ lang, activeArtist, onOpenPublish }: { lang: Lang; activeArtist: Artist; onOpenPublish?: () => void }) => {
  const zh = lang === 'zh';
  const t = (v: LT) => (zh ? v.zh : v.en);
  const name = activeArtist.name;
  const { gens } = useQuickGen();
  // Visual material: AI 图片 / AI 视频 results first, then sample footage.
  const library = useMemo(() => [
    ...gens.filter(g => g.status === 'done').map(g => ({ label: g.title, image: g.images[0], ai: true })),
    ...FRAME_POOL.map((image, i) => ({ label: zh ? `${name} 素材 ${i + 1}` : `${name} clip ${i + 1}`, image, ai: false })),
  ].slice(0, 18), [gens, name, zh]);
  const texts = [L(`${name} 新品口播`, `${name} launch talk`), L(`${name} 日常分享`, `${name} daily share`), L(`${name} 使用心得`, `${name} review notes`)];

  const [tasks, setTasks] = useStoredList<MixTask>(`ai_batch_mix_v1:${activeArtist.id}`, () => []);
  const [templateId, setTemplateId] = useState('review');
  const template = TEMPLATES.find(x => x.id === templateId)!;
  const [fills, setFills] = useState<Record<string, Fill>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [count, setCount] = useState(20);
  const [platform, setPlatform] = useState('DY');
  const [options, setOptions] = useState<string[]>(['bgm', 'caption', 'order']);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, say] = useToast();

  const running = tasks.some(x => progressOf(x, Date.now()) < 100);
  const now = useNow(running);
  const selected = tasks.find(x => x.id === selectedId) ?? tasks[0] ?? null;
  const missing = template.slots.filter(s => !s.optional && !fills[`${template.id}:${s.id}`]);
  const similarity = similarityFor(options);
  const cost = count * PRICE_PER_VARIANT;

  const pickTemplate = (id: string) => { setTemplateId(id); setPicking(null); };
  const fill = (slot: Slot, f: Fill) => { setFills(x => ({ ...x, [`${template.id}:${slot.id}`]: f })); setPicking(null); };
  // Fill every empty slot in one go from the library, BGM and copy lists.
  const autofill = () => {
    let vi = 0;
    const next = { ...fills };
    template.slots.forEach((s, i) => {
      const key = `${template.id}:${s.id}`;
      if (next[key]) return;
      next[key] = s.kind === 'visual' ? library[vi++ % library.length] : s.kind === 'audio' ? { label: t(BGMS[i % BGMS.length]) } : { label: t(texts[0]) };
    });
    setFills(next);
  };

  const start = () => {
    if (missing.length || !spend(cost)) return;
    const visuals = template.slots.filter(s => s.kind === 'visual').map(s => fills[`${template.id}:${s.id}`]?.image).filter((x): x is string => !!x);
    const task: MixTask = {
      id: uid('mix'), template: template.id, title: `${name} · ${t(template.name)} · ${PLATFORMS.find(p => p[0] === platform)?.[1] ?? platform}`,
      count, platform, options, similarity, cost, date: today(), startedAt: Date.now(), durationMs: 3500 + count * 180,
      variants: Array.from({ length: count }, (_, i) => ({
        id: uid('v'), image: visuals[i % Math.max(1, visuals.length)] ?? FRAME_POOL[i % FRAME_POOL.length],
        label: [`#${String(i + 1).padStart(2, '0')}`, options.includes('bgm') ? t(BGMS[i % BGMS.length]) : '', options.includes('caption') ? `${zh ? '字幕' : 'Caps'} ${'ABC'[i % 3]}` : ''].filter(Boolean).join(' · '),
      })),
    };
    setTasks(list => [task, ...list]);
    setSelectedId(task.id);
    say(zh ? `开始批量渲染 ${count} 条` : `Rendering ${count} variants`);
  };

  const patchVariants = (taskId: string, fn: (v: Variant) => Variant) => setTasks(list => list.map(x => (x.id === taskId ? { ...x, variants: x.variants.map(fn) } : x)));
  const pool = (task: MixTask) => {
    const chosen = task.variants.filter(v => v.selected && !v.pooled);
    chosen.forEach(v => addToPool({
      id: v.id, type: 'mix', title: `${task.title} ${v.label.split(' · ')[0]}`, partnerName: name, platform: task.platform, account: `@${name}`, status: 'pending_review',
      scheduledAt: primeTimeSlot(1), preCheck: { auth: true, watermark: true, quality: true }, duration: TEMPLATES.find(x => x.id === task.template)?.length.split('–')[0] ?? '0:30',
      thumbColor: '#f97316', thumbImage: v.image, formats: ['9:16'],
    }));
    patchVariants(task.id, v => (v.selected && !v.pooled ? { ...v, pooled: true, selected: false } : v));
    say(zh ? `${chosen.length} 条变体已送入发布池` : `${chosen.length} variants sent to the pool`);
  };

  const stats = useMemo(() => {
    const done = tasks.filter(x => progressOf(x, now) >= 100);
    return {
      running: tasks.length - done.length,
      today: done.filter(x => x.date === today()).reduce((a, x) => a + x.count, 0),
      similarity: done.length ? Math.round(done.reduce((a, x) => a + x.similarity, 0) / done.length) : null,
      pooled: done.reduce((a, x) => a + x.variants.filter(v => v.pooled).length, 0),
    };
  }, [tasks, now]);

  const composer = (
    <Composer icon={Layers} color="#ea580c" title={zh ? '新建混剪批次' : 'New mix batch'} desc={zh ? `为 ${name} 批量出片，素材可直接用 AI 生成的结果` : `Batch videos for ${name}; use AI results as material`}
      footer={<RunButton zh={zh} label={zh ? `批量渲染 ${count} 条` : `Render ${count}`} cost={cost} blocked={missing.length ? (zh ? `还差 ${missing.length} 个素材槽` : `${missing.length} slots empty`) : null} onClick={start} />}>
      <Field label={zh ? '模板' : 'Template'}>
        <div className="space-y-1.5">
          {TEMPLATES.map(x => (
            <button key={x.id} type="button" onClick={() => pickTemplate(x.id)} aria-pressed={x.id === templateId}
              className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition ${x.id === templateId ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-[13px] text-gray-900">{t(x.name)}<span className="text-[11px] text-gray-400">{x.length}</span></span>
                <span className="block truncate text-[11px] text-gray-500">{t(x.flow)}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={zh ? '素材槽' : 'Slots'} right={<button type="button" onClick={autofill} className="text-[11px] font-medium text-violet-700 hover:underline">{zh ? '一键填充' : 'Auto-fill'}</button>}>
        <div className="space-y-1.5">
          {template.slots.map(s => {
            const key = `${template.id}:${s.id}`;
            const f = fills[key];
            const open = picking === key;
            return (
              <div key={key} className={`rounded-xl border ${open ? 'border-violet-300' : 'border-gray-200'}`}>
                <button type="button" onClick={() => setPicking(open ? null : key)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                    {f?.image ? <img src={f.image} alt="" className="h-full w-full object-cover" /> : s.kind === 'audio' ? <Music className="h-4 w-4" /> : s.kind === 'text' ? <Type className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-gray-800">{t(s.label)}{s.optional && <span className="ml-1 font-normal text-gray-400">{zh ? '可选' : 'optional'}</span>}</span>
                    <span className={`block truncate text-[11px] ${f ? 'text-gray-600' : 'text-gray-400'}`}>{f?.label ?? (zh ? '点击选择' : 'Choose')}</span>
                  </span>
                  {f && <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 p-2">
                    {s.kind === 'visual' ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {library.map((m, i) => (
                          <button key={i} type="button" onClick={() => fill(s, m)} title={m.label} className="relative aspect-square overflow-hidden rounded-lg">
                            <img src={m.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                            {m.ai && <span className="absolute left-1 top-1 rounded px-1 text-[9px] font-medium" style={{ background: 'rgba(124,58,237,.9)', color: '#ffffff' }}>AI</span>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {(s.kind === 'audio' ? BGMS : texts).map(x => (
                          <button key={x.en} type="button" onClick={() => fill(s, { label: t(x) })} className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-50">{t(x)}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <Field label={zh ? '去重策略' : 'De-dup'} right={<span className={`text-[11px] font-medium ${similarity <= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>{zh ? `预计相似度 ${similarity}%` : `≈${similarity}% similar`}</span>}>
        {OPTIONS.map(o => <Check key={o.id} checked={options.includes(o.id)} onChange={on => setOptions(x => (on ? [...x, o.id] : x.filter(y => y !== o.id)))} label={t(o.label)} sub={t(o.sub)} />)}
        {similarity > 25 && <p className="mt-1 text-[11px] text-amber-700">{zh ? '相似度偏高，同一平台批量发布可能被判重复，建议至少勾选 3 项' : 'High similarity may be flagged as duplicates; pick at least 3'}</p>}
      </Field>
      <Field label={zh ? '数量' : 'Count'}><Chips options={[[10, '10'], [20, '20'], [50, '50']]} value={count} onChange={setCount} /></Field>
      <Field label={zh ? '发布平台' : 'Platform'}><Chips options={PLATFORMS.map(([id, zhName]) => [id, zh ? zhName : id] as [string, string])} value={platform} onChange={setPlatform} /></Field>
    </Composer>
  );

  return (
    <ToolLayout composer={composer}>
      <Stats items={[
        { label: zh ? '渲染中批次' : 'Rendering', value: stats.running, tone: '#6d28d9' },
        { label: zh ? '今日产出' : 'Made today', value: stats.today },
        { label: zh ? '平均相似度' : 'Avg. similarity', value: stats.similarity === null ? '-' : `${stats.similarity}%`, tone: '#047857' },
        { label: zh ? '已入发布池' : 'In pool', value: stats.pooled, tone: '#ea580c' },
      ]} />
      {tasks.length === 0 ? (
        <Card><Empty icon={Layers} title={zh ? '还没有混剪批次' : 'No batches yet'} desc={zh ? '在左侧选模板、填素材槽（可点「一键填充」），开始第一批' : 'Pick a template and fill the slots (or Auto-fill) to start'} /></Card>
      ) : (
        <>
          <Card>
            <SectionHead title={zh ? '批次' : 'Batches'} />
            <ul className="px-2 pb-2">
              {tasks.map(x => {
                const pct = progressOf(x, now);
                const pooled = x.variants.filter(v => v.pooled).length;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => setSelectedId(x.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${x.id === selected?.id ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                      <img src={x.variants[0]?.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-gray-900">{x.title}</span>
                        {pct < 100 ? <span className="mt-1.5 block w-48"><Bar pct={pct} /></span>
                          : <span className="block text-[11px] text-gray-500">{x.count}{zh ? ' 条' : ''} · {zh ? '相似度' : 'similarity'} {x.similarity}% · ⬡{x.cost} · {x.date}</span>}
                      </span>
                      {pct < 100 ? <Pill tone="running">{zh ? '渲染中' : 'Rendering'} {pct}%</Pill> : pooled ? <Pill tone="done">{zh ? `已入池 ${pooled}` : `${pooled} pooled`}</Pill> : <Pill tone="review">{zh ? '待挑选' : 'To review'}</Pill>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {selected && progressOf(selected, now) >= 100 && (() => {
            const picked = selected.variants.filter(v => v.selected && !v.pooled).length;
            const open = selected.variants.filter(v => !v.pooled);
            return (
              <Card>
                <SectionHead title={selected.title} sub={zh ? '勾选要发布的变体，一起送入发布池' : 'Tick the variants to publish'}
                  right={<div className="flex flex-wrap gap-1.5">
                    <SmallButton disabled={!open.length} onClick={() => patchVariants(selected.id, v => (v.pooled ? v : { ...v, selected: picked < open.length }))}>{picked < open.length ? (zh ? '全选' : 'Select all') : (zh ? '取消全选' : 'Clear')}</SmallButton>
                    {selected.variants.some(v => v.pooled) && onOpenPublish && <SmallButton onClick={onOpenPublish}>{zh ? '去发布池' : 'Open pool'}</SmallButton>}
                    <SmallButton primary disabled={!picked} onClick={() => pool(selected)}><Send className="h-3.5 w-3.5" />{zh ? `送入发布池 ${picked}` : `Send ${picked}`}</SmallButton>
                  </div>} />
                <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-4 xl:grid-cols-6">
                  {selected.variants.map(v => (
                    <button key={v.id} type="button" disabled={v.pooled} onClick={() => patchVariants(selected.id, x => (x.id === v.id ? { ...x, selected: !x.selected } : x))} aria-pressed={!!v.selected}
                      className={`group overflow-hidden rounded-xl border text-left transition disabled:cursor-default ${v.selected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200 hover:border-violet-300'}`}>
                      <div className="relative aspect-[3/4] bg-slate-100">
                        <img src={v.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <span className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md border ${v.selected ? 'border-violet-600 bg-violet-600' : 'border-white/80 bg-black/20'}`} style={{ color: '#ffffff' }}>
                          {(v.selected || v.pooled) && <CheckIcon className="h-3.5 w-3.5" />}
                        </span>
                        {v.pooled && <span className="absolute inset-x-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-center text-[10px]" style={{ background: 'rgba(4,120,87,.9)', color: '#ffffff' }}>{zh ? '已入池' : 'In pool'}</span>}
                      </div>
                      <div className="truncate px-2 py-1.5 text-[11px] text-gray-600">{v.label}</div>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })()}
        </>
      )}
      {toast}
    </ToolLayout>
  );
};
