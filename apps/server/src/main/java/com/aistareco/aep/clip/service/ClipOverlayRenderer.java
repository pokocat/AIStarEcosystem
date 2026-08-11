package com.aistareco.aep.clip.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** 用 Java2D 生成逐段透明叠加层，避免把用户字幕拼进 ffmpeg filter 表达式。 */
@Service
public class ClipOverlayRenderer {
    private static final Logger log = LoggerFactory.getLogger(ClipOverlayRenderer.class);
    private static final int WIDTH = 720;
    private static final int HEIGHT = 1280;
    private static final String AI_LABEL = "AI 生成";
    private final String fontFamily;

    public ClipOverlayRenderer() {
        this.fontFamily = chooseFontFamily();
        Font probe = new Font(fontFamily, Font.PLAIN, 32);
        if (probe.canDisplayUpTo(AI_LABEL) >= 0) {
            log.warn("[clip-overlay] font '{}' cannot fully display Chinese; rendered works may show fallback glyphs", fontFamily);
        } else {
            log.info("[clip-overlay] Chinese font ready: {}", fontFamily);
        }
    }

    public Path render(Path workDir, int segmentNo, String caption) {
        try {
            BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = image.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                drawAiLabel(g);
                if (caption != null && !caption.isBlank()) drawCaption(g, caption.trim());
            } finally {
                g.dispose();
            }
            Path output = workDir.resolve(String.format(Locale.ROOT, "overlay-%03d.png", segmentNo));
            if (!ImageIO.write(image, "png", output.toFile())) throw new IllegalStateException("PNG writer unavailable");
            return output;
        } catch (Exception e) {
            throw new IllegalStateException("视频字幕与 AI 标识生成失败", e);
        }
    }

    /** 无运营尾片素材时使用的模板固定尾卡；整帧不透明，避免把空白色块当成正式尾片。 */
    public Path renderTail(Path workDir, int segmentNo, String templateId, String templateName) {
        try {
            BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = image.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                drawTailBackground(g);
                drawTailCopy(g, tailHeadline(templateId, templateName), tailSubline(templateId));
                drawAiLabel(g);
            } finally {
                g.dispose();
            }
            Path output = workDir.resolve(String.format(Locale.ROOT, "overlay-%03d.png", segmentNo));
            if (!ImageIO.write(image, "png", output.toFile())) throw new IllegalStateException("PNG writer unavailable");
            return output;
        } catch (Exception e) {
            throw new IllegalStateException("固定尾片生成失败", e);
        }
    }

    /** 测试媒体模式的成片必须永久带「测试演示」角标，避免离开预发 UI 后被误认成真实生成。 */
    public Path markAsTest(Path imagePath) {
        try {
            BufferedImage image = ImageIO.read(imagePath.toFile());
            if (image == null) throw new IllegalStateException("overlay image unreadable");
            Graphics2D g = image.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                String label = "测试演示";
                Font font = new Font(fontFamily, Font.BOLD, 24);
                FontMetrics metrics = g.getFontMetrics(font);
                int x = 36, y = 44, padX = 18, boxH = 46;
                int boxW = metrics.stringWidth(label) + padX * 2;
                g.setColor(new Color(214, 91, 44, 225));
                g.fillRoundRect(x, y, boxW, boxH, 20, 20);
                g.setFont(font);g.setColor(Color.WHITE);
                int baseline = y + (boxH - metrics.getHeight()) / 2 + metrics.getAscent();
                g.drawString(label, x + padX, baseline);
            } finally {
                g.dispose();
            }
            if (!ImageIO.write(image, "png", imagePath.toFile())) throw new IllegalStateException("PNG writer unavailable");
            return imagePath;
        } catch (Exception e) {
            throw new IllegalStateException("测试演示标识生成失败", e);
        }
    }

    private void drawTailBackground(Graphics2D g) {
        g.setPaint(new GradientPaint(0, 0, new Color(18, 54, 47), WIDTH, HEIGHT, new Color(117, 52, 31)));
        g.fillRect(0, 0, WIDTH, HEIGHT);
        g.setColor(new Color(255, 255, 255, 18));
        g.fillOval(-260, 80, 760, 760);
        g.fillOval(310, 650, 620, 620);
        g.setColor(new Color(228, 98, 43, 110));
        g.fillRoundRect(62, 174, 9, 250, 9, 9);
    }

    private void drawTailCopy(Graphics2D g, String headline, String subline) {
        g.setColor(new Color(245, 232, 211));
        g.setFont(new Font(fontFamily, Font.PLAIN, 24));
        g.drawString("快出片 · 真实故事计划", 92, 220);

        g.setFont(new Font(fontFamily, Font.BOLD, 62));
        List<String> headlineLines = wrap(headline, g.getFontMetrics(), 530);
        int y = 500;
        for (String line : headlineLines) {
            g.drawString(line, 92, y);
            y += 82;
        }

        g.setColor(new Color(245, 232, 211, 150));
        g.fillRoundRect(92, y + 6, 88, 5, 5, 5);
        g.setColor(new Color(255, 255, 255, 225));
        g.setFont(new Font(fontFamily, Font.PLAIN, 30));
        for (String line : wrap(subline, g.getFontMetrics(), 530)) {
            y += 62;
            g.drawString(line, 92, y);
        }

        g.setColor(new Color(255, 255, 255, 150));
        g.setFont(new Font(fontFamily, Font.PLAIN, 23));
        g.drawString("记录每一家认真生活的小店", 92, HEIGHT - 112);
    }

    private static String tailHeadline(String templateId, String templateName) {
        return switch (templateId == null ? "" : templateId) {
            case "ct_shiti" -> "我为实体发声";
            case "ct_kaimen" -> "今天开门了";
            case "ct_shouyi" -> "让手艺被看见";
            default -> templateName == null || templateName.isBlank() ? "让真实被看见" : templateName;
        };
    }

    private static String tailSubline(String templateId) {
        return switch (templateId == null ? "" : templateId) {
            case "ct_shiti" -> "一束光照亮一块招牌，也照亮一条街。";
            case "ct_kaimen" -> "认真过好每一天，就是小店最好的故事。";
            case "ct_shouyi" -> "手上的功夫有温度，时间会替它作证。";
            default -> "把真实的故事，讲给更多人听。";
        };
    }

    private void drawAiLabel(Graphics2D g) {
        Font font = new Font(fontFamily, Font.BOLD, 24);
        FontMetrics metrics = g.getFontMetrics(font);
        int padX = 18;
        int boxW = metrics.stringWidth(AI_LABEL) + padX * 2;
        int boxH = 46;
        int x = WIDTH - 36 - boxW;
        int y = 44;
        g.setColor(new Color(0, 0, 0, 150));
        g.fillRoundRect(x, y, boxW, boxH, 20, 20);
        g.setFont(font);
        g.setColor(Color.WHITE);
        int baseline = y + (boxH - metrics.getHeight()) / 2 + metrics.getAscent();
        g.drawString(AI_LABEL, x + padX, baseline);
    }

    private void drawCaption(Graphics2D g, String caption) {
        Font font = new Font(fontFamily, Font.BOLD, 38);
        FontMetrics metrics = g.getFontMetrics(font);
        List<String> lines = wrap(caption, metrics, 592);
        int lineHeight = metrics.getHeight() + 8;
        int boxH = lines.size() * lineHeight + 34;
        int boxY = HEIGHT - 72 - boxH;
        int widest = lines.stream().mapToInt(metrics::stringWidth).max().orElse(0);
        int boxW = Math.min(WIDTH - 72, widest + 64);
        int boxX = (WIDTH - boxW) / 2;
        g.setColor(new Color(0, 0, 0, 165));
        g.fillRoundRect(boxX, boxY, boxW, boxH, 28, 28);
        g.setFont(font);
        g.setColor(Color.WHITE);
        int baseline = boxY + 17 + metrics.getAscent();
        for (String line : lines) {
            int x = (WIDTH - metrics.stringWidth(line)) / 2;
            g.drawString(line, x, baseline);
            baseline += lineHeight;
        }
    }

    private static List<String> wrap(String text, FontMetrics metrics, int maxWidth) {
        List<String> all = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        text.codePoints().forEach(cp -> {
            if (cp == '\n') {
                if (!line.isEmpty()) all.add(line.toString());
                line.setLength(0);
                return;
            }
            String next = new String(Character.toChars(cp));
            if (!line.isEmpty() && metrics.stringWidth(line + next) > maxWidth) {
                all.add(line.toString());
                line.setLength(0);
            }
            line.append(next);
        });
        if (!line.isEmpty()) all.add(line.toString());
        if (all.isEmpty()) return List.of("");
        if (all.size() <= 2) return all;
        String remainder = String.join("", all.subList(1, all.size()));
        return List.of(all.get(0), ellipsize(remainder, metrics, maxWidth));
    }

    private static String ellipsize(String value, FontMetrics metrics, int maxWidth) {
        String suffix = "…";
        StringBuilder out = new StringBuilder();
        for (int cp : value.codePoints().toArray()) {
            String next = new String(Character.toChars(cp));
            if (metrics.stringWidth(out + next + suffix) > maxWidth) break;
            out.append(next);
        }
        return out + suffix;
    }

    private static String chooseFontFamily() {
        List<String> available = List.of(GraphicsEnvironment.getLocalGraphicsEnvironment()
                .getAvailableFontFamilyNames(Locale.CHINA));
        for (String candidate : List.of("Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "STHeiti", "Arial Unicode MS")) {
            if (available.stream().anyMatch(name -> name.equalsIgnoreCase(candidate))) return candidate;
        }
        return Font.SANS_SERIF;
    }
}
