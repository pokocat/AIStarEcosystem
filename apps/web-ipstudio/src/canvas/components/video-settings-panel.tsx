import { useEffect, type ReactNode } from "react";
import { Slider } from "antd";
import { useTranslation } from "react-i18next";

import i18n from "@/canvas-bridge/i18n";
import { ImageSettingsTheme } from "@/canvas/components/image-settings-panel";
import { type CanvasTheme } from "@/canvas/lib/canvas-theme";
import { clampVideoSeconds, computeVideoSize, inferVideoRatio, parseVideoResolution, readVideoDimensions, VIDEO_SECONDS_MAX, VIDEO_SECONDS_MIN, videoRatioOptions } from "@/canvas/lib/media-size";
import { type AiConfig } from "@/canvas-bridge/config-store";
import { videoDurationBoundsFor } from "@/canvas-bridge/models";

const resolutionOptions = [
    { value: "480", label: "480p" },
    { value: "720", label: "720p" },
    { value: "1080", label: "1080p" },
];
const videoModeOptions = [
    { value: "frames", labelKey: "frames" },
    { value: "reference", labelKey: "reference" },
];

export const videoResolutionOptions = resolutionOptions.map((item) => ({ value: item.value, label: item.label }));
export const videoSizeOptions = videoRatioOptions.map((item) => ({ value: item.value, get label() { return item.value === "auto" ? i18n.t("settingsPanels.common.auto") : item.value; } }));
export const videoSecondsRange = { min: VIDEO_SECONDS_MIN, max: VIDEO_SECONDS_MAX };

/**
 * 这个配置下**真正会提交**的时长，以及它被夹在哪个区间里（本仓，v0.179）。
 *
 * 两件事必须由同一处算出来，否则「屏幕上显示的」和「送到服务端的」会不一样：
 *   · 区间来自**选中的那个模型**的能力（服务端 `/models` 给的协议边界 ∩ 后台配置）。
 *     取模型的顺序与提交时一致：`config.model` 优先 —— 它才是「节点上选的 > 全局默认」
 *     合并后的结果（`buildNodeConfig` / `buildGenerationConfig`），
 *     而 `videoModel` 永远是全局默认。此前这里读的是 `videoModel || model`，
 *     于是节点上换了模型，滑杆还按全局那个模型的区间夹。
 *   · 夹过之后必须**回写**到 config（见 VideoSettingsPanel 里的 effect）。
 *     v0.176 只夹了显示：旧节点存的 4 秒、切到最短 5 秒的模型后屏幕显示 5，
 *     提交仍然是 4 —— 服务端 400 `VIDEO_DURATION_UNSUPPORTED`，
 *     而用户明明看到的是 5。上限切换同理（显示 15、提交 30）。
 */
