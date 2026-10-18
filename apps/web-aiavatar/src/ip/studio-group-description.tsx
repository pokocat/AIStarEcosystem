'use client';
import { useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { FileText, Pencil } from 'lucide-react';
import { studioOverlayContainer } from './studio-overlay';

/** Group notes are documentation, not model inputs. The same reader serves template previews. */
export function StudioGroupDescription({ title, description, onChange }: { title: string; description?: string; onChange?: (value: string) => void }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState('');
  const show = () => { setDraft(description || ''); setOpen(true); };
  if (!description && !onChange) return null;
  return <>
    <button type="button" className={`studio-group-description nodrag nopan${description ? ' has-description' : ''}`}
      aria-label={`${onChange ? description ? '编辑' : '添加' : '查看'}分组说明：${title}`} onClick={e => { e.stopPropagation(); show(); }} onDoubleClick={e => e.stopPropagation()}>
      {description ? <span>{description}</span> : <span>添加说明</span>}{onChange ? <Pencil size={14}/> : <FileText size={14}/>}
    </button>
    <Modal title={`${onChange ? '编辑' : '查看'}分组说明 · ${title}`} open={open} getContainer={studioOverlayContainer} width={560}
      onCancel={() => setOpen(false)} footer={<>{onChange && <Button onClick={() => setOpen(false)}>取消</Button>}<Button type="primary" onClick={() => { if (onChange) onChange(draft); setOpen(false); }}>{onChange ? '保存说明' : '关闭'}</Button></>}>
      {onChange ? <label className="studio-group-description-editor">分组说明<Input.TextArea aria-label="分组说明" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} showCount autoSize={{ minRows: 6, maxRows: 14 }} placeholder="说明这组流程的用途、素材要求和操作步骤"/></label>
        : <p className="studio-group-description-reader">{description}</p>}
    </Modal>
  </>;
}
