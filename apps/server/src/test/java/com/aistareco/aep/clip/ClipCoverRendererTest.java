package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipCoverPlan;
import com.aistareco.aep.clip.service.ClipCoverRenderer;
import com.aistareco.aep.service.picgen.FontRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ClipCoverRendererTest {
    @TempDir Path temp;
    private static FontRegistry fonts;

    @BeforeAll
    static void loadFonts() {
        fonts = new FontRegistry();
        fonts.load();
    }

    private static ClipCoverPlan.Spec spec(String keyword, String handle, List<String> slogan, String signature) {
        Map<String, Object> cover = new LinkedHashMap<>();
        cover.put("enabled", true);
        cover.put("keyword", keyword);
        cover.put("handle", handle);
        cover.put("sloganLines", slogan);
        cover.put("signature", signature);
        return ClipCoverPlan.parse(Map.of("cover", cover)).orElseThrow();
    }

    @Test
    void rendersFullSpecCoverAtWorkResolutionWithAllFourElements() throws Exception {
        ClipCoverRenderer renderer = new ClipCoverRenderer(fonts);

        Path output = renderer.render(temp, spec("团结", "@可乐米乐麻麻讲Ai",
                List.of("一群人一条心", "一件事一起拼"), "集体为实体发声"), null);

        assertTrue(Files.size(output) > 1_000);
        BufferedImage image = ImageIO.read(output.toFile());
        assertEquals(720, image.getWidth());
        assertEquals(1280, image.getHeight());

        // 1) 亮黄书法关键词横跨顶部约 1/4
        assertTrue(near(image, 0, 0, 720, 320, 0xFFE400, 60) > 3_000,
                "顶部 1/4 必须有成片量的亮黄书法笔画");
        // 2) 白底黑字账号名标签在中部偏下，且靠左
        assertTrue(near(image, 40, 770, 320, 90, 0xFFFFFF, 12) > 4_000,
                "账号名白底标签必须出现在左侧中下部");
        // 3) 白色标语 + 4) 金色落款在下半屏
        assertTrue(near(image, 0, 880, 720, 140, 0xFFFFFF, 30) > 2_000, "两行白色标语");
        assertTrue(near(image, 0, 1050, 720, 160, 0xE0B23A, 90) > 1_500, "金色渐变落款");
    }

    @Test
    void keepsRenderingWhenOnlySomeSlotsAreFilled() throws Exception {
        ClipCoverRenderer renderer = new ClipCoverRenderer(fonts);

        Path output = renderer.render(temp, spec("坚持", "", List.of(), ""), null);

        BufferedImage image = ImageIO.read(output.toFile());
        assertTrue(near(image, 0, 0, 720, 320, 0xFFE400, 60) > 3_000, "只填关键词也要出图");
        assertEquals(0, near(image, 40, 770, 320, 90, 0xFFFFFF, 6),
                "没填账号名就不该画出空白底标签");
    }

    @Test
    void differentCopyProducesDifferentCovers() throws Exception {
        ClipCoverRenderer renderer = new ClipCoverRenderer(fonts);

        Path a = renderer.render(temp, spec("团结", "@甲", List.of("一群人一条心"), "集体为实体发声"), null);
        byte[] first = Files.readAllBytes(a);
        Path b = renderer.render(temp, spec("破局", "@乙", List.of("一件事一起拼"), "让手艺被看见"), null);

        assertFalse(Arrays.equals(first, Files.readAllBytes(b)), "换了文案封面必须跟着变");
    }

    @Test
    void usesUserBackgroundScaledToFillTheFrame() throws Exception {
        // 横幅底图：等比铺满 + 居中裁切后，四角都应该是底图的洋红，而不是留黑边
        Path background = temp.resolve("bg.png");
        BufferedImage source = new BufferedImage(1600, 900, BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = source.createGraphics();
        g.setColor(new Color(0xFF00FF));
        g.fillRect(0, 0, 1600, 900);
        g.dispose();
        ImageIO.write(source, "png", background.toFile());
        ClipCoverRenderer renderer = new ClipCoverRenderer(fonts);

        Path output = renderer.render(temp, spec("团结", "", List.of(), ""), background);

        BufferedImage image = ImageIO.read(output.toFile());
        assertTrue(near(image, 0, 560, 40, 160, 0xFF00FF, 40) > 3_000, "左中缘必须是底图而不是黑边");
        assertTrue(near(image, 680, 560, 40, 160, 0xFF00FF, 40) > 3_000, "右中缘必须是底图而不是黑边");
    }

    @Test
    void fallsBackToGradientWhenBackgroundIsUnreadable() throws Exception {
        Path broken = temp.resolve("broken.png");
        Files.writeString(broken, "not an image");
        ClipCoverRenderer renderer = new ClipCoverRenderer(fonts);

        Path output = renderer.render(temp, spec("团结", "", List.of(), ""), broken);

        BufferedImage image = ImageIO.read(output.toFile());
        assertEquals(720, image.getWidth());
        // 底图坏了不能整片失败：兜底渐变仍要出图，关键词照画
        assertTrue(near(image, 0, 0, 720, 320, 0xFFE400, 60) > 3_000);
    }

    /** 统计矩形区域内与目标色距离在 tolerance 内的像素数。 */
    private static long near(BufferedImage image, int x, int y, int w, int h, int rgb, int tolerance) {
        int tr = (rgb >> 16) & 0xff, tg = (rgb >> 8) & 0xff, tb = rgb & 0xff;
        long count = 0;
        for (int py = y; py < Math.min(image.getHeight(), y + h); py++) {
            for (int px = x; px < Math.min(image.getWidth(), x + w); px++) {
                int value = image.getRGB(px, py);
                if (Math.abs(((value >> 16) & 0xff) - tr) <= tolerance
                        && Math.abs(((value >> 8) & 0xff) - tg) <= tolerance
                        && Math.abs((value & 0xff) - tb) <= tolerance) count++;
            }
        }
        return count;
    }
}
