import React from 'react';
import { Clapperboard, Film, Music, Trash2, Wand2 } from 'lucide-react';
import type { Lang } from '../../../translations';
import {
  CAMERA_MOVES, GENRES, KIND_META, MOODS, RATIOS, SHOT_SIZES, STYLES, VOICE_STYLES, fmtDuration, isGeneratable,
  type CanvasNode, type ProjectMode, type Ratio,
} from './directorData';

interface Props {
  lang: Lang;
  nodes: CanvasNode[];
  selected?: CanvasNode;
  mode: ProjectMode;
  template: string;
  formats: string[];
  deliverables: string[];
  style: string;
  ratio: Ratio;
  onToggleFormat: (f: string) => void;
  onStyle: (id: string) => void;
  onRatio: (r: Ratio) => void;
  onChange: (id: string, patch: Partial<CanvasNode>) => void;
  onGenerate: (id: string) => void;
  onGenerateAll: () => void;
  onDelete: (id: string) => void;
  className?: string;
}

const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[11px] font-medium text-gray-500 mb-1.5">{children}</div>;

const Chips = ({ options, value, onPick, lang, color }: { options: Array<{ id: string; label: { zh: string; en: string } }>; value?: string | string[]; onPick: (v: string) => void; lang: Lang; color: string }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(o => {
      const active = Array.isArray(value) ? value.includes(o.id) : o.id === value;
      return (
        <button key={o.id} type="button" onClick={() => onPick(o.id)} aria-pressed={active}
          className="rounded-lg px-2.5 py-1 text-xs border transition"
          style={active ? { background: `${color}14`, borderColor: color, color } : { borderColor: '#e5e7eb', color: '#4b5563' }}>
          {o.label[lang]}
        </button>
      );
    })}
  </div>
);

const Slider = ({ label, value, min, max, step = 1, color, format, onChange }: { label: string; value: number; min: number; max: number; step?: number; color: string; format: (v: number) => string; onChange: (v: number) => void }) => (
  <div>
    <div className="flex items-center justify-between"><Label>{label}</Label><span className="text-xs font-mono text-gray-700">{format(value)}</span></div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full" style={{ accentColor: color }} />
  </div>
);

