package com.aistareco.aep.service.ai;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.net.http.*;
import java.nio.file.*;
import java.io.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoAnalysisFramesTest {
    @Test void realVideoBytesBecomeFourActualImageParts() throws Exception {
        Path video=Files.createTempFile("analysis-test-",".mp4");
        try {
            var process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-f","lavfi","-i","color=c=red:s=128x128:d=2","-pix_fmt","yuv420p","-y",video.toString()).start();
            assertEquals(0,process.waitFor());var http=mock(HttpClient.class);var reply=mock(HttpResponse.class);
            when(reply.statusCode()).thenReturn(200);when(reply.headers()).thenReturn(HttpHeaders.of(Map.of(),(a,b)->true));
            when(reply.body()).thenReturn(new ByteArrayInputStream(Files.readAllBytes(video)));when(http.send(any(),any())).thenReturn(reply);
            var sample=new VideoAnalysisFrames(http).sample("https://8.8.8.8/video.mp4");
            assertEquals(2,sample.durationSec(),0.1);assertEquals(4,sample.parts().stream().filter(p->"image_url".equals(p.get("type"))).count());
            for(var part:sample.parts())if("image_url".equals(part.get("type")))assertTrue(((Map<?,?>)part.get("image_url")).get("url").toString().startsWith("data:image/jpeg;base64,"));
        } finally {Files.deleteIfExists(video);}
    }
    @Test void privateOrCredentialedSourcesAndRedirectsNeverReachInternalResources() throws Exception {
        var http=mock(HttpClient.class);var frames=new VideoAnalysisFrames(http);
        assertThrows(BusinessException.class,()->frames.sample("http://127.0.0.1/video"));
        assertThrows(BusinessException.class,()->frames.sample("https://key:secret@8.8.8.8/video"));
        verifyNoInteractions(http);
        var reply=mock(HttpResponse.class);when(reply.statusCode()).thenReturn(302);
        when(reply.headers()).thenReturn(HttpHeaders.of(Map.of("Location",List.of("http://169.254.169.254/latest/meta-data")),(a,b)->true));
        when(reply.body()).thenReturn(new ByteArrayInputStream(new byte[0]));when(http.send(any(),any())).thenReturn(reply);
        assertThrows(BusinessException.class,()->frames.sample("https://8.8.8.8/video"));verify(http).send(any(),any());
    }
}
