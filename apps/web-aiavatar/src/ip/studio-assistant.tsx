"use client";
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
import { StudioAttachmentPicker } from './studio-attachment-picker';
import { StudioConversationShare } from './studio-conversation-share';
import { AtSign, Scan, X } from 'lucide-react';

type Props={projectId:string;nodes:CanvasNodeData[];setNodes:Dispatch<SetStateAction<CanvasNodeData[]>>;setConnections:Dispatch<SetStateAction<CanvasConnection[]>>;
  capabilities?:StudioCapabilities;open:boolean;initialNodeId?:string;initialPrompt?:string;initialMode?:StudioAssistantMode;onClose:()=>void;selectedIds:string[];onUseStep:(step:StudioPlan["steps"][number])=>void};
const modeNames={general:"全能创作",original:"原创剧本",adapt:"故事改编",director:"导演执导"};
type AssistantDraft={prompt:string;contextIds:string[];model?:string;mode:StudioAssistantMode;readVisuals:boolean};
// These business errors occur before a run is accepted. Unknown transport/server
// errors keep the original request key; a timeout must never create another paid run.
const preflightErrors=new Set(['STUDIO_INPUT_INVALID','STUDIO_MODE_INVALID','STUDIO_CONTEXT_NOT_FOUND','STUDIO_CONTEXT_LIMIT','STUDIO_HISTORY_LIMIT','STUDIO_HISTORY_INVALID','STUDIO_PRICE_CHANGED','ENDPOINT_NOT_ALLOWED','PROMPT_NOT_CONFIGURED','STUDIO_VISION_UNAVAILABLE','STUDIO_VISUAL_MISSING','STUDIO_VISUAL_LIMIT','IP_ASSET_KEY_INVALID']);
export function StudioAssistant({projectId,nodes,setNodes,setConnections,capabilities,open,initialNodeId,initialPrompt,initialMode,onClose,selectedIds,onUseStep}:Props) {
  const {message}=App.useApp();const [mode,setMode]=useState<StudioAssistantMode>("general"),[prompt,setPrompt]=useState(""),[conversationId,setConversationId]=useState<string>(),[contextIds,setContextIds]=useState<string[]>([]),[model,setModel]=useState<string>(),[busy,setBusy]=useState(false);
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
  const selectedModel=textModels.find(m=>m.endpointId===(model||textModels.find(m=>m.isDefault)?.endpointId||textModels[0]?.endpointId));
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
          history:(conversation?.turns||[]).slice(-14),model:model||textModels.find(m=>m.isDefault)?.endpointId||textModels[0]?.endpointId,maxCost:capabilities.textCost,readVisuals:readingVisuals};
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
  return <StudioFloatingPanel title="Studio 创作助手" open={open} onClose={()=>{rememberDraft();onClose();}} width={420} utility dockable footer={<div className="studio-assistant-footer">
    {!!textModels.length&&<Select aria-label="助手模型" disabled={locked} value={model||textModels.find(m=>m.isDefault)?.endpointId||textModels[0]?.endpointId} onChange={setModel} options={textModels.map(m=>({value:m.endpointId,label:m.name+(m.supportsVision?' · 可看图':' · 文字')}))}/>}
    <Button className="studio-assistant-primary" type="primary" loading={busy} disabled={!prompt.trim()||!capabilities||locked||attachmentsUnsaved||!!missingIds.length} onClick={()=>void send()}>发送 · {capabilities?.mock?"测试响应":`${capabilities?.textCost??"—"} 积分`}</Button>
  </div>}>
    <div className="studio-assistant">
      <div className="studio-mode-tabs" role="group" aria-label="助手模式">{(Object.keys(modeNames) as StudioAssistantMode[]).map(value=><button key={value} type="button" disabled={locked} aria-pressed={mode===value} onClick={()=>{rememberDraft();setMode(value);setConversationId(undefined);}}>{modeNames[value]}</button>)}</div>
      <div className="studio-assistant-history"><Select aria-label="对话历史" value={conversationId} disabled={busy||reading} allowClear placeholder="新对话" onChange={selectConversation} options={conversations.map(n=>({value:n.id,label:`${n.title} · ${n.metadata?.studio?.conversation?.turns.find(t=>t.role==='user')?.content.slice(0,24)||'新对话'}`}))}/><Button disabled={busy||reading} onClick={()=>selectConversation()}>新对话</Button><StudioConversationShare key={`${projectId}-${conversationId||'new'}`} projectId={projectId} nodeId={conversationId} disabled={locked||attachmentsUnsaved||conversation?.turns.at(-1)?.role!=='assistant'}/></div>
      <p className="studio-helper-note">助手依据本次引用提出方案。每个生成动作仍需确认。</p>
      {!conversation&&<div className="studio-assistant-welcome"><h3>{modeNames[mode]}</h3><p>{mode==="director"?"选中镜头，讨论节奏、画面和运镜。":mode==="adapt"?"引用已有故事，讨论人物和改编方式。":mode==="original"?"先讨论题材、人物和故事，再起草分集剧本。":"选中画布内容，告诉我你下一步想做什么。"}</p></div>}
      <div className="studio-conversation">{conversation?.turns.map((turn,i)=><div className={`studio-turn studio-turn-${turn.role}`} key={i}><small>{turn.role==="user"?"你":"Studio"}</small><p>{turn.content}</p></div>)}</div>
      {conversation?.plan&&<div className="studio-plan"><h3>创作建议</h3>{conversation.plan.notes?.map((note,i)=><p key={`note-${i}`}>{note}</p>)}{conversation.plan.questions.map((q,i)=><p key={i}>{q}</p>)}{conversation.plan.steps.map(step=><article key={step.id}><strong>{step.title}</strong><Input.TextArea aria-label={`方案 ${step.title}`} value={step.prompt} autoSize={{minRows:2,maxRows:6}} onChange={e=>current&&patch(current.id,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,conversation:{...n.metadata!.studio!.conversation!,plan:{...n.metadata!.studio!.conversation!.plan!,steps:n.metadata!.studio!.conversation!.plan!.steps.map(s=>s.id===step.id?{...s,prompt:e.target.value}:s)}}}}}))}/>{step.unresolvedReferences?.length&&<p role="status">需补选参考：{step.unresolvedReferences.join("、")}</p>}<Button className="studio-assistant-primary" onClick={()=>onUseStep(step)}>{step.unresolvedReferences?.length?"补选参考并确认":"确认参数并生成"}</Button></article>)}</div>}
      {current?.metadata?.status==="loading"&&<Button loading={busy} onClick={()=>void send(true)}>确认原对话任务</Button>}
      <div className="studio-assistant-composer">
        <div className="studio-assistant-references" aria-label="本次引用">{contextIds.map(id=>{const n=contextNodes.find(n=>n.id===id);return <div key={id} className="studio-assistant-reference"><span>{n?.title||'已删除的画布对象'}{n&&<small> · {readingVisuals&&n.type==='image'?'图片':readingVisuals&&n.type==='video'?'视频 4 帧':n.type==='text'?'文字':'文字设定'}</small>}</span><button type="button" disabled={locked} aria-label={`移除引用 ${n?.title||id}`} onClick={()=>setContextIds(ids=>ids.filter(value=>value!==id))}><X size={14}/></button></div>;})}</div>
        <Input.TextArea ref={composer} aria-label="给创作助手的消息" aria-describedby="studio-assistant-context-note" aria-autocomplete="list" aria-controls={query?'studio-assistant-mentions':undefined} aria-activedescendant={query&&suggestions.length?`studio-assistant-mention-${suggestions[mentionIndex%suggestions.length].id}`:undefined} placeholder="描述你想做的内容，输入 @ 引用画布节点" value={prompt} disabled={locked} onChange={e=>{const value=e.target.value;setPrompt(value);setCaret(e.target.selectionStart);setMentionOpen(mentionOpen||(value.match(/@/g)?.length||0)>(prompt.match(/@/g)?.length||0));setMentionIndex(0);}} onSelect={e=>setCaret(e.currentTarget.selectionStart)} onKeyDown={e=>{
          if(e.nativeEvent.isComposing)return;
          if(query&&e.key==='Escape'){e.preventDefault();e.stopPropagation();setMentionOpen(false);}
          else if(query&&suggestions.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setMentionIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);}
          else if(query&&suggestions.length&&e.key==='Enter'){e.preventDefault();chooseMention(suggestions[mentionIndex%suggestions.length]);}
        }} rows={4} maxLength={4000}/>
        {query&&<div id="studio-assistant-mentions" className="studio-assistant-mentions" role="listbox" aria-label="可引用的画布节点">{suggestions.length?suggestions.map((node,index)=><button key={node.id} id={`studio-assistant-mention-${node.id}`} type="button" role="option" aria-selected={index===mentionIndex%suggestions.length} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseMention(node)}><span>{node.title}</span><small>{node.type==='text'?'文字':'素材设定'}</small></button>):<p>没有匹配的节点，换个名称试试</p>}</div>}
        <div className="studio-assistant-context-actions"><Button icon={<AtSign size={16}/>} disabled={locked} onClick={()=>{const value=prompt+(prompt&&!/\s$/.test(prompt)?' ':'')+'@';setPrompt(value);setCaret(value.length);setMentionOpen(true);setMentionIndex(0);composer.current?.focus();}}>引用节点</Button><Button icon={<Scan size={16}/>} disabled={locked||!contextNodes.length} onClick={()=>{const ids=contextNodes.slice(0,16).map(n=>n.id);setContextIds(ids);setContextError(contextNodes.length>16?'已引用前 16 个对象，可移除或用 @ 换选其他节点':'');}}>感知画布</Button></div>
        <StudioAttachmentPicker locked={locked} reading={reading} onFiles={files=>void addAttachments(files).catch(()=>{})} onAssets={addAttachments}/>
        {attachmentsUnsaved&&<Button disabled={locked} onClick={()=>void retryAttachmentSave()}>重试保存附件</Button>}
        <details className="studio-helper-note"><summary>附件与读取说明</summary><p id="studio-assistant-context-note">可多选图片、视频、音频和故事；导入免费，加入画布后可编辑和复用。图片 8 MB，MP4 视频 128 MB / 60 秒，音频 25 MB / 10 分钟。TXT / Markdown 256 KB，PDF / Word 8 MB，正文最多 24000 字；扫描件需先识别文字。</p></details>
        <label className="studio-helper-note"><input type="checkbox" checked={readingVisuals} disabled={locked||!canReadVisuals} onChange={e=>setReadVisuals(e.target.checked)}/> 读取图片与视频画面</label>
        <p className="studio-helper-note">{readingVisuals?'读取所选图片；60 秒内视频取 4 帧，不含音轨。最多 16 张画面，每段视频占 4 张。音频只读取文字设定。':canReadVisuals?'本次仅读取文字和设定，勾选后可读取所选图片与视频采样帧。':'当前模型仅读取文字和设定。切换到支持看图的模型后可读取画面。'}</p>
        {(contextError||missingIds.length>0||current?.metadata?.status==='error'&&current.metadata.errorDetails)&&<p role="alert" className="studio-assistant-error">{missingIds.length?'部分引用已从画布删除，请移除后重新选择':contextError||current?.metadata?.errorDetails}</p>}
      </div>
    </div>
  </StudioFloatingPanel>;
}
