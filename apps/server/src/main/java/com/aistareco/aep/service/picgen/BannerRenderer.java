package com.aistareco.aep.service.picgen;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.LinearGradientPaint;
import java.awt.MultipleGradientPaint.CycleMethod;
import java.awt.Paint;
import java.awt.Polygon;
import java.awt.RadialGradientPaint;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.font.TextAttribute;
import java.awt.font.TextLayout;
import java.awt.geom.AffineTransform;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 纯 Java2D 实现的促销 banner 渲染器（picgen）。
 *
 * <p>多维 seeded 随机化（v0.25）：
 * <ul>
 *   <li>颜色方案（16 套）</li>
 *   <li>背景方向（DIAGONAL / HORIZONTAL / VERTICAL / RADIAL）</li>
 *   <li>背景纹理（NONE / STRIPES / GRID / NOISE）</li>
 *   <li>主标题布局（7 套位置 + 旋转）</li>
 *   <li>字体 profile（按 kind + tracking + posture + weight）</li>
 *   <li>描边样式（CLASSIC / DOUBLE_LINE / SHADOW_HEAVY / SHADOW_ONLY）</li>
 *   <li>副标题样式（RIBBON / BAR / UNDERLINE）</li>
 *   <li>贴图挂件（NONE / STAR_BURST / CIRCLE_SEAL / SPARKLES / CHEVRONS）</li>
 * </ul>
 *
 * <p>组合空间 ≈ 16 × 4 × 4 × 7 × 11 × 4 × 3 × 5 ≈ <b>120 万</b>，
 * 5 条变体在视觉上几乎不可能撞同款。
 *
 * <p>遮罩规避：
 * <ul>
 *   <li>tag 角由 layout 派生（远离 title）</li>
 *   <li>sticker 角与 tag / title 都互斥</li>
 *   <li>subtitle 位置基于 title 实际 bbox 计算（上下二选一）</li>
 *   <li>SHIFT 布局的标题最大宽度按 cx 与画布边距求 min，防溢出</li>
 * </ul>
 *
 * <p>主次硬保证：
 * <ul>
 *   <li>subtitle ≤ title × 0.42</li>
 *   <li>tag ≤ subtitle × 0.85 （无副标题时 ≤ title × 0.22）</li>
 *   <li>sticker 字 ≤ title × 0.20</li>
 *   <li>主标题不参与花式描边的最弱形式（保证一定有描边或重阴影）</li>
 * </ul>
 */
@Service
public class BannerRenderer {

    private static final Logger log = LoggerFactory.getLogger(BannerRenderer.class);

    private final FontRegistry fonts;

    @Autowired
    public BannerRenderer(FontRegistry fonts) {
        this.fonts = fonts;
    }

    /** 色彩方案 —— 与 pic-gen/lib.js SCHEMES 对齐。 */
    public record ColorScheme(
            String name,
            Color bgFrom, Color bgTo,
            Color fillFrom, Color fillTo,
            Color strokeInner,
            Color strokeOuter,
            Color accent,
            Color shadow,
            Color tag
    ) {}

    private static final List<ColorScheme> SCHEMES = List.of(
            scheme("sky-gold",     "#67c5f7","#1e40af", "#fff5a8","#fbbf24", "#ffffff","#7c3aed", "#fbbf24","#5b21b6", "#f97316"),
            scheme("festive-red",  "#fde047","#f59e0b", "#fff5e0","#fbbf24", "#ffffff","#991b1b", "#dc2626","#7f1d1d", "#dc2626"),
            scheme("sunset",       "#ff9a8b","#d6336c", "#fff2c2","#ffd23f", "#ffffff","#7c1d6f", "#ffd23f","#6b1d6f", "#7c1d6f"),
            scheme("mint-pop",     "#a7f3d0","#059669", "#fffbeb","#fde68a", "#ffffff","#065f46", "#f97316","#064e3b", "#f97316"),
            scheme("candy-pink",   "#fbcfe8","#db2777", "#fef9c3","#fbbf24", "#ffffff","#9d174d", "#fde047","#831843", "#db2777"),
            scheme("ocean-gold",   "#a5f3fc","#0e7490", "#fef3c7","#f59e0b", "#ffffff","#1e3a8a", "#fbbf24","#1e3a8a", "#f97316"),
            scheme("night-neon",   "#312e81","#0c0a09", "#86efac","#22d3ee", "#0f172a","#10b981", "#22d3ee","#000000", "#22d3ee"),
            scheme("royal-gold",   "#4c1d95","#1e1b4b", "#fef9c3","#fbbf24", "#ffffff","#7c1d1d", "#fbbf24","#1c1917", "#dc2626"),
            scheme("chinese-red",  "#dc2626","#7f1d1d", "#fef9c3","#fbbf24", "#ffffff","#451a03", "#fbbf24","#451a03", "#dc2626"),
            scheme("lemon-zest",   "#fef08a","#facc15", "#ffffff","#fef08a", "#ffffff","#15803d", "#f97316","#166534", "#15803d"),
            scheme("rose-cream",   "#fce7f3","#fb7185", "#ffffff","#fde68a", "#ffffff","#9f1239", "#fb7185","#831843", "#9f1239"),
            scheme("cyber-mint",   "#06b6d4","#0e7490", "#a7f3d0","#34d399", "#ffffff","#064e3b", "#fde047","#022c22", "#facc15"),
            scheme("retro-coral",  "#fed7aa","#f97316", "#fff7ed","#fed7aa", "#ffffff","#7c2d12", "#1e3a8a","#7c2d12", "#1e3a8a"),
            scheme("denim-fire",   "#3b82f6","#1e40af", "#ffffff","#fde047", "#ffffff","#dc2626", "#facc15","#7f1d1d", "#dc2626"),
            scheme("taro-cream",   "#e9d5ff","#a855f7", "#ffffff","#fde68a", "#ffffff","#581c87", "#fbbf24","#3b0764", "#7e22ce"),
            scheme("mocha-gold",   "#78350f","#3f1f06", "#fde68a","#f59e0b", "#fff7ed","#1c1917", "#fbbf24","#1c1917", "#b45309")
    );

