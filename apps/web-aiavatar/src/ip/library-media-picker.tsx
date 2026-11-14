"use client";
import { IMAGE_UPLOAD_ACCEPT } from '@ai-star-eco/api-client/image-upload-policy';
// AI 图片 / AI 视频素材位的资产选择框（2026-10-31，设计稿「选择框 · 商品图 / 声音」）：
// 左边是资产库，默认打开这张画布绑定的库，没有就打开上次用的；图片位上面能切「图片 / 人物」，视频和声音位只列这一类文件。
// 新文件在框里「上传到这个库」，传完自动选中。
// 图片位分「我的资产 / 官方形象」。官方人物用头像预览，有形象设定图时优先引用设定图。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ConfigProvider, Input, Modal, Skeleton, Spin } from 'antd';
import { AudioLines, Check, ChevronDown, Folder, LayoutGrid, Maximize2, Mic, Search, Upload } from 'lucide-react';
import type { IpSavedAsset, LibraryFolder, LibraryObject } from '@ai-star-eco/types';
import { canvasLibraryFolder, libraryFolders, libraryMaterials, libraryObjects, uploadLibraryMedia } from '@/canvas-bridge/asset-library';
import { libraryObjectAsset, studioIpAssetReference } from '@/canvas-bridge/library-reference';
import { listStudioIpAssets } from '@/canvas-bridge/studio-api';
import { groupStudioIpAssets, type StudioLibraryCharacter } from '@/canvas-bridge/studio-ip-library';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { AssetThumb } from './asset-thumb';
import { selectUploadedAssets, uploadAssetBatch } from './asset-upload-batch';
import { AudioRecorderDialog } from './audio-recorder-dialog';
import { inOfficialCategory, isOfficialAsset, OFFICIAL_LICENSE_REASON, officialAccessLabel, OfficialCategoryFilter, officialCategoryOptions, officialReference, officialUsable } from './official-avatars';
import { AI_LIBRARY, lastLibrary, libraryQuery, rememberLibrary, sourceLabel } from './assets-hub-shared';
import { AiMark } from './studio-ai-icon';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';
import { useLoadMoreOnScroll } from '@/lib/use-load-more-on-scroll';

export type LibraryMediaPickerProps = {
  open: boolean; projectId?: string; onClose: () => void; onAssets: (assets: IpSavedAsset[]) => Promise<void>;
  title?: string; confirmLabel?: string; max?: number; mediaType: 'image' | 'video' | 'audio'; upload?: boolean;
  /** 图片位要不要给「人物」那一栏（新建人物里选照片时不要）。 */
  people?: boolean;
  /** 先打开哪个资产库（比如在某个库里新建人物）。画布绑定的库仍然优先。 */
  library?: string;
};
type PickerTab = 'files' | 'character' | 'scene' | 'prop';
type PickerSource = 'mine' | 'official';
type VisualAsset = Extract<IpSavedAsset, { kind: 'image' | 'video' }>;
const OBJECT_TABS: { key: Exclude<PickerTab, 'files'>; label: string }[] = [{ key: 'character', label: '人物' }, { key: 'scene', label: '场景' }, { key: 'prop', label: '道具' }];
const ACCEPT = { image: IMAGE_UPLOAD_ACCEPT, video: '.mp4', audio: '.mp3,.wav,.m4a' };
const NOUN = { image: '图片', video: '视频', audio: '音频' };

