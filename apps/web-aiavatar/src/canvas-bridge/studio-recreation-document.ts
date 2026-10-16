import type { IpRun } from '@ai-star-eco/types';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

/** A completed analysis is a reusable document and ordinary image nodes, grouped once. */
export function materializeRecreation(nodes:CanvasNodeData[],nodeId:string,run:IpRun):CanvasNodeData[] {
 const report=run.output.recreation,node=nodes.find(n=>n.id===nodeId);
 if(run.status!=='done'||!report||!node||node.metadata?.studio?.recreation?.materializedRunId===run.id)return nodes;
 const groupId=`${nodeId}-analysis`,left=node.position.x-28,top=node.position.y-48,width=720,height=1900;
 const refs=report.references||[];
 const document={...node,width,height,metadata:{...node.metadata,groupId,studio:{...node.metadata!.studio!,recreation:{...node.metadata!.studio!.recreation!,materializedRunId:run.id}}}};
 const group:CanvasNodeData={id:groupId,type:CanvasNodeType.Group,title:'全片创作拆解',position:{x:left,y:top},width:refs.length?1136:776,height:height+76,metadata:{status:'success'}};
 const images:CanvasNodeData[]=refs.map((ref,i)=>({id:`${nodeId}-reference-${i+1}`,type:CanvasNodeType.Image,title:`风格参考 ${i+1} · ${ref.timeSec.toFixed(1)} 秒`,position:{x:node.position.x+752,y:node.position.y+i*224},width:300,height:200,metadata:{status:'success',groupId,storageKey:ref.storageKey,content:ref.url,naturalWidth:ref.width,naturalHeight:ref.height,mimeType:'image/jpeg'}}));
 const present=new Set(nodes.map(n=>n.id));
 return [...nodes.map(n=>n.id===nodeId?document:n),...[group,...images].filter(n=>!present.has(n.id))];
}
