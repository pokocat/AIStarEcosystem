"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, Skeleton } from 'antd';
import { FileText, Image, Library, Music2, Paperclip, Upload, Video, X } from 'lucide-react';
import type { IpSavedAsset } from '@ai-star-eco/types';
import { listSavedAssets } from '@/canvas-bridge/saved-assets';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { ATTACHMENT_ACCEPT } from '@/canvas-bridge/studio-attachments';
import { studioOverlayContainer } from './studio-overlay';
const names = { text: '文字', image: '图片', video: '视频', audio: '音频' };
const icons = { text: FileText, image: Image, video: Video, audio: Music2 };
export function StudioAttachmentPicker({ locked, reading, onFiles, onAssets }: {
  locked: boolean; reading: boolean; onFiles: (files: File[]) => void; onAssets: (assets: IpSavedAsset[]) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null), epoch = useRef(0);
  const [open, setOpen] = useState(false), [assets, setAssets] = useState<IpSavedAsset[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [keyword, setKeyword] = useState(''), [kind, setKind] = useState('all'), [selected, setSelected] = useState<string[]>([]), [page, setPage] = useState(1);
  const load = async () => {
    const request = ++epoch.current; setLoading(true); setError('');
    try { const list = await listSavedAssets(); if (request === epoch.current) { setAssets(list); setSelected(ids => ids.filter(id => list.some(a => a.id === id))); } }
    catch (e) { if (request === epoch.current) setError(e instanceof Error ? e.message : '素材库加载失败，请重试'); }
    finally { if (request === epoch.current) setLoading(false); }
  };
  useEffect(() => () => { epoch.current++; }, []);
  const filtered = assets.filter(a => (kind === 'all' || a.kind === kind) && (!keyword.trim() || a.title.toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 6)), current = Math.min(page, pages);
  const insert = async () => { await onAssets(assets.filter(a => selected.includes(a.id))); setSelected([]); setOpen(false); };
  return <>
    <Dropdown trigger={['click']} disabled={locked} getPopupContainer={studioOverlayContainer} menu={{ items: [
      { key: 'upload', label: '本地上传', icon: <Upload size={16}/> }, { key: 'library', label: '素材库添加', icon: <Library size={16}/> }
    ], onClick: ({ key }) => { if (key === 'upload') input.current?.click(); else { setOpen(true); void load(); } } }}>
      <Button icon={<Paperclip size={16}/>} loading={reading} disabled={locked}>{reading ? '正在导入附件' : '添加附件'}</Button>
    </Dropdown>
    <input ref={input} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden aria-label="上传创作附件" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) onFiles(files); }}/>
    {open && <section className="studio-attachment-library" aria-label="助手素材库">
      <header><strong>素材库添加</strong><Button type="text" icon={<X size={16}/>} aria-label="关闭助手素材库" disabled={locked} onClick={() => setOpen(false)}/></header>
      <p className="studio-helper-note">选择已保存的画布素材，添加后进入本次引用。</p>
      <Input aria-label="搜索助手素材库" placeholder="搜索素材名称" allowClear value={keyword} disabled={locked} onChange={e => { setKeyword(e.target.value); setPage(1); }}/>
      <div className="studio-attachment-filters" role="group" aria-label="助手素材类型">{['all', ...Object.keys(names)].map(value => <button type="button" key={value} disabled={locked} aria-pressed={value === kind} onClick={() => { setKind(value); setPage(1); }}>{value === 'all' ? '全部' : names[value as keyof typeof names]}</button>)}</div>
      {loading ? <Skeleton active paragraph={{ rows: 3 }}/> : error ? <div><p role="alert">{error}</p><Button disabled={locked} onClick={() => void load()}>重新加载素材库</Button></div> : !filtered.length ? <p className="studio-helper-note">{assets.length ? '没有匹配的素材，请换个名称或类型。' : '还没有保存的素材。在画布节点菜单选择“加入我的资产”，即可在这里复用。'}</p> : <div className="studio-attachment-list">{filtered.slice((current - 1) * 6, current * 6).map(asset => {
        const Icon = icons[asset.kind]; return <label key={asset.id} className="studio-attachment-item">
          <input type="checkbox" aria-label={`选择素材 ${asset.title}`} disabled={locked || !selected.includes(asset.id) && selected.length >= 16} checked={selected.includes(asset.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, asset.id] : ids.filter(id => id !== asset.id))}/>
          {asset.kind === 'image' ? <SignedImage src={asset.data.dataUrl} storageKey={asset.data.storageKey} alt=""/> : <Icon size={22}/>}
          <span><strong>{asset.title}</strong><small>{names[asset.kind]}</small></span>
        </label>;
      })}</div>}
      {pages > 1 && <nav aria-label="助手素材分页"><Button disabled={locked || current === 1} onClick={() => setPage(current - 1)}>上一页</Button><span>{current} / {pages}</span><Button disabled={locked || current === pages} onClick={() => setPage(current + 1)}>下一页</Button></nav>}
      <footer><span>已选 {selected.length} / 16</span><Button type="primary" disabled={locked || loading || !!error || !selected.length} onClick={() => void insert().catch(() => {})}>添加并引用{selected.length ? ` ${selected.length} 项` : ''}</Button></footer>
    </section>}
  </>;
}
