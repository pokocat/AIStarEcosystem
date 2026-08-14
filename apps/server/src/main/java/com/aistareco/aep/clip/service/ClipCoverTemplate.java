package com.aistareco.aep.clip.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 成片封面的「版式数据」。字号、锚点、颜色、描边、底衬全部是模板参数，
 * {@link ClipCoverRenderer} 只负责把这些参数画出来，不许在渲染代码里写死任何一处版式，
 * 这样加第二套模板只需要在 {@link #BUILT_IN} 里多注册一条记录。
 *
 * <p>坐标系固定为成片规格 720x1280，与 {@link ClipOverlayRenderer} 一致。
 */
public record ClipCoverTemplate(
        String id,
        String name,
        Scrim scrim,
        Slot keyword,
        Slot handle,
        Slot slogan,
        Slot signature
) {
    /** 槽位取哪一类字体；实际字体由 {@link ClipCoverRenderer} 按服务器可用字体解析。 */
    public enum FontRole { BRUSH, DISPLAY, SANS, SERIF }

    public enum Align { LEFT, CENTER, RIGHT }

    /** 文字描边。width<=0 表示不描边。 */
    public record Stroke(int argb, float width) {
        public static final Stroke NONE = new Stroke(0, 0);
        public boolean enabled() { return width > 0; }
    }

    /** 纵向线性渐变填充；null 表示用 {@link Slot#fillArgb} 纯色。 */
    public record Gradient(int fromArgb, int toArgb) {}

    /** 文字底衬色块（账号名标签的白底就是它）。null 表示不画底衬。 */
    public record Chip(int bgArgb, int padX, int padY, int radius) {}

    /** 上下两端的压暗层，保证任何底图上文字都可读；alpha 为 0 即等于关闭。 */
    public record Scrim(int topArgb, int topHeight, int bottomArgb, int bottomHeight) {
        public static final Scrim NONE = new Scrim(0, 0, 0, 0);
    }

    /**
     * 一个文本槽位。
     *
     * @param fontSize    基准字号；实测超过 maxWidth 时按 minFontSize 下限等比缩小
     * @param maxChars    入库前的硬截断字数，超出用省略号；防止用户把整段话塞进标语
     * @param anchorX     对齐锚点：LEFT 为左边缘，CENTER 为中线，RIGHT 为右边缘
     * @param anchorY     第一行的基线 y
     */
    public record Slot(
            String key, FontRole fontRole, int fontSize, int minFontSize,
            int maxLines, int maxChars, int maxWidth,
            int anchorX, int anchorY, int lineGap,
            Align align, int fillArgb, Gradient gradient, Stroke stroke, Chip chip,
            int letterSpacing
    ) {}

    /**
     * 主模板「为实体发声」——照参考图的四层结构：
     * 顶部 1/4 亮黄书法关键词 → 中下白底黑字账号名 → 居中白字黑描边两行标语 → 更大的金色渐变落款。
     */
    public static final ClipCoverTemplate ENTITY_VOICE = new ClipCoverTemplate(
            "cover_shiti",
            "为实体发声",
            new Scrim(0x46000000, 360, 0x66000000, 520),
            // 关键词：2 字亮黄书法，横跨顶部约 1/4（基线 288 ≈ 1280 的 22.5%）
            new Slot("keyword", FontRole.BRUSH, 268, 150, 1, 2, 640,
                    360, 288, 0, Align.CENTER, 0xFFFFE400, null,
                    new Stroke(0xB3241A00, 7f), null, 24),
            // 账号名：白底黑字标签，左对齐，中部偏下
            new Slot("handle", FontRole.SANS, 30, 22, 1, 20, 560,
                    56, 818, 0, Align.LEFT, 0xFF14110C, null,
                    Stroke.NONE, new Chip(0xFFFFFFFF, 20, 12, 8), 0),
            // 标语：白色粗体 + 黑描边，居中两行
            new Slot("slogan", FontRole.SANS, 58, 38, 2, 14, 620,
                    360, 936, 78, Align.CENTER, 0xFFFFFFFF, null,
                    new Stroke(0xFF000000, 8f), null, 2),
            // 落款：金色渐变粗体 + 深色描边，比标语更大
            new Slot("signature", FontRole.SANS, 76, 46, 1, 12, 640,
                    360, 1136, 0, Align.CENTER, 0xFFF6C544,
                    new Gradient(0xFFFFF0B4, 0xFFDF9A22),
                    new Stroke(0xFF2B1A03, 9f), null, 2)
    );

    /** id → 模板。加第二套模板在这里注册即可，渲染代码不用动。 */
    public static final Map<String, ClipCoverTemplate> BUILT_IN = builtIn();

    private static Map<String, ClipCoverTemplate> builtIn() {
        Map<String, ClipCoverTemplate> map = new LinkedHashMap<>();
        for (ClipCoverTemplate template : List.of(ENTITY_VOICE)) map.put(template.id(), template);
        return Map.copyOf(map);
    }

    /** 未知 id 一律回落主模板，不因为运营填错模板名就整张封面渲染失败。 */
    public static ClipCoverTemplate byId(String id) {
        if (id == null || id.isBlank()) return ENTITY_VOICE;
        return BUILT_IN.getOrDefault(id.trim(), ENTITY_VOICE);
    }

    public List<Slot> slots() { return List.of(keyword, handle, slogan, signature); }
}
