package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.picgen.FontRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.font.FontRenderContext;
import java.awt.font.TextLayout;
import java.awt.geom.AffineTransform;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 成片封面渲染：把 {@link ClipCoverTemplate} 的版式参数画到一张 720x1280 PNG 上。
 *
 * <p>范式与 {@link ClipOverlayRenderer} 一致（Java2D + ImageIO，用户文案永远不进 ffmpeg filter 表达式），
 * 字体也共用同一套解析：先问仓库自带的 {@link FontRegistry}（resources/fonts 里已随仓库提交
 * 马善政书法体等 OFL 字体），再回落 {@link ClipFontPalette} 的系统中文字体。
 * 两级都要过 canDisplayUpTo 校验 —— 宁可换字体也不能烧出一排豆腐块。
 */
@Service
public class ClipCoverRenderer {
    private static final Logger log = LoggerFactory.getLogger(ClipCoverRenderer.class);
    private static final int WIDTH = 720;
    private static final int HEIGHT = 1280;
    /** 没有底图时的兜底底色，与尾卡同一套墨绿 → 砖红。 */
    private static final Color FALLBACK_TOP = new Color(18, 54, 47);
    private static final Color FALLBACK_BOTTOM = new Color(117, 52, 31);

    /** 每个 FontRole 的优先字体族；命中不了就按 FontRegistry.Kind 里任意一个，再回落系统字体。 */
    private static final Map<ClipCoverTemplate.FontRole, List<String>> PREFERRED = Map.of(
            // 马善政是楷书笔意、可读性最好的一支；刘建毛草/龙藏偏草书，两字大标题辨识度差，只作次选
            ClipCoverTemplate.FontRole.BRUSH, List.of("Ma Shan Zheng", "Long Cang", "Liu Jian Mao Cao"),
            ClipCoverTemplate.FontRole.DISPLAY, List.of("ZCOOL QingKe HuangYou", "ZCOOL KuaiLe", "Noto Sans SC"),
            ClipCoverTemplate.FontRole.SANS, List.of("Noto Sans SC"),
            ClipCoverTemplate.FontRole.SERIF, List.of("Noto Serif SC", "ZCOOL XiaoWei"));

    private static final Map<ClipCoverTemplate.FontRole, FontRegistry.Kind> ROLE_KIND = Map.of(
            ClipCoverTemplate.FontRole.BRUSH, FontRegistry.Kind.BRUSH,
            ClipCoverTemplate.FontRole.DISPLAY, FontRegistry.Kind.DISPLAY,
            ClipCoverTemplate.FontRole.SANS, FontRegistry.Kind.SANS,
            ClipCoverTemplate.FontRole.SERIF, FontRegistry.Kind.SERIF);

    private final FontRegistry fonts;
    private final String systemFamily;

    public ClipCoverRenderer(FontRegistry fonts) {
        this.fonts = fonts;
        this.systemFamily = ClipFontPalette.systemCjkFamily();
        log.info("[clip-cover] system CJK family = {}, bundled fonts = {}", systemFamily, fonts.all().size());
    }

