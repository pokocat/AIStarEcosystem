import type { DirectorClip, DirectorImageReference, DirectorWork } from "@ai-star-eco/types";
import { ImageIcon } from "lucide-react";
import { ZoomableImage } from "./director-shared";

/** 关联资产的展示也跟随服务端参考清单；仅声音等未用作图片的资产放在后面。 */
export function orderedLinkedAssets(work: DirectorWork, clip: DirectorClip) {
  const linked = clip.assetIds.map(id => work.assets.find(a => a.id === id)).filter((a): a is DirectorWork["assets"][number] => !!a);
  const rank = new Map<string, number>();
  clip.boardRefs?.forEach(r => { if (r.assetId && !rank.has(r.assetId)) rank.set(r.assetId, rank.size); });
  // 兼容旧服务端响应；同类保持原顺序，与后端 visualAssets 一致。
  const kinds = { character: 0, scene: 1, prop: 2, product: 3 };
  return linked.sort((a, b) => rank.size ? (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size) : kinds[a.kind] - kinds[b.kind]);
}

export function ReferenceImages({ refs, title }: { refs?: DirectorImageReference[]; title: string }) {
  if (!refs?.length) return null;
  return <section className="director-reference-images" aria-label={title}>
    <h4>{title}</h4>
    <ol>{refs.map((r, i) => <li key={`${r.label}:${i}`}>
      <span className="director-reference-image">{r.url ? <ZoomableImage src={r.url} alt={`${r.label} ${r.name}`}/> : <span className="director-reference-missing"><ImageIcon size={18}/>{r.key ? "图片暂不可用" : "缺少图片"}</span>}</span>
      <span><b>{r.label}</b><span>{r.name}</span></span>
    </li>)}</ol>
  </section>;
}
