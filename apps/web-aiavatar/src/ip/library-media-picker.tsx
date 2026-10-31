"use client";
// AI 图片 / AI 视频素材位的资产选择框（2026-10-31，设计稿「选择框 · 商品图 / 声音」）：
// 左边是资产库，默认打开这张画布绑定的库，没有就打开上次用的；图片位上面能切「图片 / 人物」，视频和声音位只列这一类文件。
// 新文件在框里「上传到这个库」，传完自动选中。画布、导演台、创作助手的选择框不走这里（library-reference-picker.tsx 原样）。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ConfigProvider, Input, Modal, Skeleton } from 'antd';
import { AudioLines, Check, Folder, LayoutGrid, Search, Upload } from 'lucide-react';
import type { IpSavedAsset, LibraryFolder, LibraryObject } from '@ai-star-eco/types';
import { canvasLibraryFolder, libraryFolders, libraryMaterials, libraryObjects, uploadLibraryMedia } from '@/canvas-bridge/asset-library';
import { libraryObjectAsset } from '@/canvas-bridge/library-reference';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { AssetThumb } from './asset-thumb';
import { AI_LIBRARY, lastLibrary, libraryQuery, rememberLibrary, sourceLabel } from './assets-hub-shared';
import { AiMark } from './studio-ai-icon';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

export type LibraryMediaPickerProps = {
  open: boolean; projectId?: string; onClose: () => void; onAssets: (assets: IpSavedAsset[]) => Promise<void>;
  title?: string; confirmLabel?: string; max?: number; mediaType: 'image' | 'video' | 'audio'; upload?: boolean;
  /** 图片位要不要给「人物」那一栏（新建人物里选照片时不要）。 */
  people?: boolean;
  /** 先打开哪个资产库（比如在某个库里新建人物）。画布绑定的库仍然优先。 */
  library?: string;
};
const ACCEPT = { image: '.jpg,.jpeg,.png', video: '.mp4', audio: '.mp3,.wav,.m4a' };
const NOUN = { image: '图片', video: '视频', audio: '音频' };

