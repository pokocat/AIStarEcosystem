/**
 * 素材槽位：商品图 / 角色 / 声音 / 参考视频等。角色和声音默认带上当前 IP，可以换人或不用。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Mic, Plus, User, Video, X } from 'lucide-react';
import { MOCK_ARTISTS } from '../ArtistTypes';
import type { SlotDef } from './sceneData';

export type SlotValue =
  | { type: 'image'; images: string[] }
  | { type: 'character'; artistId: string | null }
  | { type: 'voice'; voice: string | null }
  | { type: 'video'; file: { name: string; url: string } | null };

export const VOICES = [
  { id: 'ip', zh: 'IP 专属声线', en: "IP's own voice" },
  { id: 'warm_f', zh: '温柔女声', en: 'Warm female' },
  { id: 'bright_m', zh: '活力男声', en: 'Upbeat male' },
  { id: 'calm_f', zh: '知性女声', en: 'Calm female' },
  { id: 'narrator', zh: '纪录片旁白', en: 'Documentary narrator' },
];

export const emptySlot = (def: SlotDef, artistId: string): SlotValue => {
  if (def.type === 'character') return { type: 'character', artistId };
  if (def.type === 'voice') return { type: 'voice', voice: 'ip' };
  if (def.type === 'video') return { type: 'video', file: null };
  return { type: 'image', images: [] };
};

export const slotFilled = (v?: SlotValue) =>
  !!v && (v.type === 'image' ? v.images.length > 0 : v.type === 'character' ? !!v.artistId : v.type === 'voice' ? !!v.voice : !!v.file);

const Tile = ({ children, label, sub, onClick, active, compact }: { children: React.ReactNode; label: string; sub?: string; onClick?: () => void; active?: boolean; compact?: boolean }) => (
  <div className={`flex shrink-0 flex-col items-center gap-1 ${compact ? 'w-[52px]' : 'w-[76px]'}`} title={compact && sub ? `${label} · ${sub}` : undefined}>
    <button type="button" onClick={onClick} aria-label={compact ? (sub ? `${label} · ${sub}` : label) : undefined}
      className={`relative grid place-items-center overflow-hidden border transition ${compact ? 'h-[52px] w-[52px] rounded-xl' : 'h-[76px] w-[76px] rounded-2xl'} ${active ? 'border-violet-300 bg-violet-50' : 'border-transparent bg-slate-100 hover:bg-slate-200/70'}`}>
      {children}
    </button>
    <div className="w-full text-center leading-tight">
      <div className={`truncate text-slate-700 ${compact ? 'text-[10px]' : 'text-[12px]'}`}>{label}</div>
      {sub && !compact && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  </div>
);

const AddBadge = () => (
  <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full" style={{ background: '#0f172a', color: '#ffffff' }}>
    <Plus className="h-3 w-3" />
  </span>
);

const RemoveBadge = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <span role="button" tabIndex={0} aria-label={label} onClick={e => { e.stopPropagation(); onClick(); }}
    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onClick(); } }}
    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full" style={{ background: 'rgba(15,23,42,.7)', color: '#ffffff' }}>
    <X className="h-3 w-3" />
  </span>
);

/** Small anchored menu that closes on outside click. */
const Menu = ({ open, onClose, children, up }: { open: boolean; onClose: () => void; children: React.ReactNode; up?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="menu" className={`absolute left-0 z-30 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-xl ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
      {children}
    </div>
  );
};

interface Props {
  zh: boolean;
  def: SlotDef;
  value: SlotValue;
  onChange: (v: SlotValue) => void;
  /** Name of the character picked in this scene, for the voice label. */
  castName?: string;
  registerUrl: (url: string) => void;
  /** Small tiles with upward menus, for the AI 创作 input box. */
  compact?: boolean;
}

export const SlotTile = ({ zh, def, value, onChange, castName, registerUrl, compact }: Props) => {
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const label = zh ? def.label.zh : def.label.en;
  const optional = def.optional ? (zh ? '可选' : 'Optional') : undefined;

  if (value.type === 'image') {
    const max = def.max ?? 1;
    const pick = (files: FileList | null) => {
      if (!files) return;
      const urls = [...files].filter(f => f.type.startsWith('image/')).slice(0, max - value.images.length).map(f => { const u = URL.createObjectURL(f); registerUrl(u); return u; });
      if (urls.length) onChange({ type: 'image', images: [...value.images, ...urls] });
    };
    const sub = max > 1 ? `${value.images.length}/${max}${optional ? ` · ${optional}` : ''}` : optional;
    return (
      <>
        {value.images.map((u, i) => (
          <Tile compact={compact} key={u} label={max > 1 ? (zh ? `图${i + 1}` : `Img ${i + 1}`) : label}>
            <img src={u} alt="" className="h-full w-full object-cover" />
            <RemoveBadge label={zh ? '移除' : 'Remove'} onClick={() => onChange({ type: 'image', images: value.images.filter(x => x !== u) })} />
          </Tile>
        ))}
        {value.images.length < max && (
          <Tile compact={compact} label={label} sub={sub} onClick={() => fileRef.current?.click()}>
            <ImagePlus className={compact ? 'h-4 w-4 text-slate-400' : 'h-6 w-6 text-slate-400'} />
            <AddBadge />
            <input ref={fileRef} type="file" accept="image/*" multiple={max > 1} className="hidden" onChange={e => { pick(e.target.files); e.target.value = ''; }} />
          </Tile>
        )}
      </>
    );
  }

  if (value.type === 'video') {
    return (
      <Tile compact={compact} label={label} sub={value.file ? value.file.name.slice(0, 10) : optional} active={!!value.file} onClick={() => fileRef.current?.click()}>
        <Video className={`h-6 w-6 ${value.file ? 'text-violet-600' : 'text-slate-400'}`} />
        {value.file ? <RemoveBadge label={zh ? '移除' : 'Remove'} onClick={() => onChange({ type: 'video', file: null })} /> : <AddBadge />}
        <input ref={fileRef} type="file" accept="video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { const u = URL.createObjectURL(f); registerUrl(u); onChange({ type: 'video', file: { name: f.name, url: u } }); } e.target.value = ''; }} />
      </Tile>
    );
  }

  if (value.type === 'character') {
    const artist = MOCK_ARTISTS.find(a => a.id === value.artistId);
    return (
      <div className="relative">
        <Tile compact={compact} label={artist ? artist.name : label} sub={artist ? (zh ? '当前角色' : 'Cast') : optional} active={!!artist} onClick={() => setMenu(m => !m)}>
          {artist ? <img src={artist.avatar} alt="" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-slate-400" />}
          {!artist && <AddBadge />}
        </Tile>
        <Menu up={compact} open={menu} onClose={() => setMenu(false)}>
          <div className="px-2 pb-1 pt-1.5 text-[11px] text-slate-400">{zh ? '选择出镜的角色 IP' : 'Pick the on-camera IP'}</div>
          <div className="max-h-56 overflow-y-auto">
            {MOCK_ARTISTS.map(a => (
              <button key={a.id} type="button" role="menuitem" onClick={() => { onChange({ type: 'character', artistId: a.id }); setMenu(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                <img src={a.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="flex-1 truncate">{a.name}</span>
                {a.id === value.artistId && <Check className="h-3.5 w-3.5 text-violet-600" />}
              </button>
            ))}
          </div>
          {def.optional && (
            <button type="button" role="menuitem" onClick={() => { onChange({ type: 'character', artistId: null }); setMenu(false); }}
              className="mt-1 w-full rounded-lg border-t border-gray-100 px-2 py-1.5 text-left text-[13px] text-slate-500 hover:bg-slate-50">
              {zh ? '不用角色出镜' : 'No on-camera character'}
            </button>
          )}
        </Menu>
      </div>
    );
  }

  const voice = VOICES.find(v => v.id === value.voice);
  const voiceName = voice ? (voice.id === 'ip' && castName ? (zh ? `${castName}的声线` : `${castName}'s voice`) : zh ? voice.zh : voice.en) : undefined;
  return (
    <div className="relative">
      <Tile compact={compact} label={label} sub={voiceName ?? optional} active={!!voice} onClick={() => setMenu(m => !m)}>
        <Mic className={`h-6 w-6 ${voice ? 'text-violet-600' : 'text-slate-400'}`} />
        {!voice && <AddBadge />}
      </Tile>
      <Menu up={compact} open={menu} onClose={() => setMenu(false)}>
        {VOICES.map(v => (
          <button key={v.id} type="button" role="menuitem" onClick={() => { onChange({ type: 'voice', voice: v.id }); setMenu(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50">
            <span className="flex-1">{v.id === 'ip' && castName ? (zh ? `${castName}的声线` : `${castName}'s voice`) : zh ? v.zh : v.en}</span>
            {v.id === value.voice && <Check className="h-3.5 w-3.5 text-violet-600" />}
          </button>
        ))}
        <button type="button" role="menuitem" onClick={() => { onChange({ type: 'voice', voice: null }); setMenu(false); }}
          className="mt-1 w-full rounded-lg border-t border-gray-100 px-2 py-1.5 text-left text-[13px] text-slate-500 hover:bg-slate-50">
          {zh ? '不配音（仅字幕与音乐）' : 'No voice-over'}
        </button>
      </Menu>
    </div>
  );
};
