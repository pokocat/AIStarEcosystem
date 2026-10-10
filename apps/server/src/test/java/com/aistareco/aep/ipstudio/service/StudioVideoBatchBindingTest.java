package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.BusinessException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVideoBatchBindingTest {
    @Test void repeatedRequestRecoversTheSameBatchAndChangedQuantityCannotResubmit() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var nativeRuns=mock(IpRunService.class);var fixtures=mock(StudioFixtureProvider.class);
        when(projects.requiredForUpdate("owner","p")).thenReturn(IpProject.builder().id("p").build());
        when(runs.findByProjectIdAndClientRequestId("p","request")).thenReturn(Optional.empty());
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        when(nativeRuns.generateVideoBatch(eq("owner"),eq("p"),any(),eq(4))).thenReturn(List.of(
                mapper.createObjectNode().put("id","a"),mapper.createObjectNode().put("id","b"),mapper.createObjectNode().put("id","c"),mapper.createObjectNode().put("id","d")));
        IpRun[] saved={null};when(runs.save(any())).thenAnswer(call->{saved[0]=call.getArgument(0);return saved[0];});
        when(projects.parseOrEmptyObject(anyString())).thenAnswer(call->mapper.readTree((String)call.getArgument(0)));
        when(projects.toRunDto(any())).thenAnswer(call->{IpRun r=call.getArgument(0);return new IpRunDto(r.getId(),"p","n","studio-video","running","video",0,0,null,null,mapper.readTree(r.getInputJson()),mapper.createObjectNode(),null,null);});
        var service=new StudioWorkflowService(projects,runs,fixtures,null,null,null,nativeRuns,null,null,null,null,null,mapper,null,null);
        var request=new RunRequest("request","n","video","动作",List.of(),"ep",null,8,"9:16",4);
        var first=service.submit("owner","p",request);
        assertEquals(4,mapper.readTree(saved[0].getInputJson()).path("_exec").path("nativeVideoJobIds").size());
        when(runs.findByProjectIdAndClientRequestId("p","request")).thenReturn(Optional.of(saved[0]));
        assertEquals(first.id(),service.submit("owner","p",request).id());
        assertThrows(BusinessException.class,()->service.submit("owner","p",new RunRequest("request","n","video","动作",List.of(),"ep",null,8,"9:16",2)));
        verify(nativeRuns,times(1)).generateVideoBatch(eq("owner"),eq("p"),any(),eq(4));verify(runs,times(1)).save(any());
    }
}
