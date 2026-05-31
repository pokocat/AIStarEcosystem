package com.aistareco.aep.aiavatar.dto;

import java.util.List;

/**
 * AiAvatar 轻量 UI 文案配置（落 PlatformConfig key=aiavatar.ui-config）。
 * 与前端 packages/types/src/ai-avatar.ts#AiAvatarUiConfig 字段一一对齐（camelCase 出 wire）。
 *
 * 运营在 web-aiavatar /config 编辑；创作者侧只读消费（草稿/精调快捷指令、默认人设、局部重绘默认词）。
 */
public record AiAvatarUiConfigDto(
        List<String> draftPresets,
        List<String> refinePresets,
        List<String> personaChips,
        String defaultPersona,
        String regionInpaintPrompt
) {
    /** 出厂默认（与前端 UI_CONFIG_DEFAULTS 一致）。 */
    public static AiAvatarUiConfigDto defaults() {
        return new AiAvatarUiConfigDto(
                List.of("瘦脸", "淡妆", "换职业装", "发型微卷", "更年轻"),
                List.of("表情更自然", "光影更柔和", "背景虚化", "气质更亲和"),
                List.of("圆脸", "温柔气质", "休闲职业装", "写实风格", "齐肩短发"),
                "25 岁女带货主播，圆脸，温柔气质，休闲职业装，写实风格",
                "服饰区域重绘"
        );
    }
}
