export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Group = "group",
}

// Node types are open strings: built-ins use CanvasNodeType and plugins use "<pluginId>:<name>".
export type CanvasNodeTypeId = CanvasNodeType | (string & {});

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";

/** 视频节点的一版成片（v0.182）。与 CanvasNodeImage 同形，只是产物是 MP4。 */
export type CanvasNodeVideoTake = {
    id: string;
    status: "loading" | "success" | "error";
    /** 我方存储里的成片键（真值）。 */
    storageKey?: string;
    /** 出 wire 现签的播放地址（派生值，落库前被服务端剥掉）。 */
    content?: string;
    prompt?: string;
    seconds?: string;
    mimeType?: string;
    errorDetails?: string;
};

export type CanvasNodeImage = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
    storageKey?: string;
    /**
     * 这张候选是哪次服务端运行出来的（本仓新增，契约里的 `IpNodeMetadata.runId`）。
     *
     * 出图是「已受理、可能已开始扣费」的动作，还要跑几十秒。服务端一受理就把运行号写在这儿，
     * 刷新 / 关标签页回来才接得回去 —— 否则服务端跑完、扣了钱、图躺在运行记录里没人认领。
     */
    runId?: string;
    naturalWidth: number;
    naturalHeight: number;
    bytes: number;
    mimeType: string;
};

export type CanvasNodeText = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    reasoningEffort?: "auto" | "low" | "medium" | "high" | "xhigh";
    size?: string;
    quality?: string;
    background?: string;
    count?: number;
    textCount?: number;
    texts?: CanvasNodeText[];
    primaryTextId?: string;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    videoMode?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    images?: CanvasNodeImage[];
    primaryImageId?: string;
    /**
     * 视频节点的历史成片（v0.182）。视频跟出图一样是抽卡：跑十条挑一条，
     * 所以重出不能把上一版顶掉 —— 想回到刚才那条不该只能重跑一次再付一次钱。
     * 与 `images[]` / `primaryImageId` 同形。
     */
    videos?: CanvasNodeVideoTake[];
    primaryVideoId?: string;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    /** 节点显示的那张图来自哪次运行 —— 服务端按它把历史运行投影进 `runsById`。 */
    runId?: string;
    videoTaskId?: string;
    // "plugin" = 本仓的服务端视频任务（`MaterialVideoJob`）。上游的 plugin 是浏览器里的插件，
    // 进程一关任务就没了，所以它**不存** taskId；我们的恰恰是服务端任务，最该存（v0.179）。
    videoTaskProvider?: "openai" | "gemini" | "plugin";
    groupId?: string;
    interactive?: boolean; // Plugin node interaction/move state; see CanvasNodeDefinition.interactionToggle.
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };
