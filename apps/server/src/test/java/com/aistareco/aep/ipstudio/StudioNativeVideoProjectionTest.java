package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioNativeVideoProjectionTest {
    @Test void nativeJobRemainsTheOnlyStatusAndSettlementTruth() {
        var repository=mock(MaterialVideoJobRepository.class);
        var storage=IpStudioFixtures.storage();
        when(storage.keyOfStoredUrl("/cdn/material-videos/job/video.mp4")).thenReturn("material-videos/job/video.mp4");
        var service=new IpProjectService(new IpStudioFixtures.Projects().repo,new IpStudioFixtures.Runs().repo,
                new IpCatalogService(IpStudioFixtures.OM),IpStudioFixtures.templateResolver(),storage,IpStudioFixtures.props(),repository,IpStudioFixtures.OM,null);
        var binding=IpRun.builder().id("binding").projectId("p").ownerUserId("owner").nodeId("n").kind("studio-video")
                .status("done").cost(0).inputJson("{\"_exec\":{\"nativeVideoJobId\":\"job\"}}").outputJson("{}").build();
        var job=MaterialVideoJob.builder().id("job").ownerUserId("owner").app("ipstudio").status("generating").progress(35).creditsHeld(320).build();
        when(repository.findById("job")).thenReturn(Optional.of(job));
        assertEquals("running",service.toRunDto(binding).status());assertEquals(320,service.toRunDto(binding).cost());
        job.setStatus("succeeded");job.setVideoUrl("/cdn/material-videos/job/video.mp4");job.setDurationSec(8);
        assertEquals("done",service.toRunDto(binding).status());assertEquals("material-videos/job/video.mp4",service.toRunDto(binding).output().path("storageKey").asText());
        job.setStatus("failed");assertEquals(0,service.toRunDto(binding).cost());
        assertEquals("done",binding.getStatus());assertEquals(0,binding.getCost());
        verify(repository,never()).save(any());
        job.setApp("celebrity");assertThrows(BusinessException.class,()->service.toRunDto(binding));
        job.setApp("ipstudio");job.setOwnerUserId("other");assertThrows(BusinessException.class,()->service.toRunDto(binding));
    }
    @Test void projectsPartialSuccessWithoutASecondSettlementOrHiddenFailureSlot() {
        var repository=mock(MaterialVideoJobRepository.class);var storage=IpStudioFixtures.storage();
        var service=new IpProjectService(new IpStudioFixtures.Projects().repo,new IpStudioFixtures.Runs().repo,
                new IpCatalogService(IpStudioFixtures.OM),IpStudioFixtures.templateResolver(),storage,IpStudioFixtures.props(),repository,IpStudioFixtures.OM,null);
        var binding=IpRun.builder().id("binding").projectId("p").ownerUserId("owner").nodeId("n").kind("studio-video")
                .status("done").cost(0).inputJson("{\"_exec\":{\"nativeVideoJobIds\":[\"a\",\"b\",\"c\"]}}").outputJson("{}").build();
        var a=MaterialVideoJob.builder().id("a").ownerUserId("owner").app("ipstudio").status("succeeded").videoUrl("/cdn/a.mp4").durationSec(8).progress(100).creditsHeld(320).build();
        var b=MaterialVideoJob.builder().id("b").ownerUserId("owner").app("ipstudio").status("generating").durationSec(8).progress(40).creditsHeld(320).build();
        var c=MaterialVideoJob.builder().id("c").ownerUserId("owner").app("ipstudio").status("failed").durationSec(8).progress(0).creditsHeld(320).errorMessage("引擎失败").build();
        when(repository.findById("a")).thenReturn(Optional.of(a));when(repository.findById("b")).thenReturn(Optional.of(b));when(repository.findById("c")).thenReturn(Optional.of(c));
        when(storage.keyOfStoredUrl("/cdn/a.mp4")).thenReturn("a.mp4");
        var active=service.toRunDto(binding);assertEquals("running",active.status());assertEquals(640,active.cost());
        assertEquals(80,active.pct());assertEquals(3,active.output().path("videoCandidates").size());
        assertEquals("failed",active.output().path("videoCandidates").get(2).path("status").asText());
        b.setStatus("failed");var partial=service.toRunDto(binding);assertEquals("done",partial.status());assertEquals(320,partial.cost());assertEquals("部分视频生成失败",partial.stage());
        assertEquals("a.mp4",partial.output().path("storageKey").asText());assertFalse(partial.inputs().has("_exec"));
        a.setStatus("failed");assertEquals("failed",service.toRunDto(binding).status());assertEquals(0,service.toRunDto(binding).cost());
        verify(repository,never()).save(any());assertEquals(0,binding.getCost());
        c.setOwnerUserId("other");assertThrows(BusinessException.class,()->service.toRunDto(binding));
    }

}
