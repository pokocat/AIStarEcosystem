"use client";
// 官方形象（2026-11-10）：平台提供的人物形象，数据来自 Studio 人物库接口里 librarySource=official 的那部分
// （服务端 StudioIpAssetService#officialAssets，含内置和运营上架的形象）。
// 免费的可直接用于生成；需授权的列出来但不能选，「申请授权」暂未开放。以后做签约艺人 / IP 市场时，
// 「能不能用」仍只看 access，授权入口换成真流程即可（OfficialLicenseButton 是唯一入口）。
import { useId, useState } from 'react';
import { Button, Modal } from 'antd';
import type { StudioIpAsset } from '@ai-star-eco/types/ip-studio-workflow';
import type { StudioLibraryCharacter } from '@/canvas-bridge/studio-ip-library';
import { studioOverlayContainer } from './studio-overlay';

const CATEGORY_LABELS: Record<string, string> = { pro: '商务专业', life: '生活方式', ugc: '内容创作', community: '潮流娱乐' };
const CATEGORY_ORDER = ['pro', 'life', 'ugc', 'community'];

export const isOfficialAsset = (a: Pick<StudioIpAsset, 'librarySource'>) => a.librarySource === 'official';
/** 能不能拿去生成：我的 IP 一律能；官方形象只有需授权的不能。 */
export const officialUsable = (a: Pick<StudioIpAsset, 'librarySource' | 'access'>) => !isOfficialAsset(a) || a.access !== 'license';
export const officialAccessLabel = (a: Pick<StudioIpAsset, 'access'>) => a.access === 'license' ? '需授权' : '免费';
export const officialCategoryLabel = (c?: string | null) => (c && CATEGORY_LABELS[c]) || '其他';
/** 不能选的原因，写在卡片旁边和悬停提示里。 */
export const OFFICIAL_LICENSE_REASON = '需授权，暂不能使用';

/** 「全部分类」加上现有形象里出现过的分类，顺序固定。 */
export function officialCategoryOptions(assets: Pick<StudioIpAsset, 'category'>[]) {
  const present = new Set(assets.map(a => a.category || 'other'));
  const keys = [...CATEGORY_ORDER.filter(k => present.has(k)), ...[...present].filter(k => !CATEGORY_ORDER.includes(k) && k !== 'other'), ...(present.has('other') ? ['other'] : [])];
  return [{ value: 'all', label: '全部分类' }, ...keys.map(k => ({ value: k, label: k === 'other' ? '其他' : officialCategoryLabel(k) }))];
}
export const inOfficialCategory = (a: Pick<StudioIpAsset, 'category'>, category: string) => category === 'all' || (a.category || 'other') === category;

export function officialReference(person: StudioLibraryCharacter) {
  return person.assets.find(a => a.assetRole === 'three-view' && a.storageKey && a.url) || person.main;
}

export function OfficialCategoryFilter({ options, value, onChange, disabled }: {
  options: ReturnType<typeof officialCategoryOptions>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return <div className="official-category-filter" role="radiogroup" aria-label="按分类筛选官方形象">
    {options.map(option => <label key={option.value}>
      <input type="radio" name={name} value={option.value} checked={option.value === value} disabled={disabled} onChange={() => onChange(option.value)}/>
      <span>{option.label}</span>
    </label>)}
  </div>;
}

/** 需授权形象的「申请授权」：官方形象的授权还没开放，只说明，不建单、不扣费。 */
export function OfficialLicenseButton({ name, block, size }: { name: string; block?: boolean; size?: 'small' | 'middle' }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button block={block} size={size} onClick={e => { e.stopPropagation(); setOpen(true); }}>申请授权</Button>
    <Modal open={open} title="申请授权" onCancel={() => setOpen(false)} getContainer={studioOverlayContainer} centered width={400}
      footer={<Button type="primary" onClick={() => setOpen(false)}>知道了</Button>}>
      <p>「{name}」需要授权后才能使用。官方形象的授权暂未开放，如需使用请联系平台。</p>
    </Modal>
  </>;
}
