"use client";
// 新版「资产」页（2026-10-31 改版，设计稿「资产（新）」一排）：
// 按文件类型分（全部 / 图片 / 视频 / 音频 / 人物），场景、商品这类按内容的分组交给左边的「资产库」（就是原来的文件夹）。
// 「AI 生成」是自带的库：各处做出来、还没放进别的库的东西都在这里，移到别的库就从这里走掉。
// 旧版不走这里，仍是 components/hub/assets-library.tsx 原来那套。
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { App, Button, Checkbox, ConfigProvider, Dropdown, Input, Modal } from 'antd';
import type { MenuProps } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AudioLines, ChevronDown, FileText, Film, Folder, LayoutGrid, Mic, MoreHorizontal, Plus, Search, SquareCheck } from 'lucide-react';
import type { LibraryFolder, LibraryMaterial } from '@ai-star-eco/types';
import { createLibraryFolder, deleteLibraryFolder, editLibraryMaterial, libraryFolders, libraryMaterials, renameLibraryFolder, uploadLibraryMedia } from '@/canvas-bridge/asset-library';
import { saveAsset } from '@/canvas-bridge/saved-assets';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { studioHref, useHubData } from '@/components/hub/data';
import { VoiceApi } from '@/proto/api';
import type { VoiceAsset } from '@/proto/data';
import { masonry, mediaRatio, useMasonryColumns } from './asset-masonry';
import { AssetThumb } from './asset-thumb';
import { AI_LIBRARY, libraryQuery, sourceLabel } from './assets-hub-shared';
import { AssetsPeople } from './assets-people';
import { AiMark } from './studio-ai-icon';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';
import { StudioPage } from './studio-page';

export type HubTab = 'all' | 'image' | 'video' | 'audio' | 'people';
export const HUB_TABS: { value: HubTab; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'image', label: '图片' }, { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' }, { value: 'people', label: '人物' },
];
// 旧链接（我的 IP / 创作素材 / 生成与上传 / 声音 / 授权形象）落到新分类上。
const LEGACY_TABS: Record<string, HubTab> = { ips: 'people', objects: 'people', authorized: 'people', materials: 'all', voices: 'audio' };
export function hubTab(raw: string | null): HubTab {
  if (HUB_TABS.some(t => t.value === raw)) return raw as HubTab;
  return (raw && LEGACY_TABS[raw]) || 'all';
}

const SOURCES = [
  { key: 'all', label: '全部来源' }, { key: 'generated', label: 'AI 生成' },
  { key: 'upload', label: '我上传的' }, { key: 'canvas', label: '从画布存的' },
];
const TYPE_LABEL = { image: '图片', video: '视频', audio: '音频', text: '文字' } as const;
const ACCEPT: Record<Exclude<HubTab, 'people'>, string> = {
  all: '.jpg,.jpeg,.png,.mp4,.mp3,.wav,.m4a,.md,.txt', image: '.jpg,.jpeg,.png', video: '.mp4', audio: '.mp3,.wav,.m4a',
};
const folderIdOf = (item: LibraryMaterial) => typeof item.metadata?.folderId === 'string' ? item.metadata.folderId : '';

