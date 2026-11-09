package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in real Java → ReShot → temporal depth → storage handoff. No paid video-provider calls. */
@EnabledIfEnvironmentVariable(named="STUDIO_DEPTH_REAL",matches="1")
class StudioDepthVideoRealTest {
    @TempDir Path directory;
    @Test void realInferenceIsValidatedAndStoredWithoutChangingTheOriginal() throws Exception {
        verifyConversion(Path.of(System.getenv("STUDIO_DEPTH_SOURCE")),2);
    }
    /** STUDIO_DEPTH_SOURCES=a.mp4,b.mp4：真实素材（如 9861 / 9862），各自按原片画面时长核对，并打印选了骨骼还是深度。 */
    @Test void realReferencesKeepTheirPictureDuration() throws Exception {
        String list=System.getenv("STUDIO_DEPTH_SOURCES");
        org.junit.jupiter.api.Assumptions.assumeTrue(list!=null&&!list.isBlank());
        for(String file:list.split(",")) {
            Path source=Path.of(file.strip());
            var probe=new ProcessBuilder(System.getenv("STUDIO_DEPTH_FFPROBE"),"-v","error","-select_streams","v:0","-show_entries","stream=duration",
                    "-of","csv=p=0",source.toString()).redirectErrorStream(true).start();
            double seconds=Double.parseDouble(new String(probe.getInputStream().readAllBytes()).strip());
            verifyConversion(source,seconds);
        }
    }
    @Test void completeReferenceBeyond15SecondsIsProcessedWithoutTruncation() throws Exception {
        Path source=directory.resolve("long-reference.mp4");
        var process=new ProcessBuilder("ffmpeg","-v","error","-nostdin","-y","-f","lavfi","-i",
                "testsrc2=s=320x180:r=4:d=17","-c:v","libx264","-threads","2","-pix_fmt","yuv420p",source.toString()).start();
        assertTrue(process.waitFor(30,java.util.concurrent.TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        verifyConversion(source,17);
    }
    private void verifyConversion(Path source,double seconds) throws Exception {
        String root=System.getenv("STUDIO_DEPTH_HOME");
        byte[] original=Files.readAllBytes(source);
        var storage=mock(FileStorageService.class);var projects=mock(IpProjectService.class);
        when(projects.requireOwnedAssetKey("u","source.mp4")).thenReturn("source.mp4");when(storage.openForRead("source.mp4")).thenReturn(source);
        Path stored=directory.resolve("stored.mp4");
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("u"),eq("mp4"),eq("video/mp4"))).thenAnswer(i->{
            byte[] bytes=i.getArgument(0);Files.write(stored,bytes);
            return new FileStorageService.StoredFile("derived/depth.mp4",null,null,stored.toString(),bytes.length,"video/mp4");
        });
        var properties=new MixcutProperties();properties.setFfprobeBin(System.getenv("STUDIO_DEPTH_FFPROBE"));
        if(System.getenv("STUDIO_DEPTH_FFMPEG")!=null)properties.setFfmpegBin(System.getenv("STUDIO_DEPTH_FFMPEG"));
        var service=new StudioDepthVideoService(storage,projects,new FfmpegRunner(properties),new ObjectMapper(),
                root+"/venv/bin/reshot",root+"/weights/video_depth_anything_vits.pth",600000,
                System.getenv().getOrDefault("STUDIO_DEPTH_POSE_DIR",""),320,0.5);
        assertTrue(service.configured());
        var result=service.convert("u","source.mp4",()->true);
        assertEquals("derived/depth.mp4",result.path("storageKey").asText());
        System.out.println("[studio-depth-real] "+source.getFileName()+" "+result);
        assertTrue(java.util.Set.of("depth","pose").contains(result.path("controlType").asText()));assertFalse(result.path("mock").asBoolean());
        assertEquals(24,result.path("fps").asInt());
        // 转成恒定 24 帧后最多差一帧
        assertEquals(seconds,result.path("durationSec").asDouble(),.06);assertTrue(Files.size(stored)>2000);
        assertTrue(Math.max(result.path("width").asInt(),result.path("height").asInt())<=320,"按 ReShot 对 H3 的建议缩到长边 320");
        Files.copy(stored,directory.resolve("kept-"+source.getFileName()),StandardCopyOption.REPLACE_EXISTING);
        String keep=System.getenv("STUDIO_DEPTH_KEEP");
        if(keep!=null&&!keep.isBlank())Files.copy(stored,Path.of(keep).resolve(result.path("controlType").asText()+"-"+source.getFileName()),StandardCopyOption.REPLACE_EXISTING);
        assertArrayEquals(original,Files.readAllBytes(source));
    }
}
