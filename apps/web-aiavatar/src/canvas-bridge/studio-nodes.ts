import { materializeFilmStudy } from './studio-film-study';
import { materializeRecreationAudio } from './studio-recreation-audio';
import { materializeRecreation } from './studio-recreation-document';
import { nanoid } from "nanoid";
import type { IpRun } from "@ai-star-eco/types";
import type { StudioNodeMetadata, StudioOperation, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeVideoTake } from "@/canvas/types/canvas";
import { markStudioDescendants, mergeStudioRewrite, studioNodeEpisode } from "./studio-script";
import { markStudioMediaFit, runAspectRatio } from "./studio-media-fit";

export function makeStudioNode(operation: StudioOperation, origin?: CanvasNodeData): CanvasNodeData {
  const type = operation === "image" ? CanvasNodeType.Image : ["video", "assemble"].includes(operation) ? CanvasNodeType.Video : CanvasNodeType.Text;
  const title = operation==="video"&&origin?.metadata?.studio?.shot?`${origin.title} · 视频`:{ text: "文本", script: "新剧本", storyboard: "分镜草案", image: "形象图片", video: "视频片段", assemble: "合成作品", assistant: "导演对话", recreation: "全片创作拆解" }[operation];
  const studio: StudioNodeMetadata = { kind: operation === "recreation" ? "recreation" : operation === "text" ? "text" : operation === "assistant" ? "assistant" : operation === "assemble" ? "work" : ["image", "video"].includes(operation) ? "shot" : "script", includeInWork: operation === "video", episodeNo:["image","video"].includes(operation)?studioNodeEpisode(origin):undefined,order:operation==="video"?origin?.metadata?.studio?.order:undefined };
  return { id: nanoid(), type, title, width: type === CanvasNodeType.Text ? 480 : 320, height: type === CanvasNodeType.Text ? 300 : 400,
    position: { x: origin ? origin.position.x + origin.width + 90 : 100, y: origin?.position.y ?? 120 },
    metadata: { status: "idle", studio } };
}

/** Imported and older media may have no take list yet; retain their current output before editing. */
export function retainStudioMediaVersions(node: CanvasNodeData): CanvasNodeData {
  const metadata = node.metadata;
  if (!metadata?.storageKey) return node;
  if (node.type === CanvasNodeType.Image && !metadata.images?.some(t=>t.storageKey===metadata.storageKey)) {
    return {...node,metadata:{...metadata,images:[...(metadata.images||[]),{
      id:metadata.primaryImageId||`stored:image:${metadata.storageKey}`,status:'success',storageKey:metadata.storageKey,content:metadata.content||'',
      naturalWidth:metadata.naturalWidth||0,naturalHeight:metadata.naturalHeight||0,bytes:metadata.bytes||0,mimeType:metadata.mimeType||'image/jpeg',
    }]}};
  }
  if (node.type === CanvasNodeType.Video && !metadata.videos?.some(t=>t.storageKey===metadata.storageKey)) {
    return {...node,metadata:{...metadata,videos:[...(metadata.videos||[]),{
      id:metadata.primaryVideoId||`stored:video:${metadata.storageKey}`,status:'success',storageKey:metadata.storageKey,content:metadata.content,
      prompt:metadata.prompt,seconds:metadata.seconds,mimeType:metadata.mimeType||'video/mp4',
    }]}};
  }
  return node;
}

/** A new image batch retains its old takes while allowing the first new success to become primary. */
export function prepareStudioImageRegeneration(node: CanvasNodeData, update: CanvasNodeData['metadata']): CanvasNodeData {
  return {...node,metadata:{...node.metadata,...update,
    images:[...(retainStudioMediaVersions(node).metadata?.images||[]),...(update?.images||[])],
    primaryImageId:undefined,errorDetails:undefined}};
}

