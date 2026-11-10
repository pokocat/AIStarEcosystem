"use client";
// 把一张已有的图存成角色、场景或道具，或加到已有的一项（2026-11-07）。画布节点、资产页共用。
// 一张图是不是角色系统判断不了，所以画布和生成结果不自动建卡，由用户点这里。
import { useEffect, useRef, useState } from 'react';
import { Input, Modal, Radio, Skeleton } from 'antd';
import { Search } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { LibraryObject, LibraryObjectKind } from '@ai-star-eco/types';
import { libraryObjects, mainLibraryVersion, saveLibraryMedia } from '@/canvas-bridge/asset-library';
import { AssetThumb } from './asset-thumb';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

export type LibrarySaveImage = { storageKey: string; src?: string; title?: string; projectId?: string; nodeId?: string; folderId?: string };
type Kind = Exclude<LibraryObjectKind, 'product'>;
const KINDS: { value: Kind; label: string }[] = [{ value: 'character', label: '角色' }, { value: 'scene', label: '场景' }, { value: 'prop', label: '道具' }];
const KIND_OF_SUFFIX: Record<string, Kind> = { 角色图: 'character', 场景图: 'scene', 道具图: 'prop' };
/** 从标题猜类型和名字：「祖宅 · 场景图」就是场景「祖宅」；系统默认名和提示词摘要不适合当名字，留空让用户填。 */
export function suggestFromTitle(title?: string): { kind: Kind; name: string } {
  const text = (title || '').trim();
  const named = text.match(/^(.+) · (角色图|场景图|道具图)(?: \d+)?$/);
  if (named) return { kind: KIND_OF_SUFFIX[named[2]], name: named[1] };
  if (!text || text.includes('…') || /^(生成素材|生成视频|生成图片|图片|视频|视频片段)($| ·)/.test(text)) return { kind: 'character', name: '' };
  return { kind: 'character', name: text };
}

export function LibrarySaveDialog({ image, onClose, onSaved }: { image?: LibrarySaveImage; onClose: () => void; onSaved?: (object: LibraryObject) => void }) {
  const { message } = useStudioApp();
  const [kind, setKind] = useState<Kind>('character');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [objects, setObjects] = useState<LibraryObject[]>([]);
  const [chosen, setChosen] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useStudioErrorState();
  const requestId = useRef('');
  const epoch = useRef(0);
  const open = !!image;
  useEffect(() => {
    if (!image) return;
    const suggested = suggestFromTitle(image.title);
    requestId.current = nanoid(); setKind(suggested.kind); setMode('new'); setName(suggested.name); setKeyword(''); setQuery(''); setChosen(undefined); setError('');
  }, [image?.storageKey, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = setTimeout(() => setQuery(keyword.trim()), 220); return () => clearTimeout(timer); }, [keyword]);
  useEffect(() => {
    if (!open || mode !== 'existing') return;
    const id = ++epoch.current;
    setLoading(true); setChosen(undefined);
    libraryObjects({ kind, query: query || undefined }).then(r => { if (id === epoch.current) setObjects(r.items); })
      .catch(e => { if (id === epoch.current) setError(e); })
      .finally(() => { if (id === epoch.current) setLoading(false); });
    return () => { epoch.current++; };
  }, [open, mode, kind, query, setError]);
  if (!image) return null;
  const noun = KINDS.find(k => k.value === kind)?.label;
  const picked = objects.find(o => o.id === chosen);
  const reason = mode === 'new' ? (name.trim() ? '' : '请填写名称') : (chosen ? '' : `请选择一个${noun}`);
  const missing = !!reason;
  const save = async () => {
    if (missing) return;
    setBusy(true); setError('');
    try {
      const saved = await saveLibraryMedia({
        clientRequestId: requestId.current, storageKey: image.storageKey, projectId: image.projectId, nodeId: image.nodeId,
        ...(mode === 'new' ? { kind, name: name.trim(), folderId: image.folderId } : { objectId: chosen }),
      });
      message.success(`已存入「${saved.name}」`);
      onSaved?.(saved); onClose();
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  return <Modal open title="存为角色、场景或道具" okText="保存" cancelText="取消" width={480} getContainer={studioOverlayContainer} confirmLoading={busy} className="library-save-dialog"
    okButtonProps={{ disabled: missing }} onCancel={() => !busy && onClose()} onOk={() => void save()} destroyOnHidden
    footer={(_, { OkBtn, CancelBtn }) => <div className="library-save-foot"><span>{reason}</span><CancelBtn/><OkBtn/></div>}>
    <div className="library-save">
      <div className="library-save-head">
        <span className="library-save-preview"><AssetThumb kind="image" src={image.src} storageKey={image.storageKey}/></span>
        <div className="library-save-fields">
          <div className="library-save-row"><span>类型</span>
            <Radio.Group aria-label="资产类型" optionType="button" disabled={busy} value={kind} options={KINDS} onChange={e => setKind(e.target.value)}/></div>
          <div className="library-save-row"><span>方式</span>
            <Radio.Group aria-label="存入方式" optionType="button" disabled={busy} value={mode} onChange={e => setMode(e.target.value)}
              options={[{ value: 'new', label: `新建${noun}` }, { value: 'existing', label: `加到已有${noun}` }]}/></div>
        </div>
      </div>
      {mode === 'new'
        ? <label className="library-save-row"><span>名称</span><Input aria-label="资产名称" autoFocus disabled={busy} maxLength={128} value={name} placeholder={kind === 'character' ? '例如：林远' : kind === 'scene' ? '例如：祖宅' : '例如：铜钥匙'} onChange={e => setName(e.target.value)} onPressEnter={() => void save()}/></label>
        : <>
          <Input aria-label="搜索资产" prefix={<Search size={15}/>} allowClear disabled={busy} placeholder="搜索名称或作品" value={keyword} onChange={e => setKeyword(e.target.value)}/>
          {loading ? <Skeleton active paragraph={{ rows: 3 }}/> : objects.length === 0
            ? <p className="library-save-empty">{query ? '没有找到匹配的资产。' : `还没有${noun}。`}</p>
            : <ul className="library-save-list" aria-label="已有资产">{objects.map(o => {
              const main = mainLibraryVersion(o);
              return <li key={o.id}><button type="button" aria-pressed={chosen === o.id} disabled={busy} onClick={() => setChosen(o.id)}>
                <span className="library-save-thumb">{main ? <AssetThumb kind="image" src={main.url} storageKey={main.storageKey}/> : null}</span>
                <span className="library-save-text"><strong>{o.name}</strong><small>{o.sources[0]?.title || `${o.versions.length} 张图`}</small></span>
              </button></li>;
            })}</ul>}
          {picked && <p className="library-save-hint">图片将加入「{picked.name}」，主图不变。</p>}
        </>}
      {error && <p className="library-save-error"><StudioErrorNotice error={error}/></p>}
    </div>
  </Modal>;
}
