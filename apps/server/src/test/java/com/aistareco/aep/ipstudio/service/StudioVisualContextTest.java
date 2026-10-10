package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVisualContextTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @TempDir Path directory;
    @Test void capabilityNeedsAnExplicitMatchingModelDeclaration() {
        var endpoint=AiModelEndpoint.builder().model("model").modelsJson("[{\"id\":\"other\",\"supportsVision\":true}]").build();
        assertFalse(StudioVisualContext.supportsVision(endpoint));endpoint.setModelsJson("[{\"id\":\"model\",\"supportsVision\":true}]");assertTrue(StudioVisualContext.supportsVision(endpoint));
        endpoint.setModelsJson("invalid");assertFalse(StudioVisualContext.supportsVision(endpoint));
    }
    @Test void snapshotUsesTheSelectedCandidateAndChecksEveryOwnedKey() throws Exception {
        var projects=mock(IpProjectService.class);
        var doc=mapper.readTree("{\"nodes\":[{\"id\":\"i\",\"type\":\"image\",\"title\":\"人\",\"metadata\":{\"storageKey\":\"old\",\"primaryImageId\":\"b\",\"images\":[{\"id\":\"a\",\"storageKey\":\"first\"},{\"id\":\"b\",\"storageKey\":\"selected\"}]}},{\"id\":\"a\",\"type\":\"audio\",\"metadata\":{\"storageKey\":\"audio\"}}]}");
        var result=StudioVisualContext.snapshot(doc,List.of("i","a","i"),projects,"owner");assertEquals(1,result.size());assertEquals("selected",result.get(0).path("storageKey").asText());verify(projects).requireOwnedAssetKey("owner","selected");verifyNoMoreInteractions(projects);
        doThrow(BusinessException.badRequest("FOREIGN","外人素材")).when(projects).requireOwnedAssetKey("owner","selected");assertThrows(BusinessException.class,()->StudioVisualContext.snapshot(doc,List.of("i"),projects,"owner"));
    }
    @Test void missingImagesAndExcessFrameBudgetsRejectBeforeModelInvocation() throws Exception {
        var doc=mapper.readTree("{\"nodes\":[{\"id\":\"empty\",\"type\":\"image\",\"metadata\":{}}]}");
        assertEquals("STUDIO_VISUAL_MISSING",assertThrows(BusinessException.class,()->StudioVisualContext.snapshot(doc,List.of("empty"),mock(IpProjectService.class),"owner")).getCode());
        var nodes=((com.fasterxml.jackson.databind.node.ObjectNode)doc).putArray("nodes");var ids=new ArrayList<String>();
        for(int i=0;i<5;i++){ids.add("v"+i);nodes.addObject().put("id","v"+i).put("type","video").putObject("metadata").put("storageKey","video"+i);}
        assertEquals("STUDIO_VISUAL_LIMIT",assertThrows(BusinessException.class,()->StudioVisualContext.snapshot(doc,ids,mock(IpProjectService.class),"owner")).getCode());
    }
    @Test void imagesCarryActualBytesAndNodeIdentityWithoutPersistedUrls() throws Exception {
        Path picture=directory.resolve("source.png");var bitmap=new BufferedImage(20,30,BufferedImage.TYPE_INT_RGB);ImageIO.write(bitmap,"png",picture.toFile());
        var storage=mock(FileStorageService.class);when(storage.openForRead("owned-key")).thenReturn(picture);
        var snapshot=mapper.readTree("[{\"nodeId\":\"image-id\",\"title\":\"角色\",\"type\":\"image\",\"storageKey\":\"owned-key\"}]");
        var parts=new StudioVisualContext(storage).parts("question",snapshot);
        assertEquals(3,parts.size());assertTrue(parts.get(1).get("text").toString().contains("image-id"));
        String url=((Map<?,?>)parts.get(2).get("image_url")).get("url").toString();assertTrue(url.startsWith("data:image/jpeg;base64,"));assertFalse(snapshot.toString().contains("base64"));verify(storage).openForRead("owned-key");
        Files.writeString(picture,"corrupt");assertEquals("STUDIO_VISUAL_UNREADABLE",assertThrows(BusinessException.class,()->new StudioVisualContext(storage).parts("question",snapshot)).getCode());
    }
    @Test void aRealVideoProducesFourOrderedFramesAndNeverAnAudioPart() throws Exception {
        Path video=directory.resolve("clip.mp4");var process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-f","lavfi","-i","color=c=blue:s=160x120:r=24:d=1","-c:v","libx264","-pix_fmt","yuv420p","-y",video.toString()).start();assertTrue(process.waitFor(20,java.util.concurrent.TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        var storage=mock(FileStorageService.class);when(storage.openForRead("video-key")).thenReturn(video);
        var snapshot=mapper.readTree("[{\"nodeId\":\"video-id\",\"title\":\"短片\",\"type\":\"video\",\"storageKey\":\"video-key\"}]");
        var parts=new StudioVisualContext(storage).parts("question",snapshot);assertEquals(10,parts.size());assertEquals(4,parts.stream().filter(p->"image_url".equals(p.get("type"))).count());assertTrue(parts.get(1).get("text").toString().contains("不包含音轨"));assertTrue(parts.get(2).get("text").toString().contains("1/4"));assertTrue(parts.get(8).get("text").toString().contains("4/4"));
    }
}