/** Applying a new result retains previous media and records every take. */
export function applyStudioRun(node: CanvasNodeData, run: IpRun): CanvasNodeData {
  const alreadyApplied=node.metadata?.studio?.runId===run.id && node.metadata?.status==="success";
  const metadata = { ...retainStudioMediaVersions(node).metadata };
  metadata.studio = { ...metadata.studio!, runId: run.id, mock: run.output.mock,
    task: { status: run.status, stage: run.stage, pct: run.pct, errorCode:run.errorCode,errorMessage:run.errorMessage,logId:run.logId||run.output.logId, queue: run.status==='running'?run.queue:null } };
  if(run.output.lipSyncNormalized)metadata.studio.lipSyncNormalized=true;
  if(metadata.studio.episodeNo===undefined)metadata.studio.episodeNo=studioNodeEpisode(node);
  if (run.output.videoCandidates?.length) {
    const incoming=run.output.videoCandidates.map(candidate=>({
      id:candidate.index===0?run.id:`${run.id}:${candidate.index}`,
      status:candidate.status==='done'?'success' as const:candidate.status==='failed'?'error' as const:'loading' as const,
      storageKey:candidate.storageKey,content:candidate.url,mimeType:'video/mp4',seconds:String(candidate.durationSec),errorDetails:candidate.errorMessage,errorCode:candidate.errorCode,errorLogId:candidate.logId,queue:candidate.queue,
    }));
    const existing=metadata.videos||[];
    metadata.videos=[...existing.filter(v=>!incoming.some(t=>t.id===v.id)),...incoming];
    const first=incoming.find(t=>t.status==='success'&&t.storageKey);
    const adopted=incoming.find(t=>t.id===metadata.primaryVideoId&&t.storageKey);
    if(adopted||first&&(!metadata.storageKey||run.status==='done'&&!alreadyApplied)) {
      const take=adopted||first!;metadata.storageKey=take.storageKey;metadata.content=take.content;metadata.primaryVideoId=take.id;
    }
  }
  if(run.output.filmStudy && !alreadyApplied) {
    const study=run.output.filmStudy;
    metadata.studio.kind='recreation';
    metadata.studio.recreation={...metadata.studio.recreation,mode:'segments',sourceNodeId:study.source.nodeId,sourceStorageKey:study.source.storageKey,sourceTitle:study.source.title,
      study:{...study,segments:study.segments.map(({url,coverUrl,...segment})=>segment)}};
    metadata.content=run.output.text||'视频拉片';
  }
  if(run.kind==="studio-video"&&run.status!=="running") {
    // 智能优化（画布 review 模式）停在「用优化稿 / 用原文」上：优化稿有提示、太长，或没优化成（还没出片）。
    const source=(run.inputs as {prompt?:string}).prompt;
    const review=(run.inputs as {video?:{rewrite?:string}}).video?.rewrite==="review";
    if(run.status==="done"&&run.output.needsChoice&&run.output.videoPrompt)metadata.studio.promptReview={runId:run.id,source,...run.output.videoPrompt};
    else if(review&&run.status==="failed"&&!run.output.videoCandidates?.length&&run.errorCode!=="IP_RUN_CANCELLED")
      metadata.studio.promptReview={runId:run.id,source,failed:true,message:run.errorMessage,...(run.output.videoPrompt||{})};
    else if(metadata.studio.promptReview?.runId===run.id)delete metadata.studio.promptReview;
  }
  if (run.status === "running") return { ...node, metadata: { ...metadata, status: "loading" } };
  if(run.kind==="studio-video")metadata.videoTaskId=undefined;
  metadata.status = run.status === "failed" ? "error" : "success";
  metadata.errorDetails = run.status === "failed" ? run.errorMessage || "生成失败，请重试" : undefined;
  if(run.status === "done" && run.output.textRevision && !alreadyApplied) {
    const request=run.inputs as unknown as StudioRunRequest;
    const editor=metadata.studio.textEditor;
    metadata.studio.textEditor={...editor,turns:[...(editor?.turns||[]),
      {role:"user" as const,content:request.prompt.slice(0,4000)},
      {role:"assistant" as const,content:run.output.textRevision.summary,...(run.output.billing?{billing:run.output.billing}:{})}].slice(-16)};
    if((metadata.content||"") === request.textEdit?.content) {
      metadata.content=run.output.textRevision.content;
      delete metadata.studio.textEditor.proposal;
    } else {
      // A different tab/editor may have changed the body during the accepted request.
      metadata.studio.textEditor.proposal={...run.output.textRevision,runId:run.id};
    }
  }
  if(run.output.recreation && run.status==='done' && !alreadyApplied) {
    const report=run.output.recreation;
    metadata.studio.kind='recreation';
    metadata.studio.recreation={sourceNodeId:report.source.nodeId,sourceStorageKey:report.source.storageKey,sourceTitle:report.source.title,report:{...report,references:report.references?.map(({url,...ref})=>ref)}};
    metadata.content=run.output.text||report.creativePremise;
  }
  if(run.output.plan && metadata.studio.conversation && !alreadyApplied) {
    metadata.studio.conversation={...metadata.studio.conversation,plan:run.output.plan,
      turns: [...metadata.studio.conversation.turns,{role:"assistant" as const,content:run.output.plan.summary,...(run.output.billing?{billing:run.output.billing}:{})}].slice(-16)};
    metadata.content=run.output.plan.summary;
  }
  if (run.output.script && !alreadyApplied) {
    const script=metadata.studio.rewriteScope&&metadata.studio.script?mergeStudioRewrite(metadata.studio.script,run.output.script,metadata.studio.rewriteScope):run.output.script;
    metadata.studio.script = script;
    // A new structured result supersedes the previous editor document, but not its chat history.
    delete metadata.studio.scriptMarkdown;
    if(metadata.studio.scriptEditor)metadata.studio.scriptEditor={...metadata.studio.scriptEditor,draft:undefined,proposal:undefined};
    // Once a script exists, rewrite/split must start from its latest edited content.
    delete metadata.studio.composerDraft;
    metadata.content = script.episodes[0]?.content;
    return { ...node, title: script.title || node.title, metadata };
  }
  for(const [index,image] of (run.output.candidates || []).entries()) {
    const id = index===0?run.id:`${run.id}:${index}`;
    metadata.images = [...(metadata.images || []).filter(v => v.id !== id), { id, status: "success", storageKey: image.key, content: image.url,
      naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "image/jpeg" }];
    if (!metadata.storageKey) { metadata.storageKey = image.key; metadata.content = image.url; metadata.primaryImageId = id; }
  }
  // A completed in-place edit becomes the visible version; older takes remain selectable.
  // A failed or partly completed batch keeps the previous adopted image.
  if (node.type === CanvasNodeType.Image && run.status === "done" && !alreadyApplied && run.output.candidates?.[0]) {
    metadata.storageKey = run.output.candidates[0].key;
    metadata.content = run.output.candidates[0].url;
    metadata.primaryImageId = run.id;
  }
  if (!run.output.videoCandidates?.length && run.output.storageKey && run.output.url) {
    if (node.type === CanvasNodeType.Audio) {
      metadata.storageKey = run.output.storageKey; metadata.content = run.output.url;
      metadata.mimeType = run.output.mimeType;
      return { ...node, metadata };
    }
    metadata.videos = [...(metadata.videos || []).filter(v => v.id !== run.id), { id: run.id, status: "success", storageKey: run.output.storageKey,
      content: run.output.url, mimeType: "video/mp4", seconds: String(run.output.durationSec || 0) }];
    if(run.output.comparisonStorageKey&&run.output.comparisonUrl)metadata.videos=[...metadata.videos.filter(v=>v.id!==`${run.id}:comparison`),{
      id:`${run.id}:comparison`,status:"success",storageKey:run.output.comparisonStorageKey,content:run.output.comparisonUrl,mimeType:"video/mp4",seconds:String(run.output.durationSec||0)}];
    if (!metadata.storageKey || run.status==='done'&&!alreadyApplied || run.output.lipSyncNormalized&&metadata.primaryVideoId===run.id) { metadata.storageKey = run.output.storageKey; metadata.content = run.output.url; metadata.primaryVideoId = run.id; }
  }
  const applied = { ...node, metadata };
  // A new picture or clip landed: the box takes its shape (task 画幅 now, the file's real size when it loads; §6.2).
  if (run.status === "done" && !alreadyApplied && metadata.storageKey && metadata.storageKey !== node.metadata?.storageKey) {
    const ratio = runAspectRatio(run);
    return markStudioMediaFit(applied, { storageKey: metadata.storageKey, ...(ratio ? { aspectRatio: ratio } : {}) });
  }
  return applied;
}