export function AssetsHub() {
  const router = useRouter(), search = useSearchParams();
  const tab = hubTab(search.get('tab'));
  const library = search.get('lib') || 'all';
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folderRevision, setFolderRevision] = useState(0);
  const [folderError, setFolderError] = useStudioErrorState();
  const [foldersRead, setFoldersRead] = useState(false);
  useEffect(() => {
    let live = true;
    libraryFolders().then(f => { if (live) { setFolders(f); setFolderError(''); } }).catch(e => live && setFolderError(e)).finally(() => live && setFoldersRead(true));
    return () => { live = false; };
  }, [folderRevision, setFolderError]);
  const go = (next: { tab?: HubTab; library?: string }) => {
    const params = new URLSearchParams(search.toString());
    if (next.tab) params.set('tab', next.tab);
    if (next.library !== undefined) { if (next.library === 'all') params.delete('lib'); else params.set('lib', next.library); }
    params.delete('focus');
    router.push(`/assets?${params}`);
  };
  // 删掉或读不到的库不留在地址里空着。
  const builtIn = library === 'all' || library === AI_LIBRARY;
  const current = builtIn || folders.some(f => f.id === library) || (foldersRead && !!folderError) ? library : 'all';
  // 地址里是自己建的库：等库列表读回来再读内容，免得先按一个不存在的库读一遍。
  const ready = builtIn || foldersRead;
  return <StudioPage title="资产" description="人物、声音与创作素材，让每一次灵感有所承接。" nextDescription="上传的和 AI 做的都在这里，做视频、出图时直接拿来用" className="assets-hub-page">
    <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} getPopupContainer={studioOverlayContainer} theme={{ token: { colorPrimary: '#17202a', borderRadius: 10, fontFamily: 'var(--ip-ui)' } }}>
      <App className="assets-hub" data-studio-overlay-root>
        <div className="assets-hub-tabs" role="tablist" aria-label="资产分类">
          {HUB_TABS.map(t => <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => go({ tab: t.value })}>{t.label}</button>)}
        </div>
        <div className="assets-hub-body">
          <LibraryNav folders={folders} value={current} error={folderError} onRetry={() => setFolderRevision(n => n + 1)} onChange={id => go({ library: id })} onChanged={() => setFolderRevision(n => n + 1)}/>
          <section className="assets-hub-main" aria-label={HUB_TABS.find(t => t.value === tab)?.label}>
            {!ready ? null : tab === 'people'
              ? <AssetsPeople library={current} folders={folders}/>
              : <MediaWall key={`${tab}:${current}`} tab={tab} library={current} folders={folders} onFoldersChanged={() => setFolderRevision(n => n + 1)}/>}
          </section>
        </div>
      </App>
    </ConfigProvider>
  </StudioPage>;
}

/** 左边的资产库：全部、自带的 AI 生成、自己建的库。新建、改名、删除都在这里。 */
function LibraryNav({ folders, value, error, onChange, onChanged, onRetry }: {
  folders: LibraryFolder[]; value: string; error: string;
  onChange: (id: string) => void; onChanged: () => void; onRetry: () => void;
}) {
  const { modal } = useStudioApp();
  const [dialog, setDialog] = useState<{ id?: string; name: string }>();
  const row = (id: string, label: string, icon: ReactNode) =>
    <button type="button" className="assets-lib" aria-current={value === id ? 'true' : undefined} onClick={() => onChange(id)}>{icon}<span>{label}</span></button>;
  const remove = (f: LibraryFolder) => modal.confirm({
    title: `删除「${f.name}」？`, content: '里面的东西不会删，会回到「全部」里。画布里已经用上的也不受影响。', okText: '删除资产库', okButtonProps: { danger: true },
    onOk: async () => { await deleteLibraryFolder(f.id); if (value === f.id) onChange('all'); onChanged(); },
  });
  return <nav className="assets-libs" aria-label="资产库">
    <h2>资产库</h2>
    {row('all', '全部', <span className="assets-lib-icon"><LayoutGrid size={13} strokeWidth={1.6}/></span>)}
    {row(AI_LIBRARY, 'AI 生成', <span className="assets-lib-icon is-ai"><AiMark size={12}/></span>)}
    <hr/>
    {folders.map(f => <div className="assets-lib-row" key={f.id}>
      {row(f.id, f.name, <span className="assets-lib-icon"><Folder size={13} strokeWidth={1.6}/></span>)}
      <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={{ items: [{ key: 'rename', label: '改名' }, { key: 'delete', label: '删除', danger: true }], onClick: ({ key }) => key === 'rename' ? setDialog({ id: f.id, name: f.name }) : remove(f) }}>
        <button type="button" className="assets-lib-more" aria-label={`管理资产库 ${f.name}`}><MoreHorizontal size={15}/></button>
      </Dropdown>
    </div>)}
    {error && <p className="assets-libs-error"><StudioErrorNotice error={error}/><button type="button" onClick={onRetry}>重新读取</button></p>}
    <button type="button" className="assets-lib assets-lib-new" onClick={() => setDialog({ name: '' })}><span className="assets-lib-icon is-plain"><Plus size={14}/></span><span>新建资产库</span></button>
    <FolderDialog value={dialog} onClose={() => setDialog(undefined)} onSaved={f => { setDialog(undefined); onChanged(); if (!dialog?.id) onChange(f.id); }}/>
  </nav>;
}

