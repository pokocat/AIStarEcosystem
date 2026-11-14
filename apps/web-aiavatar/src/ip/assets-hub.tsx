"use client";
import { IMAGE_UPLOAD_ACCEPT } from '@ai-star-eco/api-client/image-upload-policy';
// 「资产」页（2026-10-31 改版，设计稿「资产（新）」一排）：
// 按类型分（全部 / 图片 / 视频 / 音频 / 人物 / 场景 / 道具），其余分组交给左边的「资产库」（就是原来的文件夹）。
// 2026-11-07：导演台的场景、道具有图后自动进库，这里加两个分类；来自哪部作品、哪张画布是单独的筛选（地址参数 from）。
// 2026-11-10：「官方形象」从原「发现」页搬来，是平台提供的人物，不在任何资产库里，所以这个标签不显示左边的资产库。
// 「AI 生成」是自带的库：各处做出来、还没放进别的库的东西都在这里，移到别的库就从这里走掉。
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { App, Button, Checkbox, ConfigProvider, Dropdown, Input, Modal, Spin } from 'antd';
import type { MenuProps } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AudioLines, ChevronDown, FileText, Film, Folder, LayoutGrid, Mic, MoreHorizontal, Plus, Search, ShieldCheck } from 'lucide-react';
import type { LibraryFolder, LibraryMaterial } from '@ai-star-eco/types';
import { createLibraryFolder, deleteLibraryFolder, editLibraryMaterial, libraryFolders, libraryMaterials, renameLibraryFolder, uploadLibraryMedia } from '@/canvas-bridge/asset-library';
import { deleteSavedAsset, saveAsset } from '@/canvas-bridge/saved-assets';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { downloadMedia } from '@/canvas-bridge/download-media';
import { signKeys } from '@/canvas-bridge/api';
import { studioHref, useHubData } from '@/components/hub/data';
import { VoiceApi } from '@/proto/api';
import type { VoiceAsset } from '@/proto/data';
import { masonry, mediaRatio, useMasonryColumns } from './asset-masonry';
import { AssetThumb } from './asset-thumb';
import { PortraitVerifiedMark } from './portrait-verified-mark';
import { uploadAssetBatch } from './asset-upload-batch';
import { confirmAssetDelete } from './assets-delete';
import { AudioRecorderDialog } from './audio-recorder-dialog';
import { AI_LIBRARY, ASSETS_DESCRIPTION, libraryQuery, materialOrigin, sourceLabel } from './assets-hub-shared';
import { useLoadMoreOnScroll } from '@/lib/use-load-more-on-scroll';
import { AssetsObjects } from './assets-objects';
import { AssetsOfficial } from './assets-official';
import { AssetsPeople } from './assets-people';
import { LibrarySaveDialog, type LibrarySaveImage } from './library-save-dialog';
import { LibrarySourceSelect } from './library-source-select';
import { AiMark } from './studio-ai-icon';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';
import { StudioPage } from './studio-page';

export type HubTab = 'all' | 'image' | 'video' | 'audio' | 'people' | 'scene' | 'prop' | 'official';
export const HUB_TABS: { value: HubTab; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'image', label: '图片' }, { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' }, { value: 'people', label: '人物' }, { value: 'scene', label: '场景' }, { value: 'prop', label: '道具' }, { value: 'official', label: '官方形象' },
];
// 旧链接（我的 IP / 创作素材 / 生成与上传 / 声音 / 授权形象）落到新分类上。
const LEGACY_TABS: Record<string, HubTab> = { discover: 'official', ips: 'people', objects: 'people', authorized: 'people', materials: 'all', voices: 'audio' };
export function hubTab(raw: string | null): HubTab {
  if (HUB_TABS.some(t => t.value === raw)) return raw as HubTab;
  return (raw && LEGACY_TABS[raw]) || 'all';
}

const SOURCES = [
  { key: 'all', label: '全部来源' }, { key: 'generated', label: 'AI 生成' },
  { key: 'upload', label: '我上传的' }, { key: 'canvas', label: '从画布保存' },
];
const TYPE_LABEL = { image: '图片', video: '视频', audio: '音频', text: '文字' } as const;
type FileTab = Exclude<HubTab, 'people' | 'scene' | 'prop' | 'official'>;
const ACCEPT: Record<FileTab, string> = {
  all: `${IMAGE_UPLOAD_ACCEPT},.mp4,.mp3,.wav,.m4a,.md,.txt`, image: IMAGE_UPLOAD_ACCEPT, video: '.mp4', audio: '.mp3,.wav,.m4a',
};
const folderIdOf = (item: LibraryMaterial) => typeof item.metadata?.folderId === 'string' ? item.metadata.folderId : '';