export const DirectorInspector = (props: Props) => {
  const { lang, nodes, selected, mode, template, formats, deliverables, style, ratio, onToggleFormat, onStyle, onRatio, onChange, onGenerate, onGenerateAll, onDelete, className = '' } = props;
  const zh = lang === 'zh';
  const parts = nodes.filter(isGeneratable);
  const pending = parts.filter(n => n.status === 'idle').length;
  const shots = nodes.filter(n => n.kind === 'shot');

  if (!selected) {
    const stats: Array<[string | number, string]> = mode === 'music'
      ? [[fmtDuration(nodes.find(n => n.kind === 'audio')?.duration), zh ? '歌曲时长' : 'Length'], [shots.length, zh ? 'MV 镜头' : 'MV shots'], [pending, zh ? '待生成' : 'Pending']]
      : [[shots.length, zh ? '镜头' : 'Shots'], [`${shots.reduce((a, s) => a + (s.duration || 0), 0)}s`, zh ? '总时长' : 'Length'], [pending, zh ? '待生成' : 'Pending']];
    return (
      <section className={`bg-white overflow-y-auto p-4 space-y-5 ${className}`}>
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {mode === 'music' ? <Music className="w-4 h-4 text-pink-500" /> : <Film className="w-4 h-4 text-purple-500" />}
            {zh ? '项目设置' : 'Project'}
          </div>
          <p className="text-xs text-gray-500 mt-1">{zh ? `模板：${template} · 选中节点可编辑参数` : `Template: ${template} · select a node to edit it`}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([v, k]) => (
            <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-center">
              <div className="text-lg font-bold text-gray-900">{v}</div>
              <div className="text-[10px] text-gray-500">{k}</div>
            </div>
          ))}
        </div>
        <div>
          <Label>{zh ? '交付格式（可多选）' : 'Deliverables (multi-select)'}</Label>
          <Chips options={formats.map(f => ({ id: f, label: { zh: f, en: f } }))} value={deliverables} onPick={onToggleFormat} lang={lang} color="#06b6d4" />
        </div>
        {(mode === 'video' || shots.length > 0) && (
          <>
            <div><Label>{zh ? '画面风格' : 'Visual style'}</Label><Chips options={STYLES} value={style} onPick={onStyle} lang={lang} color="#8b5cf6" /></div>
            <div><Label>{zh ? '画幅比例' : 'Aspect ratio'}</Label><Chips options={RATIOS.map(r => ({ id: r, label: { zh: r, en: r } }))} value={ratio} onPick={v => onRatio(v as Ratio)} lang={lang} color="#06b6d4" /></div>
          </>
        )}
        <button type="button" onClick={onGenerateAll} disabled={!pending}
          className="w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
          <Wand2 className="w-4 h-4" />{pending ? (zh ? `生成全部（${pending}）` : `Generate all (${pending})`) : (zh ? '全部内容已就绪' : 'Everything ready')}
        </button>
      </section>
    );
  }

  const meta = KIND_META[selected.kind];
  const set = (patch: Partial<CanvasNode>) => onChange(selected.id, patch);
  const regenLabel = selected.status === 'generating' ? (zh ? '生成中…' : 'Generating…')
    : selected.kind === 'lyrics' ? (zh ? 'AI 重写歌词' : 'Rewrite with AI')
    : selected.kind === 'vocal' ? (selected.status === 'done' ? (zh ? '按新参数重新演唱' : 'Re-sing') : (zh ? '开始演唱' : 'Sing'))
    : selected.status === 'done' ? (zh ? '按新参数重新生成' : 'Regenerate') : (zh ? 'AI 生成' : 'Generate');

  return (
    <section className={`bg-white overflow-y-auto p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: meta.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />{selected.badge ?? meta.label[lang]}
        </span>
        {selected.kind !== 'output' && (
          <button type="button" onClick={() => onDelete(selected.id)} className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" />{zh ? '删除' : 'Delete'}</button>
        )}
      </div>

      {selected.kind === 'shot' && selected.image && <img src={selected.image} alt="" className="w-full aspect-video rounded-xl object-cover" />}

      <div>
        <Label>{zh ? '名称' : 'Title'}</Label>
        <input value={selected.title} onChange={e => set({ title: e.target.value })}
          className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-purple-300" />
      </div>
      <div>
        <Label>{selected.kind === 'lyrics' ? (zh ? '歌词（[段落] 单独一行）' : 'Lyrics ([Section] on its own line)') : selected.kind === 'product' || selected.kind === 'knowledge' ? (zh ? '资料（每行“标签：内容”）' : 'Notes (one "label: value" per line)') : selected.kind === 'shot' ? (zh ? '画面提示词' : 'Shot prompt') : (zh ? '描述' : 'Description')}</Label>
        <textarea value={selected.prompt} onChange={e => set({ prompt: e.target.value })} rows={selected.kind === 'lyrics' || selected.kind === 'product' || selected.kind === 'knowledge' ? 8 : 4}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 leading-relaxed outline-none focus:border-purple-300 resize-none" />
      </div>

      {selected.kind === 'shot' && (
        <>
          <div><Label>{zh ? '景别' : 'Shot size'}</Label><Chips options={SHOT_SIZES} value={selected.shotSize} onPick={v => set({ shotSize: v as CanvasNode['shotSize'] })} lang={lang} color={meta.color} /></div>
          <div><Label>{zh ? '运镜' : 'Camera'}</Label><Chips options={CAMERA_MOVES} value={selected.camera} onPick={v => set({ camera: v as CanvasNode['camera'] })} lang={lang} color={meta.color} /></div>
          <Slider label={zh ? '时长' : 'Duration'} value={selected.duration ?? 3} min={1} max={10} color={meta.color} format={v => `${v}s`} onChange={v => set({ duration: v })} />
        </>
      )}
      {selected.kind === 'audio' && (
        <>
          <div><Label>{zh ? '曲风' : 'Genre'}</Label><Chips options={GENRES} value={selected.genre} onPick={v => set({ genre: v })} lang={lang} color={meta.color} /></div>
          <div><Label>{zh ? '情绪' : 'Mood'}</Label><Chips options={MOODS} value={selected.mood} onPick={v => set({ mood: v })} lang={lang} color={meta.color} /></div>
          <Slider label="BPM" value={selected.bpm ?? 96} min={60} max={180} color={meta.color} format={v => String(v)} onChange={v => set({ bpm: v })} />
          <Slider label={zh ? '时长' : 'Length'} value={selected.duration ?? 180} min={15} max={300} step={5} color={meta.color} format={fmtDuration} onChange={v => set({ duration: v })} />
        </>
      )}
      {selected.kind === 'vocal' && (
        <div><Label>{zh ? '演唱音色' : 'Voice style'}</Label><Chips options={VOICE_STYLES} value={selected.voiceStyle} onPick={v => set({ voiceStyle: v })} lang={lang} color={meta.color} /></div>
      )}

      {(selected.kind === 'shot' || selected.kind === 'audio' || selected.kind === 'vocal' || selected.kind === 'lyrics') && (
        <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-white border-t border-gray-100">
          <button type="button" onClick={() => onGenerate(selected.id)} disabled={selected.status === 'generating'}
            className="w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: meta.color, color: '#fff' }}>
            <Wand2 className="w-4 h-4" />{regenLabel}
          </button>
        </div>
      )}
      {selected.kind === 'output' && (
        <div className="space-y-3">
          <div>
            <Label>{zh ? '交付格式' : 'Deliverables'}</Label>
            <Chips options={formats.map(f => ({ id: f, label: { zh: f, en: f } }))} value={deliverables} onPick={onToggleFormat} lang={lang} color={meta.color} />
          </div>
          <p className="text-xs text-gray-500 flex items-start gap-1.5"><Clapperboard className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {mode === 'music' ? (zh ? '会把编曲与人声混音、做母带处理，并按勾选的格式分别导出。' : 'Mixes arrangement and vocals, masters the track and exports every selected format.')
              : (zh ? '成片会按时间线顺序拼接所有镜头，并混入配乐与字幕。' : 'The final cut stitches shots in timeline order with music and captions.')}
          </p>
        </div>
      )}
    </section>
  );
};
