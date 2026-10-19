"use client";
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Button, Dropdown } from 'antd';
import { Library, Paperclip, Upload } from 'lucide-react';
import type { IpSavedAsset } from '@ai-star-eco/types';
import { ATTACHMENT_ACCEPT } from '@/canvas-bridge/studio-attachments';
import { LibraryReferencePicker } from './library-reference-picker';
import { studioOverlayContainer } from './studio-overlay';
/** Lets a guide elsewhere in the panel (the recreation checklist) open the same upload / library flows. */
export type AttachmentPickerActions = { upload: () => void; library: () => void };
export function StudioAttachmentPicker({locked,reading,onFiles,onAssets,variant='assistant',projectId,iconOnly=false,actions}: {locked:boolean;reading:boolean;onFiles:(files:File[])=>void;onAssets:(assets:IpSavedAsset[])=>Promise<void>;variant?:'assistant'|'canvas';projectId?:string;
  /** The assistant composer shows the paperclip alone; the label stays as the accessible name. */
  iconOnly?:boolean;actions?:Ref<AttachmentPickerActions>}) {
  const input=useRef<HTMLInputElement>(null),[open,setOpen]=useState(false),canvas=variant==='canvas';
  useImperativeHandle(actions,()=>({upload:()=>{if(!locked)input.current?.click();},library:()=>{if(!locked)setOpen(true);}}),[locked]);
  const label=reading?'正在导入附件':'添加附件';
  return <>{canvas?<><Button icon={<Upload size={19}/>} aria-label="上传素材" loading={reading} disabled={locked} onClick={()=>input.current?.click()}><span className="studio-flow-tool-label" aria-hidden>上传素材</span></Button><Button icon={<Library size={19}/>} aria-label="从资产库添加" aria-expanded={open} disabled={locked} onClick={()=>setOpen(true)}><span className="studio-flow-tool-label" aria-hidden>从资产库添加</span></Button></>:<Dropdown trigger={['click']} disabled={locked} getPopupContainer={studioOverlayContainer} menu={{items:[{key:'upload',label:'本地上传',icon:<Upload size={16}/>},{key:'library',label:'资产库添加',icon:<Library size={16}/>}],onClick:({key})=>key==='upload'?input.current?.click():setOpen(true)}}><Button icon={<Paperclip size={16}/>} aria-label={iconOnly?label:undefined} title={iconOnly?label:undefined} loading={reading} disabled={locked}>{iconOnly?null:label}</Button></Dropdown>}<input ref={input} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden aria-label={canvas?'上传画布素材':'上传创作附件'} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)onFiles(files);}}/><LibraryReferencePicker open={open} projectId={projectId} onClose={()=>setOpen(false)} onAssets={onAssets}/></>;
}