export function AssetsHub() {
  const router = useRouter(), search = useSearchParams();
  const tab = hubTab(search.get('tab'));
  const library = search.get('lib') || 'all';
  const from = search.get('from') || '';
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folderRevision, setFolderRevision] = useState(0);
  const [folderError, setFolderError] = useStudioErrorState();
  const [foldersRead, setFoldersRead] = useState(false);
  useEffect(() => {
    let live = true;
    libraryFolders().then(f => { if (live) { setFolders(f); setFolderError(''); } }).catch(e => live && setFolderError(e)).finally(() => live && setFoldersRead(true));
    return () => { live = false; };
  }, [folderRevision, setFolderError]);
  const go = (next: { tab?: HubTab; library?: string; from?: string }) => {
    const params = new URLSearchParams(search.toString());
    if (next.tab) params.set('tab', next.tab);
    if (next.from !== undefined) { if (next.from) params.set('from', next.from); else params.delete('from'); }
    if (next.library !== undefined) { if (next.library === 'all') params.delete('lib'); else params.set('lib', next.library); }
    params.delete('focus');
    router.push(`/assets?${params}`);
  };
  // 删掉或读不到的库不留在地址里空着。
  const builtIn = library === 'all' || library === AI_LIBRARY;
  const current = builtIn || folders.some(f => f.id === library) || (foldersRead && !!folderError) ? library : 'all';
  // 地址里是自己建的库：等库列表读回来再读内容，免得先按一个不存在的库读一遍。
  const ready = builtIn || foldersRead;
  return <StudioPage title="资产" description={ASSETS_DESCRIPTION} className="assets-hub-page" actions={<Link className="ip-brand-secondary" href="/assets/verification"><ShieldCheck aria-hidden/>人像核验</Link>}>
    <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} getPopupContainer={studioOverlayContainer} theme={{ token: { colorPrimary: '#17202a', borderRadius: 10, fontFamily: 'var(--ip-ui)' } }}>
      <App className="assets-hub" data-studio-overlay-root>
        <div className="assets-hub-tabs" role="tablist" aria-label="资产分类">
          {HUB_TABS.map(t => <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => go({ tab: t.value })}>{t.label}</button>)}
        </div>
        <div className="assets-hub-body">
          {tab !== 'official' && <LibraryNav folders={folders} value={current} error={folderError} onRetry={() => setFolderRevision(n => n + 1)} onChange={id => go({ library: id })} onChanged={() => setFolderRevision(n => n + 1)}/>}
          <section className="assets-hub-main" aria-label={HUB_TABS.find(t => t.value === tab)?.label}>
            {tab === 'official' ? <AssetsOfficial/> : !ready ? null : tab === 'people'
              ? <AssetsPeople library={current} folders={folders} from={from} onFromChange={id => go({ from: id })}/>
              : tab === 'scene' || tab === 'prop'
              ? <AssetsObjects key={tab} kind={tab} library={current} folders={folders} from={from} onFromChange={id => go({ from: id })} onShowAll={() => go({ library: 'all' })}/>
              : <MediaWall key={`${tab}:${current}`} tab={tab} library={current} folders={folders} from={from} onFromChange={id => go({ from: id })} onFoldersChanged={() => setFolderRevision(n => n + 1)}/>}
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
    title: `删除「${f.name}」？`, content: '库中的素材不会被删除，仍可在「全部」中找到。已在画布中使用的素材不受影响。', okText: '删除资产库', okButtonProps: { danger: true },
    onOk: async () => { await deleteLibraryFolder(f.id); if (value === f.id) onChange('all'); onChanged(); },
  });
  return <nav className="assets-libs" aria-label="资产库">
    <h2>资产库</h2>
    {row('all', '全部', <span className="assets-lib-icon"><LayoutGrid size={13} strokeWidth={1.6}/></span>)}
    {row(AI_LIBRARY, 'AI 生成', <span className="assets-lib-icon is-ai"><AiMark size={12}/></span>)}
    <hr/>
    {folders.map(f => <div className="assets-lib-row" key={f.id}>
      {row(f.id, f.name, <span className="assets-lib-icon"><Folder size={13} strokeWidth={1.6}/></span>)}
      <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={{ items: [{ key: 'rename', label: '重命名' }, { key: 'delete', label: '删除', danger: true }], onClick: ({ key }) => key === 'rename' ? setDialog({ id: f.id, name: f.name }) : remove(f) }}>
        <button type="button" className="assets-lib-more" aria-label={`管理资产库 ${f.name}`}><MoreHorizontal size={15}/></button>
      </Dropdown>
    </div>)}
    {error && <p className="assets-libs-error"><StudioErrorNotice error={error}/><button type="button" onClick={onRetry}>重试</button></p>}
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
  return <Modal open={!!value} title={value?.id ? '重命名资产库' : '新建资产库'} okText={value?.id ? '保存' : '新建'} cancelText="取消" getContainer={studioOverlayContainer} confirmLoading={busy}
    okButtonProps={{ disabled: !name.trim() }} onCancel={() => !busy && onClose()} onOk={() => void save()} destroyOnHidden>
    <Input autoFocus aria-label="资产库名称" placeholder="例如：保湿精华、巷里火锅" value={name} maxLength={100} onChange={e => setName(e.target.value)} onPressEnter={() => name.trim() && void save()}/>
    {error && <p className="assets-form-error"><StudioErrorNotice error={error}/></p>}
  </Modal>;
}

