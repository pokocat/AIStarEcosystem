'use client';
import { IMAGE_UPLOAD_ACCEPT } from '@ai-star-eco/api-client/image-upload-policy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { Upload, Video } from 'lucide-react';
import type { IpProjectDoc, IpCanvasCover, IpCanvasCoverTarget } from '@ai-star-eco/types';
import { projectPreview } from './project-preview';
import { resetCanvasCover, selectCanvasCover, signCoverChoices, uploadCanvasCover } from './canvas-cover-api';
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
  const preview = useMemo(() => doc && projectPreview(doc), [doc]);
  const missingKeys = useMemo(() => target === 'template' && preview
    ? [...new Set([...preview.images, ...preview.videos].filter(media => !media.url).map(media => media.key))]
    : [], [target, preview]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(missingKeys.length > 0);
  const [previewError, setPreviewError] = useStudioErrorState();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!missingKeys.length) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError('');
    void signCoverChoices(missingKeys).then(urls => {
      if (!active) return;
      setSigned(urls);
      if (missingKeys.some(key => !urls[key])) setPreviewError(new Error('部分素材预览无法加载，请重试。'));
    }).catch(error => {
      if (active) setPreviewError(error);
    }).finally(() => {
      if (active) setPreviewLoading(false);
    });
    return () => { active = false; };
  }, [missingKeys, retry, setPreviewError]);
  const images = (preview?.images ?? []).filter(image => image.url || signed[image.key]);
  const videos = target === 'template' ? (preview?.videos ?? []).filter(video => video.url || signed[video.key]) : [];
  const save = async (action: () => Promise<IpCanvasCover>, file?: File) => {
    if (lock.current) return;
    lock.current=true;setBusy(true);setSaveError('');
    try { const cover=await action();setFailedFile(undefined);onSaved(cover); }
    catch(e){setSaveError(e);setFailedFile(file);}
    finally {lock.current=false;setBusy(false);}
  };
  return <Modal open title="设置封面" footer={null} onCancel={() => {if(!busy)onClose();}} closable={!busy} keyboard={!busy} mask={{closable:!busy}} getContainer={container} className="ip-management-editor project-preview-dialog" centered width={640}>
    <p className="project-preview-name">{name}</p>
    <p className="project-preview-caption">{target === 'template' ? '从当前画布选择图片或视频，也可以上传封面图片。' : '上传封面，或从画布中选择图片。'}</p>
    <input ref={input} type="file" accept={IMAGE_UPLOAD_ACCEPT} hidden aria-label="上传封面图片" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void save(()=>uploadCanvasCover(target,id,file),file);}}/>
    <button type="button" className="ip-brand-secondary" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>上传封面</button>
    {(images.length > 0 || videos.length > 0) && <div className="project-cover-choices">
      {images.map((image, index) => <button key={image.key} type="button" disabled={busy}
        onClick={() => void save(() => selectCanvasCover(target, id, image.key))} aria-label={`设为封面：${image.title} ${index + 1}`}>
        <img src={image.url || signed[image.key]} alt="" loading="lazy"/><span>{image.title}</span>
      </button>)}
      {videos.map((video, index) => <button key={`video:${video.key}`} type="button" disabled={busy}
        onClick={() => void save(() => selectCanvasCover(target, id, video.key))} aria-label={`将视频设为封面：${video.title} ${index + 1}`}>
        <video src={`${video.url || signed[video.key]}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true"/>
        <span className="project-cover-video-title"><Video size={14} aria-hidden="true"/>{video.title}</span>
      </button>)}
    </div>}
    {(previewLoading || (!doc && !error)) && <p role="status">正在加载画布素材…</p>}
    {previewError && <><StudioErrorNotice error={previewError}/><button type="button" className="ip-brand-text-button" disabled={busy} onClick={() => setRetry(n => n + 1)}>重试加载素材</button></>}
    {target === 'template' && preview && !preview.images.length && !preview.videos.length && <p className="project-preview-caption">当前画布没有可选的图片或视频。</p>}
    {error && <p className="project-preview-caption">{error} {onRetry && <button type="button" disabled={busy} onClick={onRetry}>重试</button>}</p>}
    {saveError && <><StudioErrorNotice error={saveError}/>{failedFile && <button type="button" className="ip-brand-text-button" disabled={busy} onClick={()=>void save(()=>uploadCanvasCover(target,id,failedFile),failedFile)}>重试上传</button>}</>}
    <div className="project-cover-footer"><button type="button" className="ip-brand-secondary" disabled={busy} onClick={()=>void save(()=>resetCanvasCover(target,id))}>恢复自动封面</button><span role="status">{busy?'正在保存封面…':'选择后自动保存'}</span></div>
  </Modal>;
}
