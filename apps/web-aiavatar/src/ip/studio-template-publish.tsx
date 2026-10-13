'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Select } from 'antd';
import type { IpProjectDoc, IpTemplate } from '@ai-star-eco/types';
import { IpStudioApi } from './api';
import { readStudioProject } from '@/canvas-bridge/studio-api';
import { publishTemplateVersion } from '@/canvas-bridge/template-api';
import { publishWithLatestDoc } from '@/canvas-bridge/publish-gate';
import type { SaveOutcome } from '@/canvas-bridge/project-sync';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

/** Save the complete canvas without an input/step recipe editor. */
export function StudioTemplatePublish({projectId,superAdmin,saveNow,onClose,initialVisibility='personal'}:{projectId:string;superAdmin:boolean;saveNow:()=>Promise<SaveOutcome>;onClose:()=>void;initialVisibility?:'personal'|'official'}) {
  const [doc,setDoc]=useState<IpProjectDoc>(),[name,setName]=useState(''),[summary,setSummary]=useState('');
  const [templates,setTemplates]=useState<IpTemplate[]>([]),[target,setTarget]=useState<string>();
  const [visibility,setVisibility]=useState<'personal'|'official'>(superAdmin?initialVisibility:'personal');
  const [busy,setBusy]=useState(false),[error,setError]=useStudioErrorState(),[done,setDone]=useState('');
  const inFlight=useRef(false);
  useEffect(()=>{let active=true;publishWithLatestDoc(saveNow,()=>Promise.all([readStudioProject(projectId),IpStudioApi.listTemplates()])).then(([p,t])=>{
    if(active){setDoc(p.doc);setName(p.name);setTemplates(t.filter(t=>t.mine&&t.versionId));}
  }).catch(e=>{if(active)setError(e);});return()=>{active=false;};},[projectId]);
  const nodes=doc?.nodes.filter(n=>!['assistant','batch'].includes(String((n.metadata?.studio as {kind?:string}|undefined)?.kind??'')))??[];
  const save=async()=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    try {
      const version=await publishWithLatestDoc(saveNow,()=>publishTemplateVersion(projectId,{templateId:target,name:name.trim(),summary:summary.trim(),visibility}));
      setTemplates(current=>{
        const item:IpTemplate={id:version.templateId,name:name.trim(),summary:summary.trim(),visibility,mine:true,enabled:true,versionId:version.id,version:version.version,doc:version.doc,lookCount:0,estimatedCredits:0};
        return current.some(t=>t.id===item.id)?current.map(t=>t.id===item.id?item:t):[...current,item];
      });
      setTarget(version.templateId);setDone(`已保存完整画布：${version.doc.nodes.length} 个节点。${visibility==='official'?'所有用户':'你'}可以从画布模板中查看。`);
    }catch(e){setError(e);}finally{inFlight.current=false;setBusy(false);}
  };
  return <Modal open title="保存画布模板" getContainer={studioOverlayContainer} onCancel={()=>{if(!busy)onClose();}} width={560} mask={{closable:!busy}} keyboard={!busy} closable={!busy}
    footer={<><Button disabled={busy} onClick={onClose}>{done?'完成':'取消'}</Button><Button type="primary" loading={busy} disabled={!doc||!name.trim()||!nodes.length||!!done} onClick={()=>void save()}>保存完整画布</Button></>}>
    <div className="studio-template-form">
      <p>保留全部节点、文字、连线和已生成的图片、视频。别人打开后就能看到这张画布。</p>
      {doc&&<p className="studio-template-snapshot-summary">{nodes.length} 个节点 · {nodes.filter(n=>n.type==='image'&&n.metadata?.storageKey).length} 张图片 · {nodes.filter(n=>n.type==='video'&&n.metadata?.storageKey).length} 个视频</p>}
      <label>模板名称<Input disabled={busy} value={name} onChange={e=>{setName(e.target.value);setDone('');}} maxLength={128}/></label>
      <label>说明（选填）<Input.TextArea disabled={busy} value={summary} onChange={e=>{setSummary(e.target.value);setDone('');}} maxLength={1024} rows={2}/></label>
      {superAdmin&&<label>谁可以看到<Select disabled={busy||!!target} value={visibility} options={[{value:'personal',label:'仅自己'},{value:'official',label:'所有用户（官方模板）'}]} onChange={v=>{setVisibility(v);setDone('');}}/></label>}
      <label>保存位置<Select disabled={busy} allowClear placeholder="新建模板" value={target} options={templates.filter(t=>t.visibility===visibility).map(t=>({value:t.id,label:`更新「${t.name}」`}))} onChange={v=>{setTarget(v);setDone('');}}/></label>
      {error&&<StudioErrorNotice error={error}/>} {done&&<Alert type="success" title={done} showIcon/>}
    </div>
  </Modal>;
}
