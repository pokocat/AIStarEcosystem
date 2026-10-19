"use client";
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';

import { useEffect, useRef, useState } from 'react';
import { App, Button, Checkbox, Input, Modal, Select, Skeleton, Tabs } from 'antd';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import type { LibraryExtraction, LibraryCandidate, LibraryFolder, LibraryObject } from '@ai-star-eco/types';
import type { StudioNodeMetadata, StudioCapabilities } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { extractLibraryAssets, saveLibraryExtraction, libraryFolders, createLibraryFolder, libraryObjects, canvasLibraryFolder } from '@/canvas-bridge/asset-library';
import { studioCapabilities } from '@/canvas-bridge/studio-api';
import { readRun } from '@/canvas-bridge/api';
import { LibraryAssetEditor } from './library-asset-editor';
import { LibraryFolderSelect } from './library-folder-select';
import { LibraryScriptAssets } from './library-script-assets';
import { extractionSourceHash } from './library-extraction-source';
import { StudioAiIcon } from './studio-ai-icon';
import { studioOverlayContainer } from './studio-overlay';

// The source-scoped list is paginated too. Count and display every saved object.
async function readScriptAssets(projectId: string, nodeId: string) {
  const items: LibraryObject[] = [];
  let page = 0;
  while (true) {
    const result = await libraryObjects({ projectId, nodeId, page });
    items.push(...result.items);
    if (!result.hasMore) return items;
    page++;
  }
}

