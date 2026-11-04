package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.common.BusinessException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StudioAudioReferenceTest {
    @TempDir Path dir;
    byte[] wav(int seconds) {
        int frames=seconds*24000;
        var b=ByteBuffer.allocate(44+frames*2).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(36+frames*2).put("WAVEfmt ".getBytes()).putInt(16)
                .putShort((short)1).putShort((short)1).putInt(24000).putInt(48000).putShort((short)2).putShort((short)16)
                .put("data".getBytes()).putInt(frames*2);
        for(int i=0;i<frames;i++)b.putShort((short)(i%3000-1500));
        return b.array();
    }
    FileStorageService storage(Path source) throws Exception {
        var storage=mock(FileStorageService.class);
        when(storage.openForRead("original")).thenReturn(source);
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("u"),eq("wav"),eq("audio/wav")))
                .thenAnswer(i->{var bytes=(byte[])i.getArgument(0);var target=dir.resolve("derived.wav");Files.write(target,bytes);
                    return new FileStorageService.StoredFile("derived",null,null,target.toString(),bytes.length,"audio/wav");});
        when(storage.openForRead("derived")).thenReturn(dir.resolve("derived.wav"));
        return storage;
    }
    @Test void usesTheFirst149SecondsAndReusesTheDerivedKeyWithoutChangingOriginal() throws Exception {
        var source=dir.resolve("original.wav");var bytes=wav(30);Files.write(source,bytes);
        var storage=storage(source);var ffmpeg=spy(new FfmpegRunner(new MixcutProperties()));
        var service=new StudioAudioReference(storage,ffmpeg);
        var sample=service.prepare("u","original");
        assertEquals("derived",sample.key());assertEquals(14.9,sample.durationSec());assertEquals(30,sample.sourceDurationSec(),.001);
        assertArrayEquals(bytes,Files.readAllBytes(source));
        var output=dir.resolve("derived.wav");assertEquals(14.9,ffmpeg.probeMedia(output.toFile()).durationSec(),.000001);
        var derived=Files.readAllBytes(output);var b=ByteBuffer.wrap(derived).order(ByteOrder.LITTLE_ENDIAN);int offset=12;
        while(!new String(derived,offset,4).equals("data"))offset+=8+b.getInt(offset+4)+(b.getInt(offset+4)%2);
        var data=java.util.Arrays.copyOfRange(derived,offset+8,offset+8+b.getInt(offset+4));
        assertArrayEquals(java.util.Arrays.copyOfRange(bytes,44,44+(int)(14.9*48000)),data);
        assertEquals(sample,service.prepare("u","original"));
        verify(ffmpeg,times(1)).runFfmpeg(anyList(),eq(60_000L));
    }
    /** 2026-11-04 线上：不足 14.9 秒的 M4A 过了资产库，到 Seedance（只收 WAV / MP3）才被拒。 */
    @Test void aShortM4aBecomesAWavTheSeedanceRulesAccept() throws Exception {
        var wavSource=dir.resolve("source.wav");Files.write(wavSource,wav(6));
        var source=dir.resolve("original.m4a");
        var ffmpeg=spy(new FfmpegRunner(new MixcutProperties()));
        ffmpeg.runFfmpeg(List.of("-v","error","-nostdin","-y","-i",wavSource.toString(),"-c:a","aac",source.toString()),60_000);
        var original=Files.readAllBytes(source);
        assertEquals("M4A ",new String(original,8,4));
        clearInvocations(ffmpeg);
        var storage=storage(source);
        var projects=mock(IpProjectService.class);when(projects.requireOwnedAssetKey(anyString(),anyString())).thenAnswer(i->i.getArgument(1));
        var service=new StudioVideoService(mock(AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage,ffmpeg);
        var seedance=seedanceMode();
        var rejected=assertThrows(BusinessException.class,()->service.requireMedia("u","audio","original",false,seedance));
        assertEquals("STUDIO_VIDEO_ASSET_INVALID",rejected.getCode());

        var references=service.prepareAudioReferences("u",List.of(new VideoStudioReferenceInput("audio","original")));

        assertEquals("derived",references.get(0).key());
        service.requireMedia("u","audio","derived",false,seedance);
        assertEquals("WAVE",new String(Files.readAllBytes(dir.resolve("derived.wav")),8,4));
        assertArrayEquals(original,Files.readAllBytes(source));
        var reference=new StudioAudioReference(storage,ffmpeg).prepare("u","original");
        assertEquals(6,reference.durationSec(),.1);assertFalse(reference.trimmed());
    }
    @Test void aShortWavAndMp3GoThroughUntouched() throws Exception {
        var wav=dir.resolve("original.wav");Files.write(wav,wav(6));
        var mp3=dir.resolve("original.mp3");Files.write(mp3,"ID3\u0004\0\0\0\0\0\0\0\0".getBytes());
        var ffmpeg=mock(FfmpegRunner.class);
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(6,"x",null,"x",0,0,24000,1,true));
        for(var source:List.of(wav,mp3)){
            var storage=storage(source);
            var sample=new StudioAudioReference(storage,ffmpeg).prepare("u","original");
            assertEquals("original",sample.key());
            verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
        }
        verify(ffmpeg,never()).runFfmpeg(anyList(),anyLong());
    }
    @Test void aFailedConversionNeverFallsBackToTheOriginal() throws Exception {
        var source=dir.resolve("original.m4a");
        Files.write(source,new byte[]{0,0,0,28,'f','t','y','p','M','4','A',' ',0,0,0,0});
        var storage=storage(source);var ffmpeg=mock(FfmpegRunner.class);
        when(ffmpeg.probeMedia(source.toFile())).thenReturn(new FfmpegRunner.MediaProbe(6,"m4a",null,"aac",0,0,44100,2,true));
        when(ffmpeg.runFfmpeg(anyList(),anyLong())).thenThrow(new RuntimeException("decoder failed"));
        assertThrows(BusinessException.class,()->new StudioAudioReference(storage,ffmpeg).prepare("u","original"));
        verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
    }
    /** 这条报错就是给用户看的说明，要断内容：哪类素材、要什么格式。 */
    @Test void aRejectedFormatSaysWhichKindAndWhatTheModelTakes() throws Exception {
        var source=dir.resolve("original.m4a");
        Files.write(source,new byte[]{0,0,0,28,'f','t','y','p','M','4','A',' ',0,0,0,0});
        var projects=mock(IpProjectService.class);when(projects.requireOwnedAssetKey(anyString(),anyString())).thenAnswer(i->i.getArgument(1));
        var service=new StudioVideoService(mock(AiAppSceneModelPolicyService.class),mock(VideoStudioService.class),projects,storage(source),mock(FfmpegRunner.class));
        var e=assertThrows(BusinessException.class,()->service.requireMedia("u","audio","original",false,seedanceMode()));
        assertEquals("STUDIO_VIDEO_ASSET_INVALID",e.getCode());
        assertTrue(e.getMessage().contains("声音"),e.getMessage());
        assertTrue(e.getMessage().contains("WAV、MP3"),e.getMessage());
    }
    /** 线上 Seedance 端点的声音规则（video_request_spec_json）。 */
    private static VideoStudioModeSpec seedanceMode() {
        var audio=new VideoStudioMediaLimit("audio",3,15L*1024*1024,List.of("WAV","MP3"),2,15);
        return new VideoStudioModeSpec("universal_reference_video",false,false,null,
                new VideoStudioReferenceRules(null,null,audio,9,12,1,15));
    }
    @Test void quotesAndSubmitsUseTheSameShortReferenceAndNeverReadForeignAssets() throws Exception {
        var source=dir.resolve("original.wav");Files.write(source,wav(30));var storage=storage(source);
        var projects=mock(IpProjectService.class);when(projects.requireOwnedAssetKey(anyString(),anyString())).thenAnswer(i->i.getArgument(1));
        var scenes=mock(AiAppSceneModelPolicyService.class);var endpoint=AiModelEndpoint.builder().id("h3").name("H3").build();
        var resolved=new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true);
        when(scenes.studioVideoCandidates()).thenReturn(List.of(resolved));when(scenes.resolveStudioVideo(any())).thenReturn(resolved);
        var videos=mock(VideoStudioService.class);
        when(videos.listModels("studio")).thenReturn(List.of(new VideoStudioModel("h3","H3",true,true,false,
                VideoStudioService.contract(5,15),new VideoStudioPricing(Map.of(),0,0,0),List.of(1))));
        when(videos.prepareCanvas(eq("u"),any(),any(VideoStudioService.CanvasAssetValidator.class),eq("studio")))
                .thenReturn(new VideoStudioService.CanvasPreparation(new VideoGenSpec("universal_reference_video","768p",null,null,null,List.of()),0,100));
        var service=new StudioVideoService(scenes,videos,projects,storage,new FfmpegRunner(new MixcutProperties()));
        var refs=List.of(new VideoStudioReferenceInput("image","image"),new VideoStudioReferenceInput("audio","original"));
        var request=new IpRunService.IpVideoRequest("提示",null,5,"16:9","h3",null,
                new VideoSettings("universal_reference_video","768p",null,null,null,refs,null));
        service.quotePreparation("u",request);service.prepare("u",request);
        var requests=org.mockito.ArgumentCaptor.forClass(VideoStudioJobRequest.class);
        verify(videos,times(2)).prepareCanvas(eq("u"),requests.capture(),any(VideoStudioService.CanvasAssetValidator.class),eq("studio"));
        requests.getAllValues().forEach(r->assertEquals("derived",r.references().get(1).key()));
        assertEquals("original",request.video().references().get(1).key());
        when(projects.requireOwnedAssetKey("u","foreign")).thenThrow(BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign"));
        assertThrows(BusinessException.class,()->service.prepareAudioReferences("u",List.of(new VideoStudioReferenceInput("audio","foreign"))));
        verify(storage,never()).openForRead("foreign");
    }
    @Test void failedTrimmingDeletesTemporaryFilesAndNeverStoresAReplacement() throws Exception {
        var source=dir.resolve("original.wav");Files.write(source,wav(30));var storage=storage(source);var ffmpeg=mock(FfmpegRunner.class);
        when(ffmpeg.probeMedia(source.toFile())).thenReturn(new FfmpegRunner.MediaProbe(30,"wav",null,"pcm_s16le",0,0,24000,1,true));
        var temporary=new java.util.ArrayList<Path>();
        when(ffmpeg.runFfmpeg(anyList(),anyLong())).thenAnswer(i->{List<String> args=i.getArgument(0);temporary.add(Path.of(args.get(args.size()-1)));throw new RuntimeException("encoder failed");});
        assertThrows(BusinessException.class,()->new StudioAudioReference(storage,ffmpeg).prepare("u","original"));
        verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());
        assertFalse(temporary.isEmpty());temporary.forEach(p->assertFalse(Files.exists(p)));
    }
}
