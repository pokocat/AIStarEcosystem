import type { CSSProperties } from "react";
import { Keyboard, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/canvas/lib/canvas-theme";
import { useConfigStore } from "@/canvas-bridge/config-store";
import { useThemeStore } from "@/canvas/stores/use-theme-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
    /** 插件市场已关（见下方注释），这个回调不再使用；保留字段是为了少动上游调用点。 */
    onOpenPlugins?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const { t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass = "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-black/5 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            {/* ── 本仓改动（v0.161）：上游这排图标里有一半在我们的产品里没有意义，逐个说明 ──
                · 插件（Puzzle）：插件市场已关（默认从 CDN 拉第三方代码进页面执行，
                  而我们的画布跑在登录态里，旁边就是钱包和资产），按钮留着只会点了没反应
                · 文档（BookOpen）：DOCS_URL 是空串，href="" 会重新加载当前页 —— 一个坏按钮
                · 语言（中/EN）：本仓中文单语（§4.6），切换函数已被硬写成 zh-CN，点了不会变
                · 主题（AnimatedThemeToggler）：主题由外层应用统一控制，画布单独一个深色开关
                  会和顶栏、资产页打架
                · 版本说明（VersionReleaseModal）：上游项目的版本日志
                · GitHub：直接指向 basketikun/infinite-canvas —— 我们的产品页面不该往那儿送人
                留下的两个是对用户真有用的：设置（画布偏好）与快捷键。
                改动集中在这一处、不动其它上游文件，日后跟上游 diff 时一眼能看出差异。 */}
            {showConfig ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label={t("navigation.config")} title={t("navigation.config")}>
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label={t("topNav.shortcuts")} title={t("topNav.shortcuts")}>
                    <Keyboard className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
