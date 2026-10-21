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
    @Test void nativeVideoLetsTheSelectedModeDecideWhetherPromptIsRequired() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var nativeRuns=mock(IpRunService.class);var fixtures=mock(StudioFixtureProvider.class);
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        when(projects.requiredForUpdate("owner","p")).thenReturn(IpProject.builder().id("p").build());
        when(runs.findByProjectIdAndClientRequestId("p","optional")).thenReturn(Optional.empty());
        when(nativeRuns.generateVideoBatch(eq("owner"),eq("p"),any(),eq(1)))
                .thenReturn(new IpRunService.VideoBatch(List.of(mapper.createObjectNode().put("id","job")),mapper.createObjectNode()));
        when(runs.save(any())).thenAnswer(call->call.getArgument(0));
        when(projects.toRunDto(any())).thenAnswer(call->{IpRun r=call.getArgument(0);return new IpRunDto(
                r.getId(),"p","n","studio-video","running","video",0,0,null,null,
                mapper.readTree(r.getInputJson()),mapper.createObjectNode(),null,null);});
        var service=new StudioWorkflowService(projects,runs,fixtures,null,null,null,nativeRuns,null,null,null,null,null,mapper,null,null);
        var settings=new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings(
                "silent-mode","custom",null,null,null,List.of());
        var request=new RunRequest("optional","n","video",null,List.of(),"ep",null,5,"9:16",1,
                null,null,null,null,null,5L,null,settings);
        service.submit("owner","p",request);
        verify(nativeRuns).generateVideoBatch(eq("owner"),eq("p"),argThat(input->input.prompt()==null),eq(1));
    }
    /** §6.2: the request keeps the frame the user chose; the crop actually sent is recorded beside the job ids. */
    @Test void aCroppedFirstFrameIsRecordedOnTheBindingRun() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var nativeRuns=mock(IpRunService.class);var fixtures=mock(StudioFixtureProvider.class);
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        when(projects.requiredForUpdate("owner","p")).thenReturn(IpProject.builder().id("p").build());
        when(runs.findByProjectIdAndClientRequestId("p","framed")).thenReturn(Optional.empty());
        var adjusted=mapper.createObjectNode();
        adjusted.putObject("firstFrameAdjusted").put("from","1:1").put("to","9:16").put("mode","crop").put("croppedKey","ipstudio_gen/owner/c.jpg");
        when(nativeRuns.generateVideoBatch(eq("owner"),eq("p"),any(),eq(1))).thenReturn(new IpRunService.VideoBatch(List.of(mapper.createObjectNode().put("id","job")),adjusted));
        IpRun[] saved={null};when(runs.save(any())).thenAnswer(call->{saved[0]=call.getArgument(0);return saved[0];});
        when(projects.toRunDto(any())).thenAnswer(call->{IpRun r=call.getArgument(0);return new IpRunDto(r.getId(),"p","n","studio-video","running","video",0,0,null,null,
                mapper.readTree(r.getInputJson()),mapper.createObjectNode(),null,null);});
        var service=new StudioWorkflowService(projects,runs,fixtures,null,null,null,nativeRuns,null,null,null,null,null,mapper,null,null);
        var settings=new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings("i2v","768p",null,"ipstudio_gen/owner/square.png",null,List.of());
        service.submit("owner","p",new RunRequest("framed","n","video","她转身",List.of(),"ep",null,5,"9:16",1,null,null,null,null,null,5L,null,settings));
        var inputs=mapper.readTree(saved[0].getInputJson());
        assertEquals("crop",inputs.path("_exec").path("firstFrameAdjusted").path("mode").asText());
        assertEquals("9:16",inputs.path("_exec").path("firstFrameAdjusted").path("to").asText());
        assertEquals("ipstudio_gen/owner/square.png",inputs.path("video").path("firstFrameKey").asText(),"the request keeps the user's own frame");
    }
    @Test void repeatedRequestRecoversTheSameBatchAndChangedQuantityCannotResubmit() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var nativeRuns=mock(IpRunService.class);var fixtures=mock(StudioFixtureProvider.class);
        when(projects.requiredForUpdate("owner","p")).thenReturn(IpProject.builder().id("p").build());
        when(runs.findByProjectIdAndClientRequestId("p","request")).thenReturn(Optional.empty());
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        when(nativeRuns.generateVideoBatch(eq("owner"),eq("p"),any(),eq(4))).thenReturn(new IpRunService.VideoBatch(List.of(
                mapper.createObjectNode().put("id","a"),mapper.createObjectNode().put("id","b"),mapper.createObjectNode().put("id","c"),mapper.createObjectNode().put("id","d")),mapper.createObjectNode()));
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
