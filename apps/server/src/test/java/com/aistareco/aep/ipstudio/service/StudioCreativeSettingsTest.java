package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioCreativeSettingsTest {
    final ObjectMapper mapper=new ObjectMapper();
    final IpProjectService projects=mock(IpProjectService.class);
    final IpRunRepository runs=mock(IpRunRepository.class);
    final StudioFixtureProvider fixtures=mock(StudioFixtureProvider.class);
    final StudioWorkflowService service=new StudioWorkflowService(projects,runs,fixtures,null,null,null,null,null,null,null,null,null,mapper,null,null);
    final String old="{\"clientRequestId\":\"original-key\",\"nodeId\":\"script\",\"operation\":\"script\",\"prompt\":\"故事\",\"settings\":{\"genre\":\"都市治愈\",\"episodeCount\":1,\"episodeDurationSec\":30}}";

    @Test void addingNullableSettingsKeepsAnAcceptedRequestIdempotent() throws Exception {
        when(projects.requiredForUpdate("u","p")).thenReturn(new IpProject());
        when(projects.parseOrEmptyObject(old)).thenReturn(mapper.readTree(old));
        when(runs.findByProjectIdAndClientRequestId("p","original-key")).thenReturn(Optional.of(IpRun.builder().inputFingerprint("old-format").inputJson(old).build()));
        service.submit("u","p",mapper.readValue(old,RunRequest.class));
        verify(projects).toRunDto(any());verifyNoInteractions(fixtures);
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(old);
        ((com.fasterxml.jackson.databind.node.ObjectNode)changed.path("settings")).put("characterBrief","不同人物");
        assertThrows(BusinessException.class,()->service.submit("u","p",mapper.treeToValue(changed,RunRequest.class)));
    }
    @Test void malformedCreativeSettingsAreRejectedBeforeDispatch() throws Exception {
        for(String field:new String[]{"characterBrief","structure"}) {
            var body=(com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(old);
            ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("settings")).put(field,"x".repeat(1001));
            assertThrows(BusinessException.class,()->service.submit("u","p",mapper.treeToValue(body,RunRequest.class)));
        }
        var body=(com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(old);
        ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("settings")).putArray("fusionGenres").add("都市").add("科幻").add("喜剧").add("悬疑");
        assertThrows(BusinessException.class,()->service.submit("u","p",mapper.treeToValue(body,RunRequest.class)));
        verifyNoInteractions(runs,fixtures);
    }
}
