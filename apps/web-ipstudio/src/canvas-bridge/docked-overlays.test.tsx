// @vitest-environment jsdom
//
// 操作浮层必须在**屏幕层**，画布缩放影响不到它们（v0.187，对齐小云雀的形态）。
//
// 之前两个浮层各错一头：
//   · 节点操作条 —— 固定屏幕尺寸但位置跟着节点，缩小后比节点宽好几倍
//   · 节点提示词面板 —— 渲染在节点内部，也就是在 scale(k) 图层里，缩小后字全糊了
//
// 这里钉的是「不会再被接回缩放层」：一个是渲染断言，两个是源码结构断言
// （v0.159/v0.160 的教训 —— 接线断了编译器不会说话）。
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { App } from "antd";

const mem = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
        clear: () => mem.clear(),
        key: () => null,
        length: 0,
    },
});

import { CanvasNodeHoverToolbar } from "@/canvas/components/canvas/canvas-node-hover-toolbar";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";

const src = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

const node: CanvasNodeData = {
    id: "n1",
    type: CanvasNodeType.Video,
    title: "开屏打招呼",
    position: { x: 0, y: 400 },
    width: 185,
    height: 240,
    metadata: { content: "https://cdn.test/a.mp4" },
};

const noop = vi.fn();
const handlers = Object.fromEntries(
    ["onKeep", "onLeave", "onInfo", "onDecreaseFont", "onIncreaseFont", "onToggleDialog", "onGenerateImage",
     "onUpload", "onDownload", "onSaveAsset", "onMaskEdit", "onCrop", "onSplit", "onUpscale", "onSuperResolve",
     "onAngle", "onViewImage", "onReversePrompt", "onRetry", "onToggleFreeResize", "onDelete", "onUngroup"]
        .map((k) => [k, noop]),
) as Record<string, typeof noop>;

describe("节点操作条：停靠在画布区顶部，跟缩放无关", () => {
    it("渲染时不需要任何缩放 / 视口入参，文字照常显示", () => {
        const { container } = render(
            <App>
                <CanvasNodeHoverToolbar node={node} {...(handlers as never)} />
            </App>,
        );
        expect(container.textContent).toContain("删除");
        // 停靠时给出它在操作哪个节点 —— 浮层离开了节点，这个线索就得补上
        expect(container.textContent).toContain("开屏打招呼");
    });

    it("组件里不再读 viewport / scale —— 一旦读了，位置就又跟缩放绑上了", () => {
        const code = src("canvas/components/canvas/canvas-node-hover-toolbar.tsx");
        expect(code).not.toContain("viewport");
        expect(code).not.toContain("ViewportTransform");
    });
});

describe("节点提示词面板：不许再回到节点内部", () => {
    it("canvas-node.tsx 不再渲染面板（节点在 scale(k) 图层里，放回去就会跟着缩）", () => {
        const code = src("canvas/components/canvas/canvas-node.tsx");
        expect(code).not.toContain("renderPanel");
        expect(code).not.toContain("NodePanelHolder");
    });

    it("面板由画布页在屏幕层渲染（停靠在底部）", () => {
        const code = src("canvas/pages/canvas/project.tsx");
        expect(code).toContain("dockedPanelNode");
        expect(code).toContain("renderNodePanel(dockedPanelNode)");
    });
});
