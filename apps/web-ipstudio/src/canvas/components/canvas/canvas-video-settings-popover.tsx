import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";

import { effectiveVideoGeometry, effectiveVideoSeconds, VideoSettingsPanel, videoModeLabel, videoResolutionLabel, videoSecondsLabel, videoSizeLabel } from "@/canvas/components/video-settings-panel";
import { canvasThemes } from "@/canvas/lib/canvas-theme";
import { useThemeStore } from "@/canvas/stores/use-theme-store";
import type { AiConfig } from "@/canvas-bridge/config-store";

type CanvasVideoSettingsPopoverProps = {
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    buttonClassName?: string;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
};

export function CanvasVideoSettingsPopover({ config, onConfigChange, buttonClassName, placement = "topLeft" }: CanvasVideoSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!open) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
        };
    }, [open]);

    const panel = open && buttonRect ? <VideoSettingsPortal buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} config={config} onConfigChange={onConfigChange} /> : null;

    // 收起来的这行显示的是**存着的那个值**，也就是现在点发送真会送出去的时长（v0.179）。
    //
    // 别显示夹过的「有效值」：夹 + 回写只发生在**面板打开**的时候（effect 在 VideoSettingsPanel 里），
    // 没打开过的节点存的还是换模型之前那个数。显示 5 而提交 4，等于这行在骗人 ——
    // 而提交那头会如实拒绝（「这个模型只接 5–15 秒，当前是 4 秒」），两边就对不上了。
    //
    // 超出区间时加一个记号 + 悬浮说明：如实告诉用户「这样发会被拒，点开改一下」，
    // 而不是替他把计费时长改掉。
    const effective = effectiveVideoSeconds(config);
    const storedSeconds = String(config.videoSeconds || "6");
    const outOfRange = String(effective.seconds) !== storedSeconds;
    const summary = `${videoResolutionLabel(config.vquality)} · ${videoSizeLabel(config.size)} · ${videoSecondsLabel(storedSeconds)} · ${videoModeLabel(config.videoMode)}`;

    // 画幅跟时长不一样：超区间的时长会被服务端**拒**，而选不了的画幅会被**悄悄换掉**
    // —— 用户选 720p·3:4，聚算按 768p·portrait 出，回来 768×1376，没有任何地方报错（v0.184）。
    // 面板打开时会夹 + 回写，但没打开过的节点存的还是老值，所以这行得如实说会出成什么样。
    const geometry = effectiveVideoGeometry(config);
    const geometryMismatch =
        geometry.constrained &&
        (videoResolutionLabel(config.vquality) !== `${geometry.resolution}p` || videoSizeLabel(config.size) !== geometry.ratio);

    const hint = outOfRange
        ? `${summary}（这个模型只接 ${effective.min}–${effective.max} 秒，现在这样发会被拒 —— 点开改一下）`
        : geometryMismatch
            ? `${summary}（这个模型只出 ${geometry.resolution}p，实际会按 ${geometry.ratio} 出 —— 点开改一下）`
            : summary;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" title={hint} className={buttonClassName || "!h-8 !max-w-[220px] !justify-start !rounded-full !px-2.5"} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} onClick={() => setOpen((current) => !current)}>
                    <span className="truncate">
                        {summary}
                        {outOfRange || geometryMismatch ? <span style={{ color: theme.node.muted }}> ⚠</span> : null}
                    </span>
                </Button>
            </span>
            {panel}
        </>
    );
}

function VideoSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    config,
    onConfigChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasVideoSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
}) {
    const width = 356;
    const gap = 8;
    const margin = 12;
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    const topPlacement = placement?.startsWith("top");
    const style = {
        position: "fixed",
        zIndex: 1200,
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
        ...(topPlacement ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(260, buttonRect.top - margin * 2) } : { top: buttonRect.bottom + gap, maxHeight: Math.max(260, window.innerHeight - buttonRect.bottom - margin * 2) }),
        background: theme.toolbar.panel,
        borderRadius: 18,
        boxShadow: "0 18px 54px rgba(28, 25, 23, 0.16)",
        padding: 18,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            className="canvas-image-settings-popover"
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <VideoSettingsPanel config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} className="space-y-4" />
        </div>,
        document.body,
    );
}
