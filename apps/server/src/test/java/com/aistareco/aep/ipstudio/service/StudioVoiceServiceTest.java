package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.dap.model.*;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVoiceServiceTest {
    final DapVoiceRepository voices=mock(DapVoiceRepository.class);final DapAvatarRepository avatars=mock(DapAvatarRepository.class);
    final IpRunRepository runs=mock(IpRunRepository.class);final IpProjectService projects=mock(IpProjectService.class);final FileStorageService storage=mock(FileStorageService.class);
    final DapAvatar avatar=DapAvatar.builder().id("a").name("小紫").ownerUserId("o").build();
    final Map<String,DapVoice> saved=new LinkedHashMap<>();StudioVoiceService service;IpRun source;
    @TempDir Path dir;
    @BeforeEach void setup() throws Exception {
        service=new StudioVoiceService(voices,avatars,runs,projects,storage,new ObjectMapper());
        source=IpRun.builder().id("r1").projectId("p").ownerUserId("o").kind("studio-audio").status("done")
                .inputJson("{\"speaker\":\"Vivian\",\"instruct\":\"温暖自然\"}").outputJson("{\"storageKey\":\"owned/real.wav\",\"mimeType\":\"audio/wav\",\"durationSec\":3.52}").build();
        when(runs.findByIdAndOwnerUserId("r1","o")).thenReturn(Optional.of(source));
        when(avatars.lockOwned("a","o")).thenReturn(Optional.of(avatar));when(avatars.findByIdAndOwnerUserId("a","o")).thenReturn(Optional.of(avatar));
        when(voices.save(any())).thenAnswer(i->{DapVoice v=i.getArgument(0);saved.put(v.getId(),v);return v;});
        when(voices.lastProfileVersion("o","a")).thenAnswer(i->saved.values().stream().mapToInt(DapVoice::getProfileVersion).max().orElse(0));
        when(voices.findByOwnerUserIdAndAvatarIdAndSourceRunId(eq("o"),eq("a"),anyString())).thenAnswer(i->saved.values().stream().filter(v->v.getSourceRunId().equals(i.getArgument(2))).findFirst());
        when(voices.findByIdAndOwnerUserId(anyString(),eq("o"))).thenAnswer(i->Optional.ofNullable(saved.get(i.getArgument(0))));
        Path audio=dir.resolve("real.wav");Files.write(audio,new byte[]{1,2,3});when(storage.openForRead("owned/real.wav")).thenReturn(audio);when(storage.signedUrl(anyString())).thenReturn("signed-real-demo");
    }
    @Test void adoptionIsFreeImmutableAndReplayCannotRevertNewDefault() {
        var one=service.adopt("o","p",new AdoptVoiceRequest("r1","a","小紫自然声",null));
        var first=saved.get(one.voiceId());assertEquals(1,one.version());assertEquals("Vivian",one.speaker());assertEquals("温暖自然",one.instruct());assertEquals("preset",first.getKind());assertNull(first.getEngineTrainedAt());assertEquals("owned/real.wav",one.demoStorageKey());assertEquals(3,first.getBytes());
        var secondSource=IpRun.builder().id("r2").projectId("p").kind("studio-audio").status("done").inputJson("{\"speaker\":\"Serena\"}").outputJson(source.getOutputJson()).build();
        when(runs.findByIdAndOwnerUserId("r2","o")).thenReturn(Optional.of(secondSource));
        var two=service.adopt("o","p",new AdoptVoiceRequest("r2","a","小紫新声",one.voiceId()));
        assertEquals(2,two.version());assertEquals(two.voiceId(),avatar.getVoiceId());
        var replay=service.adopt("o","p",new AdoptVoiceRequest("r1","a","不会改名",null));assertEquals(one,replay);assertEquals(two.voiceId(),avatar.getVoiceId());assertEquals(2,saved.size());
        assertEquals(first,service.requiredProfile("o","a",one.voiceId())); // Historical version remains selectable.
        service.bindDefault("o","a",new BindVoiceRequest(one.voiceId(),two.voiceId()));assertEquals(one.voiceId(),avatar.getVoiceId());
        service.bindDefault("o","a",new BindVoiceRequest(one.voiceId(),two.voiceId()));assertEquals(2,saved.size());
    }
    @Test void concurrentDefaultChangeCannotCreateVersion() {
        avatar.setVoiceId("newer");assertEquals("STUDIO_VOICE_CHANGED",assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null))).getCode());verify(voices,never()).save(any());verifyNoInteractions(storage);
    }
    @Test void foreignDeletedAndUncompletedSourcesNeverAdopt() {
        assertEquals("STUDIO_VOICE_SOURCE_INVALID",assertThrows(BusinessException.class,()->service.adopt("foreign","p",new AdoptVoiceRequest("r1","a","voice",null))).getCode());
        source.setProjectId("other");assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null)));
        source.setProjectId("p");source.setStatus("running");assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null)));
        source.setStatus("done");avatar.setDeletedAt(java.time.Instant.now());assertEquals("STUDIO_VOICE_AVATAR_INVALID",assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null))).getCode());verify(voices,never()).save(any());
    }
    @Test void exactProfileCannotBeUsedWithAnotherPersonOrDeletedAsset() {
        var profile=service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null));
        assertThrows(BusinessException.class,()->service.requiredProfile("other","a",profile.voiceId()));
        saved.get(profile.voiceId()).setAvatarId("another");assertEquals("STUDIO_VOICE_UNAVAILABLE",assertThrows(BusinessException.class,()->service.requiredProfile("o","a",profile.voiceId())).getCode());
        saved.get(profile.voiceId()).setAvatarId("a");saved.get(profile.voiceId()).setDeletedAt(java.time.Instant.now());assertThrows(BusinessException.class,()->service.requiredProfile("o","a",profile.voiceId()));
        assertEquals("STUDIO_VOICE_UNAVAILABLE",assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",avatar.getVoiceId()))).getCode());
    }
    @Test void unreadableDemoIsRejectedAndDeletedVersionsDoNotReuseNumbers() throws Exception {
        when(storage.openForRead("owned/real.wav")).thenThrow(new java.io.IOException());assertEquals("STUDIO_VOICE_SOURCE_INVALID",assertThrows(BusinessException.class,()->service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null))).getCode());verify(voices,never()).save(any());
        doReturn(dir.resolve("real.wav")).when(storage).openForRead("owned/real.wav");when(voices.lastProfileVersion("o","a")).thenReturn(4);
        assertEquals(5,service.adopt("o","p",new AdoptVoiceRequest("r1","a","voice",null)).version());
    }
}
