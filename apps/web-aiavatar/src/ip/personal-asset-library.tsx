"use client";
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Checkbox, Input, Modal, Select, Tabs, Dropdown } from 'antd';
import { FolderOpen, Folder, Plus, Upload, UserRound, MapPin, Box, MoreHorizontal, Images, FileText, Film, Music2, Search, RefreshCw, ArrowUpRight, Expand, X } from 'lucide-react';
import type { LibraryObject, LibraryFolder, LibraryMaterial, IpProject } from '@ai-star-eco/types';
import { apiFetch } from '@ai-star-eco/api-client';
import { libraryFolders, libraryObjects, libraryMaterials, createLibraryFolder, renameLibraryFolder, deleteLibraryFolder, editLibraryMaterial, createLibraryObject, mainLibraryVersion, uploadLibraryMedia, addLibraryVersion, setCanvasLibraryFolder } from '@/canvas-bridge/asset-library';
import { saveAsset } from '@/canvas-bridge/saved-assets';
import { attachmentNode, savedAssetPayload } from '@/canvas-bridge/studio-attachments';
import { libraryObjectAsset } from '@/canvas-bridge/library-reference';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { LibraryAssetEditor } from './library-asset-editor';
import { LibraryFolderSelect } from './library-folder-select';
import { LibraryGridMotion } from './library-grid-motion';
import { LibraryWorkspace } from './library-workspace';
import { studioOverlayContainer } from './studio-overlay';

const objectLabels = { character: '角色', scene: '场景', prop: '道具' };
const mediaLabels = { image: '图片', video: '视频', audio: '音频', text: '文本' };
type SupplementaryTab = { key: string; label: string; icon: ReactNode; count?: number; children: ReactNode };

