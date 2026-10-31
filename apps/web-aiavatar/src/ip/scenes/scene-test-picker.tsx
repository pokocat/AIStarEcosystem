import type { IpSavedAsset } from "@ai-star-eco/types";

type Picked = { key: string; url: string; fileName?: string; mimeType?: string; bytes?: number; width?: number; height?: number };
let source: (mediaType: "image" | "video" | "audio") => Promise<Picked> = async () => { throw new Error("测试没有设置资产库返回什么"); };
/** 测试里设定「资产库里选中的是哪一份」（按素材类型）。 */
export function setLibrarySource(next: typeof source) { source = next; }

/** 资产库选择框的测试替身：一个「用这个」按钮，点了把设定好的那一份交给页面，再关掉。 */
export function LibraryReferencePicker({ open, onAssets, onClose, mediaType = "image", title }: {
  open: boolean; onAssets: (assets: IpSavedAsset[]) => Promise<void>; onClose: () => void; mediaType?: "image" | "video" | "audio"; title?: string;
}) {
  if (!open) return null;
  const confirm = async () => {
    const r = await source(mediaType);
    const base = { id: `lib-${r.key}`, title: r.fileName ?? r.key, coverUrl: "", tags: [], createdAt: "", updatedAt: "" };
    const meta = { storageKey: r.key, bytes: r.bytes ?? 1, mimeType: r.mimeType ?? "" };
    const asset = mediaType === "image" ? { ...base, kind: "image", data: { ...meta, dataUrl: r.url, width: r.width ?? 0, height: r.height ?? 0 } }
      : mediaType === "video" ? { ...base, kind: "video", data: { ...meta, url: r.url, width: r.width ?? 0, height: r.height ?? 0 } }
      : { ...base, kind: "audio", data: { ...meta, url: r.url } };
    await onAssets([asset as IpSavedAsset]);
    onClose();
  };
  return <div role="dialog" aria-label={title ?? "资产库"}><button type="button" onClick={() => void confirm()}>用这个</button></div>;
}
