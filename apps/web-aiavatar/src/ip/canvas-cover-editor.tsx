'use client';
import { useRef, useState } from 'react';
import { Modal } from 'antd';
import { Upload } from 'lucide-react';
import type { IpProjectDoc, IpCanvasCover, IpCanvasCoverTarget } from '@ai-star-eco/types';
import { projectPreview } from './project-preview';
import { resetCanvasCover, selectCanvasCover, uploadCanvasCover } from './canvas-cover-api';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

/** Projects and inspiration share upload, selection, reset, failure and retry behavior. */
export function CanvasCoverEditor({target, id, name, doc, onClose, onSaved, container, error, onRetry}: {
  target: IpCanvasCoverTarget; id: string; name: string; doc?: IpProjectDoc;
  onClose: () => void; onSaved: (cover: IpCanvasCover) => void;
  container?: () => HTMLElement; error?: string; onRetry?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [failedFile, setFailedFile] = useState<File>();
  const [saveError, setSaveError] = useStudioErrorState();
  const images = doc ? projectPreview(doc).images.filter(i => i.url) : [];
  const save = async (action: () => Promise<IpCanvasCover>, file?: File) => {
    if (lock.current) return;
    lock.current=true;setBusy(true);setSaveError('');
    try { const cover=await action();setFailedFile(undefined);onSaved(cover); }
    catch(e){setSaveError(e);setFailedFile(file);}
    finally {lock.current=false;setBusy(false);}
  };
  return <Modal open title="设置封面" footer={null} onCancel={() => {if(!busy)onClose();}} closable={!busy} keyboard={!busy} mask={{closable:!busy}} getContainer={container} className="ip-management-editor project-preview-dialog" centered width={640}>
    <p className="project-preview-name">{name}</p>
    <p className="project-preview-caption">上传一张封面，或从画布中选择图片。恢复自动后，优先显示已有图片，没有图片则显示画布缩略图。</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" hidden aria-label="上传封面图片" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void save(()=>uploadCanvasCover(target,id,file),file);}}/>
    <button type="button" className="ip-brand-secondary" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>上传封面</button>
    <p className="project-preview-caption">支持 JPG、PNG；上传封面不会向画布添加节点。</p>
    {images.length>0 && <div className="project-cover-choices">{images.map((image,index)=><button key={image.key} type="button" disabled={busy} onClick={()=>void save(()=>selectCanvasCover(target,id,image.key))} aria-label={`设为封面：${image.title} ${index+1}`}><img src={image.url} alt={image.title} loading="lazy"/><span>{image.title}</span></button>)}</div>}
    {!doc && !error && <p role="status">正在读取画布图片…</p>}
    {error && <p className="project-preview-caption">{error} {onRetry && <button type="button" disabled={busy} onClick={onRetry}>重试读取</button>}</p>}
    {saveError && <><StudioErrorNotice error={saveError}/>{failedFile && <button type="button" className="ip-brand-text-button" disabled={busy} onClick={()=>void save(()=>uploadCanvasCover(target,id,failedFile),failedFile)}>重试上传</button>}</>}
    <div className="project-cover-footer"><button type="button" className="ip-brand-secondary" disabled={busy} onClick={()=>void save(()=>resetCanvasCover(target,id))}>恢复自动封面</button><span role="status">{busy?'正在保存封面…':'选择图片即可保存'}</span></div>
  </Modal>;
}
