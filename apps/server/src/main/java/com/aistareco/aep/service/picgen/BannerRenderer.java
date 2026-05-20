package com.aistareco.aep.service.picgen;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.font.TextLayout;
import java.awt.geom.AffineTransform;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

/**
 * v0.16+: 纯 Java2D 实现的促销 banner 渲染器。
 *
 * 没有任何外部进程依赖（无 Node / Puppeteer / Chromium）。从原 pic-gen 项目移植的元素：
 *   - 16 套色彩 SCHEMES（背景渐变 / 主标题填充渐变 / 内描边 / 外描边 / accent / shadow 等）
 *   - 主标题描边双层（外深色 + 内白色），底色渐变
 *   - 副标题 + 标签胶囊（小色块圆角矩形）
 *
 * 中文字体走 JVM 逻辑字 SansSerif Bold，靠 OS 字体回退机制（macOS PingFang SC、
 * Linux Noto Sans CJK、Windows Microsoft YaHei）渲染。生产 Linux 部署需安装
 * fonts-noto-cjk 或同等 CJK 字体包。
 *
 * 渲染输入：title 必填，subtitle / tag 可选；width / height 任意（建议 ≥ 200×120）。
 * 用 seed 控制 scheme / 字体 / 装饰随机性 —— 同 seed 出同图，便于排查。
 */
@Service
public class BannerRenderer {

    private static final Logger log = LoggerFactory.getLogger(BannerRenderer.class);

    /**
     * 色彩方案 —— 与 pic-gen/lib.js SCHEMES 严格对齐。
     * 字段含义：
     *   bgFrom / bgTo       背景线性渐变（左上 → 右下）
     *   fillFrom / fillTo   主标题填充渐变（垂直）
     *   strokeInner         主标题内描边（通常白色）
     *   strokeOuter         主标题外描边（最厚的深色轮廓）
     *   accent              副标题 / 装饰高亮色
     *   shadow              主标题文字阴影
     *   tag                 标签胶囊背景色
     */
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

    /**
     * 主入口。
     * @param req 渲染参数
     * @return PNG 字节流
     */
    public byte[] render(BannerRequest req) throws IOException {
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("title 不能为空");
        }
        int w = clamp(req.width(), 200, 1920);
        int h = clamp(req.height(), 120, 1080);
        long seed = req.seed();

        // 1) Scheme & font pick（seed 控制；override 优先）
        ColorScheme scheme = req.schemeName() != null
                ? findScheme(req.schemeName())
                : SCHEMES.get(Math.floorMod(mix32(seed, 1), SCHEMES.size()));

        // 2) BufferedImage + Graphics2D
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            applyHints(g);

            // 2a) 背景渐变
            drawBackgroundGradient(g, w, h, scheme);

            // 2b) 装饰：左上斜向色条（subtle，与 picgen 'ribbon' template 致敬）
            drawCornerStripe(g, w, h, scheme, mix32(seed, 5));

            // 3) 主标题
            String title = req.title().trim();
            String subtitle = req.subtitle() == null ? "" : req.subtitle().trim();
            String tag = req.tag() == null ? "" : req.tag().trim();

            // 计算主标题字号：先按高度的 40% 试，超宽则按 maxTextWidth 缩
            double maxTextWidth = w * 0.84;
            double titleFontSize = h * 0.42;
            Font baseTitleFont = pickFont(seed, Font.BOLD);
            Font titleFont = autoFitFont(g, title, baseTitleFont, titleFontSize, maxTextWidth);

            // 主标题水平居中、垂直略偏上（给副标题留位）
            float titleY = (float) (h * (subtitle.isEmpty() ? 0.62 : 0.50));
            drawOutlinedText(g, title, titleFont, w / 2f, titleY, scheme);

            // 4) 副标题（可选）
            if (!subtitle.isEmpty()) {
                Font subFont = pickFont(seed, Font.BOLD).deriveFont((float) (titleFont.getSize2D() * 0.32f));
                drawSubtitleRibbon(g, subtitle, subFont, w / 2f, (float) (h * 0.78), scheme);
            }