    /**
     * 渲染封面。
     *
     * @param background 底图（用户成片的某一帧或自传图）；null 走兜底渐变底
     */
    public Path render(Path workDir, ClipCoverPlan.Spec spec, Path background) {
        try {
            ClipCoverTemplate template = spec.template();
            BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = image.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
                drawBackground(g, background);
                drawScrim(g, template.scrim());
                drawSlot(g, template.keyword(), List.of(spec.keyword()));
                drawSlot(g, template.handle(), List.of(spec.handle()));
                drawSlot(g, template.slogan(), spec.sloganLines());
                drawSlot(g, template.signature(), List.of(spec.signature()));
            } finally {
                g.dispose();
            }
            Path output = workDir.resolve("cover.png");
            if (!ImageIO.write(image, "png", output.toFile())) throw new IllegalStateException("PNG writer unavailable");
            return output;
        } catch (Exception e) {
            throw new IllegalStateException("成片封面生成失败", e);
        }
    }

    // ── 底图与压暗 ──────────────────────────────────────────────────────────

    private void drawBackground(Graphics2D g, Path background) {
        BufferedImage source = null;
        if (background != null) {
            try {
                source = ImageIO.read(background.toFile());
            } catch (Exception e) {
                log.warn("[clip-cover] background unreadable ({}), falling back to gradient: {}", background, e.toString());
            }
        }
        if (source == null) {
            g.setPaint(new GradientPaint(0, 0, FALLBACK_TOP, WIDTH, HEIGHT, FALLBACK_BOTTOM));
            g.fillRect(0, 0, WIDTH, HEIGHT);
            return;
        }
        // 等比放大到铺满再居中裁切，和成片 scale+crop 的画面口径保持一致，封面不会跟第二帧错位
        double scale = Math.max((double) WIDTH / source.getWidth(), (double) HEIGHT / source.getHeight());
        int drawW = (int) Math.ceil(source.getWidth() * scale);
        int drawH = (int) Math.ceil(source.getHeight() * scale);
        g.drawImage(source, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH, null);
    }

    private void drawScrim(Graphics2D g, ClipCoverTemplate.Scrim scrim) {
        if (scrim == null) return;
        if (scrim.topHeight() > 0 && alpha(scrim.topArgb()) > 0) {
            g.setPaint(new GradientPaint(0, 0, new Color(scrim.topArgb(), true),
                    0, scrim.topHeight(), new Color(scrim.topArgb() & 0x00FFFFFF, true)));
            g.fillRect(0, 0, WIDTH, scrim.topHeight());
        }
        if (scrim.bottomHeight() > 0 && alpha(scrim.bottomArgb()) > 0) {
            int top = HEIGHT - scrim.bottomHeight();
            g.setPaint(new GradientPaint(0, top, new Color(scrim.bottomArgb() & 0x00FFFFFF, true),
                    0, HEIGHT, new Color(scrim.bottomArgb(), true)));
            g.fillRect(0, top, WIDTH, scrim.bottomHeight());
        }
    }

    // ── 槽位绘制 ────────────────────────────────────────────────────────────

    private void drawSlot(Graphics2D g, ClipCoverTemplate.Slot slot, List<String> lines) {
        List<String> visible = lines.stream().filter(line -> line != null && !line.isBlank()).limit(slot.maxLines()).toList();
        if (visible.isEmpty()) return;
        Font base = resolveFont(slot, String.join("", visible));
        FontRenderContext frc = g.getFontRenderContext();

        // 先按最宽的一行统一缩字号，多行之间字号一致，不然两行标语会一大一小
        int size = ClipCoverLayout.fitFontSize(slot.fontSize(), slot.minFontSize(), slot.maxWidth(),
                measured -> widestAdvance(visible, base, measured, slot.letterSpacing(), frc));

        Font font = withTracking(base, size, slot.letterSpacing());
        int y = slot.anchorY();
        for (String line : visible) {
            TextLayout layout = new TextLayout(line, font, frc);
            drawLine(g, slot, layout, y);
            y += slot.lineGap() > 0 ? slot.lineGap() : Math.round(layout.getAscent() + layout.getDescent());
        }
    }

    private void drawLine(Graphics2D g, ClipCoverTemplate.Slot slot, TextLayout layout, int baselineY) {
        float advance = layout.getAdvance();
        int x = ClipCoverLayout.alignedX(slot.align(), slot.anchorX(), Math.round(advance));

        ClipCoverTemplate.Chip chip = slot.chip();
        if (chip != null) {
            Rectangle2D bounds = layout.getBounds();
            int boxX = x - chip.padX();
            int boxY = (int) Math.floor(baselineY - layout.getAscent()) - chip.padY();
            int boxW = Math.round(advance) + chip.padX() * 2;
            int boxH = Math.round(layout.getAscent() + layout.getDescent()) + chip.padY() * 2;
            if (bounds.getWidth() <= 0) return;
            g.setPaint(new Color(chip.bgArgb(), true));
            g.fillRoundRect(boxX, boxY, boxW, boxH, chip.radius() * 2, chip.radius() * 2);
        }

        ClipCoverTemplate.Stroke stroke = slot.stroke();
        if (stroke != null && stroke.enabled()) {
            // 描边走字形轮廓而不是「偏移重绘」，转角才不会出毛刺；先描后填，笔画内部保持纯色
            Shape outline = layout.getOutline(AffineTransform.getTranslateInstance(x, baselineY));
            g.setPaint(new Color(stroke.argb(), true));
            g.setStroke(new BasicStroke(stroke.width(), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.draw(outline);
        }

        ClipCoverTemplate.Gradient gradient = slot.gradient();
        if (gradient != null) {
            float top = baselineY - layout.getAscent();
            float bottom = baselineY + layout.getDescent();
            g.setPaint(new GradientPaint(0, top, new Color(gradient.fromArgb(), true),
                    0, bottom, new Color(gradient.toArgb(), true)));
        } else {
            g.setPaint(new Color(slot.fillArgb(), true));
        }
        layout.draw(g, x, baselineY);
    }

    // ── 字体解析 ────────────────────────────────────────────────────────────

    /**
     * 按 role 找一支能完整显示这段文字的字体：
     * 1) FontRegistry 里的优先字体族 → 2) 同 Kind 的任意一支 → 3) 系统中文字体 → 4) JVM 逻辑字。
     * 每一级都验 canDisplayUpTo，缺字就往下走，永远不硬指定一个可能不存在的字体名。
     */
    private Font resolveFont(ClipCoverTemplate.Slot slot, String probe) {
        FontRegistry.Kind kind = ROLE_KIND.get(slot.fontRole());
        List<FontRegistry.RegisteredFont> pool = fonts.isEmpty() ? List.of() : fonts.byKind(kind);

        for (String preferred : PREFERRED.getOrDefault(slot.fontRole(), List.of())) {
            for (FontRegistry.RegisteredFont candidate : pool) {
                if (!familyMatches(candidate, preferred)) continue;
                if (displays(candidate.font(), probe)) return candidate.font();
            }
        }
        for (FontRegistry.RegisteredFont candidate : pool) {
            if (candidate.kind() == kind && displays(candidate.font(), probe)) return candidate.font();
        }
        Font system = new Font(systemFamily, Font.BOLD, 64);
        if (displays(system, probe)) return system;
        log.warn("[clip-cover] no font covers '{}' for role {}; falling back to logical sans", probe, slot.fontRole());
        return new Font(Font.SANS_SERIF, Font.BOLD, 64);
    }

    private static boolean familyMatches(FontRegistry.RegisteredFont candidate, String preferred) {
        String family = candidate.font().getFamily(Locale.US);
        String name = candidate.name();
        String flat = preferred.replace(" ", "");
        return family.equalsIgnoreCase(preferred) || name.replace(" ", "").equalsIgnoreCase(flat);
    }

    private static boolean displays(Font font, String probe) {
        return probe == null || probe.isBlank() || font.canDisplayUpTo(probe) < 0;
    }

    /** letterSpacing 是像素，TextAttribute.TRACKING 是字号倍率，换算一次即可。 */
    private static Font withTracking(Font base, int size, int letterSpacing) {
        Font sized = base.deriveFont(Font.BOLD, (float) size);
        if (letterSpacing == 0) return sized;
        return sized.deriveFont(Map.of(java.awt.font.TextAttribute.TRACKING, (float) letterSpacing / size));
    }

    private float widestAdvance(List<String> lines, Font base, int size, int letterSpacing, FontRenderContext frc) {
        Font font = withTracking(base, size, letterSpacing);
        float widest = 0;
        for (String line : lines) widest = Math.max(widest, new TextLayout(line, font, frc).getAdvance());
        return widest;
    }

    private static int alpha(int argb) { return (argb >>> 24) & 0xff; }
}
