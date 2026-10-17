import type { IpRun } from '@ai-star-eco/types';
import type { StudioSourceAudio } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { placeStudioNode } from './flow-document';

/** Analysis and film study reuse one ordinary soundtrack node for the same source video. */
export function existingSourceAudio(nodes:CanvasNodeData[],audio:StudioSourceAudio):CanvasNodeData|undefined {
 return nodes.find(n=>n.type===CanvasNodeType.Audio&&n.metadata?.status==='success'&&n.metadata.studio?.sourceRange?.storageKey===audio.sourceStorageKey);
}

export function materializeRecreationAudio(nodes:CanvasNodeData[],nodeId:string,run:IpRun):CanvasNodeData[] {
 const audio=run.output.sourceAudio,root=nodes.find(n=>n.id===nodeId),saved=root?.metadata?.studio?.recreation;
 if(!run.output.filmStudy&&!run.output.recreation&&root?.metadata?.studio?.recreation?.mode!=='segments')return nodes;
 if(!root||!saved||audio?.status!=='ready'||!audio.storageKey||saved.materializedAudioSourceKey===audio.sourceStorageKey)return nodes;
 const existing=existingSourceAudio(nodes,audio);
 const grouped=!!run.output.recreation&&!!root.metadata?.groupId;
 const candidate:CanvasNodeData={id:`${nodeId}-source-audio`,type:CanvasNodeType.Audio,title:`${audio.sourceTitle||'视频'} · 原声音频`,
  position:{x:root.position.x+(grouped?752:root.width+64),y:root.position.y+(grouped?(run.output.recreation?.references?.length||0)*224:0)},width:360,height:220,
  metadata:{status:'success',storageKey:audio.storageKey,content:audio.url,mimeType:audio.mimeType||'audio/wav',bytes:audio.bytes,seconds:String(audio.durationSec||0),
   ...(grouped?{groupId:root.metadata?.groupId}:{}),studio:{kind:'audio',sourceRange:{storageKey:audio.sourceStorageKey,startSec:0,endSec:audio.durationSec||0}}}};
 const created=existing?undefined:grouped?candidate:placeStudioNode(candidate,nodes);
 return [...nodes.map(n=>n.id!==nodeId?n:{...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,recreation:{...saved,materializedAudioSourceKey:audio.sourceStorageKey}}}}),...(created?[created]:[])];
}
