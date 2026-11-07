"use client";
// 资产库的「来源」筛选：某部导演台作品或某张画布。没有任何来源时不显示。
// 「全部」是第一个选项而不是占位字加清除按钮：手机上没有悬停，那个 12px 的小叉也点不准。
import { useEffect, useState } from 'react';
import { Select } from 'antd';
import type { LibrarySourceOption } from '@ai-star-eco/types';
import { librarySources } from '@/canvas-bridge/asset-library';
import { studioOverlayContainer } from './studio-overlay';

const labelOf = (s: LibrarySourceOption) => s.deleted ? `${s.title}（已删除）` : s.title;

export function LibrarySourceSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [sources, setSources] = useState<LibrarySourceOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    // 读不到只是少一个筛选项，列表本身不受影响。
    librarySources().then(list => { if (live) setSources(list); }).catch(e => console.warn('[asset-library] sources not loaded', e)).finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  if (!sources.length && !value) return null;
  const group = (type: LibrarySourceOption['type'], label: string) => {
    const options = sources.filter(s => s.type === type).map(s => ({ value: s.id, label: labelOf(s) }));
    return options.length ? [{ label, options }] : [];
  };
  return <Select aria-label="按作品或画布筛选" className="assets-source-select" disabled={disabled}
    value={value} onChange={next => onChange(next ?? '')} getPopupContainer={studioOverlayContainer} popupMatchSelectWidth={false}
    classNames={{ popup: { root: 'assets-source-popup' } }}
    showSearch={{ optionFilterProp: 'label' }} notFoundContent="没有匹配的作品或画布" virtual={false}
    options={[{ value: '', label: '全部作品和画布' }, ...group('director', '导演台作品'), ...group('canvas', '画布')]}
    // 地址里带来的来源：列表还没读回来，或这部作品还没有东西进库时，不把 id 露给用户。
    labelRender={({ label }) => <span>{label && label !== value ? label : loaded ? '所选作品或画布' : '正在加载…'}</span>}/>;
}
