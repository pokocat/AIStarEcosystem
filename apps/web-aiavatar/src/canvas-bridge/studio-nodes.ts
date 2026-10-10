import { nanoid } from "nanoid";
import type { IpRun } from "@ai-star-eco/types";
import type { StudioNodeMetadata, StudioOperation } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasNodeData, type CanvasNodeVideoTake } from "@/canvas/types/canvas";
import { markStudioDescendants, mergeStudioRewrite, studioNodeEpisode } from "./studio-script";

export function makeStudioNode(operation: StudioOperation, origin?: CanvasNodeData): CanvasNodeData {
  const type = operation === "image" ? CanvasNodeType.Image : ["video", "assemble"].includes(operation) ? CanvasNodeType.Video : CanvasNodeType.Text;
  const title = operation==="video"&&origin?.metadata?.studio?.shot?`${origin.title} · 视频`:{ script: "新剧本", storyboard: "分镜草案", image: "形象图片", video: "视频片段", assemble: "合成作品", assistant: "导演对话" }[operation];
  const studio: StudioNodeMetadata = { kind: operation === "assistant" ? "assistant" : operation === "assemble" ? "work" : ["image", "video"].includes(operation) ? "shot" : "script", includeInWork: operation === "video", episodeNo:["image","video"].includes(operation)?studioNodeEpisode(origin):undefined,order:operation==="video"?origin?.metadata?.studio?.order:undefined };
  return { id: nanoid(), type, title, width: type === CanvasNodeType.Text ? 480 : 320, height: type === CanvasNodeType.Text ? 300 : 400,
    position: { x: origin ? origin.position.x + origin.width + 90 : 100, y: origin?.position.y ?? 120 },
    metadata: { status: "idle", studio } };
}

/** Applying a new result retains previously adopted media and records every take. */
export function applyStudioRun(node: CanvasNodeData, run: IpRun): CanvasNodeData {
  const alreadyApplied=node.metadata?.studio?.runId===run.id && node.metadata?.status==="success";
  const metadata = { ...node.metadata };
  metadata.studio = { ...metadata.studio!, runId: run.id, mock: run.output.mock,
    task: { status: run.status, stage: run.stage, pct: run.pct, errorCode:run.errorCode, queue: run.status==='running'?run.queue:null } };
  if(run.output.lipSyncNormalized)metadata.studio.lipSyncNormalized=true;
  if(metadata.studio.episodeNo===undefined)metadata.studio.episodeNo=studioNodeEpisode(node);
  if (run.output.videoCandidates?.length) {
    const incoming=run.output.videoCandidates.map(candidate=>({
      id:candidate.index===0?run.id:`${run.id}:${candidate.index}`,
      status:candidate.status==='done'?'success' as const:candidate.status==='failed'?'error' as const:'loading' as const,
      storageKey:candidate.storageKey,content:candidate.url,mimeType:'video/mp4',seconds:String(candidate.durationSec),errorDetails:candidate.errorMessage,queue:candidate.queue,
    }));
    const existing=metadata.videos||[];
    metadata.videos=[...existing.filter(v=>!incoming.some(t=>t.id===v.id)),...incoming];
    const first=incoming.find(t=>t.status==='success'&&t.storageKey);
    const adopted=incoming.find(t=>t.id===metadata.primaryVideoId&&t.storageKey);
    if(adopted||!metadata.storageKey&&first) {
      const take=adopted||first!;metadata.storageKey=take.storageKey;metadata.content=take.content;metadata.primaryVideoId=take.id;
    }
  }
  if (run.status === "running") return { ...node, metadata: { ...metadata, status: "loading" } };
  if(run.kind==="studio-video")metadata.videoTaskId=undefined;
  metadata.status = run.status === "failed" ? "error" : "success";
  metadata.errorDetails = run.status === "failed" ? run.errorMessage || "生成失败，请重试" : undefined;
  if(run.output.plan && metadata.studio.conversation && !alreadyApplied) {
    metadata.studio.conversation={...metadata.studio.conversation,plan:run.output.plan,
      turns: [...metadata.studio.conversation.turns,{role:"assistant" as const,content:run.output.plan.summary}].slice(-16)};
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
    if (!metadata.storageKey || run.output.lipSyncNormalized&&metadata.primaryVideoId===run.id) { metadata.storageKey = run.output.storageKey; metadata.content = run.output.url; metadata.primaryVideoId = run.id; }
  }
  return { ...node, metadata };
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
