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
