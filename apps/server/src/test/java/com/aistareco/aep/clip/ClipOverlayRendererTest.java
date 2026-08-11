package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipOverlayRenderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class ClipOverlayRendererTest {
    @TempDir Path temp;

    @Test
    void rendersPermanentAiBadgeAndTwoLineCaptionLayer() throws Exception {
        ClipOverlayRenderer renderer = new ClipOverlayRenderer();
        Path output = renderer.render(temp, 2,
                "每天早上七点，卷闸门一拉开，这条街才算醒了。这句故意写长，用来验证两行截断。再补一点。 ");

        assertTrue(Files.size(output) > 1_000);
        BufferedImage image = ImageIO.read(output.toFile());
        assertEquals(720, image.getWidth());
        assertEquals(1280, image.getHeight());
        assertTrue(alphaPixels(image, 0, 0, 720, 140) > 1_000, "AI badge must occupy top safe area");
        assertTrue(alphaPixels(image, 0, 950, 720, 330) > 10_000, "caption must occupy bottom safe area");
    }

    @Test
    void rendersTemplateSpecificOpaqueFixedTailCard() throws Exception {
        ClipOverlayRenderer renderer = new ClipOverlayRenderer();
        Path entity = renderer.renderTail(temp, 14, "ct_shiti", "为实体发声");
        Path craft = renderer.renderTail(temp, 15, "ct_shouyi", "这门手艺");

        BufferedImage image = ImageIO.read(entity.toFile());
        assertEquals(720, image.getWidth());
        assertEquals(1280, image.getHeight());
        assertEquals(720L * 1280L, alphaPixels(image, 0, 0, 720, 1280), "fixed tail must cover the whole frame");
        assertFalse(Arrays.equals(Files.readAllBytes(entity), Files.readAllBytes(craft)), "templates need distinct closing copy");
    }

    @Test
    void stampsTestMediaPermanentlyIntoTopLeftCorner() throws Exception {
        ClipOverlayRenderer renderer = new ClipOverlayRenderer();
        Path output = renderer.render(temp, 3, "测试口播");
        BufferedImage before = ImageIO.read(output.toFile());
        long beforePixels = alphaPixels(before, 20, 30, 180, 90);

        renderer.markAsTest(output);

        BufferedImage after = ImageIO.read(output.toFile());
        assertTrue(alphaPixels(after, 20, 30, 180, 90) > beforePixels + 3_000,
                "test media must carry a visible permanent badge");
    }

    private static long alphaPixels(BufferedImage image, int x, int y, int w, int h) {
        long count = 0;
        for (int py = y; py < Math.min(image.getHeight(), y + h); py++) {
            for (int px = x; px < Math.min(image.getWidth(), x + w); px++) {
                if (((image.getRGB(px, py) >>> 24) & 0xff) > 0) count++;
            }
        }
        return count;
    }
}