/** Keep the accepted task on its authored node and invalidate inputs that used its previous media. */
export function applyStudioRunToDocument(nodes: CanvasNodeData[], connections: CanvasConnection[], nodeId: string, run: IpRun): CanvasNodeData[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || node.metadata?.studio?.runId && node.metadata.studio.runId !== run.id) return nodes;
  const updated = applyStudioRun(node, run);
  const changedMedia = (node.type===CanvasNodeType.Image||node.type===CanvasNodeType.Video) && node.metadata?.storageKey !== updated.metadata?.storageKey;
  const current = changedMedia ? markStudioDescendants(nodes, nodeId, connections) : nodes;
  return materializeRecreationAudio(materializeFilmStudy(materializeRecreation(current.map(n => n.id === nodeId ? updated : n),nodeId,run),nodeId,run),nodeId,run);
}

export function selectStudioTake(node: CanvasNodeData, id: string): CanvasNodeData {
  const metadata = { ...node.metadata };
  const take = (node.type === CanvasNodeType.Image ? metadata.images : metadata.videos)?.find(v => v.id === id);
  if (!take?.storageKey || take.status!=="success") return node;
  metadata.storageKey = take.storageKey; metadata.content = take.content;
  metadata.mimeType = take.mimeType ?? metadata.mimeType;
  if (node.type === CanvasNodeType.Image) metadata.primaryImageId = id; else metadata.primaryVideoId = id;
  return { ...node, metadata };
}

