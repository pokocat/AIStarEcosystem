'use client';
import { useState } from 'react';
import { Button, Modal } from 'antd';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { StudioScriptRichEditor } from './studio-script-rich-editor';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

type Props={title?:string;value:string;onChange:(value:string)=>void;onSave:()=>Promise<void>;onClose:()=>void};
/** Analysis uses the same Markdown document editor as scripts, with no extra creation workflow. */
export function StudioAnalysisDocument({title="全片创作拆解",value,onChange,onSave,onClose}:Props) {
 const [saving,setSaving]=useState(false),[error,setError]=useStudioErrorState(),[toolbar,setToolbar]=useState<HTMLDivElement|null>(null);
 const save=async(close=false)=>{if(saving)return;setSaving(true);setError('');try{await onSave();if(close)onClose();}catch(e){setError(e);}finally{setSaving(false);}};
 return <Modal open width="100vw" title={title} closable={false} footer={null} mask={{closable:false}} onCancel={()=>void save(true)} keyboard={!saving} getContainer={()=>document.querySelector<HTMLElement>('.ip-surface')||document.body} className="studio-script-fullscreen" wrapClassName="studio-script-fullscreen-wrap" styles={{body:{padding:0}}}>
  <div className="studio-script-fullscreen-layout" onKeyDown={e=>{if(e.key!=='Escape')e.stopPropagation();if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();void save();}}}>
   <header className="studio-script-header">
    <Button type="text" aria-label="返回画布" icon={<ArrowLeft size={17}/>} disabled={saving} onClick={()=>void save(true)}/>
    <div className="studio-script-heading"><strong>{title}</strong><span>Markdown 文档 · {value.length.toLocaleString()} 字</span></div>
    <div className="studio-script-format-tools" ref={setToolbar}/>
    <div className="studio-script-header-actions"><Button type="text" aria-label="导出 Markdown" icon={<Download size={16}/>} onClick={()=>{const url=URL.createObjectURL(new Blob([value],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${title}.md`;link.click();URL.revokeObjectURL(url);}}/><Button type="primary" icon={<Save size={16}/>} loading={saving} onClick={()=>void save()}>保存文档</Button></div>
   </header>
   <div className="studio-script-layout"><main className="studio-script-document">{error&&<StudioErrorNotice error={error}/>}<div className="studio-script-document-body"><div className="studio-script-current-document"><StudioScriptRichEditor markdown={value} onChange={onChange} toolbarContainer={toolbar} ariaLabel="创作拆解文档"/></div></div></main></div>
  </div>
 </Modal>;
}
