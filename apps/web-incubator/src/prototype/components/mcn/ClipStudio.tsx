/**
 * 真人切片 — 从授权素材（直播回放 / 长视频 / 采访）自动切出短视频，逐条做 6 项强制质检，
 * 不通过的修正后复检，合格切片送入 发布中心 › 发布池。素材和授权跟随当前角色 IP。
 */
import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileVideo, Radio, Scissors, Send, ShieldCheck, Upload, Wrench, XCircle } from 'lucide-react';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { FRAME_POOL } from './director/directorData';
import { addToPool, primeTimeSlot } from './publishPoolStore';
import { spend } from './quickgen/quickgenStore';
import {
  Bar, Card, Chips, Check, Composer, Empty, Field, Pill, RunButton, SectionHead, SmallButton, Stats, ToolLayout,
  progressOf, today, uid, useNow, useStoredList, useToast, type Timed,
} from './batch/kit';

type SourceType = 'live' | 'long' | 'interview' | 'upload';
interface Clip { id: string; title: string; from: string; seconds: number; image: string; failed: number | null; fixed?: boolean; pooled?: boolean }
interface ClipTask extends Timed {
  id: string; title: string; source: SourceType; sourceName: string; topic: string;
  count: number; seconds: number; ratio: string; subtitles: boolean; cost: number; date: string; clips: Clip[];
}

const PRICE_PER_CLIP = 6;
const QC = [
  { zh: '黑屏 / 静音', en: 'Black screen / silence' },
  { zh: '字幕错位', en: 'Subtitle offset' },
  { zh: '画幅异常', en: 'Aspect ratio' },
  { zh: '敏感词', en: 'Sensitive words' },
  { zh: '品牌露出', en: 'Brand exposure' },
  { zh: '授权范围', en: 'License scope' },
];
const HIGHLIGHTS = [
  { zh: '开场钩子', en: 'Hook' }, { zh: '核心卖点', en: 'Key benefit' }, { zh: '观众提问', en: 'Viewer question' }, { zh: '价格讲解', en: 'Pricing' },
  { zh: '现场演示', en: 'Live demo' }, { zh: '情绪高光', en: 'Peak moment' }, { zh: '金句口播', en: 'Quote' }, { zh: '福利放送', en: 'Giveaway' },
];
const SOURCE_META: Record<SourceType, { icon: React.ComponentType<{ className?: string }>; zh: string; en: string; length: string }> = {
  live: { icon: Radio, zh: '直播回放', en: 'Live replay', length: '3:42:18' },
  long: { icon: FileVideo, zh: '长视频', en: 'Long video', length: '28:45' },
  interview: { icon: FileVideo, zh: '采访', en: 'Interview', length: '45:10' },
  upload: { icon: Upload, zh: '本地上传', en: 'Upload', length: '' },
};

const stamp = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** Clips are decided when the task is created, so results are stable across reloads. */
const cutClips = (count: number, seconds: number, topic: string, zh: boolean): Clip[] =>
  Array.from({ length: count }, (_, i) => {
    const h = HIGHLIGHTS[i % HIGHLIGHTS.length];
    return {
      id: uid('clip'), title: `${zh ? h.zh : h.en}${topic ? ` · ${topic}` : ''}`, from: stamp(180 + i * 611 + (i % 3) * 97), seconds,
      image: FRAME_POOL[(i * 3 + 1) % FRAME_POOL.length],
      // Roughly one clip in six trips a check: usually sensitive words, sometimes subtitles.
      failed: i % 6 === 4 ? 3 : i % 9 === 7 ? 1 : null,
    };
  });

