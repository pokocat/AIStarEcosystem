"use client";

import { Select } from 'antd';
import type { LibraryFolder } from '@ai-star-eco/types';
import { studioOverlayContainer } from './studio-overlay';

/** Folder names can contain 100 characters; keep them readable in both states. */
export function LibraryFolderSelect({ folders, value, onChange, disabled }: {
  folders: LibraryFolder[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <Select
    aria-label="提取资产保存文件夹"
    className="personal-folder-select"
    value={value}
    onChange={onChange}
    disabled={disabled}
    getPopupContainer={studioOverlayContainer}
    popupMatchSelectWidth={false}
    virtual={false}
    showSearch={{ optionFilterProp: 'label' }}
    notFoundContent="没有匹配的文件夹"
    classNames={{ content: 'personal-folder-select-content', popup: { root: 'personal-folder-select-popup' } }}
    labelRender={({ label }) => <span className="personal-folder-name">{label}</span>}
    options={[{ value: '', label: '未分类' }, ...folders.map(f => ({ value: f.id, label: f.name }))]}
  />;
}
