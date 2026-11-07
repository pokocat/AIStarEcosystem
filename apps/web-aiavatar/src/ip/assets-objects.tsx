"use client";
// 新版资产页的「场景」「道具」：导演台有图后自动进来，也可以在这里新建。
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { Box, MapPin, Plus, Search } from 'lucide-react';
import type { LibraryFolder, LibraryObject } from '@ai-star-eco/types';
import { createLibraryObject, libraryObjects, mainLibraryVersion } from '@/canvas-bridge/asset-library';
import { AssetThumb } from './asset-thumb';
import { AI_LIBRARY, objectOriginLabel } from './assets-hub-shared';
import { LibraryAssetEditor } from './library-asset-editor';
import { LibrarySourceSelect } from './library-source-select';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

const LABEL = { scene: '场景', prop: '道具' } as const;

export function AssetsObjects({ kind, library, folders, from, onFromChange, onShowAll }: {
  kind: 'scene' | 'prop'; library: string; folders: LibraryFolder[]; from: string; onFromChange: (id: string) => void; onShowAll?: () => void;
}) {
  const noun = LABEL[kind], Icon = kind === 'scene' ? MapPin : Box;
  const isAi = library === AI_LIBRARY;
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LibraryObject[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useStudioErrorState();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<LibraryObject[]>();
  const [creating, setCreating] = useState(false);
  const epoch = useRef(0);
  const filtered = !!query || !!from;
  useEffect(() => { const timer = setTimeout(() => setQuery(keyword.trim()), 220); return () => clearTimeout(timer); }, [keyword]);
  const fetchPage = (n: number) => libraryObjects({ kind, folder: library, query: query || undefined, projectId: from || undefined, page: n });
  useEffect(() => {
    if (isAi) { setItems([]); setLoading(false); return; }
    const id = ++epoch.current;
    setLoading(true); setError('');
    fetchPage(0).then(r => { if (id !== epoch.current) return; setItems(r.items); setPage(0); setTotal(r.total); setHasMore(r.hasMore); })
      .catch(e => id === epoch.current && setError(e))
      .finally(() => id === epoch.current && setLoading(false));
    return () => { epoch.current++; };
    // fetchPage 只读这些筛选值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, library, query, from, revision, isAi, setError]);
  const loadMore = async () => {
    const id = epoch.current;
    setLoading(true);
    try { const r = await fetchPage(page + 1); if (id !== epoch.current) return; setItems(old => [...old, ...r.items.filter(i => !old.some(o => o.id === i.id))]); setPage(page + 1); setHasMore(r.hasMore); setTotal(r.total); }
    catch (e) { if (id === epoch.current) setError(e); }
    finally { if (id === epoch.current) setLoading(false); }
  };
  if (isAi) return <div className="assets-empty"><h3>AI 生成库里没有{noun}</h3><p>此处仅保存 AI 生成的图片、视频和音频。</p>{onShowAll && <Button onClick={onShowAll}>查看全部{noun}</Button>}</div>;
  return <div className="assets-people assets-objects">
    <div className="assets-toolbar">
      <Input className="assets-search" prefix={<Search size={15}/>} allowClear aria-label={`搜索${noun}`} placeholder="搜索名称、描述或作品" value={keyword} onChange={e => setKeyword(e.target.value)}/>
      <LibrarySourceSelect value={from} onChange={onFromChange}/>
      <span className="assets-toolbar-gap"/>
      <span className="assets-count" aria-live="polite">{loading && !items.length ? '正在加载…' : `${total} 个${noun}`}</span>
    </div>
    {error && <p className="assets-notice"><StudioErrorNotice error={error}/><Button size="small" onClick={() => setRevision(n => n + 1)}>重试</Button></p>}
    <ul className="assets-people-grid">
      {!filtered && <li className="assets-person-new"><div><button type="button" onClick={() => setCreating(true)}><Plus size={15}/>新建{noun}</button></div></li>}
      {loading && !items.length ? Array.from({ length: 4 }, (_, i) => <li key={`s${i}`}><span className="assets-skeleton assets-person-cover"/></li>)
        : items.map(o => {
          const main = mainLibraryVersion(o), origin = objectOriginLabel(o);
          return <li key={o.id}><button type="button" className="assets-person" aria-label={`查看 ${o.name}`} onClick={() => setEditing([o])}>
            <span className="assets-person-cover">{main ? <AssetThumb kind="image" src={main.url} storageKey={main.storageKey}/> : <span className="assets-person-blank"><Icon size={36} strokeWidth={1.1}/></span>}</span>
            <span className="assets-person-text"><strong>{o.name}</strong><small>{o.description || '暂无描述'}</small></span>
            <span className="assets-person-meta"><span title={o.sources[0]?.title}>{[o.sources[0]?.title, o.versions.length ? `${o.versions.length} 张图` : '暂无图片'].filter(Boolean).join(' · ')}</span>{origin && <span className="assets-tag">{origin}</span>}</span>
          </button></li>;
        })}
    </ul>
    {!loading && !items.length && filtered && <div className="assets-empty"><h3>没有找到匹配的{noun}</h3><p>请尝试其他名称或作品。</p><Button onClick={() => { setKeyword(''); onFromChange(''); }}>清除筛选</Button></div>}
    {!loading && !items.length && !filtered && !error && <p className="assets-rule">导演台里有图的{noun}会自动保存到这里。画布上的图片，可在右键菜单中选择「存为角色、场景或道具」。</p>}
    {hasMore && !error && <div className="assets-more"><Button loading={loading} onClick={() => void loadMore()}>加载更多</Button></div>}
    {editing && <LibraryAssetEditor assets={editing} folders={folders} onClose={() => { setEditing(undefined); setRevision(n => n + 1); }} onChange={() => setRevision(n => n + 1)}/>}
    <NewObjectDialog open={creating} kind={kind} folderId={library !== 'all' ? library : undefined} onClose={() => setCreating(false)}
      onCreated={o => { setCreating(false); setRevision(n => n + 1); setEditing([o]); }}/>
  </div>;
}

function NewObjectDialog({ open, kind, folderId, onClose, onCreated }: { open: boolean; kind: 'scene' | 'prop'; folderId?: string; onClose: () => void; onCreated: (o: LibraryObject) => void }) {
  const noun = LABEL[kind];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useStudioErrorState();
  useEffect(() => { if (open) { setName(''); setDescription(''); setError(''); } }, [open, setError]);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { onCreated(await createLibraryObject({ name: name.trim(), kind, description: description.trim(), folderId })); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  return <Modal open={open} title={`新建${noun}`} okText="新建" cancelText="取消" getContainer={studioOverlayContainer} confirmLoading={busy} okButtonProps={{ disabled: !name.trim() }} onCancel={() => !busy && onClose()} onOk={() => void create()} destroyOnHidden
    footer={(_, { OkBtn, CancelBtn }) => <div className="library-save-foot"><span>{name.trim() ? '' : '请填写名称'}</span><CancelBtn/><OkBtn/></div>}>
    <div className="library-save">
      <label className="library-save-row"><span>名称</span><Input aria-label={`${noun}名称`} autoFocus maxLength={128} value={name} onChange={e => setName(e.target.value)}/></label>
      <label className="library-save-row"><span>描述</span><Input.TextArea aria-label={`${noun}描述`} placeholder="选填" rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></label>
      {error && <p className="library-save-error"><StudioErrorNotice error={error}/></p>}
    </div>
  </Modal>;
}
