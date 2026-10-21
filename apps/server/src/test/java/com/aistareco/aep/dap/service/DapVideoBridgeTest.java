package com.aistareco.aep.dap.service;
import com.aistareco.aep.dap.model.*;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DapVideoBridgeTest {
    @Test void parentOwnsFiftyCreditChargeAndRetryReattachesSameDurableChild() {
        var videos=mock(MaterialVideoJobService.class);var models=mock(AiModelInvocationService.class);var jobs=mock(DapJobRepository.class);var om=new ObjectMapper();
        var bridge=new DapVideoBridge(videos,models,jobs,om);
        when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_VIDEO,"aiavatar")).thenReturn(Optional.of(AiModelEndpoint.builder().id("h3").build()));
        when(videos.submit(any(),eq("u"),eq(MaterialVideoJobService.APP_DAP))).thenReturn(List.of(om.createObjectNode().put("id","mvj_1")));
        var job=DapJob.builder().id("job").avatarId("avatar").ownerUserId("u").kind("运镜视频").cost(50).build();
        var avatar=DapAvatar.builder().id("avatar").ownerUserId("u").imageKey("owned-frame").build();
        assertEquals("mvj_1",bridge.start(job,avatar,"orbit"));
        when(videos.getJob("mvj_1","u",MaterialVideoJobService.APP_DAP)).thenReturn(om.createObjectNode().put("status","rendering"));
        assertEquals("mvj_1",bridge.start(job,avatar,"orbit"));
        var body=org.mockito.ArgumentCaptor.forClass(JsonNode.class);verify(videos).submit(body.capture(),eq("u"),eq(MaterialVideoJobService.APP_DAP));
        var item=body.getValue().path("items").get(0);assertEquals(0,item.path("credit_cost").asLong());assertEquals(50,job.getCost());
        assertEquals("owned-frame",item.path("variant_config").path("first_frame_key").asText());assertEquals("h3",item.path("variant_config").path("endpoint_id").asText());
        assertEquals(5,item.path("duration_sec").asInt());verify(jobs).save(job);
    }
    @Test void unrelatedAvatarIsRejectedBeforeSubmit() {
        var videos=mock(MaterialVideoJobService.class);var bridge=new DapVideoBridge(videos,mock(AiModelInvocationService.class),mock(DapJobRepository.class),new ObjectMapper());
        assertThrows(BusinessException.class,()->bridge.start(DapJob.builder().ownerUserId("a").avatarId("avatar").build(),DapAvatar.builder().id("avatar").ownerUserId("b").imageKey("foreign").build(),"orbit"));verifyNoInteractions(videos);
    }
}
