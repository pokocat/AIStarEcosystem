package com.aistareco.aep.ipstudio;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Direct native video retries bind to one original job; the workflow batch remains its own binding owner. */
class IpNativeVideoReplayTest {
    static final String PROJECT="IPP-native-replay", USER="native-user";
    final BillingSelection enterprise=new BillingSelection("enterprise","enterprise-one");
    IpStudioFixtures.Projects projects; IpStudioFixtures.Runs runs;
    MaterialVideoJobService videos; IpRunService service;
    JsonNode card;
    @BeforeEach void setup() {
        projects=new IpStudioFixtures.Projects();runs=new IpStudioFixtures.Runs();
        projects.repo.save(IpStudioFixtures.project(PROJECT,USER,new IpStudioFixtures.Doc()));
        when(runs.repo.findByProjectIdAndClientRequestId(anyString(),anyString())).thenAnswer(inv->runs.rows.values().stream()
                .filter(r->inv.getArgument(0).equals(r.getProjectId())&&inv.getArgument(1).equals(r.getClientRequestId())).findFirst());
        var catalog=new IpCatalogService(IpStudioFixtures.OM);
        var projectService=new IpProjectService(projects.repo,runs.repo,catalog,IpStudioFixtures.templateResolver(),
                IpStudioFixtures.storage(),IpStudioFixtures.props(),IpStudioFixtures.videoJobs(),IpStudioFixtures.OM,null);
        videos=mock(MaterialVideoJobService.class);
        card=IpStudioFixtures.OM.createObjectNode().put("id","native-original").put("status","submitting");
        when(videos.submit(any(),eq(USER),eq("ipstudio"))).thenReturn(List.of(card));
        when(videos.submit(any(),eq(USER),eq("ipstudio"),any())).thenReturn(List.of(card));
        when(videos.getJob("native-original",USER,"ipstudio")).thenReturn(card);
        service=new IpRunService(runs.repo,projectService,catalog,IpStudioFixtures.props(),mock(PromptService.class),
                mock(DapMultimodalClient.class),mock(DapPricingService.class),mock(DapAccountService.class),
                mock(CreditService.class),mock(IpRunWorker.class),IpStudioFixtures.OM,videos,mock(AiModelInvocationService.class));
    }
    IpRunService.IpVideoRequest request(BillingSelection payer,String key) {
        return new IpRunService.IpVideoRequest("缓慢推镜",null,5,"9:16","local-video",30L,null,payer,key);
    }
    @Test void corporateUnknownSubmissionRetryOnlyReadsTheOriginalJob() {
        var request=request(enterprise,"native-1");
        assertEquals("native-original",service.generateVideo(USER,PROJECT,request).path("id").asText());
        assertEquals("native-original",service.generateVideo(USER,PROJECT,request).path("id").asText());
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),eq(enterprise));
        verify(videos).getJob("native-original",USER,"ipstudio");
        var sequence=inOrder(projects.repo,runs.repo,videos);
        sequence.verify(projects.repo).findByIdAndOwnerUserIdAndDeletedAtIsNullForUpdate(PROJECT,USER);
        sequence.verify(runs.repo).findByProjectIdAndClientRequestId(PROJECT,"native-1");
        sequence.verify(videos).submit(any(),eq(USER),eq("ipstudio"),eq(enterprise));
        IpRun binding=runs.rows.values().iterator().next();
        assertEquals(1,runs.rows.size());assertEquals("studio-video",binding.getKind());assertEquals(0,binding.getCost());
        assertEquals("enterprise-one",binding.getEnterpriseId());assertNull(binding.getBillingAuthorizationId());
        assertEquals("native-original",read(binding.getInputJson()).path("_exec").path("nativeVideoJobIds").get(0).asText());
    }
    @Test void corporateRetryCannotChangeToPersonalOrAnotherEnterprise() {
        service.generateVideo(USER,PROJECT,request(enterprise,"native-2"));
        for(BillingSelection payer:Arrays.asList(null,new BillingSelection("personal",null),new BillingSelection("enterprise","other"))) {
            assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,
                    ()->service.generateVideo(USER,PROJECT,request(payer,"native-2"))).getCode());
        }
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),any());verify(videos,never()).getJob(anyString(),anyString(),anyString());
    }
    @Test void requestBodyChangesCannotFreezeAnotherJob() {
        var original=request(enterprise,"native-3");service.generateVideo(USER,PROJECT,original);
        var changed=List.of(
                new IpRunService.IpVideoRequest("不同文案",null,5,"9:16","local-video",30L,null,enterprise,"native-3"),
                new IpRunService.IpVideoRequest(original.prompt(),null,8,"9:16","local-video",30L,null,enterprise,"native-3"),
                new IpRunService.IpVideoRequest(original.prompt(),null,5,"16:9","local-video",30L,null,enterprise,"native-3"),
                new IpRunService.IpVideoRequest(original.prompt(),null,5,"9:16","other-video",30L,null,enterprise,"native-3"),
                new IpRunService.IpVideoRequest(original.prompt(),"changed-ref",5,"9:16","local-video",30L,null,enterprise,"native-3"),
                new IpRunService.IpVideoRequest(original.prompt(),null,5,"9:16","local-video",40L,null,enterprise,"native-3"));
        for(var request:changed)assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,
                ()->service.generateVideo(USER,PROJECT,request)).getCode());
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),any());assertEquals(1,runs.rows.size());
    }
    @Test void enterpriseMissingOrBlankRequestKeyFailsBeforeSubmission() {
        for(String key:Arrays.asList(null,""," "))assertEquals("STUDIO_REQUEST_ID_REQUIRED",assertThrows(BusinessException.class,
                ()->service.generateVideo(USER,PROJECT,request(enterprise,key))).getCode());
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,
                ()->service.generateVideo(USER,PROJECT,request(enterprise,"x".repeat(65)))).getCode());
        verifyNoInteractions(videos);assertTrue(runs.rows.isEmpty());
    }
    @Test void legacyPersonalWithoutKeyKeepsItsExistingNewTaskBehavior() {
        var legacy=new IpRunService.IpVideoRequest("向前走",null,5,"9:16","local-video");
        service.generateVideo(USER,PROJECT,legacy);service.generateVideo(USER,PROJECT,legacy);
        verify(videos,times(2)).submit(any(),eq(USER),eq("ipstudio"));assertTrue(runs.rows.isEmpty());
    }
    @Test void keyedPersonalRetryAlsoKeepsItsOriginalPayerAndJob() {
        var personal=new BillingSelection("personal",null);var request=request(personal,"personal-1");
        service.generateVideo(USER,PROJECT,request);service.generateVideo(USER,PROJECT,request);
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),eq(personal));verify(videos).getJob("native-original",USER,"ipstudio");
        assertNull(runs.rows.values().iterator().next().getEnterpriseId());
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,
                ()->service.generateVideo(USER,PROJECT,request(enterprise,"personal-1"))).getCode());
    }
    @Test void replayCannotReadAnotherPersonsProject() {
        var request=request(enterprise,"native-owner");service.generateVideo(USER,PROJECT,request);
        assertEquals("IP_PROJECT_NOT_FOUND",assertThrows(BusinessException.class,
                ()->service.generateVideo("another-user",PROJECT,request)).getCode());
        verify(videos,never()).getJob(anyString(),anyString(),anyString());
    }
    @Test void completedOrFailedJobReplayDoesNotSubmitAgain() {
        var request=request(enterprise,"native-terminal");service.generateVideo(USER,PROJECT,request);
        when(videos.getJob("native-original",USER,"ipstudio")).thenReturn(
                IpStudioFixtures.OM.createObjectNode().put("id","native-original").put("status","failed"));
        assertEquals("failed",service.generateVideo(USER,PROJECT,request).path("status").asText());
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),any());
    }
    @Test void workflowBatchDoesNotAcquireASecondDirectApiBinding() {
        var request=request(enterprise,"workflow-owner");service.generateVideoBatch(USER,PROJECT,request,1);
        verify(videos,times(1)).submit(any(),eq(USER),eq("ipstudio"),any());assertTrue(runs.rows.isEmpty());
        verify(projects.repo,never()).findByIdAndOwnerUserIdAndDeletedAtIsNullForUpdate(anyString(),anyString());
    }
    @Test void requestJsonRetainsTheClientKeyAndOldConstructorsStayCompatible() throws Exception {
        var request=IpStudioFixtures.OM.readValue("{\"prompt\":\"走路\",\"billing\":{\"mode\":\"enterprise\",\"enterpriseId\":\"e\"},\"clientRequestId\":\"native-json\"}",IpRunService.IpVideoRequest.class);
        assertEquals("native-json",request.clientRequestId());assertEquals("e",request.billing().enterpriseId());
        assertNull(new IpRunService.IpVideoRequest("x",null,5,"9:16","v",30L,null,enterprise).clientRequestId());
    }
    JsonNode read(String value) {try{return IpStudioFixtures.OM.readTree(value);}catch(Exception e){throw new AssertionError(e);}}
}