            // 5) 标签（可选）—— 右上角圆角矩形 + 略倾斜
            if (!tag.isEmpty()) {
                drawTagPill(g, tag, pickFont(seed, Font.BOLD), w, h, scheme, mix32(seed, 7));
            }

            log.debug("[picgen] render title='{}' size={}×{} scheme={}",
                    truncate(title, 20), w, h, scheme.name());
        } finally {
            g.dispose();
        }

        // 6) 编码 PNG
        ByteArrayOutputStream baos = new ByteArrayOutputStream(64 * 1024);
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }

    /** 渲染请求。title 必填；seed 缺省为 0（出同一张图）。 */
    public record BannerRequest(
            String title,
            String subtitle,
            String tag,
            int width,
            int height,
            long seed,
            /** 可选：强制选某个 scheme（按 name）；null 则按 seed 抽。 */
            String schemeName
    ) {}

    // ── 绘制子例程 ───────────────────────────────────────────────────────────

    private static void applyHints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
    }

    private static void drawBackgroundGradient(Graphics2D g, int w, int h, ColorScheme s) {
        Paint old = g.getPaint();
        g.setPaint(new GradientPaint(0, 0, s.bgFrom, w, h, s.bgTo));
        g.fillRect(0, 0, w, h);
        g.setPaint(old);
    }

    private static void drawCornerStripe(Graphics2D g, int w, int h, ColorScheme s, int seedMix) {
        Paint old = g.getPaint();
        AffineTransform oldAt = g.getTransform();
        try {
            // 一条横向暗色细带，靠下；位置抖动
            float stripeH = Math.max(6, h * 0.04f);
            float y = h - stripeH - (h * 0.02f);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.18f));
            g.setPaint(s.strokeOuter);
            g.fillRect(0, (int) y, w, (int) stripeH);

            // 左上一个圆点装饰（随 seed 决定显示）
            if ((seedMix & 1) == 0) {
                g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.22f));
                g.setPaint(s.accent);
                int r = (int) (h * 0.20);
                g.fillOval(-r / 2, -r / 2, r, r);
            }
        } finally {
            g.setComposite(AlphaComposite.SrcOver);
            g.setPaint(old);
            g.setTransform(oldAt);
        }
    }

    /** 用 GlyphVector 拿到字符轮廓 → 外描边 → 内描边 → 渐变填充。 */
    private static void drawOutlinedText(
            Graphics2D g, String text, Font font, float cx, float cy, ColorScheme s
    ) {
        FontRenderContext frc = g.getFontRenderContext();
        GlyphVector gv = font.createGlyphVector(frc, text);
        Shape outline = gv.getOutline(0, 0);
        var bounds = outline.getBounds2D();
        float tx = (float) (cx - bounds.getCenterX());
        float ty = (float) (cy - bounds.getCenterY());

        AffineTransform old = g.getTransform();
        Paint oldPaint = g.getPaint();
        try {
            g.translate(tx, ty);

            float fontSize = font.getSize2D();
            float outerStrokeW = Math.max(4f, fontSize * 0.22f);
            float innerStrokeW = Math.max(2f, fontSize * 0.10f);

            // 文字阴影（向右下偏移）
            float shadowDx = Math.max(2f, fontSize * 0.04f);
            float shadowDy = shadowDx;
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.55f));
            g.setPaint(s.shadow);
            AffineTransform shAt = AffineTransform.getTranslateInstance(shadowDx, shadowDy);
            g.fill(shAt.createTransformedShape(outline));
            g.setComposite(AlphaComposite.SrcOver);

            // 外描边
            g.setStroke(new BasicStroke(outerStrokeW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.setPaint(s.strokeOuter);
            g.draw(outline);

            // 内描边
            g.setStroke(new BasicStroke(innerStrokeW, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.setPaint(s.strokeInner);
            g.draw(outline);

            // 渐变填充
            float gradY1 = (float) bounds.getMinY();
            float gradY2 = (float) bounds.getMaxY();
            g.setPaint(new LinearGradientPaint(
                    0, gradY1, 0, gradY2,
                    new float[]{0f, 1f},
                    new Color[]{s.fillFrom, s.fillTo},
                    CycleMethod.NO_CYCLE
            ));
            g.fill(outline);
        } finally {
            g.setTransform(old);
            g.setPaint(oldPaint);
        }
    }

    /** 副标题：圆角矩形 ribbon 背景 + 居中文字。 */
    private static void drawSubtitleRibbon(
            Graphics2D g, String text, Font font, float cx, float cy, ColorScheme s
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
            // ribbon 背景：accent 色
            g.setPaint(s.accent);
            RoundRectangle2D ribbon = new RoundRectangle2D.Float(rectX, rectY, rectW, rectH, rectH * 0.5f, rectH * 0.5f);
            g.fill(ribbon);

            // ribbon 描边
            g.setStroke(new BasicStroke(Math.max(2f, font.getSize2D() * 0.10f)));
            g.setPaint(s.strokeOuter);
            g.draw(ribbon);

            // 文字
            g.setPaint(contrastForeground(s.accent));
            float textX = (float) (cx - b.getCenterX());
            float textY = (float) (cy - b.getCenterY());
            tl.draw(g, textX, textY);
        } finally {
            g.setPaint(oldPaint);
        }
    }

    /** 右上角小标签：圆角矩形 + 倾斜约 8 度。 */
    private static void drawTagPill(
            Graphics2D g, String text, Font baseFont, int w, int h, ColorScheme s, int seedMix
    ) {
        Font font = baseFont.deriveFont((float) (h * 0.10f));
        FontRenderContext frc = g.getFontRenderContext();
        TextLayout tl = new TextLayout(text, font, frc);
        var b = tl.getBounds();
        float padX = font.getSize2D() * 0.7f;
        float padY = font.getSize2D() * 0.35f;
        float rectW = (float) b.getWidth() + padX * 2;
        float rectH = (float) b.getHeight() + padY * 2;

        // 右上角，距边缘 4% 的留白
        float anchorX = w - rectW / 2 - w * 0.04f;
        float anchorY = rectH / 2 + h * 0.06f;
        // seed 决定倾斜方向（左偏 or 右偏 4~10 度）
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

    // ── 字体 / 工具 ─────────────────────────────────────────────────────────

    /**
     * 用 Java 逻辑字"SansSerif"或"Serif"，靠 JVM 自动 fallback 到 OS 安装的 CJK 字体
     * （macOS=PingFang SC、Linux=Noto Sans CJK、Windows=Microsoft YaHei）。
     * seed 决定选 SansSerif 还是 Serif，权重 5:1（serif 偶尔出现）。
     */
    private static Font pickFont(long seed, int style) {
        int family = Math.floorMod(mix32(seed, 3), 6);
        String name = family == 0 ? Font.SERIF : Font.SANS_SERIF;
        return new Font(name, style, 64);  // size 占位，调用方会 deriveFont
    }

    /** 把 font 缩到 text 宽度 ≤ maxWidth，且 size ≤ targetSize。 */
    private static Font autoFitFont(Graphics2D g, String text, Font base, double targetSize, double maxWidth) {
        Font f = base.deriveFont((float) targetSize);
        FontRenderContext frc = g.getFontRenderContext();
        double width = f.getStringBounds(text, frc).getWidth();
        if (width <= maxWidth) return f;
        double scale = maxWidth / width;
        return f.deriveFont((float) (targetSize * scale));
    }

    /** 简单亮度判定，给文字配反差色。 */
    private static Color contrastForeground(Color bg) {
        double l = 0.2126 * bg.getRed() + 0.7152 * bg.getGreen() + 0.0722 * bg.getBlue();
        return l > 160 ? new Color(40, 20, 10) : Color.WHITE;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    /** 把任意 long seed 折成 32-bit 正数；salt 让同 seed 在不同点位上散开。 */
    private static int mix32(long seed, int salt) {
        long x = seed ^ ((long) salt * 0x9e3779b97f4a7c15L);
        x ^= (x >>> 33);
        x *= 0xff51afd7ed558ccdL;
        x ^= (x >>> 33);
        return (int) (x & 0x7fffffffL);
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
        // 找不到 → 按 hashCode 兜底
        return SCHEMES.get(Math.floorMod(name.hashCode(), SCHEMES.size()));
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