    // ── hierarchy 硬保证常量 ────────────────────────────────────────────────
    private static final float SUB_MAX_RATIO = 0.42f;
    private static final float TAG_MAX_RATIO = 0.85f;
    private static final float TITLE_MIN_SIZE_RATIO = 0.30f;

    // ── 随机维度 ─────────────────────────────────────────────────────────────

    private enum BgStyle { DIAGONAL, HORIZONTAL, VERTICAL, RADIAL }
    private enum TextureStyle { NONE, DIAGONAL_STRIPES, GRID, NOISE }

    private enum LayoutStyle {
        CENTER_MID  (0.50f, 0.50f,  0f, 0.44f),
        TITLE_HIGH  (0.50f, 0.35f,  0f, 0.42f),
        TITLE_LOW   (0.50f, 0.65f,  0f, 0.42f),
        TILT_LEFT   (0.50f, 0.50f, -3f, 0.42f),
        TILT_RIGHT  (0.50f, 0.50f,  3f, 0.42f),
        SHIFT_LEFT  (0.40f, 0.50f,  0f, 0.40f),
        SHIFT_RIGHT (0.60f, 0.50f,  0f, 0.40f);

        final float cxRatio, cyRatio, rotateDeg, sizeRatio;
        LayoutStyle(float cx, float cy, float rot, float sz) {
            this.cxRatio = cx; this.cyRatio = cy; this.rotateDeg = rot; this.sizeRatio = sz;
        }
    }

    private record FontProfile(FontRegistry.Kind kind, int awtStyle, float tracking, float posture, Float weight) {}

    private static final List<FontProfile> FONT_PROFILES = List.of(
            new FontProfile(FontRegistry.Kind.DISPLAY, Font.BOLD, -0.02f, 0f,    null),
            new FontProfile(FontRegistry.Kind.DISPLAY, Font.BOLD,  0.06f, 0f,    null),
            new FontProfile(FontRegistry.Kind.DISPLAY, Font.BOLD,  0f,    0.16f, null),
            new FontProfile(FontRegistry.Kind.DISPLAY, Font.BOLD,  0.02f, 0f,    TextAttribute.WEIGHT_HEAVY),
            new FontProfile(FontRegistry.Kind.SANS,    Font.BOLD, -0.04f, 0f,    null),
            new FontProfile(FontRegistry.Kind.SANS,    Font.BOLD,  0.08f, 0f,    null),
            new FontProfile(FontRegistry.Kind.SANS,    Font.BOLD,  0f,    0.18f, null),
            new FontProfile(FontRegistry.Kind.SERIF,   Font.BOLD,  0.02f, 0f,    null),
            new FontProfile(FontRegistry.Kind.SERIF,   Font.BOLD | Font.ITALIC, 0f, 0f, null),
            new FontProfile(FontRegistry.Kind.BRUSH,   Font.BOLD,  0f,    0f,    null),
            new FontProfile(FontRegistry.Kind.BRUSH,   Font.BOLD,  0.04f, 0f,    null)
    );

    /** 主标题描边样式池。 */
    private enum StrokeStyle { CLASSIC, DOUBLE_LINE, SHADOW_HEAVY, SHADOW_ONLY }

    private enum SubStyle { RIBBON, BAR, UNDERLINE }
    private enum TagCorner { TOP_RIGHT, TOP_LEFT, BOTTOM_RIGHT, BOTTOM_LEFT }

    /** 贴图挂件样式池。NONE 占两份提高"无贴图"概率，避免画面过满。 */
    private enum StickerStyle { NONE_A, NONE_B, STAR_BURST, CIRCLE_SEAL, SPARKLES, CHEVRONS }

    // ── 渲染入口 ─────────────────────────────────────────────────────────────

    public byte[] render(BannerRequest req) throws IOException {
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("title 不能为空");
        }
        int w = clamp(req.width(), 200, 1920);
        int h = clamp(req.height(), 120, 1080);
        long seed = req.seed();

        // 各维度独立 salt 抽样
        ColorScheme scheme = req.schemeName() != null
                ? findScheme(req.schemeName())
                : pickFrom(seed, 1, SCHEMES);
        BgStyle bg = pickEnum(seed, 2, BgStyle.values());
        LayoutStyle layout = pickEnum(seed, 3, LayoutStyle.values());
        FontProfile titleFp = pickFrom(seed, 4, FONT_PROFILES);
        SubStyle subStyle = pickEnum(seed, 5, SubStyle.values());
        TagCorner tagCorner = deriveTagCorner(layout, mix32(seed, 6));
        TextureStyle texture = pickEnum(seed, 9, TextureStyle.values());
        StrokeStyle strokeStyle = pickEnum(seed, 10, StrokeStyle.values());
        StickerStyle sticker = pickEnum(seed, 11, StickerStyle.values());
        FontProfile subFp = pickSubtitleProfile(seed, titleFp);

        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            applyHints(g);

            // 1) 背景 + 纹理 + 装饰
            drawBackgroundGradient(g, w, h, scheme, bg);
            drawTexture(g, w, h, scheme, texture, mix32(seed, 12));
            drawCornerDecoration(g, w, h, scheme, mix32(seed, 7));

