package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.*;

class StudioSourceAudioTest {
    final ObjectMapper om=new ObjectMapper();
    @TempDir Path directory;

    private Path video(String audio) throws Exception {
        Path input=directory.resolve(UUID.randomUUID()+".mp4");
        var args=new ArrayList<>(List.of("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=160x90:r=24:d=2"));
        if(audio!=null)args.addAll(List.of("-f","lavfi","-i",audio,"-c:a","aac","-shortest"));
        args.addAll(List.of("-c:v","libx264","-threads","2",input.toString()));
        Process process=new ProcessBuilder(args).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        assertTrue(process.waitFor(30,TimeUnit.SECONDS));assertEquals(0,process.exitValue());return input;
    }
    private ObjectNode source(){return om.createObjectNode().put("nodeId","video").put("title","原片").put("storageKey","source");}
    private FileStorageService storage(Path input) throws Exception {
        var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(input);
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("owner"),eq("wav"),eq("audio/wav"))).thenAnswer(call->{
            byte[] bytes=call.getArgument(0);Files.write(directory.resolve("extracted.wav"),bytes);
            return new FileStorageService.StoredFile("owned-audio.wav","","","",bytes.length,"audio/wav");
        });return storage;
    }
    @Test void realMixedSoundtrackIsAnOwnedPlayableWavAndResumeDoesNotExtractAgain() throws Exception {
        var storage=storage(video("sine=frequency=400:duration=2"));
        var result=StudioSourceAudio.extract(source(),om.createObjectNode(),storage,"owner");
        assertEquals("ready",result.path("status").asText());assertEquals("owned-audio.wav",result.path("storageKey").asText());assertFalse(result.has("url"));
        var probe=StudioLipSyncMedia.probe(directory.resolve("extracted.wav"));
        assertEquals(1,probe.path("streams").size());assertEquals("audio",probe.path("streams").path(0).path("codec_type").asText());
        assertEquals("pcm_s16le",probe.path("streams").path(0).path("codec_name").asText());assertEquals(2,probe.path("format").path("duration").asDouble(),.1);
        clearInvocations(storage);result.put("url","expired-signed-address");
        var resumed=StudioSourceAudio.extract(source(),result,storage,"owner");
        assertEquals(result.path("storageKey"),resumed.path("storageKey"));assertFalse(resumed.has("url"));verifyNoInteractions(storage);
    }
    @Test void noAudioDoesNotCreateAPlaceholderWhileSilentAudioIsStillExtracted() throws Exception {
        var absent=storage(video(null));var result=StudioSourceAudio.extract(source(),om.createObjectNode(),absent,"owner");
        assertEquals("absent",result.path("status").asText());assertFalse(result.has("storageKey"));verify(absent,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
        clearInvocations(absent);assertEquals(result,StudioSourceAudio.extract(source(),result,absent,"owner"));verifyNoInteractions(absent);
        var silent=storage(video("anullsrc=r=48000:cl=stereo:d=2"));
        assertEquals("ready",StudioSourceAudio.extract(source(),result.deepCopy().put("sourceStorageKey","different-source"),silent,"owner").path("status").asText(),"a different source must not reuse an absent-track result");
    }
    @Test void extractionFailureIsExplicitAndStoresNoFakeAudio() throws Exception {
        var storage=mock(FileStorageService.class);when(storage.openForRead("source")).thenReturn(directory.resolve("missing.mp4"));
        var error=assertThrows(com.aistareco.common.BusinessException.class,()->StudioSourceAudio.extract(source(),om.createObjectNode(),storage,"owner"));
        assertEquals("STUDIO_AUDIO_EXTRACTION_FAILED",error.getCode());verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
    }
    @Test void providedDemoExtractsWithoutAnySupplierCall() throws Exception {
        String demo=System.getProperty("studio.audio.demo");assumeTrue(demo!=null&&!demo.isBlank());
        Path input=Path.of(demo);var result=StudioSourceAudio.extract(source().put("title",input.getFileName().toString()),om.createObjectNode(),storage(input),"owner");
        double expected=StudioLipSyncMedia.probe(input).path("format").path("duration").asDouble();
        assertEquals("ready",result.path("status").asText());assertEquals(expected,result.path("durationSec").asDouble(),.3);
        String output=System.getProperty("studio.audio.output");
        if(output!=null){Path folder=Path.of(output);Files.createDirectories(folder);Files.copy(directory.resolve("extracted.wav"),folder.resolve("source-original.wav"),StandardCopyOption.REPLACE_EXISTING);Files.writeString(folder.resolve("acceptance.json"),result.toPrettyString());}
    }
}