export function LibraryExtractionPanel({ projectId, node, onClose, onTask, onUse }: {
  projectId: string;
  node: CanvasNodeData;
  onClose: () => void;
  onTask: (value: StudioNodeMetadata['assetExtraction']) => Promise<void>;
  onUse: (asset: LibraryObject) => Promise<void>;
}) {
  const { message } = useStudioApp();
  const [result, setResult] = useState<LibraryExtraction>();
  const [candidates, setCandidates] = useState<LibraryCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folder, setFolder] = useState('');
  const [caps, setCaps] = useState<StudioCapabilities>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useStudioErrorState();
  const [editing, setEditing] = useState<LibraryObject[]>();
  const [existing, setExisting] = useState<LibraryObject[]>([]);
  const [model, setModel] = useState<string>();
  const [episode, setEpisode] = useState<number>();
  const [linked, setLinked] = useState<LibraryObject[]>([]);
  const [linkedReady, setLinkedReady] = useState(false);
  const [view, setView] = useState('assets');
  const [newFolder, setNewFolder] = useState<string>();
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const task = useRef(node.metadata?.studio?.assetExtraction);

  const assign = (value: LibraryExtraction) => {
    if (!alive.current) return;
    setResult(value);
    setCandidates(value.items);
    setSelected(value.items.map(item => item.key));
  };
  const wait = async (value: LibraryExtraction, active = () => alive.current) => {
    if (!value.run) return;
    let run = value.run;
    while (active() && run.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 1800));
      if (!active()) return;
      run = await readRun(run.id);
    }
    if (!active()) return;
    if (run.status === 'failed') throw new Error(run.errorMessage || '剧本解析未完成，原文保留');
    const sourceHash = await extractionSourceHash(run, value.sourceHash, task.current?.episodeNo);
    if (!active()) return;
    assign({ ...value, sourceHash, run, items: run.output.assetExtraction?.items || [], warnings: run.output.assetExtraction?.warnings });
  };

  useEffect(() => {
    let cancelled = false;
    const active = () => !cancelled && alive.current;
    alive.current = true;
    setLoading(true);
    setBusy(true);
    setError('');
    setLinkedReady(false);
    Promise.all([
      readScriptAssets(projectId, node.id).then(current => {
        if (!active()) return;
        setLinked(current);
        setLinkedReady(true);
        setView(current.length ? 'assets' : 'extract');
        setLoading(false);
      }),
      libraryFolders().then(value => { if (active()) setFolders(value); }).catch(() => {
        if (active()) setError(value => `${value} 文件夹名称暂时无法读取，已保存资产仍可查看。`.trim());
      }),
      canvasLibraryFolder(projectId).then(value => { if (active()) setFolder(value.folderId); }).catch(() => {
        if (active()) { setFolder(''); setError(value => `${value} 默认文件夹未能读取，保存位置暂设为未分类，请核对后保存。`.trim()); }
      }),
    ]).then(async () => {
        if (!active()) return;
        // Saved assets remain accessible even when analysis/model setup fails.
        const [value, capabilities, old] = await Promise.all([extractLibraryAssets(projectId, { nodeId: node.id }), studioCapabilities(), libraryObjects()]);
        if (!active()) return;
        setCaps(capabilities);
        setExisting(old.items);
        setModel(capabilities.textModels?.find(item => item.isDefault)?.endpointId || capabilities.textModels?.[0]?.endpointId);
        assign(value);
        if (task.current?.runId) {
          const run = await readRun(task.current.runId);
          await wait({ sourceHash: task.current.sourceHash, title: task.current.title, items: [], run }, active);
        }
      })
      .catch(e => active() && setError(e))
      .finally(() => { if (active()) { setBusy(false); setLoading(false); } });
    return () => { cancelled = true; alive.current = false; };
  }, [node.id, projectId, revision]);

  const refreshLinked = async () => {
    try {
      const items = await readScriptAssets(projectId, node.id);
      if (alive.current) setLinked(items);
    } catch (e) { if (alive.current) setError(e); }
  };
  const action = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await fn(); }
    catch (e) { if (alive.current) setError(e); }
    finally { if (alive.current) setBusy(false); }
  };
  const cost = caps?.mock ? 0 : caps?.textModels?.find(item => item.endpointId === model)?.tokenPricing?.maxCost;
  const analyze = () => void action(async () => {
    if (!result || cost === undefined) return;
    const prior = task.current;
    const identity = prior && !prior.runId ? prior : { clientRequestId: nanoid(), sourceHash: result.sourceHash, title: result.title, model, maxCost: cost, episodeNo: episode };
    task.current = identity;
    await onTask(identity);
    let value: LibraryExtraction;
    try {
      value = await extractLibraryAssets(projectId, { nodeId: node.id, analyze: true, clientRequestId: identity.clientRequestId, episodeNo: identity.episodeNo, model: identity.model, maxCost: identity.maxCost });
    } catch (e) {
      if (e instanceof ApiError && ['STUDIO_PRICE_CHANGED', 'AI_TOKEN_PRICE_NOT_CONFIGURED', 'AI_TOKEN_PRICE_INVALID'].includes(e.code)) { task.current = undefined; await onTask(undefined); }
      throw e;
    }
    if (value.run) { task.current = { ...identity, sourceHash: value.sourceHash, title: value.title, runId: value.run.id }; await onTask(task.current); }
    setResult(value);
    await wait(value);
  });
  const save = () => void action(async () => {
    if (!result) return;
    const items = await saveLibraryExtraction(projectId, { nodeId: node.id, sourceHash: result.sourceHash, folderId: folder || undefined, items: candidates.filter(item => selected.includes(item.key)) });
    if (!alive.current) return;
    setLinked(current => [...new Map([...current, ...items].map(asset => [asset.id, asset])).values()]);
    setView('assets');
    message.success(`已保存 ${items.length} 项资产`);
  });

  const content = (
        <div className="script-assets-body">
          {!linked.length && !result && error ? <div className="script-assets-empty"><h3>素材暂时无法读取</h3><p>请重新读取，已保存的资产仍会保留。</p></div> : view === 'assets' ? <LibraryScriptAssets assets={linked} folders={folders} onEdit={setEditing} onExtract={() => setView('extract')} /> : <>
            <div className="script-extraction-heading"><h3>从剧本提取角色、场景和道具</h3><p>{busy && result?.run?.status === 'running' ? '正文分析中，可关闭后继续查看。' : '核对下方结果，保存后即可在“已保存资产”中查看。'}提取不生成图片。</p></div>
            <div className="script-extraction-controls">
              <label>提取范围<Select aria-label="提取范围" disabled={busy} value={episode || 0} onChange={value => setEpisode(value || undefined)} options={[{ value: 0, label: '整部剧本' }, ...(node.metadata?.studio?.script?.episodes || []).map(item => ({ value: item.no, label: `第 ${item.no} 集` }))]} /></label>
              <label>分析模型<Select aria-label="提取分析模型" value={model} disabled={busy || caps?.textModelMode === 'fixed'} options={caps?.textModels?.map(item => ({ value: item.endpointId, label: item.name }))} onChange={setModel} /></label>
              <Button icon={<StudioAiIcon />} title="AI 处理，会消耗积分" loading={busy} disabled={!result || cost === undefined} onClick={analyze}>从正文分析提取</Button>
            </div>
            {candidates.length > 0 && <p className="script-extraction-summary">提取结果 {candidates.length} 项，已勾选 {selected.length} 项</p>}
            {!candidates.length ? <div className="script-assets-empty"><p>{busy ? '正在分析正文，结果会保留在这里。' : '当前设定中没有可整理的资产。请先完善人物、场景与道具设定，或从正文分析提取。'}</p></div> : <div className="personal-extraction-list">{candidates.map((item, index) => <div key={item.key} className="personal-extraction-item">
              <Checkbox disabled={busy} aria-label={`保留 ${item.name}`} checked={selected.includes(item.key)} onChange={e => setSelected(ids => e.target.checked ? [...ids, item.key] : ids.filter(key => key !== item.key))} />
              <div>
                <div className="script-extraction-item-heading"><label>名称<Input disabled={busy} aria-label={`提取名称 ${index + 1}`} value={item.name} maxLength={128} onChange={e => setCandidates(list => list.map((value, n) => n === index ? { ...value, name: e.target.value } : value))} /></label><span>{{ character: '角色', scene: '场景', prop: '道具' }[item.kind]}</span></div>
                <label className="script-extraction-field">描述<Input.TextArea disabled={busy} aria-label={`提取描述 ${item.name}`} value={item.description} rows={2} maxLength={2000} onChange={e => setCandidates(list => list.map((value, n) => n === index ? { ...value, description: e.target.value } : value))} /></label>
                <details><summary>原文依据</summary><p>{item.evidence}</p></details>
                <label className="script-extraction-field">保存方式<Select disabled={busy} aria-label={`复用已有资产 ${item.name}`} value={item.reuseId || ''} showSearch filterOption={false} onSearch={query => void libraryObjects({ query }).then(value => setExisting(list => [...new Map([...list, ...value.items].map(asset => [asset.id, asset])).values()]))} options={[{ value: '', label: '保存为本剧资产' }, ...existing.filter(asset => asset.kind === item.kind).map(asset => ({ value: asset.id, label: `${asset.name} · ${folders.find(value => value.id === asset.folderId)?.name || '未分类'} · ${asset.sources[0]?.title || asset.description}` }))]} onChange={value => setCandidates(list => list.map((candidate, n) => n === index ? { ...candidate, reuseId: value || undefined } : candidate))} /></label>
              </div>
            </div>)}</div>}
            {result?.run?.status === 'done' && result.run.output.billing && <p role="status" className="script-extraction-note">已消耗 {result.run.output.billing.credits} 积分</p>}
            {result?.warnings?.map(warning => <p role="status" className="script-extraction-note" key={warning}>{warning}</p>)}
          </>}
        </div>
  );

  return <>
    <Modal open={!editing} title="本剧素材" footer={null} width={1040} getContainer={studioOverlayContainer} className="personal-extraction-modal script-assets-modal" mask={{ closable: false }} onCancel={() => { if (!busy || task.current?.runId) onClose(); }} closable={!busy || !!result?.run}>
      <p className="script-assets-source">{node.title}</p>
      {loading ? <div className="script-assets-loading"><Skeleton active paragraph={{ rows: 6 }} /></div> : <>
        <Tabs activeKey={view} onChange={setView} className="script-assets-tabs" items={[
          { key: 'assets', label: <span>已保存资产 <span className="script-assets-count">{linkedReady ? linked.length : '读取失败'}</span></span>, children: view === 'assets' ? content : undefined },
          { key: 'extract', label: '提取与核对', children: view === 'extract' ? content : undefined },
        ]} />

      </>}
      {error && <p className="studio-error"><StudioErrorNotice error={error}/> <Button size="small" disabled={busy} onClick={() => setRevision(value => value + 1)}>重新读取</Button></p>}
      {!loading && <div className="script-assets-bottom">{view === 'extract' ? <>
        <label className="script-extraction-folder">保存到文件夹<LibraryFolderSelect folders={folders} value={folder} onChange={setFolder} disabled={busy} /></label>
        <Button disabled={busy} onClick={() => setNewFolder('')}>新建文件夹</Button>
        <Button type="primary" loading={busy} disabled={!selected.length || !result} onClick={save}>保存所选 {selected.length} 项</Button>
      </> : <><p>已保存在资产库，关闭后仍会保留。</p><Button onClick={onClose}>返回剧本</Button></>}</div>}
    </Modal>
    {editing && <LibraryAssetEditor assets={editing} folders={folders} onClose={() => { setEditing(undefined); void refreshLinked(); }} onChange={() => void refreshLinked()} onUse={onUse} />}
    <Modal open={newFolder !== undefined} title="新建文件夹" getContainer={studioOverlayContainer} confirmLoading={busy} okButtonProps={{ disabled: !newFolder?.trim() }} onCancel={() => setNewFolder(undefined)} onOk={() => void action(async () => { const value = await createLibraryFolder(newFolder!); setFolders(list => [...list, value]); setFolder(value.id); setNewFolder(undefined); })}><Input aria-label="提取文件夹名称" maxLength={100} value={newFolder} onChange={e => setNewFolder(e.target.value)} /></Modal>
  </>;
}
