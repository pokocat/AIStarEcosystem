import type { VideoStudioModel, VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import type { StudioVideoDraft } from "./studio-video";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";

/** Capacity compatibility allows unfinished frame slots; submitting still requires every mandatory input. */
export function studioVideoAcceptsReferences(spec:VideoStudioModeSpec,ids:string[],nodes:CanvasNodeData[]):boolean {
  const counts={image:0,video:0,audio:0};
  for(const id of new Set(ids)) {
    const node=nodes.find(n=>n.id===id);
    if(!node)return false;
    if(node.type===CanvasNodeType.Image)counts.image++;
    else if(node.type===CanvasNodeType.Video)counts.video++;
    else if(node.type===CanvasNodeType.Audio)counts.audio++;
    else return false;
  }
  counts.image=Math.max(0,counts.image-Number(!!spec.needsFirstFrame)-Number(!!spec.needsLastFrame));
  if(!spec.references)return counts.image+counts.video+counts.audio===0;
  const rules=spec.references;
  return counts.image+counts.video+counts.audio<=rules.maxTotal
    &&(['image','video','audio'] as const).every(type=>counts[type]<=rules[type].maxCount)
    &&(!counts.video||counts.image<=rules.maxImagesWithVideo);
}

/** No selected input is discarded during adaptation, even if a new model cannot accept it. */
export function adaptStudioVideoReferences(model:VideoStudioModel,draft:StudioVideoDraft,ids:string[],nodes:CanvasNodeData[],manualMode?:string):StudioVideoDraft {
  const images=ids.filter(id=>nodes.find(n=>n.id===id)?.type===CanvasNodeType.Image);
  const compatible=model.contract.modes.filter(spec=>studioVideoAcceptsReferences(spec,ids,nodes));
  const manual=compatible.find(spec=>spec.mode===manualMode);
  const current=compatible.find(spec=>spec.mode===draft.mode);
  const exact=compatible.find(spec=>!spec.references&&Number(!!spec.needsFirstFrame)+Number(!!spec.needsLastFrame)===ids.length);
  // Keep a reference mode the author is already using; choose specific frame modes for a new selection.
  const spec=manual||(ids.length&&current?.references?current:undefined)||exact||current||compatible[0];
  const firstId=images.includes(draft.firstId||'')?draft.firstId:images[0];
  const lastId=images.includes(draft.lastId||'')&&draft.lastId!==firstId?draft.lastId:images.find(id=>id!==firstId);
  const mode=spec?.mode||draft.mode;
  return mode===draft.mode&&firstId===draft.firstId&&lastId===draft.lastId?draft:{...draft,mode,firstId,lastId};
}

/** Frame ordering and the full visible selection share one list; unsupported inputs stay visible for correction. */
export function studioVideoSelectionIds(draft:StudioVideoDraft,ids:string[]):string[] {
  return [...new Set([draft.firstId,draft.lastId,...ids].filter((id):id is string=>!!id&&ids.includes(id)))];
}
