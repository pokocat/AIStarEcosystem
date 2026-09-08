import { defaultConfig, resolveModelForCapability, type AiConfig } from "@/canvas-bridge/config-store";
import i18n from "@/canvas-bridge/i18n";
import { resolveImageUrl, uploadImage } from "@/canvas-bridge/image-storage";
import { resolveMediaUrl } from "@/canvas-bridge/file-storage";
import { imageMetadata, referenceUrl } from "@/canvas/lib/canvas/canvas-node-factory";
import { NODE_DEFAULT_SIZE } from "@/canvas/constant/canvas";
import { fitNodeSize } from "@/canvas/lib/canvas/canvas-node-size";
import type { NodeGenerationInput } from "@/canvas/components/canvas/canvas-node-generation";
import type { CanvasNodeGenerationMode } from "@/canvas/components/canvas/canvas-node-prompt-panel";
import type { CanvasImageAngleParams } from "@/canvas/components/canvas/canvas-node-angle-dialog";
import type { ReferenceImage } from "@/canvas/types/image";
import { CanvasNodeType, type CanvasAssistantSession, type CanvasConnection, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata } from "@/canvas/types/canvas";

export function imageExtension(dataUrl: string) {
    return dataUrl.match(/^data:image[/]([^;]+)/)?.[1] || dataUrl.match(/image[/]([^;]+)/)?.[1] || "png";
}

export function audioExtension(mimeType?: string) {
    if (mimeType?.includes("wav")) return "wav";
    if (mimeType?.includes("opus")) return "opus";
    if (mimeType?.includes("aac")) return "aac";
    if (mimeType?.includes("flac")) return "flac";
    if (mimeType?.includes("pcm")) return "pcm";
    return "mp3";
}

export function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ];
}

/**
 * `metadata.references[]` 里存的到底是什么：**存储键**（本仓）还是一个可以直接当 src 的地址。
 *
 * 本仓改动（v0.179）：`referenceUrl()` 是 `storageKey || url || 非 data 的 dataUrl`，
 * 而本仓的图一律有 storageKey（OSS key，形如 `ipstudio_source/<uid>/…`）——
 * 所以这个数组里绝大多数是**裸 key**，不带任何 scheme。
 *
 * 上游只认 `image:` 前缀（它的 IndexedDB key 约定），本仓一个都没有：于是 OSS key
 * 被当成地址原样塞进 dataUrl、`storageKey` 留空，`refKeysOf` 一过滤就成了空数组 ——
 * **「重试」这一次悄悄变成纯文生图**，而 generationType 还写着 edit，钱照扣。
 */
function referenceStorageKeyOf(value: string): string | undefined {
    return /^(https?:|blob:|data:)/i.test(value) ? undefined : value;
}

