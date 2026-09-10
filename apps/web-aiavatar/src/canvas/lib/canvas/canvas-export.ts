// 把选中的节点连同素材打包下载。
//
// 本仓改动（v0.162）：删掉项目级导出（`exportCanvasProjects` —— 它唯一的调用点是上游那个
// 项目列表页，我们有自己的 /projects，那个页面已经退役）。素材取用改为统一走
// `getImageBlob`：上游按 `image:` 前缀区分图片与其它媒体，而我们的 key 形如
// `ipstudio_gen/<uid>/xxx.png`，从来不带那个前缀 —— 照原逻辑判会全部走错分支。
// 两个 get*Blob 在本仓都是「按 key 换签名地址再 fetch」，对 OSS 一样有效。

import { saveAs } from "file-saver";

import i18n from "@/canvas-bridge/i18n";
import { createZip } from "@/canvas/lib/zip";
import { getMediaBlob } from "@/canvas-bridge/file-storage";
// 本仓改动：压包里的文件名也按**真实字节**定后缀 —— v0.184 之前存的文件，OSS 上的
// Content-Type 仍是错的（写着 png、内容是 JPEG），只信 blob.type 会把错名字带进压缩包。
import { blobExtension } from "@/canvas-bridge/download-media";
import { getImageBlob } from "@/canvas-bridge/image-storage";
import type { CanvasExportAsset, CanvasExportFile } from "@/canvas/types/canvas-export";
import type { CanvasProject } from "@/canvas/stores/canvas/use-canvas-store";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";


export async function exportCanvasNodes(nodes: CanvasNodeData[], fileName = i18n.t("canvas.export.defaultNodesName")) {
    const zipFiles: { name: string; data: BlobPart }[] = [];
    const used = new Set<string>();
    const uniqueName = (base: string, ext: string) => {
        const safe = safeFileName(base) || i18n.t("canvas.export.item");
        let name = `${safe}.${ext}`;
        for (let i = 1; used.has(name); i += 1) name = `${safe}-${i}.${ext}`;
        used.add(name);
        return name;
    };

    await Promise.all(
        nodes.map(async (node) => {
            const title = node.title || node.type;
            const storageKey = node.metadata?.storageKey || "";
            if (storageKey) {
                const blob = storageKey.startsWith("image:") ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
                if (blob) return void zipFiles.push({ name: uniqueName(title, (await blobExtension(blob, null, storageKey)) ?? fileExtension(blob.type, storageKey)), data: blob });
            }
            if (node.type === CanvasNodeType.Text) return void zipFiles.push({ name: uniqueName(title, "txt"), data: node.metadata?.content || node.metadata?.prompt || "" });
            const content = node.metadata?.content;
            if (content && content.startsWith("data:")) {
                const blob = await (await fetch(content)).blob();
                return void zipFiles.push({ name: uniqueName(title, (await blobExtension(blob, null, storageKey)) ?? fileExtension(blob.type, storageKey)), data: blob });
            }
            zipFiles.push({ name: uniqueName(title, "json"), data: JSON.stringify(node, null, 2) });
        }),
    );

    const zip = await createZip(zipFiles);
    saveAs(zip, `${safeFileName(fileName)}.zip`);
}

function collectStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return [...keys];
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectStorageKeys(child, keys)) : collectStorageKeys(item, keys)));
    return [...keys];
}

function safeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

function fileExtension(mimeType: string, storageKey: string) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    return storageKey.startsWith("image:") ? "png" : "bin";
}