/** 新建 / 改名资产库。新建成功后把 onSaved 交给调用方（「移到」里新建的库还要接着把东西放进去）。 */
export function FolderDialog({ value, onClose, onSaved }: { value?: { id?: string; name: string }; onClose: () => void; onSaved: (folder: LibraryFolder) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useStudioErrorState();
  useEffect(() => { if (value) { setName(value.name); setError(''); } }, [value, setError]);
  const save = async () => {
    setBusy(true); setError('');
    try { onSaved(value?.id ? await renameLibraryFolder(value.id, name.trim()) : await createLibraryFolder(name.trim())); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  return <Modal open={!!value} title={value?.id ? '改名' : '新建资产库'} okText={value?.id ? '保存' : '新建'} cancelText="取消" getContainer={studioOverlayContainer} confirmLoading={busy}
    okButtonProps={{ disabled: !name.trim() }} onCancel={() => !busy && onClose()} onOk={() => void save()} destroyOnHidden>
    <Input autoFocus aria-label="资产库名称" placeholder="例如：保湿精华、巷里火锅" value={name} maxLength={100} onChange={e => setName(e.target.value)} onPressEnter={() => name.trim() && void save()}/>
    {error && <p className="assets-form-error"><StudioErrorNotice error={error}/></p>}
  </Modal>;
}

type WallItem = { type: 'upload' } | { type: 'voice'; voice: VoiceAsset } | { type: 'material'; item: LibraryMaterial };

/** 图片 / 视频 / 音频 / 全部：瀑布流，第一张是上传。 */
function MediaWall({ tab, library, folders, onFoldersChanged }: {
  tab: Exclude<HubTab, 'people'>; library: string; folders: LibraryFolder[]; onFoldersChanged: () => void;
}) {
  const { message } = useStudioApp();
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [items, setItems] = useState<LibraryMaterial[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useStudioErrorState();
  const [actionError, setActionError] = useStudioErrorState();
  const [revision, setRevision] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<LibraryMaterial>();
  const [uploading, setUploading] = useState(false);
  const [newFolderFor, setNewFolderFor] = useState<string[]>();
  const epoch = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const columns = useMasonryColumns(wall);
  const isAi = library === AI_LIBRARY;
  const filtered = !!query || source !== 'all';

  useEffect(() => { const timer = setTimeout(() => setQuery(keyword.trim()), 220); return () => clearTimeout(timer); }, [keyword]);
  const fetchPage = (n: number) => libraryMaterials({
    ...libraryQuery(library), kind: tab, ...(isAi ? {} : { source }), query: query || undefined, page: n,
  });
  useEffect(() => {
    const id = ++epoch.current;
    setLoading(true); setError(''); setSelected([]);
    fetchPage(0).then(r => { if (id !== epoch.current) return; setItems(r.items); setPage(0); setTotal(r.total); setHasMore(r.hasMore); })
      .catch(e => id === epoch.current && setError(e))
      .finally(() => id === epoch.current && setLoading(false));
    return () => { epoch.current++; };
    // fetchPage 只读这些筛选值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, library, query, source, revision]);
  const loadMore = async () => {
    const id = epoch.current;
    setLoading(true);
    try { const r = await fetchPage(page + 1); if (id !== epoch.current) return; setItems(old => [...old, ...r.items.filter(i => !old.some(o => o.id === i.id))]); setPage(page + 1); setHasMore(r.hasMore); setTotal(r.total); }
    catch (e) { if (id === epoch.current) setError(e); }
    finally { if (id === epoch.current) setLoading(false); }
  };

  // 「音频」里人物的声音也列出来（克隆声、设计声、预设音色），点开去声音工作室管理。只在「全部」库、不筛来源时出现。
  const showVoices = tab === 'audio' && library === 'all' && source === 'all';
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [revision], showVoices);
  const voiceItems = showVoices ? voices.data.filter(v => !query || v.name.toLowerCase().includes(query.toLowerCase())) : [];

  const folderName = (id: string) => folders.find(f => f.id === id)?.name;
  const move = async (ids: string[], folderId: string | null) => {
    setActionError('');
    try {
      for (const id of ids) await editLibraryMaterial(id, { folderId });
      const name = folderId ? folderName(folderId) : undefined;
      message.success(folderId ? `已移到「${name || '资产库'}」` : '已移出资产库');
      setSelected([]); setSelecting(false); setRevision(n => n + 1);
    } catch (e) { setActionError(e); setRevision(n => n + 1); }
  };
  const moveMenu = (ids: string[], currentFolder?: string): MenuProps => ({
    items: [
      ...folders.map(f => ({ key: f.id, label: f.name, icon: <Folder size={14}/>, disabled: f.id === currentFolder })),
      ...(folders.length ? [{ type: 'divider' as const }] : []),
      { key: '__new', label: '新建资产库…', icon: <Plus size={14}/> },
      ...(currentFolder ? [{ key: '__out', label: '移出资产库' }] : []),
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === '__new') setNewFolderFor(ids);
      else void move(ids, key === '__out' ? null : key);
    },
  });

  const upload = async (files: File[]) => {
    const folderId = library !== 'all' && !isAi ? library : undefined;
    setUploading(true); setActionError('');
    try {
      for (const file of files) {
        if (/\.(md|txt)$/i.test(file.name)) {
          const saved = await saveAsset({ kind: 'text', title: file.name, coverUrl: '', tags: [], data: { content: await file.text() } });
          if (folderId) await editLibraryMaterial(saved.id, { folderId });
        } else await uploadLibraryMedia(file, /\.mp4$/i.test(file.name) ? 'video' : /\.(mp3|wav|m4a)$/i.test(file.name) ? 'audio' : 'image', folderId);
      }
      message.success(files.length > 1 ? `已上传 ${files.length} 个文件` : '已上传');
      setRevision(n => n + 1);
    } catch (e) { setActionError(e); setRevision(n => n + 1); }
    finally { setUploading(false); }
  };

  const wallItems: WallItem[] = [
    ...(!isAi && !selecting && !filtered ? [{ type: 'upload' as const }] : []),
    ...voiceItems.map(voice => ({ type: 'voice' as const, voice })),
    ...items.map(item => ({ type: 'material' as const, item })),
  ];
  const ratioOf = (w: WallItem) => w.type === 'upload' ? 4 / 3 : w.type === 'voice' ? 1 : w.item.kind === 'image' || w.item.kind === 'video' ? mediaRatio(w.item.data.width, w.item.data.height, w.item.kind === 'video' ? 16 / 9 : 1) : w.item.kind === 'text' ? 0.75 : 1;
  const columnsOfItems = masonry(wallItems, columns, ratioOf);
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const count = total + voiceItems.length;
  const sourceName = SOURCES.find(s => s.key === source)?.label;

  return <div ref={wall} className="assets-wall-panel">
    {isAi && <header className="assets-lib-head"><span className="assets-lib-icon is-ai"><AiMark size={14}/></span><div><h2>AI 生成</h2><p>做出来的图片、视频和音频会自动放在这里，移到别的资产库就从这里拿走。</p></div></header>}
    <div className="assets-toolbar">
      <Input className="assets-search" prefix={<Search size={15}/>} allowClear aria-label="搜索资产" placeholder="搜索名称或提示词" value={keyword} onChange={e => setKeyword(e.target.value)}/>
      {!isAi && <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={{ items: SOURCES.map(s => ({ key: s.key, label: s.label })), selectable: true, selectedKeys: [source], onClick: ({ key }) => setSource(key) }}>
        <button type="button" className="assets-select" aria-label="按来源筛选">{sourceName}<ChevronDown size={14}/></button>
      </Dropdown>}
      <span className="assets-toolbar-gap"/>
      <span className="assets-count" aria-live="polite">{loading && !items.length ? '正在读取…' : `${count} 个`}</span>
      {selecting
        ? <><span className="assets-count">已选 {selected.length} 个</span>
          <Dropdown trigger={['click']} disabled={!selected.length} getPopupContainer={studioOverlayContainer} menu={moveMenu(selected)}><Button disabled={!selected.length}>移到<ChevronDown size={14}/></Button></Dropdown>
          <Button onClick={() => { setSelecting(false); setSelected([]); }}>完成</Button></>
        : <Button icon={<SquareCheck size={15}/>} disabled={!items.length} onClick={() => setSelecting(true)}>批量选择</Button>}
    </div>
    {actionError && <p className="assets-notice"><StudioErrorNotice error={actionError}/></p>}
    {error ? <div className="assets-empty"><p><StudioErrorNotice error={error}/></p><Button onClick={() => setRevision(n => n + 1)}>重新读取</Button></div>
      : loading && !items.length && !voiceItems.length ? <div className="assets-wall is-loading" aria-label="正在读取资产">{Array.from({ length: columns }, (_, i) => <div key={i} className="assets-wall-col"><span className="assets-skeleton" style={{ aspectRatio: i % 2 ? '3 / 4' : '1 / 1' }}/><span className="assets-skeleton" style={{ aspectRatio: '4 / 3' }}/></div>)}</div>
      : !wallItems.length ? <div className="assets-empty">
        {isAi ? <><h3>这里还是空的</h3><p>在 AI 图片、AI 视频或画布里做出来的东西会自动放进来。</p><div><Link className="ip-brand-secondary" href="/image">去做一张图</Link></div></>
          : <><h3>没有找到</h3><p>换个名称或来源试试。</p><Button onClick={() => { setKeyword(''); setSource('all'); }}>清除筛选</Button></>}
      </div>
      : <div className="assets-wall">{columnsOfItems.map((col, i) => <div key={i} className="assets-wall-col">{col.map(w =>
        w.type === 'upload' ? <button key="upload" type="button" className="assets-upload" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <span className="assets-upload-plus"><Plus size={18}/></span>{uploading ? '正在上传…' : '上传'}<small>{tab === 'all' ? '图片、视频、音频' : TYPE_LABEL[tab]}</small>
        </button>
        : w.type === 'voice' ? <VoiceTile key={`voice:${w.voice.id}`} voice={w.voice}/>
        : <MaterialTile key={w.item.id} item={w.item} subline={[sourceLabel(w.item.source), folderIdOf(w.item) && folderIdOf(w.item) !== library ? folderName(folderIdOf(w.item)) : ''].filter(Boolean).join(' · ')}
          selecting={selecting} selected={selected.includes(w.item.id)} onToggle={() => toggle(w.item.id)} onOpen={() => setPreview(w.item)} menu={moveMenu([w.item.id], folderIdOf(w.item) || undefined)}/>)}
      </div>)}</div>}
    {hasMore && !error && <div className="assets-more"><Button loading={loading} onClick={() => void loadMore()}>加载更多</Button></div>}
    <input ref={fileInput} hidden multiple type="file" accept={ACCEPT[tab]} aria-label="选择要上传的文件" onChange={e => { const files = [...(e.target.files || [])]; e.target.value = ''; if (files.length) void upload(files); }}/>
    <FolderDialog value={newFolderFor ? { name: '' } : undefined} onClose={() => setNewFolderFor(undefined)} onSaved={f => { const ids = newFolderFor || []; setNewFolderFor(undefined); onFoldersChanged(); void move(ids, f.id); }}/>
    <Modal open={!!preview} title={preview?.title} footer={null} width={960} getContainer={studioOverlayContainer} className="library-preview-modal" onCancel={() => setPreview(undefined)} destroyOnHidden>
      {preview && <div className="library-full-preview">{preview.kind === 'image' ? <SignedImage storageKey={preview.data.storageKey} src={preview.data.dataUrl} alt={preview.title}/> : preview.kind === 'video' ? <SignedVideo storageKey={preview.data.storageKey} src={preview.data.url} controls preload="metadata"/> : preview.kind === 'audio' ? <SignedAudio storageKey={preview.data.storageKey} src={preview.data.url} controls/> : <pre>{preview.data.content}</pre>}{typeof preview.metadata?.prompt === 'string' && <details><summary>生成时的描述</summary><p>{preview.metadata.prompt}</p></details>}</div>}
    </Modal>
  </div>;
}

function MaterialTile({ item, subline, selecting, selected, onToggle, onOpen, menu }: {
  item: LibraryMaterial; subline: string; selecting: boolean; selected: boolean;
  onToggle: () => void; onOpen: () => void; menu: MenuProps;
}) {
  const unavailable = item.metadata?.unavailable === true;
  const ratio = item.kind === 'image' || item.kind === 'video' ? mediaRatio(item.data.width, item.data.height, item.kind === 'video' ? 16 / 9 : 1) : item.kind === 'text' ? 0.75 : 1;
  const media = unavailable ? <span className="assets-tile-blank">暂时读不到</span>
    : item.kind === 'image' ? <AssetThumb kind="image" storageKey={item.data.storageKey} src={item.data.dataUrl}/>
    : item.kind === 'video' ? <AssetThumb kind="video" storageKey={item.data.storageKey} src={item.data.url}/>
    : item.kind === 'audio' ? <span className="assets-tile-audio"><AudioLines size={34} strokeWidth={1.3}/></span>
    : <span className="assets-tile-text"><FileText size={15}/><span>{item.data.content.replace(/^#{1,6}\s*/gm, '').slice(0, 220)}</span></span>;
  // 文字卡片本身就是文字，不再压一个「文字」标签在正文上。
  const badge = item.kind === 'video' ? <><Film size={11}/>视频</> : item.kind === 'audio' ? <><Mic size={11}/>音频</> : null;
  return <div className={`assets-tile${selected ? ' is-selected' : ''}`}>
    <button type="button" className="assets-tile-media" style={{ aspectRatio: `1 / ${ratio}` }} aria-label={`${selecting ? '选择' : '打开'} ${item.title}`} aria-pressed={selecting ? selected : undefined} onClick={selecting ? onToggle : onOpen}>
      {media}
      {badge && <span className="assets-tile-badge">{badge}</span>}
    </button>
    {selecting
      ? <Checkbox className="assets-tile-check" aria-label={`选择 ${item.title}`} checked={selected} onChange={onToggle}/>
      : <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={menu}>
        <button type="button" className="assets-tile-move" aria-label={`把 ${item.title} 移到资产库`}><span>移到</span><ChevronDown size={12}/><MoreHorizontal size={15}/></button>
      </Dropdown>}
    <strong title={item.title}>{item.title}</strong>
    <small>{subline}</small>
  </div>;
}

function VoiceTile({ voice }: { voice: VoiceAsset }) {
  const kind = voice.kind === 'clone' ? '克隆声' : voice.kind === 'design' ? '设计声' : '预设音色';
  return <div className="assets-tile">
    <Link className="assets-tile-media" style={{ aspectRatio: '1 / 1' }} href={studioHref('#/voice')} aria-label={`管理声音 ${voice.name}`}>
      <span className="assets-tile-audio">{voice.wave?.length
        ? <span className="assets-wave" aria-hidden="true">{voice.wave.slice(0, 24).map((h, i) => <i key={i} style={{ height: `${Math.max(4, Math.min(40, h))}px` }}/>)}</span>
        : <AudioLines size={34} strokeWidth={1.3}/>}</span>
      <span className="assets-tile-badge"><Mic size={11}/>人物的声音</span>
    </Link>
    <strong title={voice.name}>{voice.name}</strong>
    <small>{[kind, voice.lang].filter(Boolean).join(' · ')}</small>
  </div>;
}
