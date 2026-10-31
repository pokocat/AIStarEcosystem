package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.CreditService;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MusicGenUsageTest {
    @Test void asynchronousFailureRetainsSafeProviderReasonInsteadOfGenericCreativeAdvice() {
        var state=mock(MusicGenJobState.class);var client=mock(MusicGenModelClient.class);
        var credits=mock(CreditService.class);var props=new MusicGenProperties();props.setPollIntervalSeconds(1);
        var job=MusicGenJob.builder().id("rejected").ownerUserId("owner").durationSec(90).creditsHeld(10).build();
        when(state.find("rejected")).thenReturn(Optional.of(job));
        when(client.submit(any())).thenReturn(new MusicGenModelClient.SubmitResult("task","vendor","model","ep"));
        when(client.poll(any(),eq("task"))).thenReturn(new MusicGenModelClient.PollResult("failed",0,null,null,null,null,"risk: provider rejected lyrics token=private-token"));
        new MusicGenWorker(state,client,mock(MusicOutputStorage.class),credits,props,mock(AiModelUsageService.class)).generateAsync("rejected");
        var reason=org.mockito.ArgumentCaptor.forClass(String.class);verify(state).markFailed(eq("rejected"),reason.capture());
        assertTrue(reason.getValue().contains("provider rejected lyrics"));assertFalse(reason.getValue().contains("private-token"));
        verify(credits,times(1)).releaseHold(eq(MusicGenJobService.CREDIT_REF_TYPE),eq("rejected"),anyString());
        verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString(),org.mockito.ArgumentMatchers.any());
    }
    @Test void recordsActualVendorDurationAndOwnerEvenWhenDeliveryFails() {
        var state = mock(MusicGenJobState.class);
        var client = mock(MusicGenModelClient.class);
        var storage = mock(MusicOutputStorage.class);
        var usage = mock(AiModelUsageService.class);
        var props = new MusicGenProperties(); props.setPollIntervalSeconds(1);
        var job = MusicGenJob.builder().id("music-job").ownerUserId("owner").durationSec(90)
                .optionsJson("{\"endpoint_id\":\"selected\"}").build();
        when(state.find("music-job")).thenReturn(Optional.of(job));
        when(client.submit(any())).thenReturn(new MusicGenModelClient.SubmitResult("vendor-task", "vendor", "music-model", "pinned"));
        when(client.poll("pinned", "vendor-task")).thenReturn(new MusicGenModelClient.PollResult("succeeded", 100, "https://example.invalid/audio", 73, null, null, null));
        when(storage.persistAudio(anyString(), anyString())).thenThrow(new IllegalStateException("storage unavailable"));
        new MusicGenWorker(state, client, storage, mock(CreditService.class), props, usage).generateAsync("music-job");
        var calls = mockingDetails(usage).getInvocations().stream().filter(i -> i.getMethod().getName().equals("recordMeteredObservedWithAttribution")).toList();
        assertEquals(1, calls.size());
        Object[] args = calls.get(0).getArguments();
        assertEquals("pinned", args[0]);
        assertEquals("MUSIC_GENERATION", args[3]);
        assertEquals(1L, args[8]);
        assertEquals(73L, args[9]);
        assertEquals(true, args[10]);
        assertEquals("owner", args[11]);
        assertEquals("music", args[13]);
        assertEquals("music-job", args[14]);
        verify(state).markFailed(eq("music-job"), contains("转存失败"));
    }
}
