'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select } from 'antd';
import type { IpProjectDoc, IpTemplate, StudioTemplateInput, StudioTemplateStep, StudioTemplateRecipe } from '@ai-star-eco/types';
import { IpStudioApi } from '@/ip/api';
import { readStudioProject } from '@/canvas-bridge/studio-api';
import { publishTemplateVersion } from '@/canvas-bridge/template-api';
import { publishWithLatestDoc } from '@/canvas-bridge/publish-gate';
import type { SaveOutcome } from '@/canvas-bridge/project-sync';

export function StudioTemplatePublish({projectId,superAdmin,saveNow,onClose}:{projectId:string;superAdmin:boolean;saveNow:()=>Promise<SaveOutcome>;onClose:()=>void}) {
  const [doc,setDoc]=useState<IpProjectDoc>(),[name,setName]=useState(''),[summary,setSummary]=useState('');
  const [templates,setTemplates]=useState<IpTemplate[]>([]),[target,setTarget]=useState<string>(),[visibility,setVisibility]=useState<'personal'|'official'>('personal');
  const [inputs,setInputs]=useState<StudioTemplateInput[]>([]),[steps,setSteps]=useState<StudioTemplateStep[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
  useEffect(()=>{let active=true;publishWithLatestDoc(saveNow,()=>Promise.all([readStudioProject(projectId),IpStudioApi.listTemplates()])).then(([p,t])=>{
    if(!active)return;setDoc(p.doc);setName(p.name);setTemplates(t.filter(t=>t.mine&&t.versionId));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'加载失败');});return()=>{active=false;};},[projectId]);
  const nodes=doc?.nodes.filter(n=>!['assistant','batch'].includes(String((n.metadata?.studio as {kind?:string}|undefined)?.kind??'')))??[];
  const ids=new Map<string,string>([...inputs.map(i=>[i.nodeId,i.id] as const),...steps.map(s=>[s.nodeId,s.id] as const)]);
  const selectInput=(nodeId:string)=>{
    const node=nodes.find(n=>n.id===nodeId);if(!node)return;
    const used=new Set(inputs.map(i=>i.id));let index=1;while(used.has(`input${index}`))index++;
    const input:StudioTemplateInput={id:`input${index}`,nodeId,label:node.title,type:node.type==='image'?'character':'text',required:true};
    setInputs(old=>[...old,input]);setSteps(old=>old.filter(s=>s.nodeId!==nodeId));setDone('');
  };
  const addStep=(nodeId:string)=>{
    const node=nodes.find(n=>n.id===nodeId);if(!node)return;let index=1;const used=new Set(steps.map(s=>s.id));while(used.has(`step${index}`))index++;
    const refs=doc?.connections.filter(c=>c.toNodeId===nodeId).map(c=>ids.get(c.fromNodeId)).filter((x):x is string=>!!x)??[];
    const video=node.type==='video';
    setSteps(old=>[...old,{id:`step${index}`,nodeId,title:node.title,operation:video?'video':'image',prompt:String(node.metadata?.prompt??''),references:refs,size:video?undefined:'768x1024',outputRole:video?'video':old.length===0?'main':'custom',requiresAdoption:video||old.length===0,...(video?{durationSec:Number(node.metadata?.seconds)||5,aspectRatio:String(node.metadata?.aspectRatio||(node.metadata?.studio as {request?:{aspectRatio?:string}}|undefined)?.request?.aspectRatio||'9:16')}: {})}]);setDone('');
  };
  const save=async()=>{
    setBusy(true);setError('');try {
      const recipe:StudioTemplateRecipe={inputs,steps};
      const version=await publishWithLatestDoc(saveNow,()=>publishTemplateVersion(projectId,{templateId:target,name:name.trim(),summary,visibility,recipe}));
      setTarget(version.templateId);setDone(`已保存${visibility==='personal'?'个人':'官方'}模板 v${version.version}。后续修改会发布新版本，已套用的画布保留原版本。`);
      const fresh=await IpStudioApi.listTemplates();setTemplates(fresh.filter(t=>t.mine&&t.versionId));
    }catch(e){setError(e instanceof Error?e.message:'发布失败');}finally{setBusy(false);}
  };
  const refOptions=[...inputs.filter(i=>i.type==='character'||i.type==='image').map(i=>({value:i.id,label:`输入 · ${i.label}`})),...steps.filter(s=>s.operation==='image').map(s=>({value:s.id,label:`步骤 · ${s.title}`}))];
  return <Modal open title="发布为模板" onCancel={onClose} footer={<Button type="primary" loading={busy} disabled={!doc||!name.trim()||!steps.length||!!done} onClick={()=>void save()}>{target?'发布新版本':visibility==='personal'?'保存个人模板':'发布官方模板'}</Button>} styles={{body:{maxHeight:'70dvh',overflowY:'auto'}}} width={820} mask={{closable:!busy}} keyboard={!busy} closable={!busy}>
    <div className="studio-template-form">
      <p>配置输入、图片和视频步骤及输出标准。作者的素材、运行、聊天和采用身份不进入模板。</p>
      <label>模板名称<Input value={name} onChange={e=>{setName(e.target.value);setDone('');}} maxLength={128}/></label>
      <label>模板说明<Input.TextArea value={summary} onChange={e=>{setSummary(e.target.value);setDone('');}} maxLength={1024} rows={2}/></label>
      <label>可见范围<Select value={visibility} disabled={!!target} options={[{value:'personal',label:'个人模板，仅自己可用'},...(superAdmin?[{value:'official',label:'官方模板，所有用户可用'}]:[])]} onChange={v=>{setVisibility(v);setDone('');}}/></label>
      <label>发布位置<Select allowClear placeholder="新建模板" value={target} options={templates.filter(t=>t.visibility===visibility).map(t=>({value:t.id,label:`${t.name} · 发布新版本`}))} onChange={v=>{setTarget(v);setDone('');}}/></label>
      <strong>1. 定义输入</strong>
      <Select aria-label="添加模板输入" value={undefined} placeholder="选择画布中的图片或文字作为输入槽" options={nodes.filter(n=>['image','text'].includes(n.type)&&!inputs.some(i=>i.nodeId===n.id)).map(n=>({value:n.id,label:n.title}))} onChange={selectInput}/>
      {inputs.map((i,index)=><div key={i.nodeId} className="studio-template-section">
        <Input aria-label={`输入 ${index+1} 编号`} value={i.id} placeholder="稳定编号，如 character" maxLength={32} onChange={e=>{const id=e.target.value;setInputs(old=>old.map(x=>x.nodeId===i.nodeId?{...x,id}:x));setSteps(old=>old.map(s=>({...s,references:s.references.map(r=>r===i.id?id:r),prompt:s.prompt.split(`{{${i.id}}}`).join(`{{${id}}}`)})));setDone('');}}/>
        <Input aria-label={`输入 ${index+1} 名称`} value={i.label} onChange={e=>{setInputs(old=>old.map(x=>x.nodeId===i.nodeId?{...x,label:e.target.value}:x));setDone('');}} maxLength={64}/>
        <Select value={i.type} options={(nodes.find(n=>n.id===i.nodeId)?.type==='image'?['character','image']:['text','option']).map(type=>({value:type,label:{character:'IP 或参考图',image:'图片',text:'文字',option:'选项'}[type]}))} onChange={type=>{setInputs(old=>old.map(x=>x.nodeId===i.nodeId?{...x,type}:x));setDone('');}}/>
        {i.type==='option'&&<Input placeholder="选项，用逗号分隔" value={i.options?.join(',')??''} onChange={e=>{setInputs(old=>old.map(x=>x.nodeId===i.nodeId?{...x,options:e.target.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean)}:x));setDone('');}}/>}
        <Checkbox checked={i.required} onChange={e=>{setInputs(old=>old.map(x=>x.nodeId===i.nodeId?{...x,required:e.target.checked}:x));setDone('');}}>必填</Checkbox>
        <Button onClick={()=>{setInputs(old=>old.filter(x=>x.nodeId!==i.nodeId));setDone('');}}>移除输入</Button>
      </div>)}
      <strong>2. 创作步骤与输出</strong>
      <p>按执行顺序添加图片或视频。指令可用 {'{{输入编号}}'} 插入文字或选项；引用来源必须是输入或前面的图片步骤。</p>
      <Select aria-label="添加模板步骤" value={undefined} placeholder="选择画布中的图片或视频节点" options={nodes.filter(n=>['image','video'].includes(n.type)&&!inputs.some(i=>i.nodeId===n.id)&&!steps.some(s=>s.nodeId===n.id)).map(n=>({value:n.id,label:`${n.type==='video'?'视频':'图片'} · ${n.title}`}))} onChange={addStep}/>
      {steps.map((s,index)=><div key={s.nodeId} className="studio-template-section">
        <strong>{index+1}. {s.id}</strong><Input aria-label={`步骤 ${index+1} 名称`} value={s.title} maxLength={128} onChange={e=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,title:e.target.value}:x));setDone('');}}/>
        <Input.TextArea aria-label={`步骤 ${index+1} ${s.operation==='video'?'视频':'图片'}指令`} value={s.prompt} maxLength={12000} rows={3} onChange={e=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,prompt:e.target.value}:x));setDone('');}}/>
        <label>引用来源<Select mode="multiple" value={s.references} options={refOptions.filter(o=>o.value!==s.id&&(!o.value.startsWith('step')||steps.slice(0,index).some(v=>v.id===o.value)))} onChange={references=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,references}:x));setDone('');}}/></label>
        <label>输出类型<Select value={s.outputRole} options={Object.entries(s.operation==='video'?{video:'视频片段'}:{sheet:'人物设定图（一次出图）',main:'主形象',front:'正视图',side:'侧视图',back:'背视图',expression:'表情',detail:'细节',custom:'其他图片'}).map(([value,label])=>({value,label}))} onChange={outputRole=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,outputRole}:x));setDone('');}}/></label>
        {s.outputRole==='sheet'&&<p>一次生成一张包含多视角、表情和细节的设定图。采用后可整张引用来出图；视频先从它生成单独的镜头画面。</p>}
        {s.operation==='image'?<label>图片尺寸<Select value={s.size} options={['768x1024','1024x1024','768x1365','1365x768'].map(value=>({value,label:value}))} onChange={size=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,size}:x));setDone('');}}/></label>:<>
          <label>视频模式<Select aria-label={`步骤 ${index+1} 视频模式`} value={s.video?.mode??'standard'} options={[{value:'standard',label:'标准文生 / 首帧（按引用自动选择）'},{value:'t2v',label:'原生文生视频'},{value:'i2v',label:'原生首帧视频'},{value:'first_last_frame_video',label:'原生首尾帧'},{value:'universal_reference_video',label:'原生多图参考'}]} onChange={(mode:'standard'|NonNullable<StudioTemplateStep['video']>['mode'])=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,video:mode==='standard'?undefined:{mode,resolutionTier:x.video?.resolutionTier??'768p',seed:x.video?.seed}}:x));setDone('');}}/></label>
          {s.video&&<label>视频清晰度<Select value={s.video.resolutionTier} options={['768p','544p'].map(value=>({value,label:value}))} onChange={resolutionTier=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,video:{...x.video!,resolutionTier}}:x));setDone('');}}/></label>}
          <label>视频时长<Select aria-label={`步骤 ${index+1} 视频时长`} value={s.durationSec} options={[3,4,5,6,8,10,12,15,20,30].map(value=>({value,label:`${value} 秒`}))} onChange={durationSec=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,durationSec}:x));setDone('');}}/></label>
          <label>视频画幅<Select aria-label={`步骤 ${index+1} 视频画幅`} value={s.aspectRatio} options={['9:16','16:9','1:1',...(s.video?['3:4','4:3','21:9']:[])].map(value=>({value,label:value}))} onChange={aspectRatio=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,aspectRatio}:x));setDone('');}}/></label>
          <p>套用时会校验所选模型。首尾帧按“引用来源”中的第一、第二张使用；多图参考使用所有选中的图片。</p>
        </>}
        <Checkbox checked={s.requiresAdoption} onChange={e=>{setSteps(old=>old.map(x=>x.id===s.id?{...x,requiresAdoption:e.target.checked}:x));setDone('');}}>需要用户采用后，下游才继续</Checkbox>
        <Button onClick={()=>{setSteps(old=>old.filter(x=>x.id!==s.id));setDone('');}}>移除步骤</Button>
      </div>)}
      {error&&<Alert type="error" title={error} showIcon/>}{done&&<Alert type="success" title={done} showIcon/>}
    </div>
  </Modal>;
}
