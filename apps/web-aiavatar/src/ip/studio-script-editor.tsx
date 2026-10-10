"use client";
import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Select, Segmented } from 'antd';
import { ArrowLeft, Download, Plus, Save, Send, Undo2, Sparkles } from 'lucide-react';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioCapabilities, StudioNodeMetadata, StudioScript, StudioScriptSettings } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { readRun, cancelRun } from '@/canvas-bridge/api';
import { submitStudioRun } from '@/canvas-bridge/studio-api';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { studioQueueNotice } from '@/canvas-bridge/studio-task-status';
import { applyScriptProposal, markdownToScript, scriptFramework, scriptMarkdownError, scriptToMarkdown } from '@/canvas-bridge/studio-script-markdown';
import { StudioScriptRichEditor, type ScriptRichEditorHandle } from './studio-script-rich-editor';
import { StudioScriptSettingsForm } from './studio-script-settings';

type EditorState=NonNullable<StudioNodeMetadata['scriptEditor']>;
type Props={projectId:string;node:CanvasNodeData;capabilities?:StudioCapabilities;
  onState:(state:EditorState)=>void;onSettings:(settings:StudioScriptSettings)=>void;
  onCommit:(markdown:string,script:StudioScript)=>Promise<void>;onClose:()=>void;
  onVisual:(key:'characters'|'scenes'|'props',item:{name:string;description:string})=>void;
  onStoryboard:(episodeNo:number)=>void};
const rejectedCodes=new Set(['STUDIO_INPUT_INVALID','STUDIO_MODE_INVALID','STUDIO_HISTORY_LIMIT','STUDIO_HISTORY_INVALID','STUDIO_PRICE_CHANGED','ENDPOINT_NOT_ALLOWED','PROMPT_NOT_CONFIGURED','STUDIO_CONTEXT_LIMIT']);
const container=()=>document.querySelector<HTMLElement>('.ip-surface')||document.body;