export const ClipStudio = ({ lang, activeArtist, onOpenPublish }: { lang: Lang; activeArtist: Artist; onOpenPublish?: () => void }) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => (zh ? v.zh : v.en);
  const name = activeArtist.name;
  const sources: Array<{ type: Exclude<SourceType, 'upload'>; name: string }> = [
    { type: 'live', name: zh ? `${name} 直播回放 · 带货专场` : `${name} live replay · sales special` },
    { type: 'long', name: zh ? `${name} 产品讲解长视频` : `${name} product walkthrough` },
    { type: 'interview', name: zh ? `${name} 年度专访` : `${name} annual interview` },
  ];
  const [tasks, setTasks] = useStoredList<ClipTask>(`ai_batch_clip_v1:${activeArtist.id}`, () => {
    const seed = cutClips(6, 30, zh ? '新品' : 'launch', zh);
    return [{
      id: uid('ct'), title: zh ? `${sources[0].name} · 新品高光` : `${sources[0].name} · launch highlights`, source: 'live', sourceName: sources[0].name, topic: zh ? '新品' : 'launch',
      count: 6, seconds: 30, ratio: '9:16', subtitles: true, cost: 36, date: today(), clips: seed, startedAt: Date.now() - 3_600_000, durationMs: 9000,
    }];
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => tasks[0]?.id ?? null);
  const [source, setSource] = useState<SourceType>('live');
  const [upload, setUpload] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [seconds, setSeconds] = useState(30);
  const [ratio, setRatio] = useState('9:16');
  const [subtitles, setSubtitles] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, say] = useToast();

  const running = tasks.some(x => progressOf(x, Date.now()) < 100);
  const now = useNow(running);
  const selected = tasks.find(x => x.id === selectedId) ?? null;
  const sourceName = source === 'upload' ? upload : sources.find(s => s.type === source)?.name ?? '';
  const cost = count * PRICE_PER_CLIP;

  const start = () => {
    if (!sourceName || !spend(cost)) return;
    const task: ClipTask = {
      id: uid('ct'), title: `${sourceName}${topic.trim() ? ` · ${topic.trim()}` : ''}`, source, sourceName, topic: topic.trim(),
      count, seconds, ratio, subtitles, cost, date: today(), clips: cutClips(count, seconds, topic.trim(), zh),
      startedAt: Date.now(), durationMs: 4000 + count * 450,
    };
    setTasks(list => [task, ...list]);
    setSelectedId(task.id);
    say(zh ? `已开始切片：${count} 条，完成后自动质检` : `Cutting ${count} clips; QC runs automatically`);
  };

  const patchClip = (taskId: string, clipId: string, patch: Partial<Clip>) =>
    setTasks(list => list.map(x => (x.id === taskId ? { ...x, clips: x.clips.map(c => (c.id === clipId ? { ...c, ...patch } : c)) } : x)));
  const passed = (c: Clip) => c.failed === null || !!c.fixed;
  const pool = (task: ClipTask, clips: Clip[]) => {
    clips.forEach(c => addToPool({
      id: c.id, type: 'clip', title: `${c.title} · ${name}`, partnerName: name, platform: 'DY', account: `@${name}`, status: 'pending_review',
      scheduledAt: primeTimeSlot(1), preCheck: { auth: true, watermark: true, quality: true }, duration: `0:${String(c.seconds).padStart(2, '0')}`,
      thumbColor: '#ec4899', thumbImage: c.image, formats: [task.ratio],
    }));
    setTasks(list => list.map(x => (x.id === task.id ? { ...x, clips: x.clips.map(c => (clips.some(p => p.id === c.id) ? { ...c, pooled: true } : c)) } : x)));
    say(zh ? `${clips.length} 条切片已送入发布池，等待审核` : `${clips.length} clips sent to the publish pool`);
  };

  const stats = useMemo(() => {
    const doneTasks = tasks.filter(x => progressOf(x, now) >= 100);
    const all = doneTasks.flatMap(x => x.clips);
    return {
      active: tasks.length - doneTasks.length,
      today: doneTasks.filter(x => x.date === today()).reduce((a, x) => a + x.clips.length, 0),
      rate: all.length ? Math.round((all.filter(c => c.failed === null).length / all.length) * 100) : 0,
      pooled: all.filter(c => c.pooled).length,
    };
  }, [tasks, now]);

  const composer = (
    <Composer icon={Scissors} color="#db2777" title={zh ? '新建切片任务' : 'New clip task'} desc={zh ? `素材与授权跟随当前 IP：${name}` : `Footage and license follow ${name}`}
      footer={<RunButton zh={zh} label={zh ? `开始切片 ${count} 条` : `Cut ${count} clips`} cost={cost} blocked={sourceName ? null : (zh ? '先选择或上传素材' : 'Pick or upload footage')} onClick={start} />}>
      <Field label={zh ? '授权素材' : 'Licensed footage'}>
        <div className="space-y-1.5">
          {sources.map(s => {
            const Icon = SOURCE_META[s.type].icon;
            const on = source === s.type;
            return (
              <button key={s.type} type="button" onClick={() => setSource(s.type)} aria-pressed={on}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${on ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-violet-600' : 'text-gray-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-gray-900">{s.name}</span>
                  <span className="block text-[11px] text-gray-500">{t(SOURCE_META[s.type])} · {SOURCE_META[s.type].length}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => fileRef.current?.click()} aria-pressed={source === 'upload'}
            className={`flex w-full items-center gap-2.5 rounded-xl border border-dashed px-3 py-2 text-left transition ${source === 'upload' ? 'border-violet-300 bg-violet-50' : 'border-gray-300 hover:bg-gray-50'}`}>
            <Upload className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-gray-700">{upload ?? (zh ? '上传本地视频…' : 'Upload a video…')}</span>
          </button>
          <input ref={fileRef} type="file" accept="video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setUpload(f.name.replace(/\.[^.]+$/, '')); setSource('upload'); } e.target.value = ''; }} />
        </div>
        <div className="mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px]" style={{ background: '#ecfdf5', color: '#065f46' }}>
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{zh ? `已匹配授权：《${name} 肖像与切片授权》，覆盖抖音 / 快手 / 小红书，有效期至 2026-12-31` : `License matched: ${name} likeness & clipping, DY / KS / XHS, valid to 2026-12-31`}</span>
        </div>
      </Field>
      <Field label={zh ? '切片主题' : 'Focus'} hint={zh ? '可选' : 'Optional'}>
        <input value={topic} onChange={e => setTopic(e.target.value.slice(0, 20))} placeholder={zh ? '例如：新品手机、福利环节' : 'e.g. new phone, giveaway'}
          className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] text-gray-900 outline-none focus:border-violet-300" />
      </Field>
      <Field label={zh ? '切片数量' : 'Clips'}><Chips options={[[5, '5'], [10, '10'], [20, '20']]} value={count} onChange={setCount} /></Field>
      <Field label={zh ? '单条时长' : 'Length'}><Chips options={[[15, zh ? '15 秒' : '15s'], [30, zh ? '30 秒' : '30s'], [60, zh ? '60 秒' : '60s']]} value={seconds} onChange={setSeconds} /></Field>
      <Field label={zh ? '画幅' : 'Ratio'}><Chips options={[['9:16', zh ? '9:16 竖屏' : '9:16'], ['16:9', zh ? '16:9 横屏' : '16:9'], ['1:1', '1:1']]} value={ratio} onChange={setRatio} /></Field>
      <Check checked={subtitles} onChange={setSubtitles} label={zh ? '自动字幕与重点词高亮' : 'Auto captions with highlights'} />
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-gray-600">
        <div className="mb-1 font-medium text-gray-800">{zh ? '每条切片强制 6 项质检' : '6 mandatory checks per clip'}</div>
        {QC.map(q => t(q)).join(zh ? ' · ' : ' · ')}
      </div>
    </Composer>
  );

  return (
    <ToolLayout composer={composer}>
      <Stats items={[
        { label: zh ? '进行中任务' : 'Active tasks', value: stats.active, tone: '#6d28d9' },
        { label: zh ? '今日切片' : 'Clips today', value: stats.today },
        { label: zh ? '质检一次通过率' : 'First-pass QC', value: `${stats.rate}%`, tone: '#047857' },
        { label: zh ? '已入发布池' : 'In pool', value: stats.pooled, tone: '#db2777' },
      ]} />

      <Card>
        <SectionHead title={zh ? '切片任务' : 'Clip tasks'} sub={zh ? '点一个任务查看切片和质检结果' : 'Open a task to see clips and QC'} />
        <ul className="px-2 pb-2">
          {tasks.map(x => {
            const pct = progressOf(x, now);
            const done = pct >= 100;
            const ok = x.clips.filter(passed).length;
            const pending = x.clips.filter(c => passed(c) && !c.pooled).length;
            return (
              <li key={x.id}>
                <button type="button" onClick={() => setSelectedId(x.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${x.id === selectedId ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  <img src={x.clips[0]?.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-gray-900">{x.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      {done ? <span className="text-[11px] text-gray-500">{x.count}{zh ? ' 条' : ' clips'} · {x.seconds}{zh ? ' 秒' : 's'} · {x.ratio} · {x.date}</span> : <span className="w-40"><Bar pct={pct} /></span>}
                    </span>
                  </span>
                  {!done ? <Pill tone="running">{pct < 70 ? (zh ? '切片中' : 'Cutting') : (zh ? '质检中' : 'QC')} {pct}%</Pill>
                    : pending ? <Pill tone="review">{zh ? `待入池 ${pending}` : `${pending} to pool`}</Pill>
                      : <Pill tone="done">{zh ? `合格 ${ok}/${x.count}` : `${ok}/${x.count} passed`}</Pill>}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selected && (() => {
        const pct = progressOf(selected, now);
        if (pct < 100) {
          return (
            <Card className="p-4">
              <div className="flex items-center justify-between text-[13px] font-medium text-gray-900"><span className="truncate">{selected.title}</span><span className="text-violet-700">{pct}%</span></div>
              <div className="mt-2"><Bar pct={pct} /></div>
              <p className="mt-2 text-[12px] text-gray-500">{pct < 70 ? (zh ? '正在识别高光片段、对齐字幕…' : 'Finding highlights and aligning captions…') : (zh ? '正在逐条跑 6 项质检…' : 'Running the 6 checks on every clip…')}</p>
            </Card>
          );
        }
        const ready = selected.clips.filter(c => passed(c) && !c.pooled);
        return (
          <Card>
            <SectionHead title={selected.title} sub={zh ? `${selected.clips.length} 条切片 · 合格 ${selected.clips.filter(passed).length} 条` : `${selected.clips.length} clips · ${selected.clips.filter(passed).length} passed`}
              right={<div className="flex gap-1.5">
                {selected.clips.some(c => c.pooled) && onOpenPublish && <SmallButton onClick={onOpenPublish}>{zh ? '去发布池' : 'Open pool'}</SmallButton>}
                <SmallButton primary disabled={!ready.length} onClick={() => pool(selected, ready)}><Send className="h-3.5 w-3.5" />{zh ? `合格切片入池 ${ready.length}` : `Send ${ready.length} to pool`}</SmallButton>
              </div>} />
            <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 xl:grid-cols-4">
              {selected.clips.map(c => {
                const ok = passed(c);
                return (
                  <article key={c.id} className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="relative bg-slate-100" style={{ aspectRatio: selected.ratio === '16:9' ? '16 / 9' : selected.ratio === '1:1' ? '1 / 1' : '3 / 4' }}>
                      <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(15,23,42,.7)', color: '#ffffff' }}>0:{String(c.seconds).padStart(2, '0')}</span>
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(15,23,42,.7)', color: '#ffffff' }}><Clock className="h-2.5 w-2.5" />{c.from}</span>
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-[12px] font-medium text-gray-900" title={c.title}>{c.title}</div>
                      <div className="mt-1.5 flex gap-1" aria-label={zh ? '质检结果' : 'QC results'}>
                        {QC.map((q, i) => {
                          const bad = c.failed === i && !c.fixed;
                          return <span key={i} title={`${t(q)}：${bad ? (zh ? '未通过' : 'failed') : (zh ? '通过' : 'passed')}`} className={`h-1.5 flex-1 rounded-full ${bad ? 'bg-red-500' : 'bg-emerald-500'}`} />;
                        })}
                      </div>
                      {!ok && c.failed !== null && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600"><XCircle className="h-3 w-3" />{t(QC[c.failed])}{zh ? '未通过' : ' failed'}</div>
                      )}
                      {c.fixed && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3 w-3" />{zh ? '已修正，复检通过' : 'Fixed, re-check passed'}</div>}
                      <div className="mt-2">
                        {c.pooled ? <Pill tone="done">{zh ? '已入池' : 'In pool'}</Pill>
                          : ok ? <SmallButton onClick={() => pool(selected, [c])}><Send className="h-3.5 w-3.5" />{zh ? '入池' : 'To pool'}</SmallButton>
                            : <SmallButton onClick={() => { patchClip(selected.id, c.id, { fixed: true }); say(zh ? (c.failed === 3 ? '已替换风险词并复检通过' : '已重新对齐字幕并复检通过') : 'Fixed and re-checked'); }}>
                              <Wrench className="h-3.5 w-3.5" />{c.failed === 3 ? (zh ? '替换风险词并复检' : 'Replace words & re-check') : (zh ? '重新对齐字幕' : 'Re-align captions')}
                            </SmallButton>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        );
      })()}
      {!tasks.length && <Card><Empty icon={AlertTriangle} title={zh ? '还没有切片任务' : 'No clip tasks yet'} desc={zh ? '在左侧选择素材，开始第一个切片任务' : 'Pick footage on the left to start'} /></Card>}
      {toast}
    </ToolLayout>
  );
};
