package com.aistareco.aep.aiavatar.provider;

import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.util.List;

/**
 * 纯 Java2D 占位图生成器 —— 还原原型的「深色 + 琥珀主色 + 等宽元数据 + .ph 占位图」视觉系统。
 *
 * Mock Provider 用它产出「示意资产」：真实可查看的 PNG，带能力名 / 参数 / 来源角标 / 人像剪影，
 * 让任务管线、状态机、前端进度条、画廊在 mock 下被同等地走通（任务书 §5）。
 *
 * 无外部进程 / 无字体文件依赖（headless 安全）。标题用等宽 ASCII（capability wire），
 * 中文标签 best-effort（容器无 CJK 字体时退化为方框不影响占位语义）。
 */
public final class AiAvatarImageGen {

    private AiAvatarImageGen() {}

    // 设计 token（对齐前端 tokens.css dark + amber 主题）
    private static final Color BG = new Color(0x0F, 0x0F, 0x10);
    private static final Color BG_CARD = new Color(0x17, 0x17, 0x19);
    private static final Color AMBER = new Color(0xF0, 0xA8, 0x3A);
    private static final Color AMBER_SOFT = new Color(0xF0, 0xA8, 0x3A, 28);
    private static final Color INK_HI = new Color(0xF5, 0xF1, 0xE8);
    private static final Color INK_MUTE = new Color(0x9A, 0x8F, 0x7A);

    /**
     * 生成一张占位图。
     *
     * @param w        宽
     * @param h        高
     * @param title    主标题（建议 ASCII，如 capability wire）
     * @param subtitle 副标题（中文 best-effort）
     * @param lines    元数据行（等宽小字）
     * @param badge    右上角角标（如 "MOCK" / "InstantID"）
     * @param portrait 是否画人像剪影
     * @param seed     伪随机种子（决定剪影位置 / 色相微扰，保证同输入同输出）
     */
    public static BufferedImage placeholder(int w, int h, String title, String subtitle,
                                            List<String> lines, String badge,
                                            boolean portrait, long seed) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        java.util.Random rnd = new java.util.Random(seed);

        // 背景
        g.setColor(BG);
        g.fillRect(0, 0, w, h);

        // .ph 对角琥珀斜纹
        g.setColor(AMBER_SOFT);
        g.setStroke(new BasicStroke(2f));
        int step = Math.max(14, w / 26);
        for (int x = -h; x < w; x += step) {
            g.drawLine(x, 0, x + h, h);
        }

        // 人像剪影（半身）
        if (portrait) {
            int cx = w / 2 + (int) ((rnd.nextDouble() - 0.5) * w * 0.06);
            int headR = (int) (Math.min(w, h) * 0.16);
            int headCy = (int) (h * 0.40);
            g.setColor(new Color(0xF0, 0xA8, 0x3A, 36));
            // 肩
            g.fill(new Ellipse2D.Double(cx - headR * 2.1, headCy + headR * 0.9, headR * 4.2, headR * 3.2));
            // 头
            g.setColor(new Color(0xF0, 0xA8, 0x3A, 60));
            g.fill(new Ellipse2D.Double(cx - headR, headCy - headR, headR * 2.0, headR * 2.0));
            // 重置 BG 卡片遮住下半防止与文字重叠
        }

        // 中央信息卡
        int cardPad = Math.max(16, w / 18);
        int cardX = cardPad;
        int cardY = (int) (h * 0.58);
        int cardW = w - cardPad * 2;
        int cardH = h - cardY - cardPad;
        g.setColor(new Color(0x17, 0x17, 0x19, 220));
        g.fill(new RoundRectangle2D.Double(cardX, cardY, cardW, cardH, 18, 18));
        g.setColor(new Color(0xF0, 0xA8, 0x3A, 90));
        g.setStroke(new BasicStroke(1.5f));
        g.draw(new RoundRectangle2D.Double(cardX, cardY, cardW, cardH, 18, 18));

        // 标题（等宽 ASCII）
        int titleSize = Math.max(18, w / 16);
        g.setFont(new Font(Font.MONOSPACED, Font.BOLD, titleSize));
        g.setColor(INK_HI);
        if (title != null) {
            g.drawString(title, cardX + 18, cardY + 18 + titleSize);
        }

        // 副标题（中文 best-effort）
        int subSize = Math.max(12, w / 30);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, subSize));
        g.setColor(AMBER);
        int ty = cardY + 18 + titleSize + subSize + 10;
        if (subtitle != null) {
            g.drawString(subtitle, cardX + 18, ty);
            ty += subSize + 8;
        }

        // 元数据行（等宽小字）
        int metaSize = Math.max(10, w / 38);
        g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, metaSize));
        g.setColor(INK_MUTE);
        if (lines != null) {
            for (String line : lines) {
                if (ty > cardY + cardH - 8) break;
                g.drawString(line, cardX + 18, ty);
                ty += metaSize + 6;
            }
        }

        // 右上角角标
        if (badge != null && !badge.isBlank()) {
            int badgeSize = Math.max(11, w / 34);
            g.setFont(new Font(Font.MONOSPACED, Font.BOLD, badgeSize));
            FontMetrics fm = g.getFontMetrics();
            int bw = fm.stringWidth(badge) + 20;
            int bh = badgeSize + 12;
            int bx = w - bw - cardPad;
            int by = cardPad;
            g.setColor(AMBER);
            g.fill(new RoundRectangle2D.Double(bx, by, bw, bh, bh, bh));
            g.setColor(BG);
            g.drawString(badge, bx + 10, by + bh - 9);
        }

        g.dispose();
        return img;
    }

    /** 在已有图基础上叠加一层标签（用于 img2img / refine 的「在上一版基础上修改」语义）。 */
    public static BufferedImage overlayLabel(BufferedImage base, String label, String badge) {
        BufferedImage img = new BufferedImage(base.getWidth(), base.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.drawImage(base, 0, 0, null);
        int w = base.getWidth();
        int barH = Math.max(28, w / 12);
        g.setColor(new Color(0, 0, 0, 150));
        g.fillRect(0, base.getHeight() - barH, w, barH);
        g.setColor(AMBER);
        g.setFont(new Font(Font.MONOSPACED, Font.BOLD, Math.max(11, w / 32)));
        if (label != null) g.drawString(label, 12, base.getHeight() - barH / 3);
        if (badge != null) {
            FontMetrics fm = g.getFontMetrics();
            g.setColor(INK_MUTE);
            g.drawString(badge, w - fm.stringWidth(badge) - 12, base.getHeight() - barH / 3);
        }
        g.dispose();
        return img;
    }
}