export function PersonalAssetLibrary({ supplementaryTabs = [] }: { supplementaryTabs?: SupplementaryTab[] }) {
  const { message, modal } = useStudioApp();
  const router = useRouter();
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folder, setFolder] = useState('all');
  const [tab, setTab] = useState('objects');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const [objects, setObjects] = useState<LibraryObject[]>([]);
  const [materials, setMaterials] = useState<LibraryMaterial[]>([]);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useStudioErrorState();
  const [folderError, setFolderError] = useStudioErrorState();
  const [actionError, setActionError] = useStudioErrorState();
  const [counts, setCounts] = useState<{ objects?: number; materials?: number }>({});
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<LibraryObject[]>();
  const [preview, setPreview] = useState<LibraryMaterial>();
  const [folderDialog, setFolderDialog] = useState<{ id?: string; name: string }>();
  const [newObject, setNewObject] = useState<{ name: string; kind: string; description: string; storageKey?: string }>();
  const [organize, setOrganize] = useState<LibraryMaterial>();
  const [moveFolder, setMoveFolder] = useState('');
  const epoch = useRef(0);
  const upload = useRef<HTMLInputElement>(null);
  const actionPending = useRef(false);
  const pendingCanvas = useRef<{ assetId: string; project: IpProject } | undefined>(undefined);
  const refresh = () => setRevision(r => r + 1);
  const isLibraryTab = tab === 'objects' || tab === 'materials';

  useEffect(() => {
    let valid = true;
    libraryFolders().then(f => { if (valid) { setFolders(f); setFolderError(''); } })
      .catch(e => valid && setFolderError(e));
    return () => { valid = false; };
  }, [revision]);

  // Navigation counts describe the complete library, never the current search results.
  useEffect(() => {
    let valid = true;
    Promise.allSettled([libraryObjects(), libraryMaterials()]).then(([a, b]) => {
      if (valid) setCounts({ objects: a.status === 'fulfilled' ? a.value.total : undefined, materials: b.status === 'fulfilled' ? b.value.total : undefined });
    });
    return () => { valid = false; };
  }, [revision]);

  useEffect(() => {
    if (!isLibraryTab) return;
    const id = ++epoch.current;
    setLoading(true);
    setListError('');
    setSelected([]);
    const timer = setTimeout(() => {
      void (tab === 'objects' ? libraryObjects({ folder, query, status, page }) : libraryMaterials({ folder, query, kind, page }))
        .then(result => {
          if (id !== epoch.current) return;
          setTotal(result.total); setMore(result.hasMore);
          if (tab === 'objects') setObjects(result.items as LibraryObject[]);
          else setMaterials(result.items as LibraryMaterial[]);
        }).catch(e => id === epoch.current && setListError(e))
        .finally(() => id === epoch.current && setLoading(false));
    }, 180);
    return () => { clearTimeout(timer); epoch.current++; };
  }, [folder, query, status, kind, page, tab, revision, isLibraryTab]);

  const act = async (action: () => Promise<void>) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setActionError('');
    try { await action(); refresh(); }
    catch (e) { setActionError(e); }
    finally { actionPending.current = false; setBusy(false); }
  };
  const folderName = (id?: string) => id ? folders.find(f => f.id === id)?.name || '文件夹名称暂不可用' : '未分类';
  const changeFolder = (value: string) => { setFolder(value); setPage(0); setSelected([]); };
  const folderOptions = [{ value: 'all', label: '全部文件夹' }, { value: 'unfiled', label: '未分类' }, ...folders.map(f => ({ value: f.id, label: f.name }))];
  const useOnNewCanvas = async (a: LibraryObject) => {
    const p = pendingCanvas.current?.assetId === a.id ? pendingCanvas.current.project : await apiFetch<IpProject>('/v1/ip-studio/projects', { method: 'POST', body: { name: `${a.name} · 创作` } });
    pendingCanvas.current = { assetId: a.id, project: p };
    const node = attachmentNode(savedAssetPayload(libraryObjectAsset(a, folderName(a.folderId))), []);
    await apiFetch(`/v1/ip-studio/projects/${p.id}`, { method: 'PUT', body: { baseDocVersion: p.docVersion, doc: { ...p.doc, nodes: [node], libraryFolderId: a.folderId } } });
    await setCanvasLibraryFolder(p.id, a.folderId);
    pendingCanvas.current = undefined; router.push(`/projects/${p.id}`);
  };
  const showNewObject = () => setNewObject({ name: '', kind: 'character', description: '' });
  const selection = objects.filter(a => selected.includes(a.id));
  const filtered = query.trim() || folder !== 'all' || (tab === 'objects' ? status !== 'all' : kind !== 'all');

  const libraryContent = <LibraryWorkspace navigation={
    <aside className="library-folders" aria-label="文件夹导航">
      <div className="library-folders-heading"><h2>文件夹</h2><button aria-label="新建文件夹" onClick={() => setFolderDialog({ name: '' })}><Plus size={17}/></button></div>
      <nav>{folderOptions.map(f => <button key={f.value} aria-current={folder === f.value ? 'true' : undefined} onClick={() => changeFolder(f.value)}>{f.value === 'all' ? <Images size={17}/> : f.value === 'unfiled' ? <FolderOpen size={17}/> : <Folder size={17}/>}<span>{f.label}</span></button>)}</nav>
      <p className="library-folder-hint">按作品或主题整理，下一次创作更好找。</p>
    </aside>}>
      <div className="library-mobile-folder"><LibraryFolderSelect folders={folders} value={folder} options={folderOptions} ariaLabel="资产范围" onChange={changeFolder}/><Button aria-label="新建文件夹" icon={<Plus size={16}/>} onClick={() => setFolderDialog({ name: '' })}/></div>
      {folderError && <div className="library-notice">文件夹读取失败：<StudioErrorNotice error={folderError}/><Button size="small" onClick={refresh}>重新读取文件夹</Button></div>}
      <div className="library-section-heading">
        <div><div className="library-section-title"><h2>{folder === 'all' ? tab === 'objects' ? '剧本资产' : '生成与上传' : folder === 'unfiled' ? '未分类' : folderName(folder)}</h2>{folders.some(f => f.id === folder) && <Dropdown getPopupContainer={studioOverlayContainer} menu={{ items: [{ key: 'rename', label: '重命名文件夹' }, { key: 'delete', label: '删除文件夹' }], onClick: ({ key }) => key === 'rename' ? setFolderDialog({ id: folder, name: folderName(folder) }) : modal.confirm({ title: '删除文件夹？', content: '内容会保留并移到未分类，画布引用不受影响。', okText: '保留内容并删除', onOk: () => act(async () => { await deleteLibraryFolder(folder); changeFolder('all'); }) }) }}><Button type="text" aria-label="管理文件夹" icon={<MoreHorizontal size={17}/>}/></Dropdown>}</div><p>{tab === 'objects' ? '角色、场景与道具的设定和图片版本。' : '每次生成的结果与上传素材，都保存在这里。'}</p></div>
        <div className="library-create-actions"><Button icon={<Upload size={16}/>} disabled={busy} onClick={() => upload.current?.click()}>上传素材</Button>{tab === 'objects' && <Button type="primary" icon={<Plus size={16}/>} disabled={busy} onClick={showNewObject}>新建资产</Button>}</div>
      </div>
      <div className="library-filter-bar">
        <Input prefix={<Search size={16}/>} allowClear aria-label="搜索个人资产" placeholder="搜索名称、描述或来源" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>
        {tab === 'objects' ? <Select aria-label="资产配图状态" value={status} onChange={v => { setStatus(v); setPage(0); }} options={[{ value: 'all', label: '全部配图状态' }, { value: 'pending', label: '待配图' }, { value: 'ready', label: '已有主图' }]}/> : <Select aria-label="素材媒体类型" value={kind} onChange={v => { setKind(v); setPage(0); }} options={[{ value: 'all', label: '全部类型' }, ...Object.entries(mediaLabels).map(([value, label]) => ({ value, label }))]}/>}
        <Button aria-label="刷新资产" title="刷新资产" icon={<RefreshCw size={16}/>} onClick={refresh}/>
      </div>
      <div className="library-result-bar"><span aria-live="polite">{loading ? '正在读取资产…' : listError ? '暂时无法读取资产' : `${total} 项${filtered ? '匹配资产' : '资产'}`}</span>{tab === 'objects' && (selected.length ? <div><span>已选择 {selection.length} 项</span><button onClick={() => setSelected([])}>取消选择</button><Button size="small" onClick={() => setEditing(selection)}>编辑与配图</Button></div> : <span>选择资产，可批量编辑与配图</span>)}</div>
      {actionError && <div className="library-notice"><StudioErrorNotice error={actionError}/><button aria-label="关闭操作提示" onClick={() => setActionError('')}><X size={16}/></button></div>}
      {loading ? <div className="library-grid library-loading" aria-label="正在加载资产">{Array.from({ length: 6 }, (_, i) => <div className="library-skeleton" key={i}><div/><span/><span/></div>)}</div> : listError ? <div className="library-empty"><FolderOpen size={32}/><h3>资产读取失败</h3><p><StudioErrorNotice error={listError}/></p><Button onClick={refresh}>重新读取资产</Button></div> : !total ? <div className="library-empty"><FolderOpen size={32}/><h3>{filtered ? '没有找到匹配资产' : '从第一份素材开始'}</h3><p>{filtered ? '试试其他名称或筛选条件。' : tab === 'objects' ? '在剧本中提取角色、场景和道具，也可以从这里新建。' : '生成结果会自动入库，也可以上传自己的图片、视频、音频或文本。'}</p>{filtered ? <Button onClick={() => { setQuery(''); setStatus('all'); setKind('all'); changeFolder('all'); }}>清除筛选</Button> : <Button type="primary" onClick={tab === 'objects' ? showNewObject : () => upload.current?.click()}>{tab === 'objects' ? '新建资产' : '上传素材'}</Button>}</div> : <LibraryGridMotion motionKey={`${tab}-${page}-${revision}-${query}-${folder}-${status}-${kind}`}>
        {tab === 'objects' ? objects.map(a => {
          const version = mainLibraryVersion(a);
          const Icon = a.kind === 'character' ? UserRound : a.kind === 'scene' ? MapPin : Box;
          const state = a.pendingRun?.status === 'running' ? '配图生成中' : a.pendingRun?.status === 'failed' ? '配图失败' : version ? '已有主图' : '待配图';
          return <article key={a.id} className={`library-card ${selected.includes(a.id) ? 'is-selected' : ''}`} aria-label={`剧本资产 ${a.name}`}>
            <div className="library-card-visual">{version ? <SignedImage storageKey={version.storageKey} src={version.url} alt={a.name} loading="lazy"/> : <div className={`library-object-placeholder library-object-${a.kind}`}><Icon size={40} strokeWidth={1.1}/><span>{objectLabels[a.kind]}设定</span><small>设定已保存</small></div>}<span className="library-type">{objectLabels[a.kind]}</span><Checkbox aria-label={`选择资产 ${a.name}`} className="library-check" checked={selected.includes(a.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))}/></div>
            <div className="library-card-body"><button className="library-card-title" onClick={() => setEditing([a])}>{a.name}</button><p className="library-card-description">{a.description || '尚未填写描述'}</p><div className="library-card-state"><span className={version ? 'has-image' : ''}>{state}</span><small>{a.versions.length} 个版本</small></div><p className="library-card-source" title={a.sources[0]?.title || '资产库创建'}>{a.sources[0]?.title || '资产库创建'}</p><p className="library-card-folder"><Folder size={12}/>{folderName(a.folderId)}</p></div>
            <div className="library-card-actions"><Button type="text" onClick={() => setEditing([a])} aria-label={`编辑与配图 ${a.name}`}>编辑与配图</Button><Button type="text" aria-label={`在新画布使用 ${a.name}`} title="在新画布使用" disabled={busy} icon={<ArrowUpRight size={17}/>} onClick={() => void act(() => useOnNewCanvas(a))}/></div>
          </article>;
        }) : materials.map(a => {
          const Icon = a.kind === 'video' ? Film : a.kind === 'audio' ? Music2 : a.kind === 'text' ? FileText : Images;
          return <article key={a.id} className="library-card" aria-label={`素材 ${a.title}`}>
            <div className="library-card-visual">{a.kind === 'image' ? <SignedImage storageKey={a.data.storageKey} src={a.data.dataUrl} alt={a.title} loading="lazy"/> : a.kind === 'text' ? <div className="library-text-preview"><FileText size={22}/><p>{a.data.content.replace(/^#{1,6}\s*/gm, '').slice(0, 700)}</p></div> : <div className={`library-media-placeholder library-media-${a.kind}`}><Icon size={40} strokeWidth={1.2}/><span>{a.kind === 'video' ? '打开播放视频' : '打开试听音频'}</span></div>}<span className="library-type">{mediaLabels[a.kind]}</span><Button className="library-preview-button" aria-label={`预览素材 ${a.title}`} title="打开预览" icon={<Expand size={16}/>} onClick={() => setPreview(a)}/></div>
            <div className="library-card-body"><button className="library-card-title" onClick={() => setPreview(a)}>{a.title}</button><p className="library-card-source">{a.source || '画布素材'}</p><p className="library-card-folder"><Folder size={12}/>{folderName(typeof a.metadata?.folderId === 'string' ? a.metadata.folderId : undefined)}</p>{a.metadata?.unavailable === true && <p role="status" className="library-notice">素材暂不可读取</p>}</div>
            <div className="library-card-actions"><Button type="text" onClick={() => { setOrganize(a); setMoveFolder(typeof a.metadata?.folderId === 'string' ? a.metadata.folderId : ''); }}>整理</Button>{a.kind === 'image' && <Button type="text" onClick={() => setNewObject({ name: a.title, kind: 'character', description: '', storageKey: a.data.storageKey })}>设为角色</Button>}<Button type="text" aria-label={`打开素材 ${a.title}`} icon={<ArrowUpRight size={17}/>} onClick={() => setPreview(a)}/></div>
          </article>;
        })}
      </LibraryGridMotion>}
      {!loading && !listError && total > 0 && <div className="library-pagination"><span>每页 24 项</span><div><Button disabled={page === 0} onClick={() => setPage(n => n - 1)}>上一页</Button><span>{page + 1} / {Math.max(1, Math.ceil(total / 24))}</span><Button disabled={!more} onClick={() => setPage(n => n + 1)}>下一页</Button></div></div>}
  </LibraryWorkspace>;

  const navLabel = (label: string, icon: ReactNode, count?: number) => <span className="library-category-label">{icon}<span>{label}</span><small>{count ?? '—'}</small></span>;
  return <section id="personal-assets" className="personal-library library-redesign" aria-label="个人资产库">
    <Tabs className="library-categories" activeKey={tab} onChange={v => { setTab(v); setPage(0); setSelected([]); }} items={[
      { key: 'objects', label: navLabel('剧本资产', <UserRound size={17}/>, counts.objects), children: tab === 'objects' ? libraryContent : null },
      { key: 'materials', label: navLabel('生成与上传', <Images size={17}/>, counts.materials), children: tab === 'materials' ? libraryContent : null },
      ...supplementaryTabs.map(t => ({ key: t.key, label: navLabel(t.label, t.icon, t.count), children: t.children })),
    ]}/>
    {editing && <LibraryAssetEditor assets={editing} folders={folders} onClose={() => { setEditing(undefined); refresh(); }} onChange={refresh}/>}
    <Modal open={!!preview} title={preview?.title} footer={null} width={960} getContainer={studioOverlayContainer} className="library-preview-modal" onCancel={() => setPreview(undefined)} destroyOnHidden>
      {preview && <div className="library-full-preview">{preview.kind === 'image' ? <SignedImage storageKey={preview.data.storageKey} src={preview.data.dataUrl} alt={preview.title}/> : preview.kind === 'video' ? <SignedVideo storageKey={preview.data.storageKey} src={preview.data.url} controls preload="metadata"/> : preview.kind === 'audio' ? <SignedAudio storageKey={preview.data.storageKey} src={preview.data.url} controls/> : <pre>{preview.data.content}</pre>}{typeof preview.metadata?.prompt === 'string' && <details><summary>生成指令</summary><p>{preview.metadata.prompt}</p></details>}</div>}
    </Modal>
    <Modal open={!!folderDialog} title={folderDialog?.id ? '重命名文件夹' : '新建文件夹'} getContainer={studioOverlayContainer} confirmLoading={busy} okButtonProps={{ disabled: !folderDialog?.name.trim() }} onCancel={() => !busy && setFolderDialog(undefined)} onOk={() => void act(async () => { if (!folderDialog) return; const f = folderDialog.id ? await renameLibraryFolder(folderDialog.id, folderDialog.name) : await createLibraryFolder(folderDialog.name); changeFolder(f.id); setFolderDialog(undefined); })}><Input aria-label="文件夹名称" value={folderDialog?.name || ''} maxLength={100} onChange={e => setFolderDialog({ ...folderDialog, name: e.target.value })}/>{actionError && <p className="library-form-error"><StudioErrorNotice error={actionError}/></p>}</Modal>
    <Modal open={!!newObject} title="新建可复用资产" getContainer={studioOverlayContainer} confirmLoading={busy} okButtonProps={{ disabled: !newObject?.name.trim() }} onCancel={() => !busy && setNewObject(undefined)} onOk={() => void act(async () => { if (!newObject) return; let a = await createLibraryObject({ name: newObject.name, kind: newObject.kind, description: newObject.description, folderId: folder === 'all' || folder === 'unfiled' ? undefined : folder }); if (newObject.storageKey) a = await addLibraryVersion(a.id, newObject.storageKey); setNewObject(undefined); setTab('objects'); setPage(0); setEditing([a]); })}><div className="personal-editor-fields"><label>名称<Input aria-label="新资产名称" value={newObject?.name || ''} onChange={e => newObject && setNewObject({ ...newObject, name: e.target.value })}/></label><label>类别<Select aria-label="新资产类别" value={newObject?.kind} options={Object.entries(objectLabels).map(([value, label]) => ({ value, label }))} onChange={kind => newObject && setNewObject({ ...newObject, kind })}/></label><label>描述<Input.TextArea aria-label="新资产描述" value={newObject?.description || ''} onChange={e => newObject && setNewObject({ ...newObject, description: e.target.value })}/></label></div>{actionError && <p className="library-form-error"><StudioErrorNotice error={actionError}/></p>}</Modal>
    <Modal open={!!organize} title="整理素材" getContainer={studioOverlayContainer} confirmLoading={busy} onCancel={() => !busy && setOrganize(undefined)} onOk={() => void act(async () => { if (organize) await editLibraryMaterial(organize.id, { folderId: moveFolder || null }); setOrganize(undefined); })}><LibraryFolderSelect folders={folders} value={moveFolder} ariaLabel="素材整理文件夹" onChange={setMoveFolder}/>{actionError && <p className="library-form-error"><StudioErrorNotice error={actionError}/></p>}</Modal>
    <input ref={upload} hidden type="file" accept=".jpg,.jpeg,.png,.mp4,.mp3,.wav,.m4a,.md,.txt" aria-label="上传个人库素材" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void act(async () => { if (/\.(md|txt)$/i.test(f.name)) { const saved = await saveAsset({ kind: 'text', title: f.name, coverUrl: '', tags: [], data: { content: await f.text() } }); if (folder !== 'all' && folder !== 'unfiled') await editLibraryMaterial(saved.id, { folderId: folder }); } else await uploadLibraryMedia(f, /\.mp4$/i.test(f.name) ? 'video' : /\.(mp3|wav|m4a)$/i.test(f.name) ? 'audio' : 'image', folder === 'all' || folder === 'unfiled' ? undefined : folder); setTab('materials'); setPage(0); message.success('素材已保存'); }); }}/>
  </section>;
}
