import React, { useState } from 'react';
import { Image as ImageIcon, Loader2, Mic, MicOff, Plus, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import type { Lang } from '../../../translations';
import { ASSET_LABELS, type Asset, type AssetType } from './studioModel';

interface Props {
  lang: Lang;
  assets: Asset[];
  selectedId: string | null;
  propLabel?: { zh: string; en: string };
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Asset>) => void;
  onGenerate: (id: string) => void;
  onGenerateAll: () => void;
  onExtract: () => void;
  onAdd: (type: AssetType) => void;
  onDiscuss: (id: string) => void;
}

type Filter = 'all' | AssetType;

export const AssetsView = ({ lang, assets, selectedId, propLabel, onSelect, onChange, onGenerate, onGenerateAll, onExtract, onAdd, onDiscuss }: Props) => {
  const zh = lang === 'zh';
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const labelOf = (t: AssetType) => (t === 'prop' && propLabel ? propLabel[lang] : ASSET_LABELS[t][lang]);
  const missing = assets.filter(a => a.status === 'missing').length;
  const shown = filter === 'all' ? assets : assets.filter(a => a.type === filter);
  const filters: Array<[Filter, string, number]> = [
    ['all', zh ? '全部' : 'All', assets.length],
    ...(['character', 'scene', 'prop'] as AssetType[]).map(t => [t, labelOf(t), assets.filter(a => a.type === t).length] as [Filter, string, number]),
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5" onClick={() => onSelect(null)}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4" onClick={e => e.stopPropagation()}>
        <div role="tablist" className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {filters.map(([id, label, count]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition ${filter === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {label} <span className="text-gray-400">{count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onExtract} className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />{zh ? '重新提取全剧资产' : 'Re-extract assets'}</button>
          <div className="relative">
            <button type="button" onClick={() => setAddOpen(o => !o)} aria-expanded={addOpen} className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{zh ? '添加资产' : 'Add asset'}</button>
            {addOpen && (
              <div role="menu" className="absolute right-0 top-10 z-10 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                {(['character', 'scene', 'prop'] as AssetType[]).map(t => (
                  <button key={t} type="button" role="menuitem" onClick={() => { onAdd(t); setAddOpen(false); setFilter('all'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">{labelOf(t)}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onGenerateAll} disabled={!missing} className="h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: '#111827', color: '#fff' }}>
            <Sparkles className="w-3.5 h-3.5" />{zh ? '生成全部资产图' : 'Generate all images'}
            {missing > 0 && <span className="rounded-full px-1.5 text-[10px]" style={{ background: 'rgba(255,255,255,.2)' }}>{missing}</span>}
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{zh ? '还没有资产，点“重新提取全剧资产”从剧本里自动提取。' : 'No assets yet — re-extract them from the script.'}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {shown.map(a => {
            const sel = a.id === selectedId;
            const missingImg = a.status === 'missing';
            return (
              <div key={a.id} onClick={e => { e.stopPropagation(); onSelect(a.id); }}
                className="rounded-xl bg-white overflow-hidden cursor-pointer transition border"
                style={{ borderColor: sel ? '#8b5cf6' : missingImg ? '#fecaca' : '#e5e7eb', boxShadow: sel ? '0 0 0 1px #8b5cf6' : undefined }}>
                <div className="relative aspect-[4/3] bg-gray-100">
                  {a.image && <img src={a.image} alt="" className={`w-full h-full object-cover ${a.status === 'generating' ? 'blur-sm' : ''}`} />}
                  {!a.image && a.status !== 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400"><ImageIcon className="w-5 h-5" /><span className="text-[11px]">{zh ? '暂无资产图' : 'No image yet'}</span></div>
                  )}
                  {a.status === 'generating' && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,.5)' }}><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>}
                  <span className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(255,255,255,.92)', color: '#374151' }}>{labelOf(a.type)}</span>
                </div>
                <div className="p-3">
                  {sel ? (
                    <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                      <input value={a.name} onChange={e => onChange(a.id, { name: e.target.value })} aria-label={zh ? '资产名称' : 'Asset name'} className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300" />
                      <textarea value={a.desc} onChange={e => onChange(a.id, { desc: e.target.value })} rows={3} aria-label={zh ? '资产描述' : 'Asset description'} className="w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-purple-300" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5 min-w-0"><span className="text-sm font-bold text-gray-900 truncate">{a.name}</span><span className="text-[11px] text-gray-500 shrink-0">{a.scope}</span></div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2 min-h-[2.5rem]">{a.desc}</p>
                    </>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-[11px] font-semibold" style={{ color: missingImg ? '#dc2626' : a.status === 'generating' ? '#7c3aed' : '#047857' }}>
                      {missingImg ? (zh ? '缺少资产图' : 'Missing image') : a.status === 'generating' ? (zh ? '生成中' : 'Generating') : (zh ? '已确认' : 'Confirmed')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => onDiscuss(a.id)} aria-label={zh ? '和 AI 讨论' : 'Discuss with AI'} title={zh ? '和 AI 讨论' : 'Discuss with AI'} className="w-7 h-7 rounded-full inline-flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#fff' }}><Sparkles className="w-3 h-3" /></button>
                      {a.type === 'character' && (
                        <button type="button" onClick={() => onChange(a.id, { voice: !a.voice })} aria-pressed={!!a.voice}
                          title={a.voice ? (zh ? '已绑定声音' : 'Voice bound') : (zh ? '绑定声音' : 'Bind voice')}
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center border"
                          style={a.voice ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                          {a.voice ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {missingImg ? (
                        <button type="button" onClick={() => onGenerate(a.id)} className="h-7 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1" style={{ background: '#111827', color: '#fff' }}><Wand2 className="w-3 h-3" />{zh ? '生成' : 'Generate'}</button>
                      ) : a.status === 'confirmed' && (
                        <button type="button" onClick={() => onGenerate(a.id)} aria-label={zh ? '重新生成' : 'Regenerate'} title={zh ? '重新生成' : 'Regenerate'} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 inline-flex items-center justify-center"><RefreshCw className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
