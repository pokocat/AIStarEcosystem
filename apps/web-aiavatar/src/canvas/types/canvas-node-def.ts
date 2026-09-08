import type { ReactNode } from "react";
// 节点定义类型。
//
// 本仓改动（v0.162）：原文件叫 canvas-plugin.ts，里面混着「内置节点的定义」和
// 「第三方插件的运行时 API」两件事。插件市场已经退役（默认从 CDN 拉第三方代码进页面执行，
// 而我们的画布跑在登录态里、旁边就是钱包和资产），所以只留下前者，文件也改名成它真正的内容。


import type { CanvasNodeData, CanvasNodeMetadata } from "@/canvas/types/canvas";
import type { CanvasResourceKind } from "@/canvas/lib/canvas/canvas-resource-references";

// Resource emitted when a plugin node is consumed as an upstream input.
export type CanvasNodeResource = { kind: CanvasResourceKind; text?: string; url?: string };

// AI generation capabilities injected by the host, reusing its model and credential configuration.
export type GenerateOptions = { signal?: AbortSignal; references?: string[]; model?: string };
export type GenerateImageOptions = GenerateOptions & { count?: number; size?: string };
export type GenerateImageResult = { images: string[] };
export type GenerateVideoOptions = GenerateOptions & { size?: string; seconds?: string };
export type GenerateVideoResult = { url: string; mimeType: string; width?: number; height?: number; durationMs?: number };
export type GenerateTextOptions = { signal?: AbortSignal; model?: string; system?: string; onDelta?: (text: string) => void };
export type GenerateTextResult = { text: string };
export type PluginModelCapability = "image" | "video" | "text" | "audio";
export type ModelOption = { value: string; label: string };


// Node-specific buttons appended to the hover toolbar.
export type CanvasNodeToolbarItem = {
    id: string;
    title: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
};





// Shared node definition used by both built-in and plugin nodes.
export type CanvasNodeDefinition = {
    type: string; // Built-ins use values such as "image"; plugins should use "<pluginId>:<name>".
    title: string;
    icon: ReactNode;
    description?: string;
    defaultSize: { width: number; height: number };
    defaultMetadata?: CanvasNodeMetadata;
    minimapColor?: string;
    showInCreateMenu?: boolean; // Defaults to true.
    hasSourceHandle?: boolean; // Right-side output handle; defaults to true.
    hidePanel?: boolean; // Prevents click/create from opening a lower panel; intended for display-only nodes.
    transparentBackground?: boolean; // Makes the node card transparent so SVG or vector content blends into the canvas.
    // Lets the host provide an Interaction/Move toolbar toggle and control pointer events through metadata.interactive.
    interactionToggle?: boolean;
    // With interactionToggle, true forces interactive content, ignores metadata.interactive, and hides the toggle.
    forceInteractive?: (node: CanvasNodeData) => boolean;
    keepAspectRatio?: (node: CanvasNodeData) => boolean;
    resource?: (node: CanvasNodeData) => CanvasNodeResource | null;
};


