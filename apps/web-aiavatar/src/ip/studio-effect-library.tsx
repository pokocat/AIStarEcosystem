"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Skeleton } from 'antd';
import { ArrowLeft, Heart, Info, Plus, Search, Sparkles } from 'lucide-react';
import type { StudioVideoEffect } from '@ai-star-eco/types';
import { listVideoEffects, favoriteVideoEffect, applyVideoEffect, publishVideoEffect } from '@/canvas-bridge/effect-api';
import { fetchModels, type IpModelOption } from '@/canvas-bridge/api';
import { studioOverlayContainer } from './studio-overlay';

type Scope = 'square'|'favorite'|'recent'|'personal';
export type StudioEffectPreview = {storageKey:string;name:string};
export function effectMatchesModel(effect:StudioVideoEffect,model?:string) {
  return !!model && (!effect.models.length || effect.models.includes(model));
}

/** One library for native, expanded and drawer editors. All persistent activity is account-scoped on the server. */
export function StudioEffectLibrary({model,disabled,hasEffect=false,onRememberCaret,onApply,onCatalog,previews=[]}:{
  model:string;disabled?:boolean;hasEffect?:boolean;onRememberCaret:()=>void;onApply:(effect:StudioVideoEffect,catalogue:StudioVideoEffect[])=>void;
  onCatalog:(effects:StudioVideoEffect[])=>void;previews?:StudioEffectPreview[];
}) {
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [items,setItems]=useState<StudioVideoEffect[]>([]),[models,setModels]=useState<IpModelOption[]>([]);
  const [scope,setScope]=useState<Scope>('square'),[query,setQuery]=useState(''),[tag,setTag]=useState('全部'),[compatibleOnly,setCompatibleOnly]=useState(true);
  const [selectedId,setSelectedId]=useState<string>(),[busy,setBusy]=useState(false),[publishing,setPublishing]=useState(false);
  const pendingApply=useRef<StudioVideoEffect | null>(null);
  const [name,setName]=useState(''),[summary,setSummary]=useState(''),[prompt,setPrompt]=useState(''),[tags,setTags]=useState('');
  const [allowed,setAllowed]=useState<string[]>([]),[general,setGeneral]=useState(true),[previewKey,setPreviewKey]=useState<string>();
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {const [catalog,configured]=await Promise.all([listVideoEffects(),fetchModels()]);setItems(catalog);setModels(configured.video);}
    catch(e){setError(e instanceof Error?e.message:'特效库未加载，请重试');}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{onCatalog(items);},[items,onCatalog]);
  const update=(item:StudioVideoEffect)=>{setItems(current=>current.some(e=>e.id===item.id)?current.map(e=>e.id===item.id?item:e):[item,...current]);};
  const selected=items.find(e=>e.id===selectedId);
  const modelName=(id:string)=>models.find(m=>m.endpointId===id)?.name||'已停用的模型';
  const needle=query.trim().toLocaleLowerCase();
  const scoped=items.filter(e=>scope==='favorite'?e.favorite:scope==='recent'?!!e.lastUsedAt:scope==='personal'?e.visibility==='personal':e.visibility==='official');
  const filtered=scoped.filter(e=>(!compatibleOnly||effectMatchesModel(e,model)) && (tag==='全部'||e.tags.includes(tag)) &&
    `${e.name} ${e.author} ${e.tags.join(' ')} ${e.models.map(modelName).join(' ')}`.toLocaleLowerCase().includes(needle))
    .sort((a,b)=>scope==='recent'?(b.lastUsedAt||'').localeCompare(a.lastUsedAt||''):b.createdAt.localeCompare(a.createdAt));
  const categories=['全部',...new Set(scoped.flatMap(e=>e.tags))];
  const favorite=async(effect:StudioVideoEffect)=>{setBusy(true);setError('');try{update(await favoriteVideoEffect(effect.id,!effect.favorite));}catch(e){setError(e instanceof Error?e.message:'收藏未保存，请重试');}finally{setBusy(false);}};
  const apply=async(selected:StudioVideoEffect)=>{
    if(!effectMatchesModel(selected,model)||busy||disabled)return;
    setBusy(true);setError('');
    try {const effect=await applyVideoEffect(selected.id,model);update(effect);pendingApply.current=effect;setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:'特效未应用，请重试');}finally{setBusy(false);}
  };
  const publish=async()=>{
    setBusy(true);setError('');
    try {const effect=await publishVideoEffect({name,summary,prompt,tags:tags.split(/[，,]/).map(v=>v.trim()).filter(Boolean),models:general?[]:allowed,visibility:'personal',previewKey});
      update(effect);setPublishing(false);setScope('personal');setQuery('');setTag('全部');setCompatibleOnly(false);setSelectedId(effect.id);
      setName('');setSummary('');setPrompt('');setTags('');setPreviewKey(undefined);setAllowed([]);setGeneral(true);
    }catch(e){setError(e instanceof Error?e.message:'特效未保存，请重试');}finally{setBusy(false);}
  };
  return <>
    <Button disabled={disabled} type="text" size="small" aria-label="打开视频特效库" aria-expanded={open}
      onMouseDown={onRememberCaret} onClick={()=>{onRememberCaret();setOpen(true);setSelectedId(undefined);setPublishing(false);void load();}} icon={<Sparkles size={14}/>}>{hasEffect?'替换特效':'特效'}</Button>
    <Modal title="视频特效" open={open} centered width={940} className="studio-effects-modal" getContainer={studioOverlayContainer}
      footer={null} onCancel={()=>!busy&&setOpen(false)} maskClosable={!busy} closable={!busy} keyboard={!busy} destroyOnHidden
      afterClose={()=>{const effect=pendingApply.current;pendingApply.current=null;if(effect)onApply(effect,items);}}>
      <div className="studio-effects" data-canvas-no-zoom onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
        onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
        {error&&<Alert type="error" showIcon title={error} action={!busy&&<Button onClick={()=>void load()}>重新加载</Button>}/>}
        {publishing?<div className="studio-effect-authoring">
          <div className="studio-effect-authoring-header"><Button type="text" icon={<ArrowLeft size={16}/>} disabled={busy} onClick={()=>{setPublishing(false);setError('');}}>返回特效库</Button>
          <h3>保存我的特效</h3><p>保存效果描述，下次在任意画布中调用。仅自己可见。</p>
          </div><div className="studio-effect-authoring-fields">
          <label>名称<Input aria-label="特效名称" value={name} onChange={e=>setName(e.target.value)} maxLength={128}/></label>
          <label>简介<Input aria-label="特效简介" value={summary} onChange={e=>setSummary(e.target.value)} maxLength={1024}/></label>
          <label>效果描述<Input.TextArea aria-label="特效效果描述" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} maxLength={8000} placeholder="描述主体、变化过程及需要保持的细节"/></label>
          <label>标签<Input aria-label="特效标签" value={tags} onChange={e=>setTags(e.target.value)} placeholder="用逗号分隔，最多 8 个"/></label>
          <Checkbox checked={general} onChange={e=>setGeneral(e.target.checked)}>通用描述，可用于所有已配置视频模型</Checkbox>
          {!general&&<label>适用模型<Select mode="multiple" aria-label="特效适用模型" value={allowed} onChange={setAllowed} options={models.map(m=>({value:m.endpointId,label:m.name}))}/></label>}
          <label>参考封面<Select allowClear aria-label="特效参考封面" value={previewKey} onChange={setPreviewKey} placeholder={previews.length?'从当前画布选择图片':'当前画布没有可用图片，可不填'} options={previews.map(p=>({value:p.storageKey,label:p.name}))}/></label>
          </div>
          <div className="studio-effect-authoring-footer"><Button type="primary" loading={busy} disabled={!name.trim()||!prompt.trim()||!general&&!allowed.length} onClick={()=>void publish()}>保存特效</Button></div>
        </div>:<>
          <div className="studio-effect-library-header"><div role="tablist" aria-label="特效来源">{([['square','广场'],['favorite','我的收藏'],['recent','最近使用'],['personal','我的特效']] as const).map(([value,label])=>
            <button role="tab" aria-selected={scope===value} type="button" key={value} disabled={busy} onClick={()=>{setScope(value);setSelectedId(undefined);setTag('全部');}}>{label}</button>)}</div>
            <Button icon={<Plus size={15}/>} disabled={busy} onClick={()=>{setPublishing(true);setError('');}}>保存我的特效</Button></div>
          <div className="studio-effect-filters"><Input aria-label="搜索视频特效" autoFocus prefix={<Search size={16}/>} placeholder="搜索名称、作者、模型、标签" value={query} onChange={e=>setQuery(e.target.value)}/>
            <Checkbox checked={compatibleOnly} onChange={e=>setCompatibleOnly(e.target.checked)}>仅适用当前模型</Checkbox></div>
          <div className="studio-effect-categories" aria-label="特效分类">{categories.map(t=><button type="button" key={t} aria-pressed={tag===t} onClick={()=>setTag(t)}>{t}</button>)}</div>
          <p className="studio-effect-model">当前模型：{modelName(model)}。点击卡片选用；已选特效会被替换，描述仍可编辑。</p>
          <div className={`studio-effect-content${selected?' has-selection':''}`}>
            <div className="studio-effect-gallery" role="tabpanel" aria-label="特效列表">
              {loading?<Skeleton active paragraph={{rows:5}}/>:filtered.length?filtered.map(effect=><article key={effect.id} className={selectedId===effect.id?'is-selected':''}>
                <button type="button" className="studio-effect-card" disabled={busy||disabled} aria-label={`${effectMatchesModel(effect,model)?'选用':'查看不适用的'}特效 ${effect.name}`} onClick={()=>effectMatchesModel(effect,model)?void apply(effect):setSelectedId(effect.id)}>
                  {effect.previewUrl?<img src={effect.previewUrl} alt={`${effect.name}参考封面`}/>:<div className="studio-effect-no-preview"><span>效果描述</span><p>{effect.summary||effect.prompt}</p><small>暂无预览</small></div>}
                  <strong>{effect.name}</strong><span>{effect.author}</span><small>{effect.models.length?effect.models.map(modelName).join('、'):'通用描述'}</small>
                </button>
                <button type="button" className="studio-effect-heart" aria-label={`${effect.favorite?'取消收藏':'收藏'} ${effect.name}`} aria-pressed={effect.favorite} disabled={busy} onClick={()=>void favorite(effect)}><Heart size={17} fill={effect.favorite?'currentColor':'none'}/></button>
                <button type="button" className="studio-effect-info" aria-label={`查看特效详情 ${effect.name}`} disabled={busy} onClick={()=>setSelectedId(effect.id)}><Info size={17}/></button>
              </article>):<div className="studio-effect-empty" role="status"><h3>{scope==='favorite'?'还没有匹配的收藏':scope==='recent'?'还没有匹配的使用记录':scope==='personal'?'还没有匹配的个人特效':'没有匹配的特效'}</h3>
                <p>{scope==='favorite'?'在特效条目上点击收藏，便可在这里再次找到。':scope==='recent'?'应用过的特效会保存在这里。':'换个关键词，或取消“仅适用当前模型”查看其他特效。'}</p>{scope==='personal'&&<Button onClick={()=>setPublishing(true)}>保存我的特效</Button>}</div>}
            </div>
            {selected&&<section className="studio-effect-detail" aria-label="特效详情">
              <Button className="studio-effect-detail-back" type="text" icon={<ArrowLeft size={16}/>} onClick={()=>setSelectedId(undefined)}>返回列表</Button>
              <div className="studio-effect-detail-scroll">
                {selected.previewUrl&&<img src={selected.previewUrl} alt={`${selected.name}参考封面`}/>}
                <h3>{selected.name}</h3><p>{selected.author} · {selected.visibility==='official'?'官方':'仅自己可见'}</p>
                <p>{selected.summary}</p><h4>效果描述</h4><p className="studio-effect-description">{selected.prompt}</p>
                <h4>适用模型</h4><p>{selected.models.length?selected.models.map(modelName).join('、'):'所有已配置视频模型'}</p>
                <p>{selected.tags.join(' · ')}</p>
                {!effectMatchesModel(selected,model)&&<p role="status">当前模型不适用。关闭特效库后选择适用模型，再应用此特效。</p>}
              </div>
              <div className="studio-effect-detail-footer"><Button icon={<Heart size={15}/>} disabled={busy} onClick={()=>void favorite(selected)}>{selected.favorite?'取消收藏':'收藏'}</Button>
                <Button type="primary" loading={busy} disabled={!effectMatchesModel(selected,model)||disabled} onClick={()=>void apply(selected)}>选用特效</Button></div>
            </section>}
          </div>
        </>}
      </div>
    </Modal>
  </>;
}
