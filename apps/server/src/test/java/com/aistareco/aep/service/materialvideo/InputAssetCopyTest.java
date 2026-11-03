package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.storage.ImageBytes;
import com.aistareco.aep.service.storage.MediaBytes;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class InputAssetCopyTest {

    private static final MediaBytes.Format PNG = new MediaBytes.Format(ImageBytes.PNG.ext(), ImageBytes.PNG.mime());
    private static final MediaBytes.Format JPEG = new MediaBytes.Format(ImageBytes.JPEG.ext(), ImageBytes.JPEG.mime());

    @Test
    void imagesStayDecodableWithSamePixels() throws Exception {
        for (String type : new String[]{"png", "jpg"}) {
            BufferedImage img = new BufferedImage(8, 6, BufferedImage.TYPE_INT_RGB);
            img.setRGB(2, 3, 0x123456);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, type, out);
            byte[] original = out.toByteArray();
            byte[] copy = InputAssetCopy.distinct("png".equals(type) ? PNG : JPEG, original);
            assertNotNull(copy, type);
            assertFalse(Arrays.equals(original, copy), type);
            BufferedImage a = ImageIO.read(new ByteArrayInputStream(original));
            BufferedImage b = ImageIO.read(new ByteArrayInputStream(copy));
            assertEquals(a.getWidth(), b.getWidth());
            assertEquals(a.getRGB(2, 3), b.getRGB(2, 3), type);
            assertFalse(Arrays.equals(copy, InputAssetCopy.distinct("png".equals(type) ? PNG : JPEG, original)), "每次都不同");
        }
    }

    @Test
    void wavRiffSizeIsUpdatedAndUnknownFormatsAreLeftAlone() {
        byte[] wav = new byte[44];
        System.arraycopy("RIFF".getBytes(), 0, wav, 0, 4);
        wav[4] = 36;
        System.arraycopy("WAVE".getBytes(), 0, wav, 8, 4);
        byte[] copy = InputAssetCopy.distinct(MediaBytes.WAV, wav);
        int riff = (copy[4] & 0xFF) | (copy[5] & 0xFF) << 8 | (copy[6] & 0xFF) << 16 | (copy[7] & 0xFF) << 24;
        assertEquals(copy.length - 8, riff);
        assertEquals(0, copy.length % 2);
        assertNull(InputAssetCopy.distinct(MediaBytes.MP3, new byte[]{'I', 'D', '3'}));
        assertTrue(InputAssetCopy.isBindingConflict(409, "{\"code\":\"input_asset_binding_conflict\"}"));
        assertFalse(InputAssetCopy.isBindingConflict(400, "{\"code\":\"input_asset_binding_conflict\"}"));
    }

    @Test
    void mp4GetsTrailingFreeBox() {
        byte[] mp4 = {0, 0, 0, 8, 'f', 't', 'y', 'p'};
        byte[] copy = InputAssetCopy.distinct(MediaBytes.MP4, mp4);
        int size = (copy[8] & 0xFF) << 24 | (copy[9] & 0xFF) << 16 | (copy[10] & 0xFF) << 8 | (copy[11] & 0xFF);
        assertEquals(copy.length - 8, size);
        assertEquals("free", new String(copy, 12, 4));
    }
}
