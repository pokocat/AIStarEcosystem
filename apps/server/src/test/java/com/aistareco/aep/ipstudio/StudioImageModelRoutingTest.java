package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.service.StudioImageModelRouting;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class StudioImageModelRoutingTest {
    @Test void declaresTheProductResolutionRoutes() {
        assertEquals("gpt-image-2-1k-pic", StudioImageModelRouting.family("gpt-image-2").providerModels().get("1K"));
        assertEquals("gpt-image-2-1k-pic", StudioImageModelRouting.family("gpt-image-2").providerModels().get("2K"));
        assertEquals("gpt-image-2-4k-pic", StudioImageModelRouting.family("gpt-image-2").providerModels().get("4K"));
        assertEquals("gpt-image-2.5-flare-4k", StudioImageModelRouting.family("gpt-image-2.5-flare").providerModels().get("4K"));
        assertEquals("gpt-image-2.5-sunburst-1k", StudioImageModelRouting.family("gpt-image-2.5-sunburst").providerModels().get("2K"));
    }

    @Test void showsProductNamesWhileKeepingStableFamilyIds() {
        assertEquals("GPT Image 2", StudioImageModelRouting.family("studio-image:gpt-image-2").label());
        assertEquals("GPT Image 2.5", StudioImageModelRouting.family("studio-image:gpt-image-2.5-flare").label());
    }

    @Test void classifiesRequestedDimensionsAndRejectsUnknownFamilies() {
        assertEquals("1K", StudioImageModelRouting.tierForSize("1024x1365"));
        assertEquals("2K", StudioImageModelRouting.tierForSize("2048x2048"));
        assertEquals("4K", StudioImageModelRouting.tierForSize("4096x4096"));
        assertNull(StudioImageModelRouting.tierForSize("512x512"));
        assertNull(StudioImageModelRouting.family("studio-image:unknown"));
    }

    @Test void rejectsIncompleteOrMismatchedResolutionPrices() throws Exception {
        var json = new ObjectMapper();
        assertEquals(Map.of("gpt-image-2", Map.of("1K",20L,"2K",30L,"4K",30L)),
                StudioImageModelRouting.resolutionPrices(json.readTree("""
                        {"gpt-image-2":{"1K":20,"2K":30,"4K":30}}
                        """)));
        for (String value : new String[]{
                """
                {"gpt-image-2":{"1K":20,"2K":30}}
                """, """
                {"gpt-image-2":{"1K":20,"2K":30,"4K":0}}
                """, """
                {"gpt-image-unknown":{"1K":20,"2K":30,"4K":30}}
                """}) {
            assertThrows(BusinessException.class, () -> StudioImageModelRouting.resolutionPrices(json.readTree(value)));
        }
    }
}
