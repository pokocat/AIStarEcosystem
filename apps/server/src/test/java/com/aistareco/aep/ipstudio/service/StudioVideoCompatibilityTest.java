package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Opt-in real ffmpeg acceptance using a locally supplied video; never calls a model or OSS. */
class StudioVideoCompatibilityTest {
    @TempDir Path directory;
    @ParameterizedTest @ValueSource(strings={"libx265","mpeg4","libx264"})
    void importsUnsupportedVideoAndAudioFromProvidedVideo(String codec) throws Exception {
        String demo=System.getProperty("studio.video.demo");assumeTrue(demo!=null&&!demo.isBlank());
        Path original=Path.of(demo);assertTrue(Files.isRegularFile(original));
        var ffmpeg=new FfmpegRunner(new MixcutProperties());
        Path source=directory.resolve("source.mp4"), normalized=directory.resolve("normalized.mp4");
        var args=new ArrayList<>(List.of("-v","error","-nostdin","-y","-threads","2","-i",original.toString(),
                "-t","1","-map","0:v:0","-map","0:a:0","-vf","scale=320:-2","-c:v",codec,"-threads","2"));
        if(codec.equals("libx265"))args.addAll(List.of("-x265-params","pools=1:frame-threads=1"));
        args.addAll(List.of("-c:a","libmp3lame",source.toString()));ffmpeg.runFfmpeg(args,30_000);
        var input=ffmpeg.probeMedia(source.toFile());assertEquals("mp3",input.audioCodec());
        var storage=mock(FileStorageService.class);var quota=mock(StorageQuotaService.class);
        when(storage.store(any(),anyString(),anyString(),anyString(),anyString())).thenAnswer(call->{
            byte[] bytes=call.getArgument(0);Files.write(normalized,bytes);
            return new FileStorageService.StoredFile("own/normalized.mp4",null,null,null,bytes.length,"video/mp4");
        });
        when(storage.signedUrl(anyString())).thenReturn("/signed.mp4");
        var result=new StudioMediaImportService(storage,quota,ffmpeg).upload("owner",
                new MockMultipartFile("file","my-video.mp4","video/mp4",Files.readAllBytes(source)),"video");
        var output=ffmpeg.probeMedia(normalized.toFile());
        assertTrue(output.readable());assertEquals("h264",output.videoCodec());assertEquals("aac",output.audioCodec());
        assertEquals(input.durationSec(),output.durationSec(),.5);assertEquals("video/mp4",result.mimeType());
        assertEquals(Files.size(normalized),result.bytes());assertEquals(320,output.width());
        verify(quota).record(eq("aiavatar"),eq("owner"),eq("画布附件"),isNull(),eq(result.key()),eq(result.bytes()));
    }
}
