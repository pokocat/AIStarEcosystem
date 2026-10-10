import { nanoid } from "nanoid";
import type { StudioScript, StudioReference } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";

/** Older pending image requests can retain the episode only in their authored shot. */
export function studioNodeEpisode(node?: CanvasNodeData): number | undefined {
  return node?.metadata?.studio?.episodeNo ?? node?.metadata?.studio?.shot?.episodeNo;
}

/** Send the actual edited script, never the obsolete first-generation brief or shot suggestions. */
export function studioScriptPrompt(script: StudioScript, instruction: string): string {
  const { shots: _suggestions, ...edited } = script;
  return `${instruction}\n\n当前剧本：\n${JSON.stringify(edited, null, 2)}`;
}

/** Snapshot the chosen editable story into this request; later edits never change an accepted run. */
export function studioScriptInput(prompt: string, mode: "original" | "adapt", sourceId: string | undefined, nodes: CanvasNodeData[]): string {
  if(mode!=="adapt" || !sourceId)return `${mode==="adapt"?"故事改编：根据以下素材与要求改编。":"原创剧本：根据以下要求创作。"}\n${prompt.trim()}`;
  const source=nodes.find(n=>n.id===sourceId);
  if(!source || source.type!==CanvasNodeType.Text)throw new Error("原故事已移出画布，请重新选择改编素材");
  const text=source.metadata?.studio?.script?studioScriptPrompt(source.metadata.studio.script,"原故事"):source.metadata?.content;
  if(!text?.trim())throw new Error("所选故事没有正文，请补充内容或选择其他素材");
  return `故事改编：以《${source.title}》的当前正文为依据，遵守创作设定与改编要求。\n改编要求：\n${prompt.trim()}\n\n原故事正文：\n${text}`;
}

export function mergeStudioRewrite(base: StudioScript, generated: StudioScript, scope: {field:"outline"|"episode";episodeNo?:number}): StudioScript {
  if(scope.field==="outline")return {...base,outline:generated.outline,shots:[]};
  const replacement=generated.episodes.find(e=>e.no===scope.episodeNo) || generated.episodes[0];
  return {...base,episodes:base.episodes.map(e=>e.no===scope.episodeNo?{...e,content:replacement.content}:e),shots:base.shots.filter(s=>(s.episodeNo||1)!==scope.episodeNo)};
}

export function studioShotNodes(parent: CanvasNodeData, script: StudioScript): CanvasNodeData[] {
  return script.shots.map((shot, index) => ({
    id: nanoid(), type: CanvasNodeType.Image, title: shot.title || `镜头 ${index + 1}`,
    position: { x: parent.position.x + parent.width + 100 + (index % 3) * 390, y: parent.position.y + Math.floor(index / 3) * 470 },
    width: 300, height: 390, metadata: {
      prompt: shot.description, status: "idle",
      studio: { kind: "shot", shot, episodeNo:shot.episodeNo||script.episodes[0]?.no||1,parentNodeId: parent.id, order: index, references: parent.metadata?.studio?.references },
    },
  }));
}

export function studioNodeReferences(node: CanvasNodeData, role: StudioReference["role"]): StudioReference[] {
  const adoption = node.metadata?.studio?.adoption;
  const key = node.metadata?.storageKey || adoption?.storageKey;
  if (!key) return node.metadata?.studio?.references || [];
  // Choosing another take does not silently update the IP's formally adopted version.
  const adopted = adoption?.storageKey === key ? adoption : node.metadata?.studio?.references?.find(ref=>ref.avatarId&&ref.storageKey===key);
  return [{ storageKey: key, role: role === "clip" ? "clip" : adopted ? "character" : role==="frame"?"frame":node.metadata?.studio?.assetRole || role,
    ipId: adopted?.ipId || node.metadata?.studio?.references?.find(r=>r.ipId)?.ipId, avatarId: adopted?.avatarId, version: adopted?.version,lookId:adopted?.lookId }];
}

export function reorderStudioClips(nodes: CanvasNodeData[], orderedIds: string[], from: number, to: number): CanvasNodeData[] {
  if (to < 0 || to >= orderedIds.length) return nodes;
  const next = [...orderedIds];
  [next[from], next[to]] = [next[to], next[from]];
  const positions = new Map(next.map((id, index) => [id, index]));
  return nodes.map(n => positions.has(n.id) ? { ...n, metadata: { ...n.metadata, studio: { ...n.metadata!.studio!, order: positions.get(n.id) } } } : n);
}

/** Editing upstream content keeps its existing outputs and marks the whole dependent chain. */
export function markStudioDescendants(nodes: CanvasNodeData[], parentId: string): CanvasNodeData[] {
  const affected = new Set([parentId]);
  let changed = true;
  while (changed) {
    changed = false;
    const keys=new Set(nodes.filter(n=>affected.has(n.id)).map(n=>n.metadata?.storageKey).filter(Boolean));
    for (const node of nodes) {
      if (!affected.has(node.id) && (node.metadata?.studio?.parentNodeId && affected.has(node.metadata.studio.parentNodeId) || node.metadata?.studio?.scriptSourceNodeId && affected.has(node.metadata.studio.scriptSourceNodeId) || node.metadata?.studio?.references?.some(ref=>keys.has(ref.storageKey)))) {
        affected.add(node.id); changed = true;
      }
    }
  }
  return nodes.map(node => node.id !== parentId && affected.has(node.id)
    ? { ...node, metadata: { ...node.metadata, studio: { ...node.metadata!.studio!, upstreamChanged: true } } } : node);
}