export function effectiveVideoSeconds(config: Pick<AiConfig, "videoSeconds" | "videoModel" | "model">) {
    const bounds = videoDurationBoundsFor(config.model || config.videoModel);
    const min = Math.max(VIDEO_SECONDS_MIN, bounds?.min ?? VIDEO_SECONDS_MIN);
    const max = Math.max(min, Math.min(VIDEO_SECONDS_MAX, bounds?.max ?? VIDEO_SECONDS_MAX));
    const seconds = Math.min(max, Math.max(min, Number(clampVideoSeconds(config.videoSeconds || "6"))));
    return { seconds, min, max };
}

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoMode", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const { t } = useTranslation();
    // 滑杆按**选中模型**能提交的区间来，不再固定 4–30（v0.176）；
    // 而且夹过之后要回写，别让显示与提交不一致（v0.179，见 effectiveVideoSeconds）。
    const { seconds, min: secMin, max: secMax } = effectiveVideoSeconds(config);
    useEffect(() => {
        // 只在真的不一致时写一次：这不是「悄悄改计费时长」—— 用户屏幕上看到的就是这个值，
        // 不回写才是悄悄的（看到 5 秒、提交 4 秒）。
        if (String(seconds) !== String(config.videoSeconds)) onConfigChange("videoSeconds", String(seconds));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seconds, config.videoSeconds]);
    const videoMode = normalizeVideoModeValue(config.videoMode);
    const resolution = parseVideoResolution(config.vquality);
    const selectedRatio = inferVideoRatio(config.size || "auto");
    const dimensions = readVideoDimensions(config.size || "auto", resolution, selectedRatio);
    const applySize = (nextResolution: string, ratio: string) => {
        onConfigChange("vquality", nextResolution);
        onConfigChange("size", computeVideoSize(nextResolution, ratio));
    };
    const selectResolution = (nextResolution: string) => {
        if (selectedRatio === "auto") onConfigChange("vquality", nextResolution);
        else applySize(nextResolution, selectedRatio);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{t("settingsPanels.video.title")}</div> : null}
                <SettingGroup title={t("settingsPanels.video.quality")} color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {resolutionOptions.map((item) => (
                            <OptionPill key={item.value} selected={resolution === item.value} theme={theme} onClick={() => selectResolution(item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                        <ResolutionInput value={resolution} theme={theme} onChange={selectResolution} />
                    </div>
                </SettingGroup>
                <SettingGroup title={t("settingsPanels.video.size")} color={theme.node.muted}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                        <DimensionInput prefix="W" value={dimensions.width} disabled={selectedRatio === "auto"} theme={theme} onChange={(value) => updateDimension("width", value, dimensions, onConfigChange)} />
                        <span className="text-lg opacity-45">↔</span>
                        <DimensionInput prefix="H" value={dimensions.height} disabled={selectedRatio === "auto"} theme={theme} onChange={(value) => updateDimension("height", value, dimensions, onConfigChange)} />
                    </div>
                </SettingGroup>
                <SettingGroup title={t("settingsPanels.video.ratio")} color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {videoRatioOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-transparent text-sm transition hover:opacity-80"
                                style={{ borderColor: selectedRatio === item.value ? theme.node.text : theme.node.stroke, color: theme.node.text }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => applySize(resolution, item.value)}
                            >
                                <SizePreview width={item.width} height={item.height} color={theme.node.text} />
                                <span>{item.value === "auto" ? t("settingsPanels.common.auto") : item.value}</span>
                            </button>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title={t("settingsPanels.video.seconds")} color={theme.node.muted}>
                    <div className="flex items-center gap-3" onMouseDown={(event) => event.stopPropagation()}>
                        <Slider className="min-w-0 flex-1" min={secMin} max={secMax} step={1} value={seconds} onChange={(value) => onConfigChange("videoSeconds", String(Array.isArray(value) ? value[0] : value))} />
                        <SecondsInput value={seconds} min={secMin} max={secMax} theme={theme} onCommit={(value) => onConfigChange("videoSeconds", String(value))} />
                        <span className="shrink-0 text-sm" style={{ color: theme.node.muted }}>s</span>
                    </div>
                </SettingGroup>
                <SettingGroup title={t("settingsPanels.video.mode")} color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-2.5">
                        {videoModeOptions.map((item) => (
                            <OptionPill key={item.value} selected={videoMode === item.value} theme={theme} onClick={() => onConfigChange("videoMode", item.value)}>
                                {t(`settingsPanels.video.modes.${item.labelKey}`)}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(value: string) {
    return `${parseVideoResolution(value)}p`;
}

export function videoSizeLabel(value: string) {
    const ratio = inferVideoRatio(value);
    return ratio === "auto" ? i18n.t("settingsPanels.video.adaptive") : ratio;
}

export function videoSecondsLabel(value: string) {
    if (String(value).trim() === "-1") return i18n.t("settingsPanels.video.smart");
    return `${value || "6"}s`;
}

export function videoModeLabel(value: string) {
    return i18n.t(`settingsPanels.video.modes.${normalizeVideoModeValue(value)}`);
}

export function normalizeVideoModeValue(value: string | undefined) {
    return value === "reference" ? "reference" : "frames";
}

export function normalizeVideoSizeValue(value: string, resolution = "720") {
    if (value === "auto") return "auto";
    if (/^\d+x\d+$/.test(value || "")) return value;
    const ratio = inferVideoRatio(value);
    return ratio === "auto" ? "auto" : computeVideoSize(resolution, ratio);
}

export function normalizeVideoResolutionValue(value: string) {
    return parseVideoResolution(value);
}

function updateDimension(key: "width" | "height", value: number | null, dimensions: { width: number; height: number }, onConfigChange: VideoSettingsPanelProps["onConfigChange"]) {
    const next = Math.max(1, Math.floor(value || dimensions[key] || 720));
    onConfigChange("size", `${key === "width" ? next : dimensions.width}x${key === "height" ? next : dimensions.height}`);
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" disabled={disabled} className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function ResolutionInput({ value, theme, onChange }: { value: string; theme: CanvasTheme; onChange: (value: string) => void }) {
    return (
        <label className="flex h-9 overflow-hidden rounded-full border text-sm" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
            <input type="number" min={1} className="min-w-0 flex-1 bg-transparent px-3 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value} onChange={(event) => onChange(event.target.value)} onMouseDown={(event) => event.stopPropagation()} />
            <span className="grid w-7 place-items-center pr-1" style={{ color: theme.node.muted }}>
                p
            </span>
        </label>
    );
}

function SecondsInput({ value, min = VIDEO_SECONDS_MIN, max = VIDEO_SECONDS_MAX, theme, onCommit }: { value: number; min?: number; max?: number; theme: CanvasTheme; onCommit: (value: number) => void }) {
    const commit = (input: HTMLInputElement) => {
        // 手输的值也要夹到选中模型能提交的区间里 —— 只夹滑杆不夹输入框，
        // 用户照样能打一个服务端会拒的数字（v0.176）
        const next = Math.min(max, Math.max(min, Number(clampVideoSeconds(input.value))));
        input.value = String(next);
        onCommit(next);
    };

    return (
        <label className="flex h-9 w-[68px] shrink-0 overflow-hidden rounded-xl text-sm" style={{ background: theme.node.fill, color: theme.node.text }}>
            <input
                type="number"
                min={min}
                max={max}
                className="min-w-0 flex-1 bg-transparent px-2 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                defaultValue={value}
                key={value}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function DimensionInput({ prefix, value, disabled, theme, onChange }: { prefix: string; value: number; disabled: boolean; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    return (
        <label className="flex h-9 overflow-hidden rounded-xl text-sm" style={{ background: theme.node.fill, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}>
            <span className="grid w-9 place-items-center" style={{ color: theme.node.muted }}>
                {prefix}
            </span>
            <input type="number" min={1} disabled={disabled} className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || null)} onMouseDown={(event) => event.stopPropagation()} />
        </label>
    );
}

function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const longSide = Math.max(width, height);
    const previewWidth = Math.max(10, Math.round((width / longSide) * 26));
    const previewHeight = Math.max(10, Math.round((height / longSide) * 26));
    return <span className="rounded-[3px] border-2" style={{ width: previewWidth, height: previewHeight, borderColor: color }} />;
}