/** A focused document task. Its chat produces proposals, never a second script canvas node. */
export function StudioScriptEditor({projectId,node,capabilities,onState,onSettings,onCommit,onClose,onVisual,onStoryboard}:Props) {
  const {message}=App.useApp();
  const initial=node.metadata?.studio;
  const [state,setState]=useState<EditorState>(()=>({...initial?.scriptEditor,turns:initial?.scriptEditor?.turns||[],draft:initial?.scriptEditor?.draft??initial?.scriptMarkdown??(initial?.script?scriptToMarkdown(initial.script):node.metadata?.content?.trim()?scriptFramework(node.title).replace('故事背景：',node.metadata.content+'\n\n故事背景：'):scriptFramework(node.title))}));
  const [side,setSide]=useState('AI 改稿'),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[previewProposal,setPreviewProposal]=useState(false);
  // Parent nodes update optimistically; only a confirmed save advances this editor's saved baseline.
  const [savedMarkdown,setSavedMarkdown]=useState(initial?.scriptMarkdown??(initial?.script?scriptToMarkdown(initial.script):''));
  const [saveError,setSaveError]=useState('');
  const [assistantOpen,setAssistantOpen]=useState(false),[toolbarContainer,setToolbarContainer]=useState<HTMLDivElement|null>(null);
  const [undo,setUndo]=useState<string>();
  const [episode,setEpisode]=useState(initial?.script?.episodes[0]?.no||1);
  const source=useRef<ScriptRichEditorHandle>(null),live=useRef(state),alive=useRef(true),inFlight=useRef(false);
  live.current=state;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const patch=(changes:Partial<EditorState>)=>{const next={...live.current,...changes};live.current=next;if(alive.current)setState(next);onState(next);};
  const markdown=state.draft??'',script=markdownToScript(markdown,initial?.script),error=scriptMarkdownError(markdown);
  const dirty=markdown!==savedMarkdown;
  const pending=state.pending,proposal=state.proposal;
  const model=(capabilities?.textModelMode!=="fixed"&&capabilities?.textModels?.some(m=>m.endpointId===state.model)?state.model:undefined)||capabilities?.textModels?.find(m=>m.isDefault)?.endpointId||capabilities?.textModels?.[0]?.endpointId;
  const commit=async(close=false)=>{
    if(saving)return false;
    const value=live.current.draft??'',invalid=scriptMarkdownError(value);
    if(invalid){
      if(close){setSaving(true);try{patch({draft:value});await saveStudioDocument(projectId);message.info('已保存草稿；完善框架后可生成分镜');onClose();return true;}catch(e){message.error(e instanceof Error?e.message:'草稿未保存，请重试');}finally{if(alive.current)setSaving(false);}}
      else message.error(invalid);
      return false;
    }
    setSaving(true);setSaveError('');
    try{await onCommit(value,markdownToScript(value,initial?.script));if(alive.current)setSavedMarkdown(value);if(close)onClose();else message.success('剧本已保存到原节点');return true;}
    catch(e){const text=e instanceof Error?e.message:'剧本未保存，请重试';setSaveError(text);message.error(text);return false;}
    finally{if(alive.current)setSaving(false);}
  };
  const edit=(value:string)=>patch({draft:value,error:undefined});
  const reconcile=async(snapshot:NonNullable<EditorState['pending']>,submit:boolean)=>{
    if(snapshot.request.nodeId!==node.id){patch({pending:undefined,proposal:undefined,error:'来源任务属于另一节点。当前副本保留正文，请重新提出改稿要求。'});return;}
    if(inFlight.current)return;inFlight.current=true;setBusy(true);patch({error:undefined});let accepted=!!snapshot.runId,posted=false;
    try {
      await saveStudioDocument(projectId);
      let run:IpRun;
      if(snapshot.runId)run=await readRun(snapshot.runId);
      else {if(!submit)return;posted=true;run=await submitStudioRun(projectId,snapshot.request);accepted=true;patch({pending:{...snapshot,runId:run.id}});await saveStudioDocument(projectId);}
      while(alive.current) {
        setStatus(run.queue?studioQueueNotice(run.queue):run.status==='running'?'AI 正在修改剧本…':'');
        if(run.status!=='running') {
          if(run.status==='failed'){patch({pending:undefined,error:run.errorMessage||'AI 改稿未完成，原稿已保留'});await saveStudioDocument(projectId);return;}
          const result=run.output.scriptRevision,invalid=result?scriptMarkdownError(result.markdown):'AI 未返回完整剧本文档，原稿已保留';
          if(!result||invalid){patch({pending:undefined,error:invalid});await saveStudioDocument(projectId);return;}
          patch({pending:undefined,proposal:{...result,baseMarkdown:snapshot.baseMarkdown,runId:run.id},turns:[...live.current.turns,{role:'assistant' as const,content:result.summary}].slice(-16)});
          setPreviewProposal(true);await saveStudioDocument(projectId);return;
        }
        await new Promise(resolve=>setTimeout(resolve,1500));if(!alive.current)break;
        try{run=await readRun(run.id);}catch{setStatus('暂时无法更新任务，可稍后确认原任务');await new Promise(resolve=>setTimeout(resolve,2000));}
      }
    }catch(e){
      const text=e instanceof Error?e.message:'对话未完成';
      if(!accepted&&(!posted||e instanceof ApiError&&rejectedCodes.has(e.code))) {
        patch({pending:undefined,chatDraft:snapshot.request.prompt,error:text,turns:live.current.turns.at(-1)?.role==='user'?live.current.turns.slice(0,-1):live.current.turns});
      } else patch({error:accepted?'改稿任务已受理，请确认原任务继续获取结果':'提交结果尚未确认，请确认原任务，避免重复提交'});
      try{await saveStudioDocument(projectId);}catch{patch({error:`${live.current.error||text}。对话状态尚未保存，请重试保存`});}
      if(alive.current)message.error(text);
    }finally{inFlight.current=false;if(alive.current)setBusy(false);}
  };
  const send=async()=>{
    if(inFlight.current||live.current.pending||!live.current.chatDraft?.trim()||!capabilities)return;
    const invalid=scriptMarkdownError(live.current.draft??'');if(invalid){patch({error:invalid});return;}
    if(live.current.proposal){patch({error:'请先采纳或放弃当前 AI 版本，再继续改稿'});return;}
    const snapshot={baseMarkdown:live.current.draft??'',request:{clientRequestId:nanoid(),nodeId:node.id,operation:'assistant' as const,mode:'general' as const,prompt:live.current.chatDraft.trim(),scriptEdit:{markdown:live.current.draft??''},model,maxCost:capabilities.textModels?.find(m=>m.endpointId===model)?.creditCost??capabilities.textCost,history:live.current.turns.slice(-14).map(t=>({...t,content:t.content.slice(0,4000)}))}};
    patch({pending:snapshot,chatDraft:'',turns:[...live.current.turns,{role:'user' as const,content:snapshot.request.prompt}].slice(-16)});
    await reconcile(snapshot,true);
  };
  useEffect(()=>{const snapshot=live.current.pending;if(snapshot?.runId)void reconcile(snapshot,false);},[]);
  const adopt=()=>{
    if(!proposal)return;const result=applyScriptProposal(markdown,proposal);
    if(result.error){patch({error:result.error});return;}
    setUndo(markdown);patch({draft:result.markdown,proposal:undefined,error:undefined});setPreviewProposal(false);
  };
  const forceAdopt=()=>{if(!proposal||scriptMarkdownError(proposal.markdown))return;setUndo(markdown);patch({draft:proposal.markdown,proposal:undefined,error:undefined});setPreviewProposal(false);};
  const appendEpisode=()=>{const no=Math.max(0,...script.episodes.map(e=>e.no))+1;if(no>50){message.error('最多 50 集');return;}setPreviewProposal(false);edit(markdown+`\n\n### 第 ${no} 集 · 新的一集\n\n#### 场次 1\n\n场景：\n时间：\n出场人物：\n\n**动作**：\n\n**对白**：\n`);requestAnimationFrame(()=>source.current?.jumpToTitle(`第 ${no} 集 · 新的一集`));};
  return <Modal open width="100vw" title="剧本编辑器" closable={false} footer={null} mask={{closable:false}} onCancel={()=>void commit(true)} keyboard={!saving} getContainer={container} className="studio-script-fullscreen" wrapClassName="studio-script-fullscreen-wrap" styles={{body:{padding:0}}}>
    <div className="studio-script-fullscreen-layout" onKeyDown={e=>{if(e.key!=='Escape')e.stopPropagation();if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();void commit();}}}>
      <header className="studio-script-header">
        <Button type="text" aria-label="返回画布" title="返回画布" icon={<ArrowLeft size={17}/>} disabled={saving} onClick={()=>void commit(true)}/>
        <div className="studio-script-heading"><strong>{script.title}</strong><span role="status">{saveError?'保存失败，草稿保留':dirty?'有未保存的正文':'已保存到画布'} · {markdown.length.toLocaleString()} 字</span></div>
        <div className="studio-script-format-tools" ref={setToolbarContainer}/>
        <div className="studio-script-header-actions">
          {undo!==undefined&&<Button type="text" icon={<Undo2 size={15}/>} onClick={()=>{const previous=undo;setUndo(undefined);edit(previous);}}>撤销采纳</Button>}
          {proposal&&<Button className="studio-script-preview-toggle" aria-pressed={previewProposal} onClick={()=>setPreviewProposal(!previewProposal)}>{previewProposal?'查看当前稿':'预览 AI 版本'}</Button>}
          <Button type="text" aria-label="导出剧本" title="导出剧本" icon={<Download size={16}/>} onClick={()=>{const blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${script.title.replace(/[\\/:*?"<>|]/g,'_')}.md`;link.click();URL.revokeObjectURL(url);}}/>
          <Button aria-label="创作面板" aria-expanded={assistantOpen} icon={<Sparkles size={16}/>} onClick={()=>setAssistantOpen(!assistantOpen)}>{busy?'AI 改稿中':state.error?'AI 改稿待确认':'AI 改稿'}</Button>
          <Button type="primary" icon={<Save size={16}/>} loading={saving} onClick={()=>void commit()}>保存剧本</Button>
        </div>
      </header>
      <div className={`studio-script-layout${assistantOpen?' assistant-open':''}`}>
        <main className="studio-script-document">
          {previewProposal&&proposal&&<div className="studio-script-proposal-bar" role="status"><span>AI 建议版本 · 尚未采纳</span><Button size="small" disabled={proposal.baseMarkdown!==markdown} onClick={adopt}>采纳此版本</Button></div>}
          {initial?.upstreamChanged&&<p className="studio-script-validation" role="status">来源内容已修改。当前剧本和成片保留，可基于新内容再次改编。</p>}
          {saveError&&<p className="studio-script-validation" role="alert">{saveError}。正文仍保留，请点击“保存剧本”重试。</p>}
          {error&&<p className="studio-script-validation" role="status">{error}。草稿仍保留。</p>}
          <div className="studio-script-document-body">
            <div className="studio-script-current-document" hidden={previewProposal&&!!proposal}><StudioScriptRichEditor ref={source} markdown={markdown} onChange={edit} toolbarContainer={toolbarContainer} toolbarHidden={previewProposal&&!!proposal}/></div>
            {previewProposal&&proposal&&<StudioScriptRichEditor markdown={proposal.markdown} readOnly/>}
          </div>
        </main>
        {assistantOpen&&<aside className="studio-script-assistant" aria-label="剧本创作面板">
          <Segmented value={side} options={['AI 改稿','创作设定','素材']} onChange={setSide}/>
          {side==='AI 改稿'?<><div className="studio-script-chat">
            {!state.turns.length&&<div className="studio-script-chat-welcome"><h2>和 AI 一起改剧本</h2><p>告诉 AI 你的修改要求，预览后采纳。它会保留完整的剧本框架。</p><Button onClick={()=>patch({chatDraft:'按照现有框架完善故事大纲、人物小传和第 1 集正文，突出主角的目标与开场冲突。'})}>完善当前剧本</Button><Button onClick={()=>patch({chatDraft:'保留其他内容，只把第 1 集的对白改得更自然，并加强结尾的悬念。'})}>优化对白与悬念</Button></div>}
            {state.turns.map((turn,i)=><div key={i} className={`studio-script-chat-turn ${turn.role}`}><small>{turn.role==='user'?'你':'Studio'}</small><p>{turn.content}</p></div>)}
            {busy&&<p role="status">{status||'正在提交改稿任务…'}</p>}
            {pending?.runId&&<Button onClick={async()=>{try{await cancelRun(pending.runId!);message.info('已请求停止改稿，原稿保留');}catch(e){message.error(e instanceof Error?e.message:'停止失败，请确认原任务');}}}>停止改稿</Button>}
            {state.error&&<p role="alert" className="studio-script-chat-error">{state.error}</p>}
            {pending&&<Button loading={busy} onClick={()=>void reconcile(pending,true)}>确认原改稿任务</Button>}
            {proposal&&<div className="studio-script-proposal-actions"><p>{proposal.baseMarkdown===markdown?'AI 版本不会自动覆盖正文。':'正文在等待回复时有了新修改，请先比较当前稿和 AI 版本。'}</p><Button onClick={()=>{setPreviewProposal(true);}}>预览 AI 版本</Button><Button type="primary" disabled={proposal.baseMarkdown!==markdown} onClick={adopt}>采纳修改</Button>{proposal.baseMarkdown!==markdown&&<Button onClick={forceAdopt}>用 AI 版本替换当前稿</Button>}<Button onClick={()=>{patch({proposal:undefined,error:undefined});setPreviewProposal(false);}}>保留当前稿</Button></div>}
          </div><div className="studio-script-chat-composer"><Input.TextArea aria-label="剧本改稿要求" placeholder="如：保留其他集，只加强第 1 集的冲突…" value={state.chatDraft||''} maxLength={4000} autoSize={{minRows:3,maxRows:6}} disabled={!!pending||busy} onChange={e=>patch({chatDraft:e.target.value})} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
            {capabilities?.textModelMode!=="fixed"&&<Select aria-label="剧本改稿模型" value={model} disabled={!!pending||busy} placeholder="选择创作模型" options={capabilities?.textModels?.map(m=>({value:m.endpointId,label:m.name}))} onChange={value=>patch({model:value})}/> }<Button type="primary" icon={<Send size={15}/>} loading={busy} disabled={!state.chatDraft?.trim()||!!pending||!!proposal||!!error||!capabilities} onClick={()=>void send()}>发送 · {capabilities?.mock?'测试响应':`${capabilities?.textModels?.find(m=>m.endpointId===model)?.creditCost??capabilities?.textCost??'—'} 积分`}</Button></div></>
            :side==='创作设定'?<div className="studio-script-side-scroll"><p>设定用于之后的改写与拆镜。故事内容以当前剧本为准。</p><StudioScriptSettingsForm value={initial?.settings||{episodeCount:script.episodes.length}} onChange={onSettings}/></div>
            :<div className="studio-script-side-scroll"><section className="studio-script-production"><h2>分集制作</h2><Button icon={<Plus size={15}/>} onClick={appendEpisode}>添加一集</Button><Select aria-label="生成分镜的分集" value={script.episodes.some(e=>e.no===episode)?episode:script.episodes[0]?.no} options={script.episodes.map(e=>({value:e.no,label:`第 ${e.no} 集`}))} onChange={setEpisode}/><Button disabled={!!error||saving} onClick={async()=>{if(await commit())onStoryboard(script.episodes.some(e=>e.no===episode)?episode:script.episodes[0]?.no||1);}}>生成分镜</Button></section><p>先保存当前正文，再为设定生成参考图。</p>{(['characters','scenes','props'] as const).map((key,index)=><section key={key}><h2>{['人物','场景','道具'][index]}</h2>{script[key].map((item,i)=><div key={i} className="studio-script-asset"><strong>{item.name}</strong><p>{item.description||'补充设定后生成参考图'}</p><Button disabled={!item.name.trim()||saving||!!error} onClick={async()=>{if(await commit())onVisual(key,item);}}>生成参考图</Button></div>)}</section>)}</div>}
        </aside>}
      </div>
    </div>
  </Modal>;
}