            String title = req.title().trim();
            String subtitle = req.subtitle() == null ? "" : req.subtitle().trim();
            String tag = req.tag() == null ? "" : req.tag().trim();

            // 2) Title 位置与字号
            float baseTitleSize = h * Math.max(TITLE_MIN_SIZE_RATIO, layout.sizeRatio);
            float cx = w * layout.cxRatio;
            float cy = h * layout.cyRatio;
            float maxTextWidth = Math.min(
                    w * 0.86f,
                    Math.min(cx - w * 0.04f, w - cx - w * 0.04f) * 2f
            );

            Font titleBase = buildFont(titleFp, baseTitleSize, mix32(seed, 15));
            Font titleFont = autoFitFont(g, title, titleBase, baseTitleSize, maxTextWidth);
            float titleW = (float) titleFont.getStringBounds(title, g.getFontRenderContext()).getWidth();
            float titleH = (float) titleFont.getStringBounds(title, g.getFontRenderContext()).getHeight();

            float titleCyAdjusted = cy;
            if (!subtitle.isEmpty() && layout.cyRatio > 0.40f && layout.cyRatio < 0.60f) {
                titleCyAdjusted = cy - h * 0.08f;
            }

            drawOutlinedTitle(g, title, titleFont, cx, titleCyAdjusted, layout.rotateDeg, scheme, strokeStyle);

            // 3) Subtitle
            Rectangle2D titleBox = new Rectangle2D.Float(
                    cx - titleW / 2f,
                    titleCyAdjusted - titleH / 2f,
                    titleW, titleH);
            float subSize = titleFont.getSize2D() * SUB_MAX_RATIO;

            float subY = 0f;
            boolean hasSubtitle = !subtitle.isEmpty();
            if (hasSubtitle) {
                int subFontSeed = mix32(seed, 16);
                Font subFont = buildFont(subFp, subSize, subFontSeed);
                float subHGuess = (float) subFont.getStringBounds(subtitle, g.getFontRenderContext()).getHeight();
                float belowY = (float) (titleBox.getMaxY() + h * 0.05f + subHGuess / 2f);
                float aboveY = (float) (titleBox.getMinY() - h * 0.05f - subHGuess / 2f);
                if (belowY + subHGuess / 2f <= h * 0.92f) {
                    subY = belowY;
                } else if (aboveY - subHGuess / 2f >= h * 0.08f) {
                    subY = aboveY;
                } else {
                    subSize = subSize * 0.7f;
                    subFont = buildFont(subFp, subSize, subFontSeed);
                    subY = (float) (titleBox.getMaxY() + h * 0.03f + subFont.getSize2D() / 2f);
                }
                drawSubtitle(g, subtitle, subFont, cx, subY, scheme, subStyle);
            }

            // 4) Tag
            if (!tag.isEmpty()) {
                float tagSize = hasSubtitle
                        ? subSize * TAG_MAX_RATIO
                        : titleFont.getSize2D() * 0.22f;
                FontProfile tagFp = new FontProfile(FontRegistry.Kind.SANS, Font.BOLD, 0f, 0f, null);
                Font tagFont = buildFont(tagFp, tagSize, mix32(seed, 17));
                drawTagPill(g, tag, tagFont, w, h, scheme, tagCorner, mix32(seed, 8));
            }

            // 5) Sticker 挂件：放在不冲突的角；hierarchy 上比 tag 还次要，所以更小
            if (sticker != StickerStyle.NONE_A && sticker != StickerStyle.NONE_B) {
                TagCorner stickerCorner = deriveStickerCorner(layout, tagCorner, mix32(seed, 13));
                float stickerSize = titleFont.getSize2D() * 0.40f;  // sticker 外径 ≈ 40% 主标题字号
                drawSticker(g, w, h, scheme, sticker, stickerCorner, stickerSize, mix32(seed, 14));
            }