export async function resolveMetadataReferences(metadata: CanvasNodeMetadata) {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (value, index) => {
            const storageKey = referenceStorageKeyOf(value);
            // 有 key 就够了 —— 生成只需要 key（服务端按 key 取图并过归属闸），
            // 地址只影响预览。所以签不出地址也**保留这一项**，不要因此把整次重试判成「参考图不见了」。
            const dataUrl = storageKey ? await resolveImageUrl(storageKey, "") : value;
            if (!storageKey && !dataUrl) return null;
            return { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey };
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

export async function hydrateCanvasImages(nodes: CanvasNodeData[]) {
    return Promise.all(
        nodes.map(async (node) => {
            const metadata = node.metadata;
            const content = metadata?.content;
            if ((node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && metadata?.storageKey) return { ...node, metadata: { ...metadata, content: await resolveMediaUrl(metadata.storageKey, content) } };
            if (node.type !== CanvasNodeType.Image || !metadata || !content) return node;
            const images = await Promise.all((metadata.images || []).map(async (image) => (image.content ? { ...image, content: await resolveImageUrl(image.storageKey, image.content) } : image)));
            if (metadata.storageKey) return { ...node, metadata: { ...metadata, content: await resolveImageUrl(metadata.storageKey, content), images } };
            if (!content.startsWith("data:image/")) return node;
            return { ...node, metadata: { ...metadata, ...imageMetadata(await uploadImage(content)) } };
        }),
    );
}

export async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

export function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

export function getInputSummary(inputs: NodeGenerationInput[]) {
    const resources = [...new Map(inputs.flatMap((input) => (input.type === "group" ? input.children : [input])).map((input) => [input.nodeId, input])).values()];
    return {
        textCount: resources.filter((input) => input.type === "text").length,
        imageCount: resources.filter((input) => input.type === "image").length,
        videoCount: resources.filter((input) => input.type === "video").length,
        audioCount: resources.filter((input) => input.type === "audio").length,
    };
}

export function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode): AiConfig {
    return {
        ...config,
        model: resolveModelForCapability(config, node?.metadata?.model, mode),
        reasoningEffort: node?.metadata?.reasoningEffort || config.reasoningEffort || defaultConfig.reasoningEffort,
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: node?.metadata?.size || config.size || defaultConfig.size,
        background: node?.metadata?.background ?? config.background ?? defaultConfig.background,
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        videoMode: node?.metadata?.videoMode || config.videoMode || defaultConfig.videoMode,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

export function hasResumableVideoTask(node: CanvasNodeData) {
    return node.type === CanvasNodeType.Video && Boolean(node.metadata?.videoTaskId) && !node.metadata?.content;
}

/** 一次接得回来的出图运行。`imageId` 为空 = 结果直接写在节点上（没有候选数组）。 */
export type ResumableImageRun = { runId: string; imageId?: string };

/**
 * **接得回来**的出图运行 —— 身上还留着服务端运行号的那些。
 *
 * 判定只看「有没有 runId」，不看状态是 loading 还是 error：运行号本身就是
 * 「这张图还有未了结的事」的凭据。服务端明确说失败时，写回那一步会**把 runId 抹掉**
 * （见 project.tsx 里的 `isRunEnded`）—— 所以还留着 runId 的 error 候选，
 * 意味着我们是因为网络抖动 / 等超时 / 用户离开才停止观察的，那次运行可能已经出了图、
 * 也已经扣了钱。这种必须能对账接回来，否则就是一张付过费的图永远没人认领。
 *
 * 两种形状都要照顾（v0.179）：
 *   · **有候选数组**（普通出图 / 单张重试）：逐个候选看 `images[].runId`；
 *   · **没有候选数组**：蒙版编辑与视角变化直接把结果写进新节点的 metadata，
 *     运行号只能记在节点级 `metadata.runId` 上。它俩也是**付费**入口，
 *     漏掉就等于「这两条链的产物一旦中断就永远找不回来」。
 *     节点已经有图（`content`）说明那次已经收尾了 —— 此时的 runId 只是「这张图来自哪次运行」。
 */
export function resumableImageRuns(node: CanvasNodeData): ResumableImageRun[] {
    if (node.type !== CanvasNodeType.Image) return [];
    const fromCandidates = (node.metadata?.images || [])
        .filter((image) => image.runId && image.status !== "success")
        .map((image) => ({ runId: image.runId as string, imageId: image.id }));
    if (fromCandidates.length) return fromCandidates;
    const nodeRunId = node.metadata?.runId;
    return nodeRunId && !node.metadata?.content ? [{ runId: nodeRunId }] : [];
}

/** 这个节点上有没有接得回来的出图运行（进画布后由 project.tsx 接着轮询）。 */
export function hasResumableImageRun(node: CanvasNodeData) {
    return resumableImageRuns(node).length > 0;
}

/**
 * 刷新 / 重新打开画布时，把「上次没跑完」的节点收拾干净。
 *
 * <p>本仓改动（v0.179）：**接得回来的不许标失败**。出图那次运行在服务端还在跑（或已经跑完、
 * 已经扣了钱），运行号就写在候选的 `runId`（或没有候选数组时的节点级 `metadata.runId`）上 ——
 * 标成「已中断」等于把一张付过费的图丢掉。
 *
 * <p><b>没留下运行号不等于「服务端没受理」。</b>它只说明**我们不知道**：可能请求确实还没发出去，
 * 也可能服务端已经受理并开始扣费、只是响应没回来（网络断、标签页被关在 POST 与响应之间）。
 * 这个窗口用当前的接口关不掉 —— 要关掉需要**幂等请求键**（客户端先生成 key、服务端按 key 去重
 * 并把已有的运行原样返回），那是服务端改动，本轮没做。所以这里只能标失败并**如实告知**
 * （见 `canvas.generation.interrupted` 的文案：可能已经跑过并扣过费，重新生成前先看积分明细），
 * 绝不声称「一定没跑过、放心重来」。
 */
export function resetInterruptedGeneration(nodes: CanvasNodeData[]) {
    const interrupted = i18n.t("canvas.generation.interrupted");
    return nodes.map((node) => {
        if (node.metadata?.status !== "loading") return node;
        if (hasResumableVideoTask(node)) return node;
        const images = node.metadata.images?.map((image) => (image.status === "loading" && !image.runId ? { ...image, status: "error" as const, errorDetails: interrupted } : image));
        const texts = node.metadata.texts?.map((text) => (text.status === "loading" ? { ...text, status: "error" as const, errorDetails: interrupted } : text));
        // 节点级 runId 也算 —— 蒙版编辑 / 视角变化的结果直接写在节点上，没有候选数组
        const resumable = Boolean(images?.some((image) => image.status === "loading" && image.runId))
            || (node.type === CanvasNodeType.Image && Boolean(node.metadata.runId) && !node.metadata.content);
        return {
            ...node,
            metadata: {
                ...node.metadata,
                status: resumable ? ("loading" as const) : ("error" as const),
                errorDetails: resumable ? undefined : interrupted,
                images,
                texts,
            },
        };
    });
}

export function isGenerationCanceled(error: unknown) {
    return error instanceof Error && (error.message === i18n.t("common.requestCanceled") || error.name === "AbortError");
}

export function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

export function sourceNodeReferenceImages(node: CanvasNodeData | null) {
    if (!node || node.type !== CanvasNodeType.Image || !node.metadata?.content) return [];
    return [
        {
            id: node.id,
            name: `${node.title || node.id}.png`,
            type: node.metadata.mimeType || "image/png",
            dataUrl: node.metadata.content,
            storageKey: node.metadata.storageKey,
        },
    ];
}

/**
 * 画布能上传的素材：**只有 JPG / PNG**（本仓，v0.179）。
 *
 * 服务端 `POST /v1/ip-studio/uploads` 只收这两种（`IpProjectService.UPLOAD_EXTS`）。
 * 此前入口是 `accept="image/*,video/*,audio/…"` + 没有 catch 的 `void create…FileNode(...)`：
 * 拖进去一个 mp4 / webp / 超大图，界面上什么都不发生。上游那三个 `isAudioFile` 分支
 * （音频、视频导入）随之退役 —— 它们在本仓从来没成功过一次。
 */
export function isSupportedUploadImage(file: File) {
    return /^image\/(jpeg|png)$/i.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

/** 上传入口的 accept —— 与服务端 UPLOAD_MIMES 一致，别放行一定会被拒的格式。 */
export const UPLOAD_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";

export function buildAngleLabel(params: CanvasImageAngleParams) {
    const horizontal = params.horizontalAngle === 0 ? i18n.t("canvas.generation.front") : params.horizontalAngle > 0 ? i18n.t("canvas.generation.rotateRight", { angle: params.horizontalAngle }) : i18n.t("canvas.generation.rotateLeft", { angle: Math.abs(params.horizontalAngle) });
    const pitch = params.pitchAngle === 0 ? i18n.t("canvas.generation.level") : params.pitchAngle > 0 ? i18n.t("canvas.generation.topDown", { angle: params.pitchAngle }) : i18n.t("canvas.generation.lowAngle", { angle: Math.abs(params.pitchAngle) });
    return i18n.t("canvas.generation.angleLabel", { horizontal, pitch, distance: params.cameraDistance.toFixed(1), lens: i18n.t(params.wideAngle ? "canvas.editors.wide" : "canvas.editors.standard") });
}

export function buildAnglePrompt(params: CanvasImageAngleParams) {
    return i18n.t("canvas.generation.anglePrompt", { angle: buildAngleLabel(params) });
}

/**
 * 把一张出好的候选写回节点（本仓抽出来，v0.179）。
 *
 * 正常出图、单张重试、刷新后接回，三条路径共用这一段 —— 各写一份的结果就是 v0.175 那次事故：
 * 只修了其中一条，另一条继续在画布上显示第一次那张图（服务端每次都真出了新图、也真扣了钱）。
 *
 * `boxEdge > 0` = 按节点当前的长边收（就地重出 / 往已有节点塞图，模板节点是 340×240，
 * 用默认 640 会一下撑大）；0 = 按新建图节点的默认框。
 */
export function applyCandidateToNode(
    nodes: CanvasNodeData[],
    rootId: string,
    imageId: string,
    uploaded: { url: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string },
    runId: string | undefined,
    boxEdge: number,
): CanvasNodeData[] {
    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = boxEdge
        ? fitNodeSize(uploaded.width, uploaded.height, boxEdge, boxEdge)
        : fitNodeSize(uploaded.width, uploaded.height, spec.width, spec.height);
    const item: CanvasNodeImage = {
        id: imageId,
        status: "success",
        content: uploaded.url,
        storageKey: uploaded.storageKey,
        naturalWidth: uploaded.width,
        naturalHeight: uploaded.height,
        bytes: uploaded.bytes,
        mimeType: uploaded.mimeType,
        ...(runId ? { runId } : {}),
    };
    return nodes.map((node) => {
        if (node.id !== rootId) return node;
        const images = node.metadata?.images?.map((image) => (image.id === imageId ? item : image)) || [];
        // 已经有主图、而且**主图不是这一张**：只进候选，不动节点显示的那张
        // （多候选生成的第 2..N 张就该这样）。
        //
        // 但主图**正好是这一张**时必须一起更新（v0.179，Codex 复核逮到）——
        // 「重出当前这张主图」是最常见的操作。画布显示的是候选（`primaryImage?.content`
        // 兜底 `metadata.content`），所以只改数组看起来也对；可是
        // **`metadata.storageKey` 是下游生成的参考图真值**
        // （`canvas-node-generation.ts` 拿的就是它，见那儿的 200/211/226 行），
        // 不一起更新的话：画布上显示新图，而接在它后面的每一次生成都还在照着**旧图**画，
        // 用户看不出来、钱照扣。节点级 `content` 同理（导出、蒙版编辑的源图都读它）。
        if (node.metadata?.primaryImageId && node.metadata.primaryImageId !== imageId) {
            return { ...node, metadata: { ...node.metadata, images } };
        }
        const center = { x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 };
        return {
            ...node,
            position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
            ...size,
            metadata: {
                ...node.metadata,
                content: item.content,
                storageKey: item.storageKey,
                naturalWidth: item.naturalWidth,
                naturalHeight: item.naturalHeight,
                bytes: item.bytes,
                mimeType: item.mimeType,
                images,
                primaryImageId: imageId,
                // 节点级 runId = 当前显示这张图来自哪次运行。服务端按它把历史运行投影进
                // `runsById`（IpProjectService.projectRuns），刷新后顶栏「上次发给模型」才有内容。
                ...(runId ? { runId } : {}),
            },
        };
    });
}