type WallItem = { type: 'upload' } | { type: 'voice'; voice: VoiceAsset } | { type: 'material'; item: LibraryMaterial };

/** 图片 / 视频 / 音频 / 全部：瀑布流，第一张是上传。 */
function MediaWall({ tab, library, folders, from, onFromChange, onFoldersChanged }: {
  tab: FileTab; library: string; folders: LibraryFolder[]; from: string; onFromChange: (id: string) => void; onFoldersChanged: () => void;
}) {
  const { message, modal } = useStudioApp();
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
  const [recording, setRecording] = useState(false);
  const [newFolderFor, setNewFolderFor] = useState<string[]>();
  const [saving, setSaving] = useState<LibrarySaveImage>();
  const epoch = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const columns = useMasonryColumns(wall);
  const isAi = library === AI_LIBRARY;
  const filtered = !!query || source !== 'all' || !!from;

  useEffect(() => { const timer = setTimeout(() => setQuery(keyword.trim()), 220); return () => clearTimeout(timer); }, [keyword]);
  const fetchPage = (n: number) => libraryMaterials({
    ...libraryQuery(library), kind: tab, ...(isAi ? {} : { source }), query: query || undefined, projectId: from || undefined, page: n,
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
  }, [tab, library, query, source, from, revision]);
  const loadMore = async () => {
    const id = epoch.current;
    setLoading(true);
    try { const r = await fetchPage(page + 1); if (id !== epoch.current) return; setItems(old => [...old, ...r.items.filter(i => !old.some(o => o.id === i.id))]); setPage(page + 1); setHasMore(r.hasMore); setTotal(r.total); }
    catch (e) { if (id === epoch.current) setError(e); }
    finally { if (id === epoch.current) setLoading(false); }
  };
  const end = useLoadMoreOnScroll(hasMore && !loading && !error && !preview && !saving && !recording && !uploading, page, loadMore);

  // 「音频」里人物的声音也列出来（克隆声、设计声、预设音色），点开去声音工作室管理。只在「全部」库、不筛来源时出现。
  const showVoices = tab === 'audio' && library === 'all' && source === 'all' && !from;
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
  const remove = (ids: string[], title?: string) => confirmAssetDelete(modal, {
    ids, title, noun: '素材', remove: deleteSavedAsset,
    onDone: ({ removed, error }) => {
      setActionError(error || '');
      if (removed.length && !error) message.success(removed.length > 1 ? `已删除 ${removed.length} 个素材` : '已删除');
      if (!error) { setSelected([]); setSelecting(false); }
      if (preview && removed.includes(preview.id)) setPreview(undefined);
      setRevision(n => n + 1);
    },
  });
  const saveTarget = (item: LibraryMaterial): LibrarySaveImage | undefined => {
    if (item.kind !== 'image' || !item.data.storageKey) return undefined;
    const project = item.metadata?.projectId, node = item.metadata?.nodeId;
    return { storageKey: item.data.storageKey, src: item.data.dataUrl, title: item.title, folderId: folderIdOf(item) || undefined,
      // 只有画布记成来源；导演台的图有自己的卡，这里按新存的一项处理。
      projectId: typeof project === 'string' && project.startsWith('IPP-') ? project : undefined, nodeId: typeof node === 'string' ? node : undefined };
  };
  const moveMenu = (ids: string[], currentFolder?: string, item?: LibraryMaterial): MenuProps => {
    const target = item && saveTarget(item);
    const moves = [
      ...folders.map(f => ({ key: f.id, label: f.name, icon: <Folder size={14}/>, disabled: f.id === currentFolder })),
      ...(folders.length ? [{ type: 'divider' as const }] : []),
      { key: '__new', label: '新建资产库…', icon: <Plus size={14}/> },
      ...(currentFolder ? [{ key: '__out', label: '移出资产库' }] : []),
    ];
    return {
      // 卡片上的菜单除了移动还有别的操作，移动单独成组，看得出「新建资产库」会把图放进去。
      items: item ? [
        { type: 'group' as const, key: '__move', label: '移到资产库', children: moves },
        ...(target ? [{ type: 'divider' as const }, { key: '__object', label: '存为角色、场景或道具' }] : []),
        { type: 'divider' as const }, { key: '__delete', label: '删除', danger: true },
      ] : moves,
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === '__new') setNewFolderFor(ids);
        else if (key === '__object') setSaving(target);
        else if (key === '__delete') remove(ids, item?.title);
        else void move(ids, key === '__out' ? null : key);
      },
    };
  };

  const upload = async (files: File[]) => {
    const folderId = library !== 'all' && !isAi ? library : undefined;
    setUploading(true); setActionError('');
    try {
      const { uploaded, error } = await uploadAssetBatch(files, async file => {
        if (/\.(md|txt)$/i.test(file.name)) {
          const saved = await saveAsset({ kind: 'text', title: file.name, coverUrl: '', tags: [], data: { content: await file.text() } });
          if (folderId) await editLibraryMaterial(saved.id, { folderId });
        } else await uploadLibraryMedia(file, /\.mp4$/i.test(file.name) ? 'video' : /\.(mp3|wav|m4a)$/i.test(file.name) ? 'audio' : 'image', folderId);
      });
      if (error) setActionError(error);
      else message.success(uploaded.length > 1 ? `已上传 ${uploaded.length} 个文件` : '已上传');
      setRevision(n => n + 1);
    }
    finally { setUploading(false); }
  };

  const wallItems: WallItem[] = [
    ...(!isAi && !selecting && !filtered ? [{ type: 'upload' as const }] : []),
    ...voiceItems.map(voice => ({ type: 'voice' as const, voice })),
    ...items.map(item => ({ type: 'material' as const, item })),
  ];
  // The upload tile includes its action row: its complete outline aligns with the adjacent audio cover.
  const uploadRatio = tab === 'audio' || tab === 'all' ? 1 : 4 / 3;
  const ratioOf = (w: WallItem) => w.type === 'upload' ? uploadRatio : w.type === 'voice' ? 1 : w.item.kind === 'image' || w.item.kind === 'video' ? mediaRatio(w.item.data.width, w.item.data.height, w.item.kind === 'video' ? 16 / 9 : 1) : w.item.kind === 'text' ? 0.75 : 1;
  const columnsOfItems = masonry(wallItems, columns, ratioOf);
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const count = total + voiceItems.length;
  const sourceName = SOURCES.find(s => s.key === source)?.label;

  return <div ref={wall} className="assets-wall-panel">
    {isAi && <header className="assets-lib-head"><span className="assets-lib-icon is-ai"><AiMark size={14}/></span><div><h2>AI 生成</h2><p>AI 生成的图片、视频和音频会自动保存在这里。</p></div></header>}
    <div className="assets-toolbar">
      <Input className="assets-search" prefix={<Search size={15}/>} allowClear aria-label="搜索资产" placeholder="搜索名称或提示词" value={keyword} onChange={e => setKeyword(e.target.value)}/>
      {!isAi && <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={{ items: SOURCES.map(s => ({ key: s.key, label: s.label })), selectable: true, selectedKeys: [source], onClick: ({ key }) => setSource(key) }}>
        <button type="button" className="assets-select" aria-label="按来源筛选">{sourceName}<ChevronDown size={14}/></button>
      </Dropdown>}
      <LibrarySourceSelect value={from} onChange={onFromChange}/>
      <span className="assets-toolbar-gap"/>
      <span className="assets-count" aria-live="polite">{loading && !items.length ? '正在加载…' : `${count} 个`}</span>
      {selecting
        ? <><span className="assets-count">已选 {selected.length} 个</span>
          <Dropdown trigger={['click']} disabled={!selected.length} getPopupContainer={studioOverlayContainer} menu={moveMenu(selected)}><Button disabled={!selected.length}>移到<ChevronDown size={14}/></Button></Dropdown>
          <Button danger disabled={!selected.length} onClick={() => remove(selected)}>删除</Button>
          <Button onClick={() => { setSelecting(false); setSelected([]); }}>取消选择</Button></>
        : !!items.length && <Button onClick={() => setSelecting(true)}>选择</Button>}
    </div>
    {actionError && <p className="assets-notice"><StudioErrorNotice error={actionError}/></p>}
    {error ? <div className="assets-empty"><p><StudioErrorNotice error={error}/></p><Button onClick={() => setRevision(n => n + 1)}>重试</Button></div>
      : loading && !items.length && !voiceItems.length ? <div className="assets-wall is-loading" aria-label="正在加载资产">{Array.from({ length: columns }, (_, i) => <div key={i} className="assets-wall-col"><span className="assets-skeleton" style={{ aspectRatio: i % 2 ? '3 / 4' : '1 / 1' }}/><span className="assets-skeleton" style={{ aspectRatio: '4 / 3' }}/></div>)}</div>
      : !wallItems.length ? <div className="assets-empty">
        {isAi ? <><h3>还没有 AI 生成的素材</h3><p>在 AI 图片、AI 视频或画布中生成的内容会自动保存在这里。</p><div><Link className="ip-brand-secondary" href="/image">生成图片</Link></div></>
          : <><h3>没有找到匹配的素材</h3><p>请尝试其他名称或来源。</p><Button onClick={() => { setKeyword(''); setSource('all'); onFromChange(''); }}>清除筛选</Button></>}
      </div>
      : <div className="assets-wall">{columnsOfItems.map((col, i) => <div key={i} className="assets-wall-col">{col.map(w =>
        w.type === 'upload' ? <div key="upload" className="assets-upload-tile" style={{ aspectRatio: `1 / ${uploadRatio}` }}><button type="button" className="assets-upload" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <span className="assets-upload-plus"><Plus size={18}/></span>{uploading ? '正在上传…' : '上传'}<small>{tab === 'all' ? '图片、视频、音频' : TYPE_LABEL[tab]}</small>
        </button>
          {(tab === 'audio' || tab === 'all') && <div className="assets-upload-actions"><button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>上传文件</button><button type="button" disabled={uploading} onClick={() => setRecording(true)}><Mic size={14}/>录音</button></div>}
        </div>
        : w.type === 'voice' ? <VoiceTile key={`voice:${w.voice.id}`} voice={w.voice}/>
        : <MaterialTile key={w.item.id} item={w.item} subline={[from ? '' : materialOrigin(w.item.metadata)?.title, sourceLabel(w.item.source), folderIdOf(w.item) && folderIdOf(w.item) !== library ? folderName(folderIdOf(w.item)) : ''].filter(Boolean).join(' · ')}
          selecting={selecting} selected={selected.includes(w.item.id)} onToggle={() => toggle(w.item.id)} onOpen={() => setPreview(w.item)} menu={moveMenu([w.item.id], folderIdOf(w.item) || undefined, w.item)}/>)}
      </div>)}</div>}
    {hasMore && !error && <div ref={end} className="scroll-more assets-more">{loading ? <Spin size="small"/> : <ChevronDown size={18} aria-hidden/>}</div>}

    <input ref={fileInput} hidden multiple type="file" accept={ACCEPT[tab]} aria-label="选择要上传的文件" onChange={e => { const files = [...(e.target.files || [])]; e.target.value = ''; if (files.length) void upload(files); }}/>
    <AudioRecorderDialog open={recording} onClose={() => setRecording(false)} onSave={async file => {
      await uploadLibraryMedia(file, 'audio', library !== 'all' && !isAi ? library : undefined);
      setKeyword(''); setSource('all'); setRevision(n => n + 1); message.success('录音已保存到资产库');
    }}/>
    <FolderDialog value={newFolderFor ? { name: '' } : undefined} onClose={() => setNewFolderFor(undefined)} onSaved={f => { const ids = newFolderFor || []; setNewFolderFor(undefined); onFoldersChanged(); void move(ids, f.id); }}/>
    <LibrarySaveDialog image={saving} onClose={() => setSaving(undefined)}/>
    <Modal open={!!preview} title={preview?.title} footer={null} width={960} getContainer={studioOverlayContainer} className="library-preview-modal" onCancel={() => setPreview(undefined)} destroyOnHidden>
      {preview && <div className="library-full-preview">{preview.kind === 'image' ? <SignedImage storageKey={preview.data.storageKey} src={preview.data.dataUrl} alt={preview.title}/> : preview.kind === 'video' ? <SignedVideo storageKey={preview.data.storageKey} src={preview.data.url} controls preload="metadata"/> : preview.kind === 'audio' ? <SignedAudio storageKey={preview.data.storageKey} src={preview.data.url} controls/> : <pre>{preview.data.content}</pre>}{typeof preview.metadata?.prompt === 'string' && <details><summary>提示词</summary><p>{preview.metadata.prompt}</p></details>}</div>}
      {preview && <PreviewFoot item={preview} canSave={!!saveTarget(preview)} onSave={() => { setSaving(saveTarget(preview)); setPreview(undefined); }}/>}
    </Modal>
  </div>;
}