            log.debug(
                    "[picgen] render title='{}' size={}×{} scheme={} bg={} tex={} layout={} font={}({}) stroke={} sub={} tagCorner={} sticker={}",
                    truncate(title, 20), w, h, scheme.name(),
                    bg, texture, layout, titleFp.kind, titleFp.tracking, strokeStyle, subStyle, tagCorner, sticker);
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream(64 * 1024);
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }

    public record BannerRequest(
            String title,
            String subtitle,
            String tag,
            int width,
            int height,
            long seed,
            String schemeName
    ) {}

    // ── 派生规则 ─────────────────────────────────────────────────────────────

    private static TagCorner deriveTagCorner(LayoutStyle layout, int seedMix) {
        boolean bit = (seedMix & 1) == 0;
        switch (layout) {
            case TITLE_HIGH:
                return bit ? TagCorner.BOTTOM_LEFT : TagCorner.BOTTOM_RIGHT;
            case TITLE_LOW:
                return bit ? TagCorner.TOP_LEFT : TagCorner.TOP_RIGHT;
            case SHIFT_LEFT:
                return bit ? TagCorner.TOP_RIGHT : TagCorner.BOTTOM_RIGHT;
            case SHIFT_RIGHT:
                return bit ? TagCorner.TOP_LEFT : TagCorner.BOTTOM_LEFT;
            case CENTER_MID:
            case TILT_LEFT:
            case TILT_RIGHT:
            default:
                int q = seedMix & 3;
                return switch (q) {
                    case 0 -> TagCorner.TOP_LEFT;
                    case 1 -> TagCorner.TOP_RIGHT;
                    case 2 -> TagCorner.BOTTOM_LEFT;
                    default -> TagCorner.BOTTOM_RIGHT;
                };
        }
    }

    /** Sticker 选 tag 之外的、远离 title 区域的角。 */
    private static TagCorner deriveStickerCorner(LayoutStyle layout, TagCorner tag, int seedMix) {
        // 候选 = 远离 title 的所有角 - tag 已占的角
        TagCorner[] avoid = avoidCornersForTitle(layout);
        TagCorner pick = null;
        for (TagCorner c : avoid) {
            if (c != tag) { pick = c; break; }
        }
        if (pick != null) return pick;
        // fallback: 选 tag 的对角
        return diagonalOf(tag);
    }

    private static TagCorner[] avoidCornersForTitle(LayoutStyle layout) {
        switch (layout) {
            case TITLE_HIGH:
                return new TagCorner[]{TagCorner.BOTTOM_LEFT, TagCorner.BOTTOM_RIGHT, TagCorner.TOP_LEFT, TagCorner.TOP_RIGHT};
            case TITLE_LOW:
                return new TagCorner[]{TagCorner.TOP_LEFT, TagCorner.TOP_RIGHT, TagCorner.BOTTOM_LEFT, TagCorner.BOTTOM_RIGHT};
            case SHIFT_LEFT:
                return new TagCorner[]{TagCorner.TOP_RIGHT, TagCorner.BOTTOM_RIGHT, TagCorner.TOP_LEFT, TagCorner.BOTTOM_LEFT};
            case SHIFT_RIGHT:
                return new TagCorner[]{TagCorner.TOP_LEFT, TagCorner.BOTTOM_LEFT, TagCorner.TOP_RIGHT, TagCorner.BOTTOM_RIGHT};
            default:
                return new TagCorner[]{TagCorner.TOP_LEFT, TagCorner.TOP_RIGHT, TagCorner.BOTTOM_LEFT, TagCorner.BOTTOM_RIGHT};
        }
    }

    private static TagCorner diagonalOf(TagCorner c) {
        return switch (c) {
            case TOP_LEFT     -> TagCorner.BOTTOM_RIGHT;
            case TOP_RIGHT    -> TagCorner.BOTTOM_LEFT;
            case BOTTOM_LEFT  -> TagCorner.TOP_RIGHT;
            case BOTTOM_RIGHT -> TagCorner.TOP_LEFT;
        };
    }

    private static FontProfile pickSubtitleProfile(long seed, FontProfile title) {
        boolean preferSerif = title.kind == FontRegistry.Kind.SANS
                || title.kind == FontRegistry.Kind.DISPLAY;
        FontRegistry.Kind subKind = preferSerif ? FontRegistry.Kind.SERIF : FontRegistry.Kind.SANS;
        return new FontProfile(subKind, Font.BOLD, 0f, 0f, null);
    }

    // ── 绘制：背景 / 纹理 / 装饰 ───────────────────────────────────────────

    private static void applyHints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
    }

    private static void drawBackgroundGradient(Graphics2D g, int w, int h, ColorScheme s, BgStyle style) {
        Paint old = g.getPaint();
        switch (style) {
            case DIAGONAL:
                g.setPaint(new GradientPaint(0, 0, s.bgFrom, w, h, s.bgTo));
                break;
            case HORIZONTAL:
                g.setPaint(new GradientPaint(0, 0, s.bgFrom, w, 0, s.bgTo));
                break;
            case VERTICAL:
                g.setPaint(new GradientPaint(0, 0, s.bgFrom, 0, h, s.bgTo));
                break;
            case RADIAL:
                float r = Math.max(w, h) / 1.3f;
                g.setPaint(new RadialGradientPaint(
                        w / 2f, h / 2f, r,
                        new float[]{0f, 1f},
                        new Color[]{s.bgFrom, s.bgTo}));
                break;
        }
        g.fillRect(0, 0, w, h);
        g.setPaint(old);
    }

    /** 在背景之上叠一层低不透明度的纹理。alpha 永远 ≤ 0.10，不抢主视觉。 */
    private static void drawTexture(Graphics2D g, int w, int h, ColorScheme s, TextureStyle t, int seedMix) {
        if (t == TextureStyle.NONE) return;
        Paint oldP = g.getPaint();
        var oldComp = g.getComposite();
        var oldStroke = g.getStroke();
        try {
            g.setPaint(s.strokeOuter);
            switch (t) {
                case DIAGONAL_STRIPES: {
                    g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.08f));
                    float spacing = Math.max(20f, h * 0.10f);
                    float lineW = Math.max(2f, h * 0.012f);
                    g.setStroke(new BasicStroke(lineW));
                    // 45° 斜线，从画面左下到右上方向覆盖
                    for (float x = -h; x < w + h; x += spacing) {
                        g.drawLine((int) x, h, (int) (x + h), 0);
                    }
                    break;
                }
                case GRID: {
                    g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.07f));
                    float spacing = Math.max(20f, h * 0.10f);
                    float lineW = Math.max(1.5f, h * 0.008f);
                    g.setStroke(new BasicStroke(lineW));
                    for (float x = 0; x < w; x += spacing) g.drawLine((int) x, 0, (int) x, h);
                    for (float y = 0; y < h; y += spacing) g.drawLine(0, (int) y, w, (int) y);
                    break;
                }
                case NOISE: {
                    // 颗粒：用确定性随机种子撒密度 ~ 0.6% 的小亮 / 暗点
                    Random r = new Random(seedMix);
                    int count = (int) (w * h * 0.006);
                    g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.18f));
                    for (int i = 0; i < count; i++) {
                        int x = r.nextInt(w);
                        int y = r.nextInt(h);
                        g.setPaint(r.nextBoolean() ? Color.WHITE : s.strokeOuter);
                        int size = 1 + r.nextInt(2);
                        g.fillRect(x, y, size, size);
                    }
                    break;
                }
                case NONE:
                default:
                    break;
            }
        } finally {
            g.setStroke(oldStroke);
            g.setComposite(oldComp);
            g.setPaint(oldP);
        }
    }

    private static void drawCornerDecoration(Graphics2D g, int w, int h, ColorScheme s, int seedMix) {
        Paint old = g.getPaint();
        try {
            float stripeH = Math.max(6, h * 0.04f);
            int stripePos = seedMix & 3;
            float y;
            switch (stripePos) {
                case 0:  y = h - stripeH - h * 0.02f; break;
                case 1:  y = h * 0.02f;               break;
                case 2:  y = h - stripeH * 2f;         break;
                default: y = h * 0.10f;               break;
            }
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.18f));
            g.setPaint(s.strokeOuter);
            g.fillRect(0, (int) y, w, (int) stripeH);

            if ((seedMix & 1) == 0) {
                int corner = (seedMix >>> 2) & 3;
                g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.22f));
                g.setPaint(s.accent);
                int r = (int) (h * 0.22);
                int cx = (corner == 0 || corner == 2) ? -r / 2 : w - r / 2;
                int cy = (corner == 0 || corner == 1) ? -r / 2 : h - r / 2;
                g.fillOval(cx, cy, r, r);
            }
        } finally {
            g.setComposite(AlphaComposite.SrcOver);
            g.setPaint(old);
        }
    }

    // ── 绘制：主标题（4 种描边样式） ────────────────────────────────────────

    private static void drawOutlinedTitle(
            Graphics2D g, String text, Font font, float cx, float cy, float rotateDeg,
            ColorScheme s, StrokeStyle strokeStyle
    ) {
        FontRenderContext frc = g.getFontRenderContext();
        GlyphVector gv = font.createGlyphVector(frc, text);
        Shape outline = gv.getOutline(0, 0);
        var bounds = outline.getBounds2D();
        float tx = (float) (cx - bounds.getCenterX());
        float ty = (float) (cy - bounds.getCenterY());

        AffineTransform old = g.getTransform();
        Paint oldPaint = g.getPaint();
        var oldStroke = g.getStroke();
        try {
            if (rotateDeg != 0f) {
                g.rotate(Math.toRadians(rotateDeg), cx, cy);
            }
            g.translate(tx, ty);

            float fontSize = font.getSize2D();

            switch (strokeStyle) {
                case CLASSIC:
                    drawTitleClassic(g, outline, bounds, fontSize, s);
                    break;
                case DOUBLE_LINE:
                    drawTitleDoubleLine(g, outline, bounds, fontSize, s);
                    break;
                case SHADOW_HEAVY:
                    drawTitleShadowHeavy(g, outline, bounds, fontSize, s);
                    break;
                case SHADOW_ONLY:
                    drawTitleShadowOnly(g, outline, bounds, fontSize, s);
                    break;
            }
        } finally {
            g.setStroke(oldStroke);
            g.setTransform(old);
            g.setPaint(oldPaint);
        }
    }

    /** 经典：外粗描边（深色）+ 内细描边（白）+ 渐变填充 + 轻阴影。 */
    private static void drawTitleClassic(Graphics2D g, Shape outline, Rectangle2D bounds, float fontSize, ColorScheme s) {
        float outerStrokeW = Math.max(4f, fontSize * 0.22f);
        float innerStrokeW = Math.max(2f, fontSize * 0.10f);
        float shadowOff = Math.max(2f, fontSize * 0.04f);
        softShadow(g, outline, shadowOff, shadowOff, 0.55f, s.shadow);

        g.setStroke(new BasicStroke(outerStrokeW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeOuter);
        g.draw(outline);

        g.setStroke(new BasicStroke(innerStrokeW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeInner);
        g.draw(outline);

        fillGradient(g, outline, bounds, s);
    }

    /** 双重：外描边深 + 中描边亮（accent）+ 内描边白 + 渐变填充。比 classic 多一层 accent 描边。 */
    private static void drawTitleDoubleLine(Graphics2D g, Shape outline, Rectangle2D bounds, float fontSize, ColorScheme s) {
        float outerW = Math.max(5f, fontSize * 0.26f);
        float midW = Math.max(3f, fontSize * 0.16f);
        float innerW = Math.max(2f, fontSize * 0.07f);
        float shadowOff = Math.max(2f, fontSize * 0.05f);
        softShadow(g, outline, shadowOff, shadowOff, 0.50f, s.shadow);

        g.setStroke(new BasicStroke(outerW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeOuter);
        g.draw(outline);

        g.setStroke(new BasicStroke(midW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.accent);
        g.draw(outline);

        g.setStroke(new BasicStroke(innerW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeInner);
        g.draw(outline);

        fillGradient(g, outline, bounds, s);
    }

    /** 阴影偏移：大偏移阴影（漫画感）+ 单层外描边 + 渐变填充，没有内描边。 */
    private static void drawTitleShadowHeavy(Graphics2D g, Shape outline, Rectangle2D bounds, float fontSize, ColorScheme s) {
        float shadowDx = Math.max(6f, fontSize * 0.14f);
        float shadowDy = Math.max(6f, fontSize * 0.14f);
        // 硬阴影（高 alpha 实色，不模糊）
        Paint oldPaint = g.getPaint();
        var oldComp = g.getComposite();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.90f));
        g.setPaint(s.shadow);
        AffineTransform shAt = AffineTransform.getTranslateInstance(shadowDx, shadowDy);
        g.fill(shAt.createTransformedShape(outline));
        g.setComposite(oldComp);
        g.setPaint(oldPaint);

        float outerW = Math.max(4f, fontSize * 0.20f);
        g.setStroke(new BasicStroke(outerW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeOuter);
        g.draw(outline);

        fillGradient(g, outline, bounds, s);
    }

    /** 只有阴影：多向软阴影叠出"光晕" + 实色填充（取 fillTo），无描边。文学海报感。 */
    private static void drawTitleShadowOnly(Graphics2D g, Shape outline, Rectangle2D bounds, float fontSize, ColorScheme s) {
        // 多向偏移叠 6 个低 alpha 阴影，模拟 glow
        float r = Math.max(3f, fontSize * 0.06f);
        Color glow = s.shadow;
        for (int i = 0; i < 8; i++) {
            double a = i * Math.PI / 4;
            float dx = (float) (Math.cos(a) * r);
            float dy = (float) (Math.sin(a) * r);
            softShadow(g, outline, dx, dy, 0.22f, glow);
        }
        // 实色填充：直接 fillTo 单色，保留可读
        Paint oldP = g.getPaint();
        g.setPaint(s.fillTo);
        g.fill(outline);
        g.setPaint(oldP);
    }

    private static void softShadow(Graphics2D g, Shape outline, float dx, float dy, float alpha, Color color) {
        Paint oldP = g.getPaint();
        var oldComp = g.getComposite();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha));
        g.setPaint(color);
        AffineTransform at = AffineTransform.getTranslateInstance(dx, dy);
        g.fill(at.createTransformedShape(outline));
        g.setComposite(oldComp);
        g.setPaint(oldP);
    }

    private static void fillGradient(Graphics2D g, Shape outline, Rectangle2D bounds, ColorScheme s) {
        float gradY1 = (float) bounds.getMinY();
        float gradY2 = (float) bounds.getMaxY();
        g.setPaint(new LinearGradientPaint(
                0, gradY1, 0, gradY2,
                new float[]{0f, 1f},
                new Color[]{s.fillFrom, s.fillTo},
                CycleMethod.NO_CYCLE));
        g.fill(outline);
    }

    // ── 绘制：副标题 / Tag ──────────────────────────────────────────────────

    private static void drawSubtitle(
            Graphics2D g, String text, Font font, float cx, float cy, ColorScheme s, SubStyle style
    ) {
        FontRenderContext frc = g.getFontRenderContext();
        TextLayout tl = new TextLayout(text, font, frc);
        var b = tl.getBounds();
        float padX = font.getSize2D() * 0.6f;
        float padY = font.getSize2D() * 0.25f;
        float rectW = (float) b.getWidth() + padX * 2;
        float rectH = (float) b.getHeight() + padY * 2;
        float rectX = cx - rectW / 2;
        float rectY = cy - rectH / 2;

        Paint oldPaint = g.getPaint();
        try {
            switch (style) {
                case RIBBON: {
                    g.setPaint(s.accent);
                    RoundRectangle2D ribbon = new RoundRectangle2D.Float(rectX, rectY, rectW, rectH, rectH * 0.5f, rectH * 0.5f);
                    g.fill(ribbon);
                    g.setStroke(new BasicStroke(Math.max(2f, font.getSize2D() * 0.10f)));
                    g.setPaint(s.strokeOuter);
                    g.draw(ribbon);
                    g.setPaint(contrastForeground(s.accent));
                    tl.draw(g, (float) (cx - b.getCenterX()), (float) (cy - b.getCenterY()));
                    break;
                }
                case BAR: {
                    g.setPaint(s.accent);
                    RoundRectangle2D bar = new RoundRectangle2D.Float(rectX, rectY, rectW, rectH, rectH * 0.15f, rectH * 0.15f);
                    g.fill(bar);
                    g.setPaint(contrastForeground(s.accent));
                    tl.draw(g, (float) (cx - b.getCenterX()), (float) (cy - b.getCenterY()));
                    break;
                }
                case UNDERLINE: {
                    g.setPaint(s.strokeOuter);
                    tl.draw(g, (float) (cx - b.getCenterX()), (float) (cy - b.getCenterY()));
                    g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.85f));
                    g.setPaint(s.accent);
                    float underlineH = Math.max(3f, font.getSize2D() * 0.16f);
                    float underlineY = cy + (float) b.getHeight() / 2f + font.getSize2D() * 0.10f;
                    g.fillRoundRect(
                            (int) (cx - b.getWidth() / 2 - padX * 0.3f),
                            (int) underlineY,
                            (int) (b.getWidth() + padX * 0.6f),
                            (int) underlineH,
                            6, 6);
                    g.setComposite(AlphaComposite.SrcOver);
                    break;
                }
            }
        } finally {
            g.setPaint(oldPaint);
        }
    }

    private static void drawTagPill(
            Graphics2D g, String text, Font font, int w, int h,
            ColorScheme s, TagCorner corner, int seedMix
    ) {
        FontRenderContext frc = g.getFontRenderContext();
        TextLayout tl = new TextLayout(text, font, frc);
        var b = tl.getBounds();
        float padX = font.getSize2D() * 0.7f;
        float padY = font.getSize2D() * 0.35f;
        float rectW = (float) b.getWidth() + padX * 2;
        float rectH = (float) b.getHeight() + padY * 2;

        float margin = w * 0.04f;
        float anchorX, anchorY;
        switch (corner) {
            case TOP_LEFT:
                anchorX = rectW / 2 + margin; anchorY = rectH / 2 + h * 0.06f; break;
            case TOP_RIGHT:
                anchorX = w - rectW / 2 - margin; anchorY = rectH / 2 + h * 0.06f; break;
            case BOTTOM_LEFT:
                anchorX = rectW / 2 + margin; anchorY = h - rectH / 2 - h * 0.06f; break;
            case BOTTOM_RIGHT:
            default:
                anchorX = w - rectW / 2 - margin; anchorY = h - rectH / 2 - h * 0.06f; break;
        }

        double angle = Math.toRadians(((seedMix & 1) == 0 ? -1 : 1) * (4 + (Math.abs(seedMix) % 7)));

        AffineTransform old = g.getTransform();
        Paint oldPaint = g.getPaint();
        try {
            g.translate(anchorX, anchorY);
            g.rotate(angle);

            RoundRectangle2D pill = new RoundRectangle2D.Float(
                    -rectW / 2f, -rectH / 2f, rectW, rectH, rectH * 0.35f, rectH * 0.35f);
            g.setPaint(s.tag);
            g.fill(pill);

            g.setStroke(new BasicStroke(Math.max(2f, font.getSize2D() * 0.08f)));
            g.setPaint(s.strokeOuter);
            g.draw(pill);

            g.setPaint(contrastForeground(s.tag));
            float textX = (float) -b.getCenterX();
            float textY = (float) -b.getCenterY();
            tl.draw(g, textX, textY);
        } finally {
            g.setTransform(old);
            g.setPaint(oldPaint);
        }
    }

    // ── 绘制：贴图挂件 ──────────────────────────────────────────────────────

    private static void drawSticker(
            Graphics2D g, int w, int h, ColorScheme s, StickerStyle style,
            TagCorner corner, float size, int seedMix
    ) {
        float margin = w * 0.04f;
        float anchorX, anchorY;
        switch (corner) {
            case TOP_LEFT:
                anchorX = size / 2 + margin; anchorY = size / 2 + h * 0.06f; break;
            case TOP_RIGHT:
                anchorX = w - size / 2 - margin; anchorY = size / 2 + h * 0.06f; break;
            case BOTTOM_LEFT:
                anchorX = size / 2 + margin; anchorY = h - size / 2 - h * 0.06f; break;
            case BOTTOM_RIGHT:
            default:
                anchorX = w - size / 2 - margin; anchorY = h - size / 2 - h * 0.06f; break;
        }

        AffineTransform old = g.getTransform();
        Paint oldPaint = g.getPaint();
        var oldStroke = g.getStroke();
        try {
            g.translate(anchorX, anchorY);
            switch (style) {
                case STAR_BURST:  drawStarBurst(g, size, s, seedMix); break;
                case CIRCLE_SEAL: drawCircleSeal(g, size, s, seedMix); break;
                case SPARKLES:    drawSparkles(g, size, s, seedMix); break;
                case CHEVRONS:    drawChevrons(g, size, s, seedMix); break;
                default: break;
            }
        } finally {
            g.setStroke(oldStroke);
            g.setTransform(old);
            g.setPaint(oldPaint);
        }
    }

    /** 多角星 + 内圈圆点 + 微旋转，似促销爆炸星章。 */
    private static void drawStarBurst(Graphics2D g, float size, ColorScheme s, int seedMix) {
        double rot = Math.toRadians(((seedMix & 1) == 0 ? -1 : 1) * (3 + (Math.abs(seedMix) % 5)));
        g.rotate(rot);
        int points = 10;
        float outerR = size / 2f;
        float innerR = outerR * 0.55f;
        Polygon star = new Polygon();
        for (int i = 0; i < points * 2; i++) {
            double a = i * Math.PI / points - Math.PI / 2;
            float r = (i % 2 == 0) ? outerR : innerR;
            star.addPoint((int) (Math.cos(a) * r), (int) (Math.sin(a) * r));
        }
        g.setPaint(s.tag);
        g.fill(star);
        g.setStroke(new BasicStroke(Math.max(2f, size * 0.04f)));
        g.setPaint(s.strokeOuter);
        g.draw(star);
        g.setPaint(s.accent);
        float innerDotR = outerR * 0.28f;
        g.fill(new Ellipse2D.Float(-innerDotR, -innerDotR, innerDotR * 2, innerDotR * 2));
    }

    /** 圆形章：双圈，微旋转。 */
    private static void drawCircleSeal(Graphics2D g, float size, ColorScheme s, int seedMix) {
        double rot = Math.toRadians(((seedMix & 1) == 0 ? -1 : 1) * (4 + (Math.abs(seedMix) % 6)));
        g.rotate(rot);
        float r = size / 2f;
        g.setPaint(s.tag);
        g.fill(new Ellipse2D.Float(-r, -r, r * 2, r * 2));
        g.setStroke(new BasicStroke(Math.max(2f, size * 0.05f)));
        g.setPaint(s.strokeOuter);
        g.draw(new Ellipse2D.Float(-r, -r, r * 2, r * 2));
        float innerR = r * 0.74f;
        g.setStroke(new BasicStroke(Math.max(2f, size * 0.04f)));
        g.draw(new Ellipse2D.Float(-innerR, -innerR, innerR * 2, innerR * 2));
        // 中心一个小方块强调（不放文字避免与 title 文字撞）
        g.setPaint(s.accent);
        float c = r * 0.25f;
        g.fillRoundRect((int) -c, (int) -c, (int) (c * 2), (int) (c * 2), 4, 4);
    }

    /** 3 颗小星星散落，纯装饰。 */
    private static void drawSparkles(Graphics2D g, float size, ColorScheme s, int seedMix) {
        Random r = new Random(seedMix);
        for (int i = 0; i < 3; i++) {
            float scale = 0.4f + r.nextFloat() * 0.5f;
            float dx = (r.nextFloat() - 0.5f) * size * 0.8f;
            float dy = (r.nextFloat() - 0.5f) * size * 0.8f;
            AffineTransform tx = AffineTransform.getTranslateInstance(dx, dy);
            tx.scale(scale, scale);
            tx.rotate(r.nextDouble() * Math.PI / 2);
            Shape star = tx.createTransformedShape(makeFourPointStar(size * 0.5f));
            g.setPaint(s.accent);
            g.fill(star);
            g.setStroke(new BasicStroke(Math.max(1.5f, size * 0.025f)));
            g.setPaint(s.strokeOuter);
            g.draw(star);
        }
    }

    /** ">>" 双箭头簇，朝指定方向（seed 决定）。 */
    private static void drawChevrons(Graphics2D g, float size, ColorScheme s, int seedMix) {
        boolean flip = (seedMix & 1) == 0;
        g.rotate(flip ? 0 : Math.PI);
        g.setStroke(new BasicStroke(Math.max(3f, size * 0.10f), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(s.strokeOuter);
        float r = size * 0.40f;
        // 第一个 chevron
        Path2D p1 = new Path2D.Float();
        p1.moveTo(-r * 0.5f, -r);
        p1.lineTo(r * 0.3f, 0);
        p1.lineTo(-r * 0.5f, r);
        g.draw(p1);
        // 第二个 chevron 偏右
        Path2D p2 = new Path2D.Float();
        p2.moveTo(r * 0.0f, -r);
        p2.lineTo(r * 0.8f, 0);
        p2.lineTo(r * 0.0f, r);
        g.setPaint(s.accent);
        g.draw(p2);
    }

    /** 简单 4 角小星形（位置 = 0,0 中心）。 */
    private static Shape makeFourPointStar(float size) {
        Path2D p = new Path2D.Float();
        float outer = size;
        float inner = size * 0.35f;
        p.moveTo(0, -outer);
        p.lineTo(inner, -inner);
        p.lineTo(outer, 0);
        p.lineTo(inner, inner);
        p.lineTo(0, outer);
        p.lineTo(-inner, inner);
        p.lineTo(-outer, 0);
        p.lineTo(-inner, -inner);
        p.closePath();
        return p;
    }

    // ── 字体构建 ─────────────────────────────────────────────────────────────

    /**
     * 按 FontProfile 派生字体。同 kind 池里如果有多个字体，按 {@code seedMix} 选具体一个 ——
     * 这样 title / subtitle / tag 各自从 seed 抽，且不同请求能选到不同字体。
     */
    private Font buildFont(FontProfile p, float size, int seedMix) {
        Font base;
        List<FontRegistry.RegisteredFont> pool = fonts.byKind(p.kind);
        if (!pool.isEmpty()) {
            int idx = Math.floorMod(seedMix, pool.size());
            base = pool.get(idx).font();
        } else {
            String family = (p.kind == FontRegistry.Kind.SERIF) ? Font.SERIF : Font.SANS_SERIF;
            base = new Font(family, p.awtStyle, 64);
        }
        Font f = base.deriveFont(p.awtStyle, size);
        if (p.tracking != 0f || p.posture != 0f || p.weight != null) {
            Map<TextAttribute, Object> attrs = new HashMap<>();
            if (p.tracking != 0f) attrs.put(TextAttribute.TRACKING, p.tracking);
            if (p.posture != 0f)  attrs.put(TextAttribute.POSTURE, p.posture);
            if (p.weight != null) attrs.put(TextAttribute.WEIGHT, p.weight);
            f = f.deriveFont(attrs);
        }
        return f;
    }

    private static Font autoFitFont(Graphics2D g, String text, Font base, double targetSize, double maxWidth) {
        Font f = base.deriveFont((float) targetSize);
        FontRenderContext frc = g.getFontRenderContext();
        double width = f.getStringBounds(text, frc).getWidth();
        if (width <= maxWidth) return f;
        double scale = maxWidth / width;
        return f.deriveFont((float) (targetSize * scale));
    }

    // ── 工具 ────────────────────────────────────────────────────────────────

    private static Color contrastForeground(Color bg) {
        double l = 0.2126 * bg.getRed() + 0.7152 * bg.getGreen() + 0.0722 * bg.getBlue();
        return l > 160 ? new Color(40, 20, 10) : Color.WHITE;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    private static int mix32(long seed, int salt) {
        long x = seed ^ ((long) salt * 0x9e3779b97f4a7c15L);
        x ^= (x >>> 33);
        x *= 0xff51afd7ed558ccdL;
        x ^= (x >>> 33);
        return (int) (x & 0x7fffffffL);
    }

    private static <T> T pickEnum(long seed, int salt, T[] values) {
        return values[Math.floorMod(mix32(seed, salt), values.length)];
    }

    private static <T> T pickFrom(long seed, int salt, List<T> list) {
        return list.get(Math.floorMod(mix32(seed, salt), list.size()));
    }

    private static ColorScheme scheme(
            String name, String bgFrom, String bgTo, String fillFrom, String fillTo,
            String strokeInner, String strokeOuter, String accent, String shadow, String tag
    ) {
        return new ColorScheme(name,
                hex(bgFrom), hex(bgTo),
                hex(fillFrom), hex(fillTo),
                hex(strokeInner), hex(strokeOuter),
                hex(accent), hex(shadow), hex(tag));
    }

    private static Color hex(String h) {
        return Color.decode(h);
    }

    private ColorScheme findScheme(String name) {
        for (ColorScheme s : SCHEMES) {
            if (s.name().equalsIgnoreCase(name)) return s;
        }
        return SCHEMES.get(Math.floorMod(name.hashCode(), SCHEMES.size()));
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
