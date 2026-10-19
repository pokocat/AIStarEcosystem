package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 2026-10-18 production: the Jusuan Qwen vision endpoint refused the film study's 2800 px contact sheets with
 * 400 unsupported_geometry ("visual activation/HBM headroom budget"). The retry sends the same frames, smaller.
 */
class StudioVisualBudgetTest {
    static final String BODY = "status=400 body={\"code\":\"unsupported_geometry\",\"error\":{\"message\":\"visual activation/HBM headroom budget\",\"retryable\":false}}";

    @Test void onlyTheVendorsGeometryRefusalIsTreatedAsOverBudget() {
        var refused = BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "AI 生成失败，请稍后重试", "endpoint=x " + BODY);
        assertTrue(StudioVisualContext.isVisualBudgetRejection(refused));
        assertTrue(StudioVisualContext.isVisualBudgetRejection(new RuntimeException(refused)));
        assertFalse(StudioVisualContext.isVisualBudgetRejection(BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "x", "status=429 body={}")));
        assertFalse(StudioVisualContext.isVisualBudgetRejection(new IllegalStateException("unsupported_geometry")), "only the upstream detail counts");
    }

    @Test void shrinkKeepsEveryPartInOrderAndOnlyReducesLargeImages() throws Exception {
        var big = StudioVisualContext.image(jpeg(2800, 1575), 2800);
        var small = StudioVisualContext.image(jpeg(400, 300), 2800);
        List<Map<String, Object>> parts = List.of(Map.of("type", "text", "text", "原片时间 00:00:01"), big, small);
        var out = StudioVisualContext.shrink(parts, 1024);
        assertEquals(3, out.size());
        assertEquals(parts.get(0), out.get(0));
        assertEquals(1024, width(out.get(1)));
        assertSame(small, out.get(2), "an image already within the edge is not re-encoded");
    }

    static byte[] jpeg(int w, int h) throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    @SuppressWarnings("unchecked")
    static int width(Map<String, Object> part) throws Exception {
        String url = (String) ((Map<String, Object>) part.get("image_url")).get("url");
        byte[] bytes = Base64.getDecoder().decode(url.substring(url.indexOf(",") + 1));
        return ImageIO.read(new ByteArrayInputStream(bytes)).getWidth();
    }
}