/** 预览下面：来自哪部作品或哪张画布（能跳回去），图片可以存成角色、场景或道具。 */
function PreviewFoot({ item, canSave, onSave }: { item: LibraryMaterial; canSave: boolean; onSave: () => void }) {
  const origin = materialOrigin(item.metadata);
  const [downloading, setDownloading] = useState(false);
  const { message } = useStudioApp();
  const original = item.kind === 'video' && typeof item.metadata?.originalStorageKey === 'string' ? item.metadata.originalStorageKey : undefined;
  const downloadOriginal = async () => {
    if (!original || downloading) return;
    setDownloading(true);
    try {
      const url = (await signKeys([original]))[original];
      if (!url) throw new Error('原片暂时无法读取，请重试');
      await downloadMedia(url, item.title.replace(/\.mp4$/i, ''), 'video/mp4', original);
    } catch (error) { message.error(error, '下载原片'); }
    finally { setDownloading(false); }
  };
  const inObject = typeof item.metadata?.objectName === 'string' ? item.metadata.objectName : '';
  if (!origin && !canSave && !inObject && !original) return null;
  const noun = origin?.type === 'director' ? '导演台作品' : '画布';
  return <footer className="assets-preview-foot">
    {origin && (origin.href ? <Link href={origin.href}>来自{noun}「{origin.title}」</Link> : <span>来自{noun}「{origin.title}」（已删除）</span>)}
    {inObject && <span>已保存到「{inObject}」</span>}
    <span className="assets-toolbar-gap"/>
    {original && <Button loading={downloading} onClick={() => void downloadOriginal()}>下载原片</Button>}
    {canSave && <Button onClick={onSave}>{inObject ? '加到其他角色、场景或道具' : '存为角色、场景或道具'}</Button>}
  </footer>;
}

