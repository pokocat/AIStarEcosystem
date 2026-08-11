package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipOverlayRenderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;

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