export function LibraryMediaPicker({ open, projectId, onClose, onAssets, title = '从资产库选', confirmLabel = '使用', max = 1, mediaType, upload, people = true, library: preferred }: LibraryMediaPickerProps) {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [library, setLibrary] = useState<string>();
  const [last, setLast] = useState('');
  const [tab, setTab] = useState<'files' | 'people'>('files');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<IpSavedAsset[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Record<string, IpSavedAsset>>({});
  const [error, setError] = useStudioErrorState();
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0), fileInput = useRef<HTMLInputElement>(null), uploadedKey = useRef<string | undefined>(undefined);
  const withPeople = people && mediaType === 'image';

  useEffect(() => {
    if (!open) return;
    setSelected({}); setKeyword(''); setTab('files'); setError(''); setLibrary(undefined);
    const remembered = lastLibrary();
    setLast(remembered);
    Promise.all([libraryFolders(), projectId ? canvasLibraryFolder(projectId) : Promise.resolve({ folderId: '' })])
      .then(([f, p]) => { setFolders(f); setLibrary(p.folderId || [preferred, remembered].find(id => !!id && f.some(x => x.id === id)) || 'all'); })
      .catch(e => { setError(e); setLibrary('all'); });
  }, [open, projectId, preferred, setError]);

  const folderName = (id?: string) => folders.find(f => f.id === id)?.name;
  const fetchPage = async (n: number): Promise<{ items: IpSavedAsset[]; hasMore: boolean }> => {
    if (!library) return { items: [], hasMore: false };
    if (tab === 'people') {
      if (library === AI_LIBRARY) return { items: [], hasMore: false };
      const r = await libraryObjects({ kind: 'character', folder: library, query: keyword.trim() || undefined, page: n });
      // 图片位只要有图的角色；引用时带上对象和版本（同画布的引用规则）。
      return { items: (r.items as LibraryObject[]).filter(o => o.versions.length).map(o => libraryObjectAsset(o, folderName(o.folderId))), hasMore: r.hasMore };
    }
    const r = await libraryMaterials({ ...libraryQuery(library), kind: mediaType, query: keyword.trim() || undefined, page: n });
    return { items: r.items, hasMore: r.hasMore };
  };
  useEffect(() => {
    if (!open || !library) return;
    const id = ++epoch.current;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchPage(0).then(r => {
        if (id !== epoch.current) return;
        setItems(r.items); setPage(0); setHasMore(r.hasMore); setError('');
        // 刚传进资产库的那份：列表读回来后直接选中。
        const fresh = uploadedKey.current && r.items.find(a => 'storageKey' in a.data && a.data.storageKey === uploadedKey.current);
        // 已经选满了就不再自动加上（单选时换成刚传的那个），选中的数目不能超过 max。
        if (fresh) { uploadedKey.current = undefined; setSelected(old => max === 1 ? { [fresh.id]: fresh } : old[fresh.id] || Object.keys(old).length >= max ? old : { ...old, [fresh.id]: fresh }); }
      }).catch(e => id === epoch.current && setError(e)).finally(() => id === epoch.current && setLoading(false));
    }, 150);
    return () => { clearTimeout(timer); epoch.current++; };
    // fetchPage 只读这些值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, library, tab, keyword, revision]);
  const loadMore = async () => {
    const id = epoch.current; setLoading(true);
    try { const r = await fetchPage(page + 1); if (id !== epoch.current) return; setItems(old => [...old, ...r.items.filter(i => !old.some(o => o.id === i.id))]); setPage(page + 1); setHasMore(r.hasMore); }
    catch (e) { if (id === epoch.current) setError(e); }
    finally { if (id === epoch.current) setLoading(false); }
  };

  const choose = (asset: IpSavedAsset) => setSelected(old => {
    if (old[asset.id]) { const next = { ...old }; delete next[asset.id]; return next; }
    if (max === 1) return { [asset.id]: asset };
    return Object.keys(old).length >= max ? old : { ...old, [asset.id]: asset };
  });
  const putInLibrary = async (file: File) => {
    const folder = library && library !== 'all' && library !== AI_LIBRARY ? library : undefined;
    setUploading(true); setError('');
    try {
      const result = await uploadLibraryMedia(file, mediaType, folder);
      uploadedKey.current = result.key;
      // 「AI 生成」里看不到上传的文件，传完切回「全部」再选中。
      if (library === AI_LIBRARY) setLibrary('all');
      setTab('files'); setKeyword(''); setRevision(n => n + 1);
    } catch (e) { setError(e); }
    finally { setUploading(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      if (library && library !== 'all' && library !== AI_LIBRARY) rememberLibrary(library);
      await onAssets(Object.values(selected));
      onClose();
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };

  const picked = Object.values(selected);
  const libRow = (id: string, label: string, icon: ReactNode, note?: string) =>
    <button key={id} type="button" className="lmp-lib" aria-current={library === id ? 'true' : undefined} disabled={busy} onClick={() => { setLibrary(id); setPage(0); }}>{icon}<span>{label}</span>{note && <small>{note}</small>}</button>;
  // 按钮字不加空格（antd 默认把两个汉字的按钮写成「取 消」）。
  return <ConfigProvider button={{ autoInsertSpace: false }}><Modal open={open} title={title} footer={null} width={900} getContainer={studioOverlayContainer} className="lmp-modal" onCancel={() => !busy && onClose()} mask={{ closable: !busy }} destroyOnHidden>
    <div className="lmp">
      <nav className="lmp-libs" aria-label="资产库">
        <h3>资产库</h3>
        {libRow('all', '全部', <span className="lmp-lib-icon"><LayoutGrid size={13} strokeWidth={1.6}/></span>)}
        {libRow(AI_LIBRARY, 'AI 生成', <span className="lmp-lib-icon is-ai"><AiMark size={11}/></span>)}
        {folders.length > 0 && <hr/>}
        {folders.map(f => libRow(f.id, f.name, <span className="lmp-lib-icon"><Folder size={13} strokeWidth={1.6}/></span>, f.id === last ? '上次用的' : undefined))}
      </nav>
      <div className="lmp-main">
        <div className="lmp-bar">
          {withPeople && <div className="lmp-seg" role="tablist" aria-label="类型">
            <button type="button" role="tab" aria-selected={tab === 'files'} disabled={busy} onClick={() => setTab('files')}>图片</button>
            <button type="button" role="tab" aria-selected={tab === 'people'} disabled={busy} onClick={() => setTab('people')}>人物</button>
          </div>}
          <Input className="lmp-search" prefix={<Search size={14}/>} allowClear aria-label="搜索资产" placeholder="搜索名称" value={keyword} disabled={busy} onChange={e => setKeyword(e.target.value)}/>
          <span className="lmp-gap"/>
          {upload && <><Button icon={<Upload size={14}/>} loading={uploading} disabled={busy} onClick={() => fileInput.current?.click()}>{library && library !== 'all' && library !== AI_LIBRARY ? '上传到这个库' : '上传'}</Button>
            <input ref={fileInput} type="file" hidden aria-label="选择要上传到资产库的文件" accept={ACCEPT[mediaType]} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void putInLibrary(file); }}/></>}
        </div>
        {error && <p className="lmp-error"><StudioErrorNotice error={error}/><Button size="small" onClick={() => setRevision(n => n + 1)}>重试</Button></p>}
        {loading && !items.length ? <Skeleton active/> : !items.length
          ? <p className="lmp-empty">{tab === 'people' ? '这里还没有带图的人物。' : library === AI_LIBRARY ? `还没有 AI 做的${NOUN[mediaType]}。` : keyword.trim() ? '没有找到，换个名称试试。' : upload ? `这里还没有${NOUN[mediaType]}，可以上传一个。` : `这里还没有${NOUN[mediaType]}。`}</p>
          : <ul className={`lmp-grid${mediaType === 'audio' ? ' is-list' : ''}`}>{items.map(a => {
            const on = !!selected[a.id], unavailable = a.metadata?.unavailable === true;
            const full = !on && max > 1 && picked.length >= max;
            return <li key={a.id}>
              <button type="button" className="lmp-item" aria-pressed={on} aria-label={`选 ${a.title}`} disabled={busy || unavailable || full} onClick={() => choose(a)}>
                {a.kind === 'image' ? <span className="lmp-thumb"><AssetThumb kind="image" src={a.data.dataUrl} storageKey={a.data.storageKey}/></span>
                  : a.kind === 'video' ? <span className="lmp-thumb"><AssetThumb kind="video" src={a.data.url} storageKey={a.data.storageKey}/></span>
                  : <span className="lmp-voice-icon">{on ? <Check size={15} strokeWidth={2.4}/> : <AudioLines size={16} strokeWidth={1.6}/>}</span>}
                {on && a.kind !== 'audio' && <span className="lmp-check"><Check size={11} strokeWidth={2.6}/></span>}
                <span className="lmp-text"><strong>{a.title}</strong><small>{a.metadata?.libraryReference ? '人物' : sourceLabel(a.source)}</small></span>
              </button>
              {a.kind === 'audio' && <SignedAudio className="lmp-audio" quiet src={a.data.url} storageKey={a.data.storageKey} controls preload="none"/>}
            </li>;
          })}</ul>}
        {hasMore && <div className="lmp-more"><Button loading={loading} disabled={busy} onClick={() => void loadMore()}>加载更多</Button></div>}
      </div>
    </div>
    <footer className="lmp-foot">
      <span>{picked.length === 0 ? '' : picked.length === 1 ? `已选：${picked[0].title}` : `已选 ${picked.length} 个`}</span>
      <Button disabled={busy} onClick={onClose}>取消</Button>
      <Button type="primary" className="lmp-use" loading={busy} disabled={!picked.length || uploading} onClick={() => void confirm()}>{confirmLabel}</Button>
    </footer>
  </Modal></ConfigProvider>;
}