function MaterialTile({ item, subline, selecting, selected, onToggle, onOpen, menu }: {
  item: LibraryMaterial; subline: string; selecting: boolean; selected: boolean;
  onToggle: () => void; onOpen: () => void; menu: MenuProps;
}) {
  const unavailable = item.metadata?.unavailable === true;
  const ratio = item.kind === 'image' || item.kind === 'video' ? mediaRatio(item.data.width, item.data.height, item.kind === 'video' ? 16 / 9 : 1) : item.kind === 'text' ? 0.75 : 1;
  const media = unavailable ? <span className="assets-tile-blank">加载失败</span>
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
      {!unavailable && item.kind === 'image' && <PortraitVerifiedMark storageKey={item.data.storageKey}/>}
    </button>
    {selecting
      ? <Checkbox className="assets-tile-check" aria-label={`选择 ${item.title}`} checked={selected} onChange={onToggle}/>
      : <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={menu}>
        <button type="button" className="assets-tile-move" aria-label={`${item.title} 的更多操作`}><span>更多</span><ChevronDown size={12}/><MoreHorizontal size={15}/></button>
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
      <span className="assets-tile-badge"><Mic size={11}/>人物声音</span>
    </Link>
    <strong title={voice.name}>{voice.name}</strong>
    <small>{[kind, voice.lang].filter(Boolean).join(' · ')}</small>
  </div>;
}
