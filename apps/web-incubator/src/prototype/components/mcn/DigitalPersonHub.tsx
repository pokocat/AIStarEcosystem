/**
 * AI 数字人 — 用已授权的形象模型 + 声音模型，驱动已过审的文案生成口播视频，生成后做质量审核，
 * 合格的送入 发布中心 › 发布池。模型、授权和文案跟随当前角色 IP；冻结或待审的不能使用。
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Cpu, FileText, Lock, Mic, RefreshCw, Send, ShieldCheck, Sparkles, User, Wand2 } from 'lucide-react';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { addToPool, primeTimeSlot } from './publishPoolStore';
import { spend } from './quickgen/quickgenStore';
import { PRICE } from './director/pricing';
import { demoImage } from './quickgen/sceneData';
import {
  Bar, Card, Check, Chips, Composer, Empty, Field, Pill, RunButton, SectionHead, SmallButton, Stats, ToolLayout,
  progressOf, today, uid, useNow, useStoredList, useToast, type Timed,
} from './batch/kit';

type ModelState = 'active' | 'review' | 'frozen';
interface Model { id: string; kind: 'look' | 'voice'; name: string; state: ModelState; quality: number; license: string; note: { zh: string; en: string } }
interface Copy { id: string; title: string; excerpt: string; seconds: number; approved: boolean }
interface Job extends Timed {
  id: string; look: string; voice: string; copy: string; seconds: number; ratio: string; scene: string; captions: boolean;
  cost: number; date: string; score: number; issue: boolean; fixed?: boolean; pooled?: boolean;
}

// Backdrops reuse photography already in the AI 视频 scene library.
const SCENES = [
  { id: 'studio', zh: '演播室', en: 'Studio', image: demoImage('backdrop-studio') },
  { id: 'store', zh: '门店', en: 'Store', image: demoImage('backdrop-store') },
  { id: 'home', zh: '居家', en: 'Home', image: demoImage('backdrop-home') },
];
const LIP_FIX_PRICE = 40;

const modelsFor = (name: string, zh: boolean): Model[] => [
  { id: 'look-std', kind: 'look', name: zh ? `${name} 标准形象 V3` : `${name} standard look V3`, state: 'active', quality: 94, license: zh ? '形象授权 · 至 2026-12-31' : 'Likeness license · to 2026-12-31', note: { zh: '日常 · 商务', en: 'Everyday · business' } },
  { id: 'look-talk', kind: 'look', name: zh ? `${name} 讲解形象 V1` : `${name} presenter look V1`, state: 'review', quality: 78, license: zh ? '形象授权 · 至 2026-12-31' : 'Likeness license · to 2026-12-31', note: { zh: '模型审核中，暂不能生成', en: 'In review, not usable yet' } },
  { id: 'voice-ip', kind: 'voice', name: zh ? `${name} 专属声线` : `${name}'s own voice`, state: 'active', quality: 97, license: zh ? '音色授权 · 至 2026-12-31' : 'Voice license · to 2026-12-31', note: { zh: '普通话 · 亲切', en: 'Mandarin · warm' } },
  { id: 'voice-calm', kind: 'voice', name: zh ? '平台声线 · 知性女声' : 'Platform voice · calm female', state: 'active', quality: 92, license: zh ? '平台自有，无需授权' : 'Platform-owned', note: { zh: '通用旁白', en: 'General narration' } },
  { id: 'voice-variety', kind: 'voice', name: zh ? `${name} 综艺声线 V1.5` : `${name} variety voice V1.5`, state: 'frozen', quality: 82, license: zh ? '授权已过期，待续签' : 'License expired', note: { zh: '授权过期，已冻结', en: 'Frozen: license expired' } },
];
const copiesFor = (name: string, zh: boolean): Copy[] => [
  { id: 'c1', title: zh ? `${name} 新品口播` : `${name} launch talk`, excerpt: zh ? '大家好，今天给你们看一个我自己用了一个月的好东西…' : "Hi all, here's something I've used for a month…", seconds: 60, approved: true },
  { id: 'c2', title: zh ? `${name} 日常分享` : `${name} daily share`, excerpt: zh ? '今天想和你们聊聊，我是怎么安排一天的…' : "Let me tell you how I plan my day…", seconds: 30, approved: true },
  { id: 'c3', title: zh ? `${name} 知识讲解` : `${name} explainer`, excerpt: zh ? '很多人问我这个问题，今天一次讲清楚…' : 'People keep asking me this, so here it is…', seconds: 90, approved: true },
  { id: 'c4', title: zh ? `${name} 大促口播（含价格）` : `${name} sale talk (with prices)`, excerpt: zh ? '今晚八点，全场直降…' : 'Tonight at 8, everything drops…', seconds: 45, approved: false },
];

export const DigitalPersonHub = ({ lang, activeArtist, onOpenPublish }: { lang: Lang; activeArtist: Artist; onOpenPublish?: () => void }) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => (zh ? v.zh : v.en);
  const name = activeArtist.name;
  const models = useMemo(() => modelsFor(name, zh), [name, zh]);
  const copies = useMemo(() => copiesFor(name, zh), [name, zh]);
  const [jobs, setJobs] = useStoredList<Job>(`ai_batch_dh_v1:${activeArtist.id}`, () => [{
    id: uid('dh'), look: 'look-std', voice: 'voice-ip', copy: 'c2', seconds: 30, ratio: '9:16', scene: 'studio', captions: true,
    cost: PRICE.video(30), date: today(), score: 85, issue: true, startedAt: Date.now() - 3_600_000, durationMs: 8000,
  }]);
  const [tab, setTab] = useState<'jobs' | 'models'>('jobs');
  const [look, setLook] = useState('look-std');
  const [voice, setVoice] = useState('voice-ip');
  const [copy, setCopy] = useState('c1');
  const [ratio, setRatio] = useState('9:16');
  const [scene, setScene] = useState('studio');
  const [captions, setCaptions] = useState(true);
  const [toast, say] = useToast();

  const running = jobs.some(j => progressOf(j, Date.now()) < 100);
  const now = useNow(running);
  const chosenCopy = copies.find(c => c.id === copy);
  const seconds = chosenCopy?.seconds ?? 30;
  const cost = PRICE.video(seconds);
  const usable = (id: string) => models.find(m => m.id === id)?.state === 'active';
  const blocked = !usable(look) ? (zh ? '这个形象模型现在不能用' : 'This look is not usable')
    : !usable(voice) ? (zh ? '这个声音模型现在不能用' : 'This voice is not usable')
      : !chosenCopy?.approved ? (zh ? '只能使用已过审的文案' : 'Only approved copy can be used') : null;

  const run = (cfg: Pick<Job, 'look' | 'voice' | 'copy' | 'seconds' | 'ratio' | 'scene' | 'captions'>) => {
    const c = PRICE.video(cfg.seconds);
    if (!spend(c)) { say(zh ? '星币不足' : 'Not enough credits'); return; }
    const n = jobs.length;
    // Simulated QC: most renders pass, roughly one in three needs a lip-sync touch-up.
    const job: Job = { ...cfg, id: uid('dh'), cost: c, date: today(), score: 86 + ((n * 7) % 10), issue: n % 3 === 1, startedAt: Date.now(), durationMs: 5000 + cfg.seconds * 60 };
    if (job.issue) job.score = 80 + (n % 5);
    setJobs(list => [job, ...list]);
    setTab('jobs');
    say(zh ? '开始生成，完成后自动做质量审核' : 'Rendering; quality review runs when done');
  };
  const patch = (id: string, p: Partial<Job>) => setJobs(list => list.map(j => (j.id === id ? { ...j, ...p } : j)));
  const ok = (j: Job) => !j.issue || !!j.fixed;
  const pool = (j: Job) => {
    const c = copies.find(x => x.id === j.copy);
    addToPool({
      id: j.id, type: 'digital_person', title: `${c?.title ?? ''} · ${zh ? '数字人' : 'digital human'}`, partnerName: name, platform: 'DY', account: `@${name}`,
      status: 'pending_review', scheduledAt: primeTimeSlot(1), preCheck: { auth: true, watermark: true, quality: true },
      duration: `${Math.floor(j.seconds / 60)}:${String(j.seconds % 60).padStart(2, '0')}`, thumbColor: '#10b981', thumbImage: activeArtist.avatar, formats: [j.ratio],
    });
    patch(j.id, { pooled: true });
    say(zh ? '已送审，在 发布中心 › 发布池 等待审核' : 'Sent to the publish pool');
  };

  const stats = useMemo(() => {
    const done = jobs.filter(j => progressOf(j, now) >= 100);
    return {
      running: jobs.length - done.length,
      today: done.filter(j => j.date === today()).length,
      score: done.length ? Math.round(done.reduce((a, j) => a + (j.fixed ? Math.max(j.score, 90) : j.score), 0) / done.length) : 0,
      pooled: done.filter(j => j.pooled).length,
    };
  }, [jobs, now]);

  // A plain render function (not a component) so rows are not remounted on every progress tick.
  const modelRow = (m: Model, on: boolean, onPick: () => void) => (
    <button key={m.id} type="button" onClick={onPick} disabled={m.state !== 'active'} aria-pressed={on}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${on ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
      {m.kind === 'look' ? <img src={activeArtist.avatar} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Mic className="h-4 w-4" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-gray-900">{m.name}</span>
        <span className="block truncate text-[11px] text-gray-500">{t(m.note)}</span>
      </span>
      {m.state === 'frozen' ? <Lock className="h-3.5 w-3.5 shrink-0 text-red-500" /> : m.state === 'review' ? <Pill tone="review">{zh ? '审核中' : 'Review'}</Pill> : <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{m.quality}</span>}
    </button>
  );

  const composer = (
    <Composer icon={User} color="#059669" title={zh ? '新建数字人视频' : 'New digital-human video'} desc={zh ? `形象、声音与文案跟随当前 IP：${name}` : `Look, voice and copy follow ${name}`}
      footer={<RunButton zh={zh} label={zh ? `生成 ${seconds} 秒口播` : `Render ${seconds}s`} cost={cost} blocked={blocked} onClick={() => run({ look, voice, copy, seconds, ratio, scene, captions })} />}>
      <Field label={zh ? '形象模型' : 'Look'}><div className="space-y-1.5">{models.filter(m => m.kind === 'look').map(m => modelRow(m, look === m.id, () => setLook(m.id)))}</div></Field>
      <Field label={zh ? '声音模型' : 'Voice'}><div className="space-y-1.5">{models.filter(m => m.kind === 'voice').map(m => modelRow(m, voice === m.id, () => setVoice(m.id)))}</div></Field>
      <Field label={zh ? '文案' : 'Copy'} hint={zh ? '只能用已过审文案' : 'Approved copy only'}>
        <div className="space-y-1.5">
          {copies.map(c => (
            <button key={c.id} type="button" onClick={() => setCopy(c.id)} disabled={!c.approved} aria-pressed={copy === c.id}
              className={`w-full rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${copy === c.id ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">{c.title}</span>
                <span className="shrink-0 text-[11px] text-gray-400">{c.seconds}{zh ? ' 秒' : 's'}</span>
              </span>
              <span className="mt-0.5 block truncate pl-5 text-[11px] text-gray-500">{c.approved ? c.excerpt : (zh ? '待法务终审，暂不能使用' : 'Awaiting legal review')}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={zh ? '背景' : 'Background'}><Chips options={SCENES.map(s => [s.id, t(s)] as [string, string])} value={scene} onChange={setScene} /></Field>
      <Field label={zh ? '画幅' : 'Ratio'}><Chips options={[['9:16', '9:16'], ['16:9', '16:9'], ['1:1', '1:1']]} value={ratio} onChange={setRatio} /></Field>
      <Check checked={captions} onChange={setCaptions} label={zh ? '自动字幕' : 'Auto captions'} />
    </Composer>
  );

  return (
    <ToolLayout composer={composer}>
      <Stats items={[
        { label: zh ? '生成中' : 'Rendering', value: stats.running, tone: '#6d28d9' },
        { label: zh ? '今日生成' : 'Today', value: stats.today },
        { label: zh ? '平均质量分' : 'Avg. quality', value: stats.score || '-', tone: '#047857' },
        { label: zh ? '已入发布池' : 'In pool', value: stats.pooled, tone: '#059669' },
      ]} />
      <Card>
        <SectionHead title={tab === 'jobs' ? (zh ? '生成任务' : 'Renders') : (zh ? '模型库' : 'Models')}
          right={<div role="tablist" className="flex rounded-lg bg-gray-100 p-0.5">
            {([['jobs', zh ? '生成任务' : 'Renders'], ['models', zh ? '模型库' : 'Models']] as const).map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`h-7 rounded-md px-2.5 text-[12px] font-medium ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>} />
        {tab === 'jobs' ? (
          jobs.length === 0 ? <Empty icon={Sparkles} title={zh ? '还没有生成任务' : 'No renders yet'} desc={zh ? '在左侧选好形象、声音和文案开始生成' : 'Pick a look, voice and copy on the left'} /> : (
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map(j => {
                const pct = progressOf(j, now);
                const done = pct >= 100;
                const bg = SCENES.find(s => s.id === j.scene) ?? SCENES[0];
                const c = copies.find(x => x.id === j.copy);
                return (
                  <article key={j.id} className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="relative bg-slate-100" style={{ aspectRatio: j.ratio === '16:9' ? '16 / 9' : j.ratio === '1:1' ? '1 / 1' : '4 / 5' }}>
                      <img src={bg.image} alt="" className={`h-full w-full object-cover ${done ? '' : 'blur-[2px]'}`} />
                      <img src={activeArtist.avatar} alt="" className="absolute bottom-0 left-1/2 h-3/4 -translate-x-1/2 rounded-t-[40%] object-cover shadow-xl" style={{ aspectRatio: '3 / 4' }} />
                      {!done && <div className="absolute inset-x-3 bottom-3 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,.88)' }}>
                        <div className="flex justify-between text-[11px] font-medium text-gray-800"><span>{pct < 60 ? (zh ? '驱动口型与表情' : 'Driving lips & face') : (zh ? '合成声音与字幕' : 'Mixing voice & captions')}</span><span>{pct}%</span></div>
                        <div className="mt-1"><Bar pct={pct} /></div>
                      </div>}
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-gray-900">{c?.title}</div>
                          <div className="text-[11px] text-gray-500">{j.seconds}{zh ? ' 秒' : 's'} · {j.ratio} · {t(bg)} · ⬡{j.cost}</div>
                        </div>
                        {done && <span className="shrink-0 text-right"><span className="block text-[18px] font-bold tabular-nums" style={{ color: ok(j) ? '#047857' : '#b45309' }}>{j.fixed ? Math.max(j.score, 90) : j.score}</span><span className="block text-[10px] text-gray-400">{zh ? '质量分' : 'Quality'}</span></span>}
                      </div>
                      {done && j.issue && !j.fixed && <div className="rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: '#fffbeb', color: '#92400e' }}>{zh ? '口型同步度偏低，建议精修后再发布' : 'Lip sync is a bit off; touch up before publishing'}</div>}
                      {done && (
                        <div className="flex flex-wrap gap-1.5">
                          {j.pooled ? <><Pill tone="done">{zh ? '已送审' : 'In pool'}</Pill>{onOpenPublish && <SmallButton onClick={onOpenPublish}>{zh ? '去发布池' : 'Open pool'}</SmallButton>}</>
                            : ok(j) ? <SmallButton primary onClick={() => pool(j)}><Send className="h-3.5 w-3.5" />{zh ? '送审发布' : 'Publish'}</SmallButton>
                              : <SmallButton onClick={() => { if (spend(LIP_FIX_PRICE)) { patch(j.id, { fixed: true }); say(zh ? '口型精修完成，复审通过' : 'Lip sync fixed'); } else say(zh ? '星币不足' : 'Not enough credits'); }}>
                                <Wand2 className="h-3.5 w-3.5" />{zh ? '口型精修' : 'Fix lip sync'} ⬡{LIP_FIX_PRICE}
                              </SmallButton>}
                          <SmallButton onClick={() => run(j)} title={zh ? '用同样设置再生成一条' : 'Render again with the same settings'}><RefreshCw className="h-3.5 w-3.5" />{zh ? '再来一条' : 'Again'}</SmallButton>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {models.map(m => (
              <div key={m.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2.5">
                  {m.kind === 'look' ? <img src={activeArtist.avatar} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><Mic className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-gray-900">{m.name}</div>
                    <div className="text-[11px] text-gray-500">{m.kind === 'look' ? (zh ? '形象' : 'Look') : (zh ? '声音' : 'Voice')} · {zh ? '质量' : 'Quality'} {m.quality}</div>
                  </div>
                  {m.state === 'active' ? <Pill tone="done">{zh ? '可用' : 'Active'}</Pill> : m.state === 'review' ? <Pill tone="review">{zh ? '审核中' : 'Review'}</Pill> : <Pill tone="failed">{zh ? '已冻结' : 'Frozen'}</Pill>}
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${m.state === 'frozen' ? 'text-red-600' : 'text-gray-500'}`}>
                  {m.state === 'frozen' ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3 text-emerald-600" />}{m.license}
                </div>
                <div className="mt-2.5">
                  <SmallButton disabled={m.state !== 'active'} onClick={() => { if (m.kind === 'look') setLook(m.id); else setVoice(m.id); say(zh ? `已选用 ${m.name}` : `Using ${m.name}`); }}>
                    {(m.kind === 'look' ? look : voice) === m.id ? <><CheckCircle2 className="h-3.5 w-3.5" />{zh ? '使用中' : 'In use'}</> : <><Cpu className="h-3.5 w-3.5" />{zh ? '用这个模型' : 'Use this'}</>}
                  </SmallButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {toast}
    </ToolLayout>
  );
};
