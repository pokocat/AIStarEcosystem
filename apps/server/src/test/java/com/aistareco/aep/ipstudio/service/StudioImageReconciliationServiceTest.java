package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioImageReconciliationServiceTest {
    final ObjectMapper json=new ObjectMapper();final IpRunRepository runs=mock(IpRunRepository.class);
    final IpProjectService projects=mock(IpProjectService.class);final EnterpriseBillingService billing=mock(EnterpriseBillingService.class);
    final AuditService audits=mock(AuditService.class);final IpRunWorker worker=mock(IpRunWorker.class);
    final com.aistareco.aep.repository.CreditHoldRepository holds=mock(com.aistareco.aep.repository.CreditHoldRepository.class);
    final com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository authorizations=mock(com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository.class);
    final com.aistareco.aep.service.CreditService credits=mock(com.aistareco.aep.service.CreditService.class);
    final com.aistareco.aep.service.AiGenerationQueueService queue=mock(com.aistareco.aep.service.AiGenerationQueueService.class);
    final StudioImageReconciliationService service=new StudioImageReconciliationService(runs,projects,billing,audits,worker,json,holds,authorizations,credits,queue);
    IpRun run;
    @BeforeEach void setup() {
        run=IpRun.builder().id("r").ownerUserId("owner").projectId("p").kind("generate").status("running").cost(8)
                .errorCode("STUDIO_IMAGE_SUBMISSION_UNKNOWN").outputJson("{}")
                .inputJson("{\"_exec\":{\"endpointId\":\"original-endpoint\",\"unitCost\":8,\"holdTotal\":8,\"imageJobs\":[{\"submitAttempted\":true,\"baseUrl\":\"https://original.example/v1\",\"model\":\"original-model\",\"requestBody\":\"original-bytes\"}]}}").build();
        when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
        when(projects.parseOrEmptyObject(any())).thenAnswer(i->{String text=i.getArgument(0);return json.readTree(text==null?"{}":text);});
        when(holds.findByReferenceTypeAndReferenceId("ip-run","r")).thenReturn(Optional.of(com.aistareco.aep.model.CreditHold.builder().walletId("personal-wallet").userId("owner").amount(8).remainingAmount(8).status(com.aistareco.aep.model.CreditHold.Status.ACTIVE).build()));
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void cleanup(){TransactionSynchronizationManager.clearSynchronization();}
    @Test void operatorEvidenceBindsOriginalJobWithAuditAndOnlyQueriesAfterCommit() throws Exception {
        var body=new StudioImageReconciliationService.RecoveryRequest(0,"original-job","供应商后台原请求记录 2026-10-15");
        var result=service.recover("r",body,"operator");assertEquals("original-job",result.path("images").path(0).path("externalTaskId").asText());
        var exec=json.readTree(run.getInputJson()).path("_exec");assertEquals(8,exec.path("holdTotal").asLong());assertEquals("original-bytes",exec.path("imageJobs").path(0).path("requestBody").asText());
        assertEquals("original-endpoint",exec.path("endpointId").asText());assertEquals("original-model",exec.path("imageJobs").path(0).path("model").asText());
        assertFalse(result.toString().contains("original-bytes"));verifyNoInteractions(worker);
        service.recover("r",body,"operator");verify(audits,times(1)).record(eq("operator"),isNull(),eq("studio.image.bind_original_task"),eq("ip-run"),eq("r"),isNull(),isNull(),any(),anyString());
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker,times(2)).recoverNative("r");
        assertEquals("STUDIO_IMAGE_RECOVERY_INVALID",assertThrows(BusinessException.class,()->service.recover("r",new StudioImageReconciliationService.RecoveryRequest(0,"other-job",body.evidence()),"operator")).getCode());
    }
    @Test void arbitraryTasksMissingEvidenceAndInFlightQueryCannotBeRebound() {
        assertThrows(BusinessException.class,()->service.recover("r",new StudioImageReconciliationService.RecoveryRequest(0,"original-job","short"),"operator"));
        run.setInputJson("{\"_exec\":{\"imageJobs\":[]}}");assertThrows(BusinessException.class,()->service.recover("r",new StudioImageReconciliationService.RecoveryRequest(0,"original-job","供应商原请求核对凭据"),"operator"));
        verifyNoInteractions(audits,worker);verify(runs,never()).save(any());
    }
    @Test void oldMissingExecutionAndReleasedOriginalHoldAreRejectedWithoutScheduling() {
        String original=run.getInputJson();run.setInputJson("{}");
        var request=new StudioImageReconciliationService.RecoveryRequest(0,"original-job","供应商原任务核对凭据");
        assertEquals("STUDIO_IMAGE_RECOVERY_INVALID",assertThrows(BusinessException.class,()->service.recover("r",request,"operator")).getCode());
        run.setInputJson(original);when(holds.findByReferenceTypeAndReferenceId("ip-run","r")).thenReturn(Optional.of(com.aistareco.aep.model.CreditHold.builder().walletId("personal-wallet").userId("owner").amount(8).remainingAmount(0).status(com.aistareco.aep.model.CreditHold.Status.RELEASED).build()));
        assertEquals("STUDIO_IMAGE_ORIGINAL_HOLD_RELEASED",assertThrows(BusinessException.class,()->service.recover("r",request,"operator")).getCode());
        verifyNoInteractions(audits,worker);verify(runs,never()).save(any());
    }
    @Test void supplierConfirmedUnknownReleasesOnceAndPreservesSuccessfulCandidate() throws Exception {
        var input=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(run.getInputJson());
        var exec=(com.fasterxml.jackson.databind.node.ObjectNode)input.path("_exec");exec.put("holdTotal",16);
        var jobs=(com.fasterxml.jackson.databind.node.ArrayNode)exec.path("imageJobs");var pending=jobs.path(0).deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)jobs.path(0)).put("jobId","already-completed");jobs.add(pending);
        run.setInputJson(input.toString());run.setOutputJson("{\"candidates\":[{\"key\":\"retained-success.png\"}]}");
        when(holds.findByReferenceTypeAndReferenceId("ip-run","r")).thenReturn(Optional.of(com.aistareco.aep.model.CreditHold.builder().walletId("personal-wallet").userId("owner").amount(16).remainingAmount(8).status(com.aistareco.aep.model.CreditHold.Status.ACTIVE).build()));
        var body=new StudioImageReconciliationService.UnknownReleaseRequest(1,"供应商核实原请求未受理且没有上游任务",true);
        service.releaseUnknown("r",body,"operator");assertEquals("failed",run.getStatus());assertEquals(8,run.getCost());
        assertEquals("retained-success.png",json.readTree(run.getOutputJson()).path("candidates").path(0).path("key").asText());
        service.releaseUnknown("r",body,"operator");verify(credits,times(1)).releaseHold(eq("ip-run"),eq("r"),anyString());
        verify(billing,times(1)).complete("ip-run","r");verify(audits,times(1)).record(eq("operator"),isNull(),eq("studio.image.release_confirmed_unknown"),eq("ip-run"),eq("r"),isNull(),isNull(),any(),anyString());
        verifyNoInteractions(queue,worker);TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(queue).finish("ip-image","r");
    }
    @Test void releaseRequiresExplicitConfirmationAndRejectsKnownIdOrActiveQuery() throws Exception {
        var body=new StudioImageReconciliationService.UnknownReleaseRequest(0,"供应商核实原请求未受理且没有上游任务",true);
        assertThrows(BusinessException.class,()->service.releaseUnknown("r",new StudioImageReconciliationService.UnknownReleaseRequest(0,body.evidence(),false),"operator"));
        var original=run.getInputJson();var input=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(original);
        ((com.fasterxml.jackson.databind.node.ObjectNode)input.path("_exec").path("imageJobs").path(0)).put("jobId","known-original");run.setInputJson(input.toString());
        assertThrows(BusinessException.class,()->service.releaseUnknown("r",body,"operator"));
        input=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(original);((com.fasterxml.jackson.databind.node.ObjectNode)input.path("_exec")).put("nativeLeaseUntil",System.currentTimeMillis()+60_000);run.setInputJson(input.toString());
        assertThrows(BusinessException.class,()->service.releaseUnknown("r",body,"operator"));verifyNoInteractions(credits,audits,queue,worker);
    }

}
