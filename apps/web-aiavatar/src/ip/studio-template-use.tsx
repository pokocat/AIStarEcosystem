'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Spin } from 'antd';
import type { IpTemplate, StudioIpAsset, StudioTemplatePlan, StudioTemplateValue, StudioTemplateVersion, StudioTemplateUseRequest, StudioAssetCatalog } from '@ai-star-eco/types';
import { readTemplateVersion, previewTemplate, instantiateTemplate } from '@/canvas-bridge/template-api';
import { listStudioIpAssets, studioAssetCatalog } from '@/canvas-bridge/studio-api';
import { StudioIpLibrary } from './studio-ip-library';
import { ipAssetRole,ipAssetRoles } from '@/canvas-bridge/studio-ip-library';
import { fetchModels, uploadImage, type IpModelOption } from '@/canvas-bridge/api';
import { studioOverlayContainer } from './studio-overlay';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { SignedImage } from '@/canvas-bridge/signed-image';

export function StudioTemplateUse({ template, nodes=[], onClose, onCreated }: { template: IpTemplate; nodes?:CanvasNodeData[]; onClose:()=>void; onCreated:(id:string)=>void }) {
  const [libraryInput,setLibraryInput]=useState<string>();
  const [assetError,setAssetError]=useState('');
  const [version,setVersion]=useState<StudioTemplateVersion>();
  const [assets,setAssets]=useState<StudioIpAsset[]>([]),[models,setModels]=useState<IpModelOption[]>([]);
  const [products,setProducts]=useState<StudioAssetCatalog['products']>([]),[previews,setPreviews]=useState<Record<string,{url?:string;name:string}>>({});
  const [videoModels,setVideoModels]=useState<IpModelOption[]>([]),[videoModel,setVideoModel]=useState<string>();
  const [values,setValues]=useState<Record<string,StudioTemplateValue>>({}),[model,setModel]=useState<string>();
  const [name,setName]=useState(template.name),[plan,setPlan]=useState<StudioTemplatePlan>();
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;
    // Optional saved products supplement uploads and canvas references; catalog failure must not block templates.
    void studioAssetCatalog().then(c=>{if(active)setProducts(c.products);}).catch(()=>{});
    Promise.all([readTemplateVersion(template.versionId!),listStudioIpAssets(),fetchModels()]).then(([v,a,m])=>{
      if(!active)return;setVersion(v);setAssets(a);setModels(m.image);setModel(m.image.find(x=>x.isDefault)?.endpointId ?? m.image[0]?.endpointId);setVideoModels(m.video);setVideoModel(m.video.find(x=>x.isDefault)?.endpointId??m.video[0]?.endpointId);
      setValues(Object.fromEntries(v.recipe.inputs.filter(i=>i.type==='text'||i.type==='option').map(i=>[i.id,{text:i.defaultValue??''}])));
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'模板加载失败');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[template.versionId]);
  const change=(id:string,value:StudioTemplateValue)=>{setValues(old=>({...old,[id]:value}));setPlan(undefined);setError('');};
  const images=nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey&&n.metadata.status==='success');
  const availableImages=[...images.map(n=>({storageKey:n.metadata!.storageKey!,url:n.metadata?.content,name:`画布 · ${n.title}`})),...products.filter(p=>p.storageKey&&!images.some(n=>n.metadata?.storageKey===p.storageKey)).map(p=>({storageKey:p.storageKey!,url:p.url,name:`商品 · ${p.name}`}))];
  const hasImage=version?.recipe.steps.some(s=>s.operation==='image'),hasVideo=version?.recipe.steps.some(s=>s.operation==='video');
  const request=():StudioTemplateUseRequest=>({versionId:version!.id,name:name.trim(),inputs:values,model:hasImage?model:undefined,videoModel:hasVideo?videoModel:undefined});
  const preview=async()=>{setBusy(true);setError('');try{setPlan(await previewTemplate(request()));}catch(e){setError(e instanceof Error?e.message:'制作计划加载失败');}finally{setBusy(false);}};
  const create=async()=>{setBusy(true);setError('');try{const result=await instantiateTemplate(request());onCreated(result.project.id);}catch(e){setError(e instanceof Error?e.message:'套用失败');setPlan(undefined);}finally{setBusy(false);}};
  const inputRole=(id:string)=>version?.recipe.inputs.find(i=>i.id===id)?.type==='character'?'character' as const:'frame' as const;
  const upload=async(id:string,file:File)=>{setBusy(true);setError('');try{const result=await uploadImage(file,file.name);setPreviews(old=>({...old,[result.key]:{url:result.url,name:file.name}}));change(id,{reference:{storageKey:result.key,role:inputRole(id)}});}catch(e){setError(e instanceof Error?e.message:'图片上传失败');}finally{setBusy(false);}};
  // Selecting a person temporarily replaces this form; two modal portals can otherwise
  // leave the form above the picker on the homepage. The input state stays here.
  return <><Modal open={!libraryInput} getContainer={studioOverlayContainer} title={`套用「${template.name}」`} onCancel={onClose} footer={version?<div><Button onClick={onClose} disabled={busy}>取消</Button>{plan?<Button type="primary" loading={busy} onClick={()=>void create()}>免费创建画布</Button>:<Button type="primary" onClick={()=>void preview()} loading={busy} disabled={!!hasImage&&!model||!!hasVideo&&!videoModel||!name.trim()}>预览制作计划</Button>}</div>:null} styles={{body:{maxHeight:'70dvh',overflowY:'auto'}}} width={660} mask={{closable:!busy}} keyboard={!busy} closable={!busy}>
    {loading?<Spin/>:<div className="studio-template-form">
      {version&&<>
        <p>版本 v{version.version} · {version.visibility==='personal'?'个人模板':'官方模板'}。使用你自己的输入新建画布，创建免费。</p>
        <label>画布名称<Input aria-label="画布名称" value={name} disabled={busy} onChange={e=>{setName(e.target.value);setPlan(undefined);}} maxLength={128}/></label>
        {version.recipe.inputs.map(input=><div key={input.id}>
          <label>{input.label}{input.required?' *':''}</label>
          {input.type==='text'?<Input.TextArea aria-label={input.label} disabled={busy} value={values[input.id]?.text??''} onChange={e=>change(input.id,{text:e.target.value})} maxLength={2000} rows={2}/>:input.type==='option'?<Select aria-label={input.label} disabled={busy} value={values[input.id]?.text||undefined} options={input.options?.map(x=>({value:x,label:x}))} onChange={text=>change(input.id,{text})}/>:<>
            {input.type==='image'&&availableImages.length>0&&<Select aria-label={`已有${input.label}`} disabled={busy} placeholder="从当前画布或商品资产选择" value={availableImages.some(a=>a.storageKey===values[input.id]?.reference?.storageKey)?values[input.id]?.reference?.storageKey:undefined} options={availableImages.map(a=>({value:a.storageKey,label:a.name}))} onChange={storageKey=>change(input.id,{reference:{storageKey,role:'frame'}})}/>}
            <div className="studio-template-reference-picker"><Button aria-label={`${input.label}选择 IP`} disabled={busy} onClick={()=>setLibraryInput(input.id)}>{values[input.id]?.reference?'更换 IP 人物素材':'从 IP 人物库选择'}</Button>
              {values[input.id]?.reference&&<Button disabled={busy} onClick={()=>change(input.id,{})}>移除参考</Button>}</div>
            {(()=>{const a=assets.find(a=>a.storageKey===values[input.id]?.reference?.storageKey);return a?<small>{a.characterName||a.name} · {ipAssetRoles[ipAssetRole(a)]} · v{a.version}</small>:null;})()}
            <label className="studio-template-upload">上传 JPG / PNG<input aria-label={`上传${input.label}`} type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(input.id,f);e.target.value='';}}/></label>
            {(()=>{const key=values[input.id]?.reference?.storageKey;if(!key)return null;const a=assets.find(a=>a.storageKey===key),image=availableImages.find(a=>a.storageKey===key),upload=previews[key];return <figure className="studio-template-input-preview"><SignedImage src={a?.url||image?.url||upload?.url} storageKey={key} alt={input.label} style={{display:'block',width:'100%',height:180,objectFit:'contain'}}/><figcaption>{a?(a.characterName||a.name):image?.name||upload?.name||'已选择参考图片'}</figcaption></figure>;})()}
          </>}
        </div>)}
        {hasImage&&<label>图片模型<Select aria-label="模板图片模型" disabled={busy} value={model} options={models.map(m=>({value:m.endpointId,label:m.name}))} onChange={id=>{setModel(id);setPlan(undefined);}}/></label>}
        {hasVideo&&<label>视频模型<Select aria-label="模板视频模型" disabled={busy} value={videoModel} options={videoModels.map(m=>({value:m.endpointId,label:m.name}))} onChange={id=>{setVideoModel(id);setPlan(undefined);}}/></label>}
        {plan&&<div className="studio-template-plan">
          <strong>{plan.imageCount} 张图片{plan.videoCount?` · ${plan.videoCount} 条视频`:''} · 制作预计 {plan.totalCost} 积分</strong>
          <ol>{plan.steps.map(s=><li key={s.id}>{s.title} · {s.cost} 积分{s.requiresAdoption?' · 需要采用确认':''}{s.status==='waiting_adoption'?' · 等待上游采用':s.dependsOn.length?' · 依赖前序图片':''}</li>)}</ol>
          <p>创建只准备画布，生成时仍需确认费用；需要采用确认的上游图片完成后再继续制作。</p>
        </div>}
      </>}
      {error&&<Alert type="error" title={error} showIcon/>}
    </div>}
  </Modal><StudioIpLibrary open={!!libraryInput} actionLabel="引用选中素材" assets={assets} loading={false} error={assetError} onClose={()=>setLibraryInput(undefined)} onRefresh={()=>{setAssetError('');void listStudioIpAssets().then(setAssets).catch(e=>setAssetError(e.message||'人物库加载失败'));}} onAssetChange={asset=>setAssets(old=>old.map(a=>a.lookId===asset.lookId&&a.avatarId===asset.avatarId?asset:a))} onImport={async a=>{if(!libraryInput)return;change(libraryInput,{reference:{...(a.librarySource==='official'?{}:{ipId:a.ipId,avatarId:a.avatarId,version:a.version,lookId:a.lookId}),storageKey:a.storageKey,role:inputRole(libraryInput)}});setLibraryInput(undefined);}}/></>;
}
