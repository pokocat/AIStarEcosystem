"use client";
// 资产页「官方形象」（2026-11-10）：平台提供的人物形象。原来在「发现」页，现在放这里。
// 免费的在画布、AI 图片、AI 视频选择人物时可直接使用；需授权的只能看，「申请授权」暂未开放。
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { Search } from 'lucide-react';
import type { StudioIpAsset } from '@ai-star-eco/types/ip-studio-workflow';
import { listStudioIpAssets } from '@/canvas-bridge/studio-api';
import { groupStudioIpAssets, ipAssetIdentity, ipAssetRole, ipAssetRoles, type StudioLibraryCharacter } from '@/canvas-bridge/studio-ip-library';
import { AssetThumb } from './asset-thumb';
import { PortraitVerifiedMark } from './portrait-verified-mark';
import { inOfficialCategory, isOfficialAsset, OfficialCategoryFilter, OfficialLicenseButton, officialAccessLabel, officialCategoryLabel, officialCategoryOptions, officialReference, officialUsable } from './official-avatars';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

export function AssetsOfficial() {
  const [assets, setAssets] = useState<StudioIpAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useStudioErrorState();
  const [revision, setRevision] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState<StudioLibraryCharacter>();
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    listStudioIpAssets().then(r => { if (live) setAssets(r.filter(isOfficialAsset)); }).catch(e => live && setError(e)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [revision, setError]);
  const people = useMemo(() => groupStudioIpAssets(assets), [assets]);
  const categories = useMemo(() => officialCategoryOptions(people.map(p => p.main)), [people]);
  const needle = keyword.trim().toLocaleLowerCase();
  const shown = people.filter(p => inOfficialCategory(p.main, category) && (!needle || [p.name, p.main.description, ...Object.values(p.main.attributes || {})].join(' ').toLocaleLowerCase().includes(needle)));
  const filtered = !!needle || category !== 'all';
  return <div className="assets-official">
    <div className="assets-toolbar">
      <OfficialCategoryFilter options={categories} value={category} onChange={setCategory}/>
      <Input className="assets-search" prefix={<Search size={14}/>} allowClear aria-label="搜索官方形象" placeholder="搜索名字或设定" value={keyword} onChange={e => setKeyword(e.target.value)}/>
      <span className="assets-toolbar-gap"/>
      <span className="assets-count" aria-live="polite">{loading ? '正在加载…' : `${shown.length} 个形象`}</span>
    </div>
    {error && <p className="assets-notice"><StudioErrorNotice error={error}/><Button size="small" onClick={() => setRevision(n => n + 1)}>重试</Button></p>}
    <ul className="assets-people-grid">
      {loading && !shown.length ? Array.from({ length: 6 }, (_, i) => <li key={`s${i}`}><span className="assets-skeleton assets-person-cover"/></li>)
        : shown.map(p => <li key={p.id}>
          <button type="button" className="assets-person" aria-label={`查看 ${p.name}`} onClick={() => setOpen(p)}>
            <span className="assets-person-cover"><AssetThumb kind="image" src={p.main.url} storageKey={p.main.storageKey}/>
              {officialUsable(p.main) && <PortraitVerifiedMark storageKey={officialReference(p).storageKey || undefined} official/>}
            </span>
            <span className="assets-person-text"><strong>{p.name}</strong><small>{p.main.description || '暂无设定'}</small></span>
            <span className="assets-person-meta"><span>{officialCategoryLabel(p.main.category)}</span><span className={`assets-tag${officialUsable(p.main) ? ' is-ok' : ' is-star'}`}>{officialAccessLabel(p.main)}</span></span>
          </button>
        </li>)}
    </ul>
    {!loading && !error && !shown.length && (filtered
      ? <div className="assets-empty"><h3>没有找到匹配的形象</h3><p>请尝试其他名字或分类。</p><Button onClick={() => { setKeyword(''); setCategory('all'); }}>清除筛选</Button></div>
      : <div className="assets-empty"><h3>暂无官方形象</h3><p>平台上架的人物形象会显示在这里。</p></div>)}
    <OfficialAvatarDetail person={open} onClose={() => setOpen(undefined)}/>
  </div>;
}

function OfficialAvatarDetail({ person, onClose }: { person?: StudioLibraryCharacter; onClose: () => void }) {
  const [current, setCurrent] = useState<StudioIpAsset>();
  useEffect(() => setCurrent(undefined), [person]);
  if (!person) return null;
  const shown = current || officialReference(person), usable = officialUsable(person.main);
  const hasThreeView = person.assets.some(asset => asset.assetRole === 'three-view');
  const views = hasThreeView ? person.assets.filter(a => a.current || a.assetRole === 'three-view') : person.assets;
  return <Modal open title={person.name} footer={null} width={760} centered getContainer={studioOverlayContainer} className="assets-official-dialog" onCancel={onClose} destroyOnHidden>
    <div className={`assets-official-detail${shown.assetRole === 'three-view' ? ' is-three-view' : ''}`}>
      <div className="assets-official-visual">
        <span className={`assets-official-hero${shown.assetRole === 'three-view' ? ' is-three-view' : ''}`}><AssetThumb kind="image" src={shown.url} storageKey={shown.storageKey}/></span>
        {views.length > 1 && <div className="assets-official-views" role="group" aria-label="形象图">{views.map(a => {
          const on = ipAssetIdentity(a) === ipAssetIdentity(shown);
          const label = a.lookId ? a.name : hasThreeView ? '头像' : ipAssetRoles[ipAssetRole(a)];
          return <button key={ipAssetIdentity(a)} type="button" className={a.assetRole === 'three-view' ? 'is-three-view' : undefined} aria-pressed={on} aria-label={`查看${label}`} onClick={() => setCurrent(a)}>
            <AssetThumb kind="image" src={a.url} storageKey={a.storageKey}/><small>{label}</small>
          </button>;
        })}</div>}
      </div>
      <aside className="assets-official-info">
        <div className="assets-official-tags"><span className={`assets-tag${usable ? ' is-ok' : ' is-star'}`}>{officialAccessLabel(person.main)}</span><span className="assets-tag">{officialCategoryLabel(person.main.category)}</span></div>
        {person.main.description && <p className="assets-official-desc">{person.main.description}</p>}
        {Object.keys(person.main.attributes || {}).length > 0 && <dl>{Object.entries(person.main.attributes || {}).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        <div className="assets-official-use">
          {usable
            ? <p>在画布、AI 图片、AI 视频选择人物时，切换到「官方形象」直接使用。</p>
            : <><p>需要授权后才能用于生成。</p><OfficialLicenseButton name={person.name} block/></>}
        </div>
      </aside>
    </div>
  </Modal>;
}