/** Both adoption entry points invalidate the same downstream inputs only after a valid change. */
export function adoptStudioTake(nodes:CanvasNodeData[],nodeId:string,takeId:string):CanvasNodeData[] {
  const node=nodes.find(n=>n.id===nodeId);
  if(!node||(node.type===CanvasNodeType.Image?node.metadata?.primaryImageId:node.metadata?.primaryVideoId)===takeId)return nodes;
  const adopted=selectStudioTake(node,takeId);
  if(adopted===node)return nodes;
  return markStudioDescendants(nodes,nodeId).map(n=>n.id===nodeId?adopted:n);
}

export const playableVideoTake=(take:CanvasNodeVideoTake)=>take.status==='success'&&!!take.storageKey;

/** Navigate successful takes while preserving the original slot numbers in the visible history. */
export function nextStudioVideoTake(takes:CanvasNodeVideoTake[],currentId:string|undefined,delta:number) {
  const playable=takes.filter(playableVideoTake);
  if(playable.length<2)return undefined;
  const index=playable.findIndex(t=>t.id===currentId);
  return playable[((index<0?(delta>0?-1:0):index)+delta+playable.length)%playable.length];
}

export function canDeleteStudioVideoTake(node:CanvasNodeData,takeId:string) {
  const takes=node.metadata?.videos||[];
  return takes.length>1&&takes.some(t=>t.id===takeId)&&
    (takeId!==node.metadata?.primaryVideoId||takes.some(t=>t.id!==takeId&&playableVideoTake(t)));
}

/** Never replace the last adopted clip with a waiting or failed slot. */
export function deleteStudioVideoTake(nodes:CanvasNodeData[],nodeId:string,takeId:string) {
  const node=nodes.find(n=>n.id===nodeId);
  if(!node||!canDeleteStudioVideoTake(node,takeId))return nodes;
  const videos=node.metadata!.videos!.filter(t=>t.id!==takeId);
  const adopted=node.metadata?.primaryVideoId===takeId
    ?selectStudioTake({...node,metadata:{...node.metadata,videos}},videos.find(playableVideoTake)!.id)
    :{...node,metadata:{...node.metadata,videos}};
  const updated=node.metadata?.primaryVideoId===takeId?markStudioDescendants(nodes,nodeId):nodes;
  return updated.map(n=>n.id===nodeId?adopted:n);
}

/** Regeneration changes request controls; existing adoption and Studio context remain user-owned. */
export function prepareStudioVideoRegeneration(node:CanvasNodeData,update:CanvasNodeData['metadata'],videos=node.metadata?.videos) {
  return {...node,metadata:{...node.metadata,...update,videos}};
}

/** Persisted submission state survives lost responses and reloads; a new key must wait for a terminal state. */
export function studioGenerationPending(node:CanvasNodeData|undefined) {
  return !!node?.metadata?.studio?.scriptEditor?.pending || node?.metadata?.status==='loading'&&!!(node.metadata.studio?.request||node.metadata.studio?.speechRequest||node.metadata.studio?.lipSyncRequest);
}

export function dispatchStudioCommand(action: string, nodeId?: string) {
  window.dispatchEvent(new CustomEvent("studio-command", { detail: { action, nodeId } }));
}
