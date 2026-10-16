import {placeStudioNode} from './flow-document';
import type {IpRun} from '@ai-star-eco/types';
import {CanvasNodeType,type CanvasNodeData,type CanvasConnection} from '@/canvas/types/canvas';

const documentHeight=1200;
/** Incremental, stable canvas outputs. Completed and edited segment documents are never replaced on polling/retry. */
export function materializeFilmStudy(nodes:CanvasNodeData[],nodeId:string,run:IpRun):CanvasNodeData[] {
 const study=run.output.filmStudy,root=nodes.find(n=>n.id===nodeId);if(!study||!root)return nodes;
 const saved=root.metadata?.studio?.recreation,done=new Set(saved?.materializedSegmentNos||[]),created:CanvasNodeData[]=[];
 for(const segment of study.segments) {
  if(segment.status!=='done'||!segment.storageKey||!segment.markdown||done.has(segment.no))continue;
  const id=`${nodeId}-segment-${segment.no}`,preferredX=nodes.find(n=>n.id===`${nodeId}-segment-1`)?.position.x??created.find(n=>n.id===`${nodeId}-segment-1`)?.position.x??root.position.x-24;
  const preferredY=root.position.y+root.height+58+(segment.no-1)*(documentHeight+120);
  const group=placeStudioNode({id,type:CanvasNodeType.Group,title:`片段 ${segment.no} · ${segment.startSec.toFixed(1)}–${segment.endSec.toFixed(1)} 秒`,position:{x:preferredX,y:preferredY},width:1160,height:documentHeight+68,metadata:{status:'success'}},[...nodes,...created]);
  const x=group.position.x+24,y=group.position.y+42;
  created.push(group,
   {id:`${id}-video`,type:CanvasNodeType.Video,title:`片段 ${segment.no} · 原片 ${segment.startSec.toFixed(1)}–${segment.endSec.toFixed(1)} 秒`,position:{x,y},width:360,height:240,metadata:{status:'success',groupId:id,storageKey:segment.storageKey,content:segment.url,mimeType:'video/mp4',seconds:String(segment.durationSec||segment.endSec-segment.startSec),naturalWidth:segment.width,naturalHeight:segment.height,studio:{kind:'shot',includeInWork:false,sourceRange:{startSec:segment.startSec,endSec:segment.endSec,storageKey:study.source.storageKey}}}},
   {id:`${id}-document`,type:CanvasNodeType.Text,title:`片段 ${segment.no} · 镜头拆解`,position:{x:x+400,y},width:720,height:documentHeight,metadata:{status:'success',groupId:id,content:segment.markdown,studio:{kind:'recreation',recreation:{mode:'segments',document:true,sourceNodeId:study.source.nodeId,sourceStorageKey:study.source.storageKey,sourceTitle:study.source.title}}}});
  done.add(segment.no);
 }
 if(!created.length)return nodes;
 const present=new Set(nodes.map(n=>n.id));
 return [...nodes.map(n=>n.id!==nodeId?n:{...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,recreation:{...saved!,materializedSegmentNos:[...done]}}}}),...created.filter(n=>!present.has(n.id))];
}
export function filmStudyConnections(connections:CanvasConnection[],nodeId:string,run:IpRun):CanvasConnection[] {
 const study=run.output.filmStudy;if(!study)return connections;const additions:CanvasConnection[]=[];
 for(const segment of study.segments)if(segment.status==='done'&&segment.storageKey&&segment.markdown) {
  const id=`${nodeId}-segment-${segment.no}`;
  additions.push({id:`${id}-source`,fromNodeId:study.source.nodeId,toNodeId:`${id}-video`},{id:`${id}-analysis`,fromNodeId:`${id}-video`,toNodeId:`${id}-document`});
 }
 const present=new Set(connections.map(c=>c.id));return [...connections,...additions.filter(c=>!present.has(c.id))];
}