export function LibraryMediaPicker({ open, projectId, onClose, onAssets, title = '从资产库选择', confirmLabel = '使用', max = 1, mediaType, upload, people = true, library: preferred }: LibraryMediaPickerProps) {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [library, setLibrary] = useState<string>();
  const [last, setLast] = useState('');
  const [tab, setTab] = useState<PickerTab>('files');
  const [source, setSource] = useState<PickerSource>('mine');
  const [category, setCategory] = useState('all');
  const [officialAll, setOfficialAll] = useState<StudioLibraryCharacter[]>([]);
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<IpSavedAsset[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string>();
  const [preview, setPreview] = useState<VisualAsset>();
  const [selected, setSelected] = useState<Record<string, IpSavedAsset>>({});
  const [error, setError] = useStudioErrorState();
  const [uploadError, setUploadError] = useStudioErrorState();
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0), fileInput = useRef<HTMLInputElement>(null), uploadedKeys = useRef<string[]>([]);
  const withPeople = people && mediaType === 'image';
  const official = withPeople && source === 'official';
  const libraryKeyword = official ? '' : keyword;
  const needle = keyword.trim().toLocaleLowerCase();
  const shownItems = official
    ? officialAll.filter(({ main, name }) => inOfficialCategory(main, category) && (!needle || [name, main.description, ...Object.values(main.attributes || {})].join(' ').toLocaleLowerCase().includes(needle))).map(officialItem)
    : items;
  const officialPeople = new Map(officialAll.map(person => [`official:${person.id}`, person]));

  useEffect(() => {
    if (!open) { setRecording(false); setHoveredVideo(undefined); setPreview(undefined); return; }
    uploadedKeys.current = [];
    setSelected({}); setKeyword(''); setTab('files'); setSource('mine'); setCategory('all'); setOfficialAll([]); setError(''); setUploadError(''); setLibrary(undefined);
    const remembered = lastLibrary();
    setLast(remembered);
    Promise.all([libraryFolders(), projectId ? canvasLibraryFolder(projectId) : Promise.resolve({ folderId: '' })])
      .then(([f, p]) => { setFolders(f); setLibrary(p.folderId || [preferred, remembered].find(id => !!id && f.some(x => x.id === id)) || 'all'); })
      .catch(e => { setError(e); setLibrary('all'); });
  }, [open, projectId, preferred, setError, setUploadError]);

  const folderName = (id?: string) => folders.find(f => f.id === id)?.name;
  const fetchPage = async (n: number): Promise<{ items: IpSavedAsset[]; hasMore: boolean; officialPeople?: StudioLibraryCharacter[] }> => {
    if (withPeople && source === 'official') {
      const assets = (await listStudioIpAssets()).filter(a => isOfficialAsset(a) && a.storageKey && a.url);
      const people = groupStudioIpAssets(assets).filter(({ main }) => main.current && !main.lookId);
      return { items: [], hasMore: false, officialPeople: people };
    }
    if (!library) return { items: [], hasMore: false };
    if (tab !== 'files') {
      if (library === AI_LIBRARY) return { items: [], hasMore: false };
      const [r, ips] = await Promise.all([
        libraryObjects({ kind: tab, folder: library, query: keyword.trim() || undefined, page: n }),
        tab === 'character' && library === 'all' && n === 0 ? listStudioIpAssets() : Promise.resolve([]),
      ]);
      // 图片位只要有图的角色、场景和道具；引用时带上对象和版本（同画布的引用规则）。
      const objects = (r.items as LibraryObject[]).flatMap(o => o.versions.map((version, i) => {
        const asset = libraryObjectAsset(o, folderName(o.folderId), version.id);
        return o.versions.length === 1 ? asset : { ...asset, id: `${o.id}:${version.id}`, title: `${o.name} · 图片 ${i + 1}${version.id === o.mainVersionId ? '（主图）' : ''}` };
      }));
      const needle = keyword.trim().toLocaleLowerCase();
      // 「人物」只列自己的；官方形象在顶上的「官方形象」来源里。自建库仍只列该库的角色。
      const mine = ips.filter(a => !isOfficialAsset(a) && a.storageKey && a.url).map(studioIpAssetReference)
        .filter(a => !needle || `${a.title} ${a.metadata.assetRole}`.toLocaleLowerCase().includes(needle));
      return { items: [...mine, ...objects], hasMore: r.hasMore };
    }
    const r = await libraryMaterials({ ...libraryQuery(library), kind: mediaType, query: keyword.trim() || undefined, page: n });
    return { items: r.items, hasMore: r.hasMore };
  };
  useEffect(() => {
    if (!open || !library) return;
    const id = ++epoch.current;
    setLoading(true); setItems([]); setPage(0); setHasMore(false); setHoveredVideo(undefined);
    const timer = setTimeout(() => {
      fetchPage(0).then(r => {
        if (id !== epoch.current) return;
        if (r.officialPeople) setOfficialAll(r.officialPeople);
        setItems(r.items); setPage(0); setHasMore(r.hasMore); setError('');
        if (source === 'mine' && tab === 'files' && uploadedKeys.current.length) {
          const keys = uploadedKeys.current;
          uploadedKeys.current = [];
          setSelected(old => selectUploadedAssets(old, r.items, keys, max));
        }
      }).catch(e => id === epoch.current && setError(e)).finally(() => id === epoch.current && setLoading(false));
    }, 150);
    return () => { clearTimeout(timer); epoch.current++; };
    // fetchPage 只读这些值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, library, tab, libraryKeyword, revision, source]);
  const loadMore = async () => {
    const id = epoch.current; setLoading(true);
    try { const r = await fetchPage(page + 1); if (id !== epoch.current) return; setItems(old => [...old, ...r.items.filter(i => !old.some(o => o.id === i.id))]); setPage(page + 1); setHasMore(r.hasMore); setError(''); }
    catch (e) { if (id === epoch.current) setError(e); }
    finally { if (id === epoch.current) setLoading(false); }
  };
  const end = useLoadMoreOnScroll<HTMLLIElement>(open && !official && hasMore && !loading && !error && !busy && !uploading && !preview && !recording, page, loadMore);

  const choose = (asset: IpSavedAsset) => setSelected(old => {
    if (old[asset.id]) { const next = { ...old }; delete next[asset.id]; return next; }
    if (max === 1) return { [asset.id]: asset };
    return Object.keys(old).length >= max ? old : { ...old, [asset.id]: asset };
  });
  const putInLibrary = async (files: File[]) => {
    const folder = library && library !== 'all' && library !== AI_LIBRARY ? library : undefined;
    setUploading(true); setUploadError('');
    try {
      const { uploaded, error } = await uploadAssetBatch(files, file => uploadLibraryMedia(file, mediaType, folder));
      if (uploaded.length) {
        epoch.current++;
        uploadedKeys.current = uploaded.map(item => item.key);
        if (!library || library === AI_LIBRARY) setLibrary('all');
        setSource('mine'); setTab('files'); setKeyword(''); setRevision(n => n + 1);
      }
      if (error) setUploadError(error);
      return error;
    }
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
  const locked = busy || uploading;
  const canUpload = upload && !official;
  const uploadTile = canUpload && mediaType !== 'audio';
  const uploadLabel = library && library !== 'all' && library !== AI_LIBRARY ? '上传到此资产库' : uploadTile ? `上传${NOUN[mediaType]}` : '上传';
  const libRow = (id: string, label: string, icon: ReactNode, note?: string) =>
    <button key={id} type="button" className="lmp-lib" aria-current={library === id ? 'true' : undefined} disabled={locked} onClick={() => { setLibrary(id); setPage(0); }}>{icon}<span>{label}</span>{note && <small>{note}</small>}</button>;
  // 按钮字不加空格（antd 默认把两个汉字的按钮写成「取 消」）。
  return <ConfigProvider button={{ autoInsertSpace: false }}><Modal open={open} title={title} footer={null} width={900} getContainer={studioOverlayContainer} className="lmp-modal" onCancel={() => !locked && onClose()} mask={{ closable: !locked }} destroyOnHidden>
    {withPeople && <div className="lmp-sources" role="tablist" aria-label="素材来源">
      <button type="button" role="tab" aria-selected={source === 'mine'} disabled={locked} onClick={() => setSource('mine')}>我的资产</button>
      <button type="button" role="tab" aria-selected={source === 'official'} disabled={locked} onClick={() => { setSource('official'); setKeyword(''); }}>官方形象</button>
    </div>}
    <div className={`lmp${official ? ' is-official' : ''}`}>
      {!official && <nav className="lmp-libs" aria-label="资产库">
        <h3>资产库</h3>
        {libRow('all', '全部', <span className="lmp-lib-icon"><LayoutGrid size={13} strokeWidth={1.6}/></span>)}
        {libRow(AI_LIBRARY, 'AI 生成', <span className="lmp-lib-icon is-ai"><AiMark size={11}/></span>)}
        {folders.length > 0 && <hr/>}
        {folders.map(f => libRow(f.id, f.name, <span className="lmp-lib-icon"><Folder size={13} strokeWidth={1.6}/></span>, f.id === last ? '上次使用' : undefined))}
      </nav>}
      <div className="lmp-main">
        <div className="lmp-bar">
          {official && <OfficialCategoryFilter options={officialCategoryOptions(officialAll.map(person => person.main))} value={category} disabled={locked} onChange={setCategory}/>}
          {withPeople && !official && <div className="lmp-seg" role="tablist" aria-label="类型">
            <button type="button" role="tab" aria-selected={tab === 'files'} disabled={locked} onClick={() => setTab('files')}>图片</button>
            {OBJECT_TABS.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} disabled={locked} onClick={() => setTab(t.key)}>{t.label}</button>)}
          </div>}
          <Input className="lmp-search" prefix={<Search size={14}/>} allowClear aria-label="搜索资产" placeholder="搜索名称" value={keyword} disabled={locked} onChange={e => setKeyword(e.target.value)}/>
          {canUpload && mediaType === 'audio' && <>
            <span className="lmp-gap"/>
            <Button icon={<Upload size={14}/>} loading={uploading} disabled={busy} onClick={() => fileInput.current?.click()}>{uploadLabel}</Button>
            <Button icon={<Mic size={14}/>} disabled={busy || uploading || !library} onClick={() => setRecording(true)}>录音</Button>
          </>}
        </div>
        {canUpload && <input ref={fileInput} type="file" multiple hidden disabled={locked} aria-label="选择要上传到资产库的文件" accept={ACCEPT[mediaType]} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void putInLibrary(files); }}/>}
        {uploadError && <p className="lmp-error"><StudioErrorNotice error={uploadError} autoReport={false}/></p>}
        {error && <p className="lmp-error"><StudioErrorNotice error={error}/><Button size="small" disabled={loading || locked} onClick={() => setRevision(n => n + 1)}>重试</Button></p>}
        {(uploadTile || shownItems.length > 0 || (!official && hasMore)) && <ul className={`lmp-grid${mediaType === 'audio' ? ' is-list' : ''}`}>
          {uploadTile && <li><Button type="dashed" className="lmp-upload" icon={<span className="assets-upload-plus"><Upload size={21}/></span>}
            loading={uploading} disabled={busy || uploading || !library} onClick={() => fileInput.current?.click()}>
            {uploading ? '正在上传…' : uploadLabel}
          </Button></li>}
          {shownItems.map(a => {
            const on = !!selected[a.id], unavailable = a.metadata?.unavailable === true;
            const access = typeof a.metadata?.officialAccess === 'string' ? a.metadata.officialAccess : undefined;
            const portrait = official ? officialPeople.get(a.id)?.main : undefined;
            const full = !on && max > 1 && picked.length >= max;
            return <li key={a.id} className="lmp-cell"
              onPointerEnter={a.kind === 'video' ? e => { if (e.pointerType === 'mouse') setHoveredVideo(a.id); } : undefined}
              onPointerLeave={a.kind === 'video' ? () => setHoveredVideo(undefined) : undefined}>
              <button type="button" className="lmp-item" aria-pressed={on} aria-label={`选择 ${a.title}`} title={unavailable && access ? `${a.title}（${OFFICIAL_LICENSE_REASON}）` : a.title} disabled={locked || unavailable || full} onClick={() => choose(a)}>
                {a.kind === 'image' ? <span className="lmp-thumb"><AssetThumb kind="image" src={portrait?.url || a.data.dataUrl} storageKey={portrait?.storageKey || a.data.storageKey}/></span>
                  : a.kind === 'video' ? <span className="lmp-thumb"><AssetThumb kind="video" src={a.data.url} storageKey={a.data.storageKey} playing={open && !preview && hoveredVideo === a.id}/></span>
                  : <span className="lmp-voice-icon">{on ? <Check size={15} strokeWidth={2.4}/> : <AudioLines size={16} strokeWidth={1.6}/>}</span>}
                {on && a.kind !== 'audio' && <span className="lmp-check"><Check size={11} strokeWidth={2.6}/></span>}
                {access && <span className={`lmp-access${unavailable ? ' is-locked' : ''}`}>{access}</span>}
                <span className="lmp-text"><strong>{a.title}</strong><small>{access ? unavailable ? OFFICIAL_LICENSE_REASON : '官方形象' : a.metadata?.ipReference ? `我的 IP · ${a.metadata.assetRole}` : a.metadata?.libraryReference ? OBJECT_TABS.find(t => t.key === tab)?.label : sourceLabel(a.source)}</small></span>
              </button>
              {(a.kind === 'image' || a.kind === 'video') && (a.data.storageKey || (a.kind === 'image' ? a.data.dataUrl : a.data.url)) &&
                <Button type="primary" size="small" className="lmp-preview-action" icon={<Maximize2 size={11}/>} aria-label={`放大预览 ${a.title}`} title="放大预览" disabled={busy}
                  onClick={() => { setHoveredVideo(undefined); setPreview(a); }}/>}
              {a.kind === 'audio' && <SignedAudio className="lmp-audio" quiet src={a.data.url} storageKey={a.data.storageKey} controls preload="none"/>}
            </li>;
          })}
          {!official && hasMore && !error && <li ref={end} className="scroll-more lmp-grid-end">{loading ? <Spin size="small"/> : <ChevronDown size={18} aria-hidden/>}</li>}
        </ul>}
        {!shownItems.length && (loading ? <Skeleton active/> : error ? null
          : !official && library === AI_LIBRARY && tab !== 'files' ? <div className="lmp-empty"><p>AI 生成库仅保存图片、视频和音频。请在「全部」中选择{OBJECT_TABS.find(t => t.key === tab)?.label}。</p><Button onClick={() => setLibrary('all')}>查看全部{OBJECT_TABS.find(t => t.key === tab)?.label}</Button></div>
          : <p className="lmp-empty">{official ? keyword.trim() || category !== 'all' ? '没有找到匹配的官方形象。' : '暂无官方形象。' : tab !== 'files' ? `暂无带图的${OBJECT_TABS.find(t => t.key === tab)?.label}。` : library === AI_LIBRARY ? `还没有 AI 生成的${NOUN[mediaType]}。` : keyword.trim() ? '没有找到匹配的素材，请尝试其他名称。' : canUpload && !uploadTile ? `暂无${NOUN[mediaType]}，可点击「上传」添加。` : `暂无${NOUN[mediaType]}。`}</p>)}
      </div>
    </div>
    <footer className="lmp-foot">
      <span>{picked.length === 0 ? '' : max > 1 ? `已选 ${picked.length}/${max}` : `已选：${picked[0].title}`}</span>
      <Button disabled={locked} onClick={onClose}>取消</Button>
      <Button type="primary" className="lmp-use" loading={busy} disabled={!picked.length || uploading} onClick={() => void confirm()}>{confirmLabel}</Button>
    </footer>
    <Modal open={open && !!preview} title={preview?.title} footer={null} width={1040} centered getContainer={studioOverlayContainer} className="lmp-preview" onCancel={() => setPreview(undefined)} destroyOnHidden>
      {open && preview && <div className="library-full-preview">{preview.kind === 'image'
        ? <SignedImage src={preview.data.dataUrl} storageKey={preview.data.storageKey} alt={preview.title}/>
        : <SignedVideo src={preview.data.url} storageKey={preview.data.storageKey} controls playsInline preload="metadata" aria-label={preview.title}/>}</div>}
    </Modal>
  </Modal><AudioRecorderDialog open={open && recording} onClose={() => setRecording(false)} onSave={async file => {
    const error = await putInLibrary([file]);
    if (error) throw error;
  }}/></ConfigProvider>;
}

function officialItem(person: StudioLibraryCharacter): IpSavedAsset {
  const reference = officialReference(person);
  const base = studioIpAssetReference(reference), usable = officialUsable(person.main) && officialUsable(reference);
  return { ...base, id: `official:${person.id}`, title: person.name, source: '官方形象',
    metadata: { ...base.metadata, officialAccess: officialAccessLabel(person.main), ...(usable ? {} : { unavailable: true }) } };
}
