"use client";

import { useState } from 'react';
import { Button, Segmented } from 'antd';
import { Box, MapPin, UserRound } from 'lucide-react';
import type { LibraryFolder, LibraryObject, LibraryObjectKind } from '@ai-star-eco/types';
import { mainLibraryVersion } from '@/canvas-bridge/asset-library';
import { SignedImage } from '@/canvas-bridge/signed-image';

const kinds = { character: '角色', scene: '场景', prop: '道具' };

/** Saved objects are the primary content, including objects that have no image yet. */
export function LibraryScriptAssets({ assets, folders, onEdit, onExtract }: {
  assets: LibraryObject[];
  folders: LibraryFolder[];
  onEdit: (assets: LibraryObject[]) => void;
  onExtract: () => void;
}) {
  const [kind, setKind] = useState<LibraryObjectKind | 'all'>('all');
  const missing = assets.filter(asset => !mainLibraryVersion(asset)).length;
  const visible = assets.filter(asset => kind === 'all' || asset.kind === kind);
  if (!assets.length) return <div className="script-assets-empty">
    <Box size={32} aria-hidden="true" />
    <h3>本剧还没有保存的资产</h3>
    <p>从剧本整理角色、场景和道具，核对后保存到资产库。</p>
    <Button type="primary" onClick={onExtract}>提取本剧素材</Button>
  </div>;
  return <section aria-label="本剧已保存资产">
    <div className="script-assets-heading">
      <div><h3>{assets.length} 项资产已保存</h3><p>{missing ? `${missing} 项尚未配图，文字设定已可用于创作。` : '主图已就绪，可继续编辑或用于创作。'}</p></div>
      <Button onClick={() => onEdit(assets)}>批量配图</Button>
    </div>
    <Segmented className="script-assets-filter" aria-label="筛选本剧资产类型" value={kind} onChange={value => setKind(value as typeof kind)} options={[
      { value: 'all', label: `全部 ${assets.length}` },
      ...Object.entries(kinds).map(([value, label]) => ({ value, label: `${label} ${assets.filter(asset => asset.kind === value).length}` })),
    ]} />
    {visible.length ? <div className="script-assets-grid">{visible.map(asset => {
      const image = mainLibraryVersion(asset);
      const Icon = asset.kind === 'character' ? UserRound : asset.kind === 'scene' ? MapPin : Box;
      const status = asset.pendingRun?.status === 'running' ? '配图生成中' : asset.pendingRun?.status === 'failed' ? '配图失败，可重试' : image ? '已有主图' : '待配图';
      return <article key={asset.id} className="script-asset" aria-label={`已保存资产 ${asset.name}`}>
        <div className="script-asset-image">{image ? <SignedImage src={image.url} storageKey={image.storageKey} alt={asset.name} /> : <><Icon size={26} aria-hidden="true" /><span>暂无配图</span></>}</div>
        <div className="script-asset-content">
          <div className="script-asset-meta"><span>{kinds[asset.kind]}</span><span>{status}</span></div>
          <h4>{asset.name}</h4>
          <p className="script-asset-description">{asset.description || '尚未填写描述'}</p>
          <div className="script-asset-footer"><span>{folders.find(folder => folder.id === asset.folderId)?.name || (asset.folderId ? '文件夹名称暂不可用' : '未分类')}</span><Button size="small" onClick={() => onEdit([asset])} aria-label={`编辑与配图 ${asset.name}`}>编辑与配图</Button></div>
        </div>
      </article>;
    })}</div> : <div className="script-assets-empty script-assets-empty-filter"><p>本剧还没有{kinds[kind as LibraryObjectKind]}资产。</p><Button onClick={() => setKind('all')}>查看全部资产</Button></div>}
  </section>;
}
