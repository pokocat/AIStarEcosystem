package com.aistareco.aep.dap.service;

import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.imageio.ImageIO;

/**
 * dap 领域小工具：业务 id 生成 / 中文相对时间 / 占位画像 PNG（未配置生成引擎时的降级产物）。
 */
@Component
public class DapSupport {

    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final SecureRandom RND = new SecureRandom();
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    // ── 业务 id ────────────────────────────────────────────────

    /** 形如 DH-48213 的业务 id（5 位随机数，调用方负责唯一性重试）。 */
    public String newId(String prefix) {
        return prefix + "-" + (10000 + RND.nextInt(90000));
    }

    // ── 时间展示 ──────────────────────────────────────────────

    /** 中文相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前 / M-d。 */
    public String relativeZh(Instant t) {
        if (t == null) return "—";
        Duration d = Duration.between(t, Instant.now());
        long m = d.toMinutes();
        if (m < 1) return "刚刚";
        if (m < 60) return m + " 分钟前";
        long h = d.toHours();
        if (h < 24) return h + " 小时前";
        long days = d.toDays();
        if (days == 1) return "昨天";
        if (days < 7) return days + " 天前";
        return DateTimeFormatter.ofPattern("M 月 d 日").withZone(ZONE).format(t);
    }

    /** HH:mm（任务开始时间）。 */
    public String hm(Instant t) {
        return t == null ? "—" : HM.withZone(ZONE).format(t);
    }

    // ── 占位调色板（按 hue 派生，复刻前端 Portrait 渐变规则）──────

    public Map<String, Object> paletteFor(int hue) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("bg1", hsl(hue, 20, 94));
        p.put("bg2", hsl(hue, 18, 86));
        p.put("skin", "#F2D6BE");
        p.put("hair", "#2A2433");
        p.put("cloth", hsl(hue, 24, 92));
        p.put("accent", hsl((hue + 40) % 360, 70, 70));
        return p;
    }

    private static String hsl(int h, int s, int l) {
        float c = (1 - Math.abs(2 * l / 100f - 1)) * s / 100f;
        float x = c * (1 - Math.abs((h / 60f) % 2 - 1));
        float m = l / 100f - c / 2;
        float r = 0, g = 0, b = 0;
        int seg = (h % 360) / 60;
        switch (seg) {
            case 0 -> { r = c; g = x; }
            case 1 -> { r = x; g = c; }
            case 2 -> { g = c; b = x; }
            case 3 -> { g = x; b = c; }
            case 4 -> { r = x; b = c; }
            default -> { r = c; b = x; }
        }
        return String.format("#%02X%02X%02X",
                Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
    }

    // ── 占位画像 PNG（降级产物）──────────────────────────────────

    /**
     * 生成一张「占位画像」：柔和渐变底 + 人形剪影 + 标签。
     * 仅在未配置生成引擎（admin「AI 应用绑定」未绑 DAP_* 端点）时使用，产物会被打 mock 标记。
     */
    public byte[] placeholderPortrait(int hue, String label, int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Color c1 = Color.decode(hsl(hue, 26, 92));
        Color c2 = Color.decode(hsl((hue + 24) % 360, 22, 80));
        g.setPaint(new GradientPaint(0, 0, c1, w, h, c2));
        g.fillRect(0, 0, w, h);

        // 人形剪影
        Color fg = Color.decode(hsl(hue, 16, 60));
        g.setColor(fg);
        int headR = w / 5;
        g.fillOval(w / 2 - headR, (int) (h * 0.30) - headR, headR * 2, headR * 2);
        g.fillArc(w / 2 - (int) (w * 0.32), (int) (h * 0.52), (int) (w * 0.64), (int) (h * 0.62), 0, 180);

        // 光环装饰
        g.setColor(new Color(255, 255, 255, 70));
        g.drawOval(w / 2 - (int) (w * 0.28), (int) (h * 0.30) - (int) (w * 0.28), (int) (w * 0.56), (int) (w * 0.56));

        if (label != null && !label.isBlank()) {
            g.setFont(new Font("SansSerif", Font.BOLD, Math.max(12, w / 18)));
            g.setColor(new Color(40, 50, 64, 200));
            g.drawString(label, w / 18f, h - h / 22f);
        }
        g.dispose();
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("placeholder render failed", e);
        }
    }
}
