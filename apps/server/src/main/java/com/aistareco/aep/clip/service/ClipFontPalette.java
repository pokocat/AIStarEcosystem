package com.aistareco.aep.clip.service;

import java.awt.Font;
import java.awt.GraphicsEnvironment;
import java.util.List;
import java.util.Locale;

/**
 * 快出片文字烧录的系统中文字体解析，字幕/尾卡（{@link ClipOverlayRenderer}）与封面
 * （{@link ClipCoverRenderer}）共用同一套候选顺序 —— 避免两处各自维护一份字体名单后跑偏。
 *
 * <p>候选名单必须与 infra/scripts/install-cjk-fonts.sh 装的东西对得上：
 * 线上 ECS 由该脚本保证装到 Noto Sans/Serif CJK（或 WenQuanYi 兜底），开发机走 PingFang SC。
 * 一个都匹配不上时回落 JVM 逻辑字 SANS_SERIF，宁可字丑也不能抛异常。
 */
final class ClipFontPalette {
    private ClipFontPalette() {}

    /** 与 install-cjk-fonts.sh 的 CJK_FONT_RE 同源；顺序即优先级。 */
    private static final List<String> CANDIDATES =
            List.of("Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "STHeiti", "Arial Unicode MS");

    static String systemCjkFamily() {
        List<String> available = List.of(GraphicsEnvironment.getLocalGraphicsEnvironment()
                .getAvailableFontFamilyNames(Locale.CHINA));
        for (String candidate : CANDIDATES) {
            if (available.stream().anyMatch(name -> name.equalsIgnoreCase(candidate))) return candidate;
        }
        return Font.SANS_SERIF;
    }
}
