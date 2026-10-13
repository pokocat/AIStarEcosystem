"use client";
import { StudioAiIcon } from "./studio-ai-icon";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { useEffect, useRef, useState, type ComponentRef, type Dispatch, type SetStateAction } from "react";
import { App, Button, Input, Select } from "antd";
import { ApiError } from "@ai-star-eco/api-client";
import { nanoid } from "nanoid";
import type { StudioAssistantMode, StudioCapabilities, StudioPlan, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasConnection, CanvasNodeData } from "@/canvas/types/canvas";
import { applyStudioRun, makeStudioNode } from "@/canvas-bridge/studio-nodes";
import { readRun } from "@/canvas-bridge/api";
import { importStudioStory, importStudioMedia, submitStudioRun } from "@/canvas-bridge/studio-api";
import { saveStudioDocument } from "@/canvas-bridge/studio-save";
import { ASSISTANT_CONTEXT_LIMIT, assistantContextIds, assistantContextNodes, assistantMentionQuery, insertAssistantMention } from "@/canvas-bridge/studio-assistant-context";
import type { IpSavedAsset } from '@ai-star-eco/types';
import { attachmentNode, savedAssetPayload, readAssistantAttachment } from '@/canvas-bridge/studio-attachments';
import { LibraryReferencePicker } from './library-reference-picker';
import { StudioAttachmentPicker } from './studio-attachment-picker';
import { StudioConversationShare } from './studio-conversation-share';
import { AtSign, Scan, X, SlidersHorizontal, Plus, ArrowUp, FileText, Image, Video, Workflow } from 'lucide-react';
import { StudioAssistantPlan } from './studio-assistant-plan';
import { assistantStepReferences, assistantUnresolvedReferences, assistantWritableText } from '@/canvas-bridge/studio-assistant-plan';
import { placeStudioNode } from '@/canvas-bridge/flow-document';
import { markStudioDescendants } from '@/canvas-bridge/studio-script';

type Props={projectId:string;nodes:CanvasNodeData[];setNodes:Dispatch<SetStateAction<CanvasNodeData[]>>;setConnections:Dispatch<SetStateAction<CanvasConnection[]>>;
  capabilities?:StudioCapabilities;open:boolean;initialNodeId?:string;initialPrompt?:string;initialMode?:StudioAssistantMode;onClose:()=>void;selectedIds:string[];onUseStep:(step:StudioPlan["steps"][number])=>string|void};
