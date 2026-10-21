package com.aistareco.aep.service.ai;
import com.aistareco.aep.ipstudio.service.JusuanImageClient;
import com.aistareco.aep.model.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfiguredImageGeneratorTest {
    final AiImageRequestSpec spec=new AiImageRequestSpec(32000,0,16,"multiple",List.of(
            new AiImageRequestSpec.Output("1024x1024","1:1",Map.of()),
            new AiImageRequestSpec.Output("1024x1536","2:3",Map.of()),
            new AiImageRequestSpec.Output("768x1024","3:4",Map.of()),
            new AiImageRequestSpec.Output("1536x1024","3:2",Map.of()),
            new AiImageRequestSpec.Output("2048x2048","1:1",Map.of())));
    @Test void legacyPortraitKeepsItsCanvasAndAppPurposeWhileNativeOutputStaysExact() throws Exception {
        var transport=mock(JusuanImageClient.class);var service=new ConfiguredImageGenerator(transport);
        var endpoint=AiModelEndpoint.builder().enabled(true).baseUrl("https://images.example/v1").model("gpt-image-2-1k-pic")
                .imageRequestSpecJson(spec.json()).build();
        var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(1024,1536,BufferedImage.TYPE_INT_RGB),"png",out);
        when(transport.generateResolved(eq(endpoint),eq(AiModelPurpose.DAP_IMAGE),eq("aiavatar"),eq("portrait"),eq("1024x1536"),eq(List.of("reference")),anyString())).thenReturn(out.toByteArray());
        byte[] result=service.generate(endpoint,AiModelPurpose.DAP_IMAGE,"aiavatar","portrait","768x1152",List.of("reference"));
        var image=ImageIO.read(new ByteArrayInputStream(result));assertEquals(768,image.getWidth());assertEquals(1152,image.getHeight());
        assertEquals("2048x2048",ConfiguredImageGenerator.providerSize(spec,"2048x2048"));
        assertEquals("1536x1024",ConfiguredImageGenerator.providerSize(spec,"1024x640"));
        verify(transport).generateResolved(eq(endpoint),eq(AiModelPurpose.DAP_IMAGE),eq("aiavatar"),anyString(),eq("1024x1536"),eq(List.of("reference")),anyString());
    }
    @Test void unsupportedRatioAndInvalidDimensionsFailBeforeAnyPaidRequest() {
        assertThrows(BusinessException.class,()->ConfiguredImageGenerator.providerSize(spec,"1920x600"));
        assertThrows(BusinessException.class,()->ConfiguredImageGenerator.providerSize(spec,"99999x99999"));
    }
}
