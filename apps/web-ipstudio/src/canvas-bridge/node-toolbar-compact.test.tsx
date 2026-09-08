// @vitest-environment jsdom
//
// 节点悬浮工具条是**固定屏幕尺寸**的（不随画布缩放），所以画布一缩小，
// 带文字的六个按钮就比节点本身宽好几倍、横跨半个画布 —— 读起来像个全局菜单，
// 看不出它属于哪个节点（v0.186 用户实测报的）。
//
// 这里测的是「窄到什么程度收起文字」这条真的接在组件上（v0.159/v0.160 的教训：
// 逻辑写对了但没人挂，编译器不会说话）。每个按钮本来就有 Tooltip + aria-label，
// 去掉文字不丢信息 —— 所以断言「文字没了、按钮还在」。
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { App } from "antd";

// 这个 jsdom 环境里的 localStorage 不是完整的 Storage（别的用例留下的桩），
// 而工具条挂载时会读一次「显示按钮文字」的偏好 —— 给它一份能用的。
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
import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "@/canvas/types/canvas";

const node: CanvasNodeData = {
    id: "n1",
    type: CanvasNodeType.Video,
    title: "开屏打招呼",
    position: { x: 0, y: 400 },
    width: 340,
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

function renderAt(k: number) {
    const viewport: ViewportTransform = { x: 0, y: 0, k };
    return render(
        <App>
            <CanvasNodeHoverToolbar node={node} viewport={viewport} {...(handlers as never)} />
        </App>,
    );
}

describe("节点工具条：缩小之后只留图标", () => {
    it("100% 时带文字", () => {
        const { container } = renderAt(1);
        expect(container.textContent).toContain("删除");
        expect(container.querySelectorAll("button").length).toBeGreaterThan(1);
    });

    it("缩到 30% 时文字收起，但按钮一个不少", () => {
        const wide = renderAt(1);
        const wideButtons = wide.container.querySelectorAll("button").length;
        wide.unmount();

        const { container } = renderAt(0.3);
        expect(container.textContent).not.toContain("删除");
        expect(container.querySelectorAll("button").length).toBe(wideButtons);
        // 文字没了，但每个按钮仍然自报家门（aria-label / Tooltip），信息不丢
        expect(container.querySelector('button[aria-label="移除节点"]')).not.toBeNull();
    });

    it("判据是**缩放比例**，不是节点宽度 —— 内置模板的节点只有 185 宽，按宽度判会把 100% 也误伤", () => {
        expect(renderAt(0.7).container.textContent).toContain("删除");
        expect(renderAt(0.69).container.textContent).not.toContain("删除");

        const narrow: CanvasNodeData = { ...node, width: 185 };
        const { container } = render(
            <App>
                <CanvasNodeHoverToolbar node={narrow} viewport={{ x: 0, y: 0, k: 1 }} {...(handlers as never)} />
            </App>,
        );
        expect(container.textContent).toContain("删除");
    });
});