const modeNames={general:"全能创作",original:"原创剧本",adapt:"故事改编",director:"导演执导"};
type AssistantDraft={prompt:string;contextIds:string[];model?:string;mode:StudioAssistantMode;readVisuals:boolean};
// These business errors occur before a run is accepted. Unknown transport/server
// errors keep the original request key; a timeout must never create another paid run.
const preflightErrors=new Set(['AI_TOKEN_PRICE_NOT_CONFIGURED','AI_TOKEN_PRICE_INVALID','STUDIO_INPUT_INVALID','STUDIO_MODE_INVALID','STUDIO_CONTEXT_NOT_FOUND','STUDIO_CONTEXT_LIMIT','STUDIO_HISTORY_LIMIT','STUDIO_HISTORY_INVALID','STUDIO_PRICE_CHANGED','ENDPOINT_NOT_ALLOWED','PROMPT_NOT_CONFIGURED','STUDIO_VISION_UNAVAILABLE','STUDIO_VISUAL_MISSING','STUDIO_VISUAL_LIMIT','IP_ASSET_KEY_INVALID']);
export function StudioAssistant({projectId,nodes,setNodes,setConnections,capabilities,open,initialNodeId,initialPrompt,initialMode,onClose,selectedIds,onUseStep}:Props) {
  const {message}=App.useApp();const [mode,setMode]=useState<StudioAssistantMode>("general"),[prompt,setPrompt]=useState(""),[conversationId,setConversationId]=useState<string>(),[contextIds,setContextIds]=useState<string[]>([]),[model,setModel]=useState<string>(),[busy,setBusy]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [libraryQuery,setLibraryQuery]=useState<string>();
  const libraryMention=useRef<ReturnType<typeof assistantMentionQuery>>(undefined);
  const [caret,setCaret]=useState(0),[mentionOpen,setMentionOpen]=useState(false),[mentionIndex,setMentionIndex]=useState(0),[reading,setReading]=useState(false),[contextError,setContextError]=useState('');
  const [readVisuals,setReadVisuals]=useState(true),[attachmentsUnsaved,setAttachmentsUnsaved]=useState(false);
  // UI drafts belong to their conversation, independent of accepted run requests.
  const drafts=useRef(new Map<string,AssistantDraft>());
  const rememberDraft=(project=projectId)=>drafts.current.set(`${project}:${conversationId||'new'}`,{prompt,contextIds:[...contextIds],model,mode,readVisuals});
  const restoreDraft=(draft:AssistantDraft)=>{setPrompt(draft.prompt);setContextIds(draft.contextIds);setModel(draft.model);setMode(draft.mode);setReadVisuals(draft.readVisuals);};
  const composer=useRef<ComponentRef<typeof Input.TextArea>>(null);
  const live=useRef({nodes,projectId});live.current={nodes,projectId};const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setConversationId(undefined);setContextIds([]);setPrompt("");setBusy(false);setReading(false);setAttachmentsUnsaved(false);},[projectId]);
  const resumed=useRef<{projectId:string;initialNodeId?:string}|undefined>(undefined);
  useEffect(()=>{if(open){
    if(resumed.current?.projectId===projectId&&resumed.current?.initialNodeId===initialNodeId)return;
    if(resumed.current)rememberDraft(resumed.current.projectId);
    resumed.current={projectId,initialNodeId};
    const node=live.current.nodes.find(n=>n.id===initialNodeId),c=node?.metadata?.studio?.conversation;
    setConversationId(c?node!.id:undefined);setContextError('');setMentionOpen(false);
    const draft=drafts.current.get(`${projectId}:${c?node!.id:'new'}`);
    if(draft){restoreDraft(draft);return;}
    if(c)setMode(c.mode);
    else if(initialMode)setMode(initialMode);
    // New conversations only inherit referenceable selection. Saved references
    // keep missing IDs so an actually deleted source still requires recovery.
    const selection=assistantContextNodes(live.current.nodes).filter(n=>selectedIds.includes(n.id)).map(n=>n.id);
    // A copied conversation has no source bindings; its entry marker only opens the assistant.
    setContextIds(assistantContextIds(node?.metadata?.studio?.request?.contextNodeIds||(c?[]:node?.metadata?.studioStart==='assistant'?[node.id]:selection)));
    if(c)setModel(node?.metadata?.studio?.request?.model);
    setReadVisuals(c?node?.metadata?.studio?.request?.readVisuals===true:true);
    if(node?.metadata?.status==='error'&&c)setPrompt(node.metadata.studio?.request?.prompt||'');
    else setPrompt(!c?initialPrompt||'':'');
  }},[open,initialNodeId,projectId]);
  const conversations=nodes.filter(n=>n.metadata?.studio?.conversation);
  const current=conversations.find(n=>n.id===conversationId),conversation=current?.metadata?.studio?.conversation;
  const textModels=capabilities?.textModels||[];
  const selectedModel=textModels.find(m=>m.endpointId===((capabilities?.textModelMode!=="fixed"&&textModels.some(m=>m.endpointId===model)?model:undefined)||textModels.find(m=>m.isDefault)?.endpointId||textModels[0]?.endpointId));
  const canReadVisuals=!capabilities?.mock&&selectedModel?.supportsVision===true;
  const readingVisuals=readVisuals&&canReadVisuals;
  const contextNodes=assistantContextNodes(nodes),missingIds=contextIds.filter(id=>!contextNodes.some(n=>n.id===id));
  const locked=busy||reading||current?.metadata?.status==='loading';
  const query=mentionOpen?assistantMentionQuery(prompt,caret):undefined;
  const suggestions=query?contextNodes.filter(n=>n.title.toLocaleLowerCase().includes(query.query.toLocaleLowerCase())).slice(0,12):[];
  const chooseMention=(node:CanvasNodeData)=>{
    if(contextIds.length>=ASSISTANT_CONTEXT_LIMIT&&!contextIds.includes(node.id)){setContextError('最多引用 16 个画布对象，请先移除一项');return;}
    const value=query?insertAssistantMention(prompt,query,node.title):prompt;
    setPrompt(value);setContextIds(ids=>assistantContextIds([...ids,node.id]));setMentionOpen(false);setContextError('');composer.current?.focus();
  };
  const selectConversation=(id?:string)=>{
    rememberDraft();
    const node=conversations.find(n=>n.id===id),saved=node?.metadata?.studio;
    const draft=drafts.current.get(`${projectId}:${id||'new'}`);
    if(draft){setConversationId(id);restoreDraft(draft);setMentionOpen(false);setContextError('');return;}
    setConversationId(id);setPrompt(node?.metadata?.status==='error'?saved?.request?.prompt||'':'');setMentionOpen(false);setContextError('');
    setContextIds(assistantContextIds(saved?.request?.contextNodeIds||[]));setModel(saved?.request?.model);
    setReadVisuals(saved?saved.request?.readVisuals===true:true);
    if(saved?.conversation)setMode(saved.conversation.mode);
  };
  const importLock=useRef(false);
  const saveAttachments=async(project:string)=>{
    setAttachmentsUnsaved(true);
    await saveStudioDocument(project);
    if(mounted.current&&live.current.projectId===project)setAttachmentsUnsaved(false);
  };
  const addAttachments=async(source:File[]|IpSavedAsset[])=>{
    if(importLock.current||locked)return;
    const project=projectId;importLock.current=true;setReading(true);setContextError('');
    let staged=[...live.current.nodes],ids=[...contextIds],added=0;
    const failures:string[]=[];
    try{
      for(const item of source){
        if(!mounted.current||live.current.projectId!==project)return;
        try{
          let node:CanvasNodeData;
          if(item instanceof File){
            if(ids.length>=ASSISTANT_CONTEXT_LIMIT)throw new Error('最多引用 16 个对象，请先移除一项');
            node=await readAssistantAttachment(item,staged,file=>importStudioStory(project,file),(file,type)=>importStudioMedia(project,file,type));
          }else{
            node=attachmentNode(savedAssetPayload(item),staged);
            if(!ids.includes(node.id)&&ids.length>=ASSISTANT_CONTEXT_LIMIT)throw new Error('最多引用 16 个对象，请先移除一项');
          }
          if(!mounted.current||live.current.projectId!==project)return;
          if(!staged.some(n=>n.id===node.id)){staged=[...staged,node];setNodes(list=>[...list,node]);}
          if(!ids.includes(node.id)){ids=[...ids,node.id];setContextIds(ids);}
          added++;
        }catch(e){failures.push(`${item instanceof File?item.name:item.title}：${e instanceof Error?e.message:'导入失败，请重试'}`);}
      }
      if(added){await saveAttachments(project);if(mounted.current&&live.current.projectId===project)message.success(`已添加并引用 ${added} 项，可编辑后发送`);}
      if(failures.length)throw new Error(failures.join('；'));
    }catch(e){if(mounted.current&&live.current.projectId===project){setContextError(e instanceof Error?e.message:'附件未导入，请重试');throw e;}}
    finally{importLock.current=false;if(mounted.current&&live.current.projectId===project)setReading(false);}
  };
  const retryAttachmentSave=async()=>{const project=projectId;setReading(true);try{await saveAttachments(project);setContextError('');message.success('附件已保存，可继续创作');}catch(e){setContextError(e instanceof Error?e.message:'画布保存失败，请重试');}finally{if(mounted.current&&live.current.projectId===project)setReading(false);}};
  const patch=(id:string,update:(node:CanvasNodeData)=>CanvasNodeData)=>setNodes(list=>list.map(n=>n.id===id?update(n):n));
  const send=async(recover=false)=>{
    if(busy||reading||attachmentsUnsaved||!capabilities||!recover&&(!prompt.trim()||missingIds.length||current?.metadata?.status==='loading'))return;
    setBusy(true);const project=projectId;
    let target=current,request:StudioRunRequest|undefined,posted=false,accepted=false;
    try {
      if(recover)request=target?.metadata?.studio?.request;
      else {
        target=target||makeStudioNode("assistant");
        const turns=[...(conversation?.turns||[]),{role:"user" as const,content:prompt.trim()}].slice(-15);
        request={clientRequestId:nanoid(),nodeId:target.id,operation:"assistant",prompt:prompt.trim(),mode,contextNodeIds:contextIds,
          history:(conversation?.turns||[]).slice(-14).map(t=>({role:t.role,content:t.content})),model:(capabilities?.textModelMode!=="fixed"&&textModels.some(m=>m.endpointId===model)?model:undefined)||textModels.find(m=>m.isDefault)?.endpointId||textModels[0]?.endpointId,maxCost:capabilities.mock?0:selectedModel?.tokenPricing?.maxCost,readVisuals:readingVisuals};
        const next={...target,title:modeNames[mode],metadata:{...target.metadata,status:"loading" as const,errorDetails:undefined,studio:{kind:"assistant" as const,request,assistantPreviousConversation:conversation||{mode,turns:[]},conversation:{...conversation,mode,turns}}}};
        if(current)patch(next.id,()=>next);else {setNodes(list=>[...list,next]);setConnections(list=>[...list,...contextIds.map(id=>({id:nanoid(),fromNodeId:id,toNodeId:next.id}))]);}
        drafts.current.delete(`${projectId}:${conversationId||'new'}`);
        setConversationId(next.id);target=next;setPrompt("");
      }
      if(!target||!request)throw new Error("没有可恢复的对话");
      await saveStudioDocument(project);
      if(!mounted.current||live.current.projectId!==project)return;
      setContextError('');
      posted=true;
      let run=await submitStudioRun(project,request);
      accepted=true;
      while(mounted.current&&live.current.projectId===project) {
        patch(target.id,n=>{const next=applyStudioRun(n,run);return run.status==='running'?next:{...next,metadata:{...next.metadata,studio:{...next.metadata!.studio!,assistantPreviousConversation:undefined}}};});
        if(run.status!=="running") {await saveStudioDocument(project);if(run.status==="failed")throw new Error(run.errorMessage||"对话未完成");return;}
        await new Promise(resolve=>setTimeout(resolve,1200));
        try{run=await readRun(run.id);}catch{await new Promise(resolve=>setTimeout(resolve,2000));}
      }
    } catch(e){if(mounted.current&&live.current.projectId===project){
      const error=e instanceof Error?e.message:'对话未完成，请确认原任务';
      const rejected=!accepted&&(!recover&&!posted||e instanceof ApiError&&preflightErrors.has(e.code));
      if(rejected&&target&&request){
        const draft=request;
        // Restoring from request.history would drop the oldest two visible turns.
        // Save this full snapshot in the doc so recovery after a reload is identical.
        const previous=target.metadata?.studio?.assistantPreviousConversation||(!recover?conversation:undefined)||{mode:target.metadata!.studio!.conversation!.mode,turns:draft.history||[]};
        patch(target.id,n=>({...n,metadata:{...n.metadata,status:'error',errorDetails:error,studio:{...n.metadata!.studio!,conversation:previous,assistantPreviousConversation:undefined}}}));
        setPrompt(draft.prompt||'');setContextError(error);
        try{await saveStudioDocument(project);}catch{if(mounted.current&&live.current.projectId===project)setContextError(`${error}。恢复的草稿尚未保存，请重试保存后再发送`);}
      }else if(!accepted)setContextError('提交结果尚未确认，请用“确认原对话任务”获取结果，避免重复提交');
      message.error(error);
    }}
    finally {if(mounted.current&&live.current.projectId===project)setBusy(false);}
  };
  const editStep=(step:StudioPlan["steps"][number])=>current&&patch(current.id,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,conversation:{...n.metadata!.studio!.conversation!,plan:{...n.metadata!.studio!.conversation!.plan!,steps:n.metadata!.studio!.conversation!.plan!.steps.map(s=>s.id===step.id?step:s)}}}}}));
  const applyStep=async(step:StudioPlan["steps"][number],replacement?:{id:string;content:string})=>{
    if(!current||!conversation?.plan)return;
    const source=live.current.nodes.find(n=>n.id===current.id);
    const latest=source?.metadata?.studio?.conversation?.plan;
    const saved=latest?.steps.find(s=>s.id===step.id);
    if(!saved||!latest)throw new Error('方案已更新，请重新打开结果');
    const refs=assistantStepReferences(saved,latest,live.current.nodes);
    if(refs.waiting.length)throw new Error('请先完成前置内容，再继续这一步');
    const resolved={...saved,referenceNodeIds:refs.ids,unresolvedReferences:assistantUnresolvedReferences(saved,latest)};
    const existing=live.current.nodes.find(n=>n.id===saved.resultNodeId);
    // Retry saving the same adopted node; never duplicate a result after a transport failure.
    if(existing){editStep({...saved,unresolvedReferences:resolved.unresolvedReferences});await saveStudioDocument(projectId);if(step.operation!=='text')onUseStep(resolved);return;}
    let resultId:string|void;
    if(step.operation==='text') {
      if(!saved.content?.trim())throw new Error('请先填写文字内容');
      const target=replacement?live.current.nodes.find(n=>n.id===replacement.id):undefined;
      if(replacement&&(!target||!assistantWritableText(target)||!contextIds.includes(target.id)))throw new Error('目标文字节点已不可编辑，请重新选择');
      if(target&&(target.metadata?.content||'')!==replacement!.content)throw new Error('节点正文已有修改，请重新选择目标，核对原文后再采用');
      const node=target?{...target,metadata:{...target.metadata,content:saved.content}}:
        {...makeStudioNode('text',live.current.nodes.find(n=>refs.ids.includes(n.id))),title:saved.title,metadata:{content:saved.content,status:'success' as const,studio:{kind:'text' as const}}};
      resultId=node.id;
      setNodes(list=>target?markStudioDescendants(list,target.id).map(n=>n.id===target.id?node:n):[...list,placeStudioNode(node,list)]);
      // Replacement retains the user's existing graph; only new nodes inherit reference edges.
      if(!target)setConnections(list=>[...list,...refs.ids.filter(id=>id!==node.id).map(id=>({id:nanoid(),fromNodeId:id,toNodeId:node.id}))]);
    } else resultId=onUseStep(resolved);
    if(resultId)editStep({...saved,unresolvedReferences:resolved.unresolvedReferences,resultNodeId:resultId});
    await saveStudioDocument(projectId);
    if(step.operation==='text')message.success(replacement?'已更新文字节点':'文字已放入画布');
  };
  const starterPrompts=contextIds.length>1?[
    ['整理所选内容','整理这些节点的内容，生成一份可直接使用的文字摘要。',FileText],
    ['统一视觉风格','基于所选素材，设计一张风格统一的新图片。',Image],
    ['规划场景视频','基于所选素材，规划一条场景视频，保留人物和场景特征。',Video],
    ['串成创作流程','根据这些节点，规划接下来需要的文字、图片和视频节点及引用关系。',Workflow],
  ] as const:[
    ['写一段文字',contextIds.length?'基于所选节点生成一版可直接使用的文字内容，保留核心设定。':'生成一个末世英雄的角色描述，补全外貌、服装和性格，直接给我初稿。',FileText],
    ['创作一张图片',contextIds.length?'基于所选内容，设计一张新的形象图片。':'设计一个有辨识度的原创 IP 形象，先给出可生成图片的方案。',Image],
    ['制作一段视频',contextIds.length?'以所选素材为参考，设计一段五秒的场景视频。':'设计一段五秒的场景视频，给出画面和运镜方案。',Video],
    ['搭建创作流程','帮我搭建从角色描述、多视角设定图、细节参考图到场景视频的创作流程。',Workflow],
  ] as const;
  return <StudioFloatingPanel title="Studio 创作助手" className="studio-assistant-panel" open={open} onClose={()=>{rememberDraft();onClose();}} width={448} utility dockable footer={
      <div className="studio-assistant-composer">
        <div className="studio-assistant-references" aria-label="本次引用">{contextIds.map(id=>{const n=contextNodes.find(n=>n.id===id);return <div key={id} className="studio-assistant-reference"><span>{n?.title||'已删除的画布对象'}{n&&<small> · {readingVisuals&&n.type==='image'?'图片':readingVisuals&&n.type==='video'?'视频 4 帧':n.type==='text'?'文字':'文字设定'}</small>}</span><button type="button" disabled={locked} aria-label={`移除引用 ${n?.title||id}`} onClick={()=>setContextIds(ids=>ids.filter(value=>value!==id))}><X size={14}/></button></div>;})}</div>
        <Input.TextArea ref={composer} aria-label="给创作助手的消息" aria-describedby={toolsOpen?"studio-assistant-context-note":undefined} aria-autocomplete="list" aria-controls={query?'studio-assistant-mentions':undefined} aria-activedescendant={query&&suggestions.length?`studio-assistant-mention-${suggestions[mentionIndex%suggestions.length].id}`:undefined} placeholder="想创作什么？输入 @ 引用画布内容" value={prompt} disabled={locked} onChange={e=>{const value=e.target.value;setPrompt(value);setCaret(e.target.selectionStart);setMentionOpen(mentionOpen||(value.match(/@/g)?.length||0)>(prompt.match(/@/g)?.length||0));setMentionIndex(0);}} onSelect={e=>setCaret(e.currentTarget.selectionStart)} onKeyDown={e=>{
          if(e.nativeEvent.isComposing)return;
          if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!query){e.preventDefault();void send();return;}
          if(query&&e.key==='Escape'){e.preventDefault();e.stopPropagation();setMentionOpen(false);}
          else if(query&&suggestions.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setMentionIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);}
          else if(query&&suggestions.length&&e.key==='Enter'){e.preventDefault();chooseMention(suggestions[mentionIndex%suggestions.length]);}
        }} autoSize={{minRows:2,maxRows:5}} maxLength={4000}/>
        {query&&<div id="studio-assistant-mentions" className="studio-assistant-mentions" role="listbox" aria-label="可引用的画布节点">{suggestions.length?suggestions.map((node,index)=><button key={node.id} id={`studio-assistant-mention-${node.id}`} type="button" role="option" aria-selected={index===mentionIndex%suggestions.length} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseMention(node)}><span>{node.title}</span><small>{node.type==='text'?'文字':'素材设定'}</small></button>):<p>当前画布没有匹配节点</p>}<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{libraryMention.current=query;setLibraryQuery(query.query);setMentionOpen(false);}}>从个人资产库选择</button></div>}
        <div className="studio-assistant-context-actions"><Button icon={<AtSign size={16}/>} disabled={locked} onClick={()=>{const value=prompt+(prompt&&!/\s$/.test(prompt)?' ':'')+'@';setPrompt(value);setCaret(value.length);setMentionOpen(true);setMentionIndex(0);composer.current?.focus();}}>引用节点</Button><StudioAttachmentPicker projectId={projectId} locked={locked} reading={reading} onFiles={files=>void addAttachments(files).catch(()=>{})} onAssets={addAttachments}/></div>
        <LibraryReferencePicker open={libraryQuery!==undefined} query={libraryQuery||''} projectId={projectId} onClose={()=>setLibraryQuery(undefined)} onAssets={async assets=>{await addAttachments(assets);const mention=libraryMention.current;if(mention)setPrompt(value=>insertAssistantMention(value,mention,assets.map(a=>a.title).join("、")));libraryMention.current=undefined;}}/>
        {attachmentsUnsaved&&<Button disabled={locked} onClick={()=>void retryAttachmentSave()}>重试保存附件</Button>}

        <div className="studio-assistant-send-row"><span>⌘ / Ctrl + Enter 发送</span><Button icon={<StudioAiIcon/>} title="AI 处理，会消耗积分" className="studio-assistant-primary" type="primary" loading={busy} disabled={!prompt.trim()||!capabilities||!capabilities.mock&&!selectedModel?.tokenPricing||locked||attachmentsUnsaved||!!missingIds.length} onClick={()=>void send()}>发送</Button></div>
        {(contextError||missingIds.length>0||current?.metadata?.status==='error'&&current.metadata.errorDetails)&&<p role="alert" className="studio-assistant-error">{missingIds.length?'部分引用已从画布删除，请移除后重新选择':contextError||current?.metadata?.errorDetails}</p>}
      </div>}>
    <div className="studio-assistant">
      <div className="studio-assistant-toolbar"><span>{modeNames[mode]}</span><div><Button icon={<Plus size={15}/>} disabled={busy||reading} onClick={()=>selectConversation()}>新对话</Button><Button aria-label="创作设置与历史" aria-expanded={toolsOpen} icon={<SlidersHorizontal size={16}/>} onClick={()=>setToolsOpen(v=>!v)}/></div></div>
      {toolsOpen&&<section className="studio-assistant-tools" aria-label="创作设置">
        <div className="studio-mode-tabs" role="group" aria-label="助手模式">{(Object.keys(modeNames) as StudioAssistantMode[]).map(value=><button key={value} type="button" disabled={locked} aria-pressed={mode===value} onClick={()=>{rememberDraft();setMode(value);setConversationId(undefined);}}>{modeNames[value]}</button>)}</div>
        <div className="studio-assistant-history"><Select aria-label="对话历史" value={conversationId} disabled={busy||reading} allowClear placeholder="对话历史" onChange={selectConversation} options={conversations.map(n=>({value:n.id,label:`${n.title} · ${n.metadata?.studio?.conversation?.turns.find(t=>t.role==='user')?.content.slice(0,24)||'新对话'}`}))}/><StudioConversationShare key={`${projectId}-${conversationId||'new'}`} projectId={projectId} nodeId={conversationId} disabled={locked||attachmentsUnsaved||conversation?.turns.at(-1)?.role!=='assistant'}/></div>
    {capabilities?.textModelMode!=="fixed"&&!!textModels.length&&<Select aria-label="助手模型" disabled={locked} value={selectedModel?.endpointId} onChange={setModel} options={textModels.map(m=>({value:m.endpointId,label:m.name}))}/>}
<Button icon={<Scan size={16}/>} disabled={locked||!contextNodes.length} onClick={()=>{const ids=contextNodes.slice(0,16).map(n=>n.id);setContextIds(ids);setContextError(contextNodes.length>16?'已引用前 16 个对象，可移除或用 @ 换选其他节点':'');}}>感知画布</Button>        <details className="studio-helper-note"><summary>附件与读取说明</summary><p id="studio-assistant-context-note">可多选图片、视频、音频和故事；导入免费，加入画布后可编辑和复用。图片 8 MB，MP4 视频 128 MB / 60 秒，音频 25 MB / 10 分钟。TXT / Markdown 256 KB，PDF / Word 8 MB，正文最多 24000 字；扫描件需先识别文字。</p></details>
        <label className="studio-helper-note"><input type="checkbox" checked={readingVisuals} disabled={locked||!canReadVisuals} onChange={e=>setReadVisuals(e.target.checked)}/> 读取图片与视频画面</label>
        <p className="studio-helper-note">{readingVisuals?'读取所选图片；60 秒内视频取 4 帧，不含音轨。最多 16 张画面，每段视频占 4 张。音频只读取文字设定。':canReadVisuals?'本次仅读取文字和设定，勾选后可读取所选图片与视频采样帧。':'当前模型仅读取文字和设定。切换到支持看图的模型后可读取画面。'}</p>

      </section>}
      {!conversation?.turns.length&&<div className="studio-assistant-welcome"><p className="studio-assistant-eyebrow">从一个想法开始</p><h3 className="w-full max-w-full">说出想法，<br/>一起放进画布。</h3><p>{contextIds.length?`已引用 ${contextIds.length} 个节点。可以接着创作，也可以衍生新的内容。`:'写文字、做图片、制作视频，或搭建一整套创作流程。'}</p><div className="studio-assistant-starters">{starterPrompts.map(([title,value,Icon])=><button key={title} type="button" disabled={locked} onClick={()=>{setPrompt(value);composer.current?.focus();}}><Icon size={18}/><span>{title}</span><ArrowUp size={14}/></button>)}</div></div>}
      <div className="studio-conversation" role="log" aria-label="创作对话记录" aria-live="polite">{conversation?.turns.map((turn,i)=><div className={`studio-turn studio-turn-${turn.role}`} key={i}><small>{turn.role==="user"?"你":"Studio"}</small><p>{turn.content}</p>{turn.billing&&<small>已消耗 {turn.billing.credits} 积分</small>}</div>)}</div>
      {conversation?.plan&&current?.metadata?.status!=='loading'&&<>
        <StudioAssistantPlan key={`${current?.id}-${current?.metadata?.studio?.runId||'draft'}`} plan={conversation.plan} nodes={nodes} contextIds={contextIds} selectedIds={selectedIds} locked={!!locked} onEdit={editStep} onApply={applyStep}/>
        {!!conversation.plan.questions.length&&<div className="studio-assistant-questions"><span>还需要你的想法</span>{conversation.plan.questions.map((q,i)=><p key={i}>{q}</p>)}</div>}
        {!!conversation.plan.notes?.length&&<details className="studio-helper-note"><summary>补充建议</summary>{conversation.plan.notes.map((note,i)=><p key={i}>{note}</p>)}</details>}
      </>}
      {current?.metadata?.status==='loading'&&<div className="studio-assistant-pending" role="status"><p>{busy?'正在整理你的想法…':'对话任务尚未完成'}</p>{!busy&&<Button onClick={()=>void send(true)}>确认原对话任务</Button>}</div>}
    </div>
  </StudioFloatingPanel>;
}
