package com.aistareco.aep.ipstudio;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos;
import com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real transaction/project locks and enterprise ledger; the supplier boundary is replaced without HTTP. */
@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:native-video-replay;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false"})
@ActiveProfiles("test")
class IpNativeVideoReplayIntegrationTest {
    @Autowired IpRunService service; @Autowired IpProjectRepository projects; @Autowired IpRunRepository runs;
    @Autowired EnterpriseService enterprises; @Autowired EnterprisePointsService points; @Autowired EnterpriseBillingService billing;
    @Autowired EnterpriseBillingAuthorizationRepository authorizations;
    @Autowired AepUserRepository users; @Autowired EnrollmentService enrollment;
    @Autowired CreditService credits; @Autowired WalletRepository wallets; @Autowired CreditHoldRepository holds;
    @Autowired AiModelEndpointRepository endpoints; @Autowired ObjectMapper json;
    @MockBean MaterialVideoJobService nativeVideos;
    @MockBean com.aistareco.aep.service.AiGenerationQueueDispatcher dispatcher;

    @Test void simultaneousCorporateRetriesCreateOneOriginalHoldAndOneDurableBinding() throws Exception {
        // Endpoint policy/preflight is already covered by native video tests. Keep this test at the
        // transaction boundary and use the actual authorization, wallet and immutable ledger services.
        ReflectionTestUtils.setField(service,"scenePolicies",null);
        String user="native-"+UUID.randomUUID(), endpoint="native-endpoint-"+UUID.randomUUID();
        users.save(AepUser.builder().id(user).username(user).displayName("原生视频验收")
                .status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(user,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);
        endpoints.save(AiModelEndpoint.builder().id(endpoint).name("本地视频验收")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl("http://127.0.0.1:1")
                .upstreamApiKeyEncrypted("test").model("local").enabled(true).build());
        var enterprise=enterprises.create(user,new CreateRequest("原生视频重试验收",UUID.randomUUID().toString()));
        String enterpriseId=enterprise.enterprise().id();
        var policy=enterprises.policy(user,enterpriseId);
        enterprises.updatePolicy(user,enterpriseId,new PolicyUpdate(List.of(endpoint),3,policy.version()));
        var root=wallets.findByAccountKey("enterprise:"+enterpriseId).orElseThrow();
        credits.creditWallet(root.getId(),100,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"本地验收");
        var allocations=List.of(new EnterprisePointsDtos.Item(enterprise.member().id(),100L));
        var preview=points.preview(user,enterpriseId,"allocate",new EnterprisePointsDtos.PreviewRequest(allocations));
        points.submit(user,enterpriseId,"allocate",new EnterprisePointsDtos.SubmitRequest(UUID.randomUUID().toString(),preview.confirmationFingerprint(),allocations));
        credits.creditAccount(user,500,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"个人验收积分");
        String project="IPP-"+UUID.randomUUID().toString().substring(0,20), job="mvj_"+UUID.randomUUID().toString().substring(0,16);
        projects.saveAndFlush(IpProject.builder().id(project).ownerUserId(user).name("原生视频")
                .status("draft").docJson("{\"nodes\":[],\"connections\":[],\"viewport\":{\"x\":0,\"y\":0,\"k\":1}}")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build());
        var selected=new BillingSelection("enterprise",enterpriseId);
        var request=new IpRunService.IpVideoRequest("缓慢推镜",null,5,"9:16",endpoint,30L,null,selected,"native-concurrent");
        var card=json.createObjectNode().put("id",job).put("status","submitting");
        AtomicInteger submissions=new AtomicInteger();
        when(nativeVideos.submit(any(),eq(user),eq("ipstudio"),eq(selected))).thenAnswer(inv->{
            submissions.incrementAndGet();
            billing.reserve(user,selected,"material_video_job",job,endpoint,30,"本地原生视频");
            return List.of(card);
        });
        when(nativeVideos.getJob(job,user,"ipstudio")).thenReturn(card);
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            var first=pool.submit(()->{gate.await();return service.generateVideo(user,project,request);});
            var second=pool.submit(()->{gate.await();return service.generateVideo(user,project,request);});
            gate.countDown();assertEquals(job,first.get(30,TimeUnit.SECONDS).path("id").asText());
            assertEquals(job,second.get(30,TimeUnit.SECONDS).path("id").asText());
        } finally {pool.shutdownNow();}
        assertEquals(1,submissions.get());
        var memberWallet=wallets.findByAccountKey("enterprise_member:"+enterpriseId+":"+user).orElseThrow();
        assertEquals(70,memberWallet.getTotalBalance());assertEquals(30,memberWallet.getPendingBalance());
        assertEquals(500,wallets.findByUserId(user).orElseThrow().getTotalBalance());
        assertEquals(30,holds.findByReferenceTypeAndReferenceId("material_video_job",job).orElseThrow().getAmount());
        assertTrue(authorizations.findByReferenceTypeAndReferenceId("material_video_job",job).isPresent());
        var binding=runs.findByProjectIdAndClientRequestId(project,"native-concurrent").orElseThrow();
        assertEquals("studio-video",binding.getKind());assertEquals(0,binding.getCost());assertNull(binding.getBillingAuthorizationId());
        assertEquals(1,runs.findByProjectIdOrderByCreatedAtDesc(project).size());
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.generateVideo(user,project,
                new IpRunService.IpVideoRequest("换个文案",null,5,"9:16",endpoint,30L,null,selected,"native-concurrent"))).getCode());
        assertEquals(1,submissions.get());assertEquals(30,wallets.findById(memberWallet.getId()).orElseThrow().getPendingBalance());
    }
}
