package com.aistareco.aep.enterprise;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.materialvideo.*;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import jakarta.persistence.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real database/ledger plus a local deterministic HTTP video supplier; never calls a paid endpoint. */
@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false","aep.material.video.poll-interval-seconds=1"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class EnterpriseVideoBillingIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        String url=System.getProperty("enterprise.test.jdbc","jdbc:h2:mem:enterprise-video;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        registry.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        registry.add("spring.datasource.password",()->"");
    }
    @org.springframework.beans.factory.annotation.Autowired EnterpriseService enterprises;
    @org.springframework.beans.factory.annotation.Autowired EnterprisePointsService points;
    @org.springframework.beans.factory.annotation.Autowired EnterpriseBillingService billing;
    @org.springframework.beans.factory.annotation.Autowired EnrollmentService enrollment;
    @org.springframework.beans.factory.annotation.Autowired AepUserRepository users;
    @org.springframework.beans.factory.annotation.Autowired WalletRepository wallets;
    @org.springframework.beans.factory.annotation.Autowired CreditHoldRepository holds;
    @org.springframework.beans.factory.annotation.Autowired LedgerEntryRepository ledger;
    @org.springframework.beans.factory.annotation.Autowired CreditService credits;
    @org.springframework.beans.factory.annotation.Autowired MaterialVideoJobService jobs;
    @org.springframework.beans.factory.annotation.Autowired MaterialVideoJobRepository rows;
    @org.springframework.beans.factory.annotation.Autowired MaterialVideoModelClient client;
    @org.springframework.beans.factory.annotation.Autowired MaterialVideoProperties properties;
    @org.springframework.beans.factory.annotation.Autowired AiModelEndpointRepository endpoints;
    @org.springframework.beans.factory.annotation.Autowired AiAppBindingRepository bindings;
    @org.springframework.beans.factory.annotation.Autowired AiAppEndpointCandidateRepository candidates;
    @org.springframework.beans.factory.annotation.Autowired StorageQuotaService storage;
    @org.springframework.beans.factory.annotation.Autowired ObjectProvider<CdnUploader> uploader;
    @org.springframework.beans.factory.annotation.Autowired ObjectMapper mapper;
    @org.springframework.beans.factory.annotation.Autowired PlatformTransactionManager transactions;
    @org.springframework.beans.factory.annotation.Autowired MockMvc mvc;
    @org.springframework.beans.factory.annotation.Autowired AuditLogRepository auditLogs;
    @org.springframework.beans.factory.annotation.Autowired EnterpriseLifecycleService lifecycle;
    @org.springframework.beans.factory.annotation.Autowired com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository authorizations;
    @PersistenceContext EntityManager em;
    @MockBean MaterialVideoWorker asyncWorker;
    @MockBean MaterialVideoCover cover;
    HttpServer http;
    String base,endpointId;
    volatile String submitResponse,pollStatus;
    volatile int submitStatus;
    volatile boolean pollOutage;
    final AtomicInteger submitted=new AtomicInteger();
    MaterialVideoWorker worker;

    @BeforeEach void provider() throws Exception {
        submitted.set(0);submitResponse="{\"id\":\"original-supplier-task\"}";submitStatus=200;pollStatus="succeeded";pollOutage=false;
        http=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        http.createContext("/",exchange->{
            exchange.getRequestBody().readAllBytes();String path=exchange.getRequestURI().getPath();
            int status=200;byte[] body;
            if(path.equals("/videos/generations")) {submitted.incrementAndGet();status=submitStatus;body=submitResponse.getBytes(StandardCharsets.UTF_8);}
            else if(path.startsWith("/async-result/")) {
                status=pollOutage?503:200;
                body=("{\"status\":\""+pollStatus+"\",\"video_url\":\""+base+"/video.mp4\"}").getBytes(StandardCharsets.UTF_8);
            } else {body=new byte[]{1,2,3,4};}
            exchange.getResponseHeaders().set("Content-Type",path.endsWith(".mp4")?"video/mp4":"application/json");
            exchange.sendResponseHeaders(status,body.length);exchange.getResponseBody().write(body);exchange.close();
        });http.start();base="http://127.0.0.1:"+http.getAddress().getPort();
        endpointId="enterprise-video-"+UUID.randomUUID();
        endpoints.save(AiModelEndpoint.builder().id(endpointId).name("Deterministic video")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl(base).model("deterministic-video")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-test-key")).enabled(true).build());
        candidates.save(AiAppEndpointCandidate.builder().id("c-"+UUID.randomUUID()).purpose(AiModelPurpose.VIDEO_GENERATION)
                .endpointId(endpointId).creditCostOverride(30L).enabled(true).build());
        bindings.save(AiAppBinding.builder().purpose(AiModelPurpose.VIDEO_GENERATION).endpointId(endpointId).build());
        worker=new MaterialVideoWorker(rows,client,properties,credits,storage,uploader,cover);
        worker.transactionManager(transactions);ReflectionTestUtils.setField(worker,"enterpriseBilling",billing);
        ReflectionTestUtils.setField(worker,"entityManager",em);
    }
    @AfterEach void stopProvider(){if(http!=null)http.stop(0);}

    record MemberContext(Context company,Context member) {}
    String person() {
        String id=UUID.randomUUID().toString();users.save(AepUser.builder().id(id).username(id).displayName("视频验收")
                .status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);return id;
    }
    MemberContext funded(int cap,long amount) {
        var company=enterprises.create(person(),new CreateRequest("视频验收企业",UUID.randomUUID().toString()));
        var invitation=enterprises.invite(company.member().userId(),company.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        var member=enterprises.accept(person(),new AcceptRequest(invitation.token()));
        var policy=enterprises.policy(company.member().userId(),company.enterprise().id());
        enterprises.updatePolicy(company.member().userId(),company.enterprise().id(),new PolicyUpdate(List.of(endpointId),cap,policy.version()));
        var root=wallets.findByAccountKey("enterprise:"+company.enterprise().id()).orElseThrow();
        credits.creditWallet(root.getId(),amount,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"企业积分");
        var items=List.of(new Item(member.member().id(),amount));
        var preview=points.preview(company.member().userId(),company.enterprise().id(),"allocate",new PreviewRequest(items));
        points.submit(company.member().userId(),company.enterprise().id(),"allocate",new SubmitRequest(UUID.randomUUID().toString(),preview.confirmationFingerprint(),items));
        credits.creditAccount(member.member().userId(),999,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"原个人积分");
        return new MemberContext(company,member);
    }
    Wallet memberWallet(MemberContext context){return wallets.findByAccountKey("enterprise_member:"+context.member().enterprise().id()+":"+context.member().member().userId()).orElseThrow();}
    BillingSelection selection(MemberContext context){return new BillingSelection("enterprise",context.company().enterprise().id());}
    JsonNode body(long cost) {
        var body=mapper.createObjectNode();var item=body.putArray("items").addObject();
        item.put("name","验收视频").put("prompt","local deterministic").put("duration_sec",5).put("aspect_ratio","9:16").put("credit_cost",cost);
        item.putObject("variant_config").put("endpoint_id",endpointId);return body;
    }
    String submit(MemberContext context,long cost) {
        return jobs.submit(body(cost),context.member().member().userId(),MaterialVideoJobService.APP_IPSTUDIO,selection(context)).get(0).path("id").asText();
    }
    CreditHold hold(String id){return holds.findByReferenceTypeAndReferenceId("material_video_job",id).orElseThrow();}

    @Test void supplierSuccessSpendsExactlyOnceFromOriginalEnterpriseWallet() {
        var context=funded(2,100);String id=submit(context,30);var original=hold(id);
        assertEquals(memberWallet(context).getId(),original.getWalletId());assertNotNull(rows.findById(id).orElseThrow().getBillingAuthorizationId());
        assertEquals(context.member().member().id(),original.getMembershipId());assertEquals(30,memberWallet(context).getPendingBalance());
        worker.generateAsync(id);worker.generateAsync(id);
        assertEquals("succeeded",rows.findById(id).orElseThrow().getStatus());assertEquals(1,submitted.get());
        assertEquals(CreditHold.Status.COMMITTED,hold(id).getStatus());assertEquals(70,memberWallet(context).getTotalBalance());assertEquals(0,memberWallet(context).getPendingBalance());
        assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
        assertEquals(1,ledger.findAll().stream().filter(l->id.equals(l.getReferenceId())&&l.getEntryType()==LedgerEntry.LedgerEntryType.SPEND).count());
    }

    @Test void uncertainSupplierAcceptanceRetainsMoneyAndInFlightCapWithoutResubmission() {
        var context=funded(1,100);submitResponse="{}";String id=submit(context,30);worker.generateAsync(id);
        assertEquals("submitting",rows.findById(id).orElseThrow().getStatus());assertEquals("VIDEO_SUBMISSION_UNKNOWN",rows.findById(id).orElseThrow().getErrorCode());
        assertEquals(CreditHold.Status.ACTIVE,hold(id).getStatus());assertEquals(30,memberWallet(context).getPendingBalance());
        worker.generateAsync(id);worker.recoverQueuedGeneration(id);assertEquals(1,submitted.get());
        assertThrows(BusinessException.class,()->submit(context,30));assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
    }

    @Test void genericCreateGatewayFailureKeepsOriginalHoldWhileDocumentedQueueRejectionReleases() {
        var context=funded(1,100);submitStatus=503;submitResponse="{\"message\":\"gateway unavailable\"}";
        String uncertain=submit(context,30);worker.generateAsync(uncertain);
        assertEquals("VIDEO_SUBMISSION_UNKNOWN",rows.findById(uncertain).orElseThrow().getErrorCode());
        assertEquals(CreditHold.Status.ACTIVE,hold(uncertain).getStatus());assertEquals(30,memberWallet(context).getPendingBalance());
        assertThrows(BusinessException.class,()->submit(context,30));
        var other=funded(1,100);submitResponse="{\"code\":\"video_queue_full\",\"message\":\"video queue is full\"}";
        String rejected=submit(other,30);worker.generateAsync(rejected);
        assertEquals("failed",rows.findById(rejected).orElseThrow().getStatus());assertEquals("VIDEO_PROVIDER_QUEUE_FULL",rows.findById(rejected).orElseThrow().getErrorCode());
        assertEquals(CreditHold.Status.RELEASED,hold(rejected).getStatus());assertEquals(100,memberWallet(other).getTotalBalance());
        assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
        assertEquals(999,wallets.findByUserId(other.member().member().userId()).orElseThrow().getTotalBalance());assertEquals(2,submitted.get());
    }

    @Test void operatorEvidenceBindsOriginalUnknownTaskAndRecoversItsOriginalRouteWalletAndPrice() throws Exception {
        var context=funded(1,100);submitResponse="{}";String id=submit(context,30);worker.generateAsync(id);
        String path="/api/admin/material-video-jobs/"+id;
        var unknown=rows.findById(id).orElseThrow();assertEquals(base,unknown.getUpstreamBaseUrlSnapshot());
        assertEquals("deterministic-video",unknown.getModelUsed());
        mvc.perform(get(path).with(user(context.member().member().userId()).roles("PERSONAL"))).andExpect(status().isForbidden());
        mvc.perform(get(path).with(user("finance").roles("FINANCE_ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get(path).with(user("platform-operator").roles("OPERATOR"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.error_code").value("VIDEO_SUBMISSION_UNKNOWN"));
        String evidence="Supplier console confirms this original accepted task, receipt #12345";
        var request=new com.aistareco.aep.dto.MaterialVideoReconcileRequest("original-supplier-task",evidence);
        mvc.perform(post(path+"/reconcile").with(user(context.member().member().userId()).roles("PERSONAL"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isForbidden());
        mvc.perform(post(path+"/reconcile").with(user("finance").roles("FINANCE_ADMIN"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isForbidden());
        mvc.perform(post(path+"/reconcile").with(user("platform-operator").roles("OPERATOR"))
                .contentType("application/json").content("{\"externalTaskId\":\"original-supplier-task\",\"evidence\":\"\"}"))
                .andExpect(status().isBadRequest());
        assertNull(rows.findById(id).orElseThrow().getExternalTaskId());assertEquals(CreditHold.Status.ACTIVE,hold(id).getStatus());
        var edited=endpoints.findById(endpointId).orElseThrow();edited.setBaseUrl("http://127.0.0.1:1");edited.setModel("changed-later");endpoints.save(edited);
        mvc.perform(post(path+"/reconcile").with(user("platform-operator").roles("OPERATOR"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("rendering"))
                .andExpect(jsonPath("$.data.external_task_id").value("original-supplier-task"));
        worker.recoverQueuedGeneration(id);
        assertEquals("succeeded",rows.findById(id).orElseThrow().getStatus());assertEquals(1,submitted.get());
        assertEquals(CreditHold.Status.COMMITTED,hold(id).getStatus());assertEquals(70,memberWallet(context).getTotalBalance());
        assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
        mvc.perform(post(path+"/reconcile").with(user("platform-operator").roles("OPERATOR"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isOk());
        assertEquals(1,auditLogs.findAll().stream().filter(a->id.equals(a.getResourceId())&&"admin.video.bind_original_task".equals(a.getAction())
                &&"platform-operator".equals(a.getUserId())&&a.getDetail().contains("receipt #12345")).count());
        assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(id,
                new com.aistareco.aep.dto.MaterialVideoReconcileRequest("different-task",evidence),"platform-operator"));
        assertEquals("original-supplier-task",rows.findById(id).orElseThrow().getExternalTaskId());
    }

    @Test void evidenceCannotBindAnUnsubmittedQueuedJobOrAReleasedHold() {
        var context=funded(1,100);String queued=submit(context,30);
        var request=new com.aistareco.aep.dto.MaterialVideoReconcileRequest("original-supplier-task","Supplier evidence receipt #12345");
        assertEquals("VIDEO_JOB_NOT_UNCERTAIN",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(queued,request,"platform-operator")).getCode());
        assertTrue(jobs.cancelBeforeDispatch(queued));
        String unknown=submit(context,30);submitResponse="{}";worker.generateAsync(unknown);
        credits.releaseHold("material_video_job",unknown,"test operator already released original hold");
        assertEquals("VIDEO_ORIGINAL_HOLD_RELEASED",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(unknown,request,"platform-operator")).getCode());
        assertNull(rows.findById(unknown).orElseThrow().getExternalTaskId());assertEquals(1,submitted.get());
    }

    @Test void acceptedTaskRecoversOriginalSupplierIdAndFrozenPriceAfterPollOutage() {
        var context=funded(1,100);pollOutage=true;String id=submit(context,30);worker.generateAsync(id);
        var pending=rows.findById(id).orElseThrow();assertEquals("generating",pending.getStatus());assertEquals("original-supplier-task",pending.getExternalTaskId());
        assertEquals(CreditHold.Status.ACTIVE,hold(id).getStatus());assertThrows(BusinessException.class,()->submit(context,0));
        pollOutage=false;worker.reconcileSucceeded(id);worker.recoverQueuedGeneration(id);
        assertEquals("succeeded",rows.findById(id).orElseThrow().getStatus());assertEquals(1,submitted.get());assertEquals(CreditHold.Status.COMMITTED,hold(id).getStatus());
        assertEquals(70,memberWallet(context).getTotalBalance());assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
        assertFalse(jobs.cancelQueued(id,context.member().member().userId()));
        assertTrue(holds.findByReferenceTypeAndReferenceId("material_video_job_recovery",id).isEmpty());
    }

    /** Free use comes only from model grants (user decision 2026-10-25): a zero-price video is rejected before any authorization. */
    @Test void zeroCostVideoIsRejectedBeforeAnyAuthorizationOrSupplierCall() {
        var context=funded(1,100);
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->submit(context,0)).getCode());
        assertTrue(rows.findScoped(context.member().member().userId(),MaterialVideoJobService.APP_IPSTUDIO).isEmpty());
        assertTrue(authorizations.findAll().stream().noneMatch(a->context.company().enterprise().id().equals(a.getEnterpriseId())));
        assertEquals(100,memberWallet(context).getTotalBalance());assertEquals(0,memberWallet(context).getPendingBalance());assertEquals(0,submitted.get());
        assertNotNull(submit(context,30)); // The rejected attempt left nothing behind, so the only in-flight slot is still free.
    }

    @Test void supplierFailureReleasesOriginalEnterpriseHoldAndAllowsTheNextJob() {
        var context=funded(1,100);pollStatus="failed";String id=submit(context,30);worker.generateAsync(id);
        assertEquals("failed",rows.findById(id).orElseThrow().getStatus());assertEquals(CreditHold.Status.RELEASED,hold(id).getStatus());
        assertEquals(100,memberWallet(context).getTotalBalance());assertEquals(0,memberWallet(context).getPendingBalance());
        assertNotNull(submit(context,30));assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
    }

    @Test void zeroCostVideoIsRejectedForPersonalPayersToo() {
        var context=funded(1,100);String user=context.member().member().userId();
        var personal=new BillingSelection("personal",null);
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,
                ()->jobs.submit(body(0),user,MaterialVideoJobService.APP_IPSTUDIO,personal)).getCode());
        assertTrue(rows.findScoped(user,MaterialVideoJobService.APP_IPSTUDIO).isEmpty());
        assertEquals(999,wallets.findByUserId(user).orElseThrow().getTotalBalance());assertEquals(0,submitted.get());
    }

    @Test void batchCapFailureRollsBackEarlierCandidateHoldAndAuthorization() {
        var context=funded(1,100);var body=body(30);var items=(com.fasterxml.jackson.databind.node.ArrayNode)body.path("items");items.add(items.get(0).deepCopy());
        assertThrows(BusinessException.class,()->jobs.submit(body,context.member().member().userId(),MaterialVideoJobService.APP_IPSTUDIO,selection(context)));
        assertEquals(100,memberWallet(context).getTotalBalance());assertEquals(0,memberWallet(context).getPendingBalance());
        assertTrue(rows.findScoped(context.member().member().userId(),MaterialVideoJobService.APP_IPSTUDIO).isEmpty());
        assertNotNull(submit(context,30)); // The rolled-back first authorization did not consume the only slot.
    }

    @Test void changedEnterpriseModelPolicyBlocksQueuedDispatchBeforeSupplierSubmission() {
        var context=funded(1,100);String id=submit(context,30);
        var policy=enterprises.policy(context.company().member().userId(),context.company().enterprise().id());
        enterprises.updatePolicy(context.company().member().userId(),context.company().enterprise().id(),new PolicyUpdate(List.of(),1,policy.version()));
        worker.generateAsync(id);assertEquals(0,submitted.get());assertEquals("failed",rows.findById(id).orElseThrow().getStatus());
        assertEquals(CreditHold.Status.RELEASED,hold(id).getStatus());assertEquals(100,memberWallet(context).getTotalBalance());
    }

    @Test void concurrentActualCandidatesCannotExceedMemberCapOrMixPersonalFunds() throws Exception {
        var context=funded(1,40);var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        Callable<Boolean> submit=()->{start.await();try {submit(context,30);return true;}catch(BusinessException failure){return false;}};
        try {var first=pool.submit(submit);var second=pool.submit(submit);start.countDown();
            assertEquals(1,(first.get(30,TimeUnit.SECONDS)?1:0)+(second.get(30,TimeUnit.SECONDS)?1:0));
        } finally {pool.shutdownNow();}
        assertEquals(10,memberWallet(context).getTotalBalance());assertEquals(30,memberWallet(context).getPendingBalance());
        assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
    }

    @Test void sharedVideoEntryRejectsOtherProductsEnterpriseFundsAndOldPersonalStillWorks() {
        var context=funded(2,100);String user=context.member().member().userId();
        for(String app:List.of(MaterialVideoJobService.APP_CELEBRITY,MaterialVideoJobService.APP_DRAMA,MaterialVideoJobService.APP_VIDEO_STUDIO))
            assertThrows(BusinessException.class,()->jobs.submit(body(30),user,app,selection(context)));
        String personal=jobs.submit(body(30),user,MaterialVideoJobService.APP_CELEBRITY).get(0).path("id").asText();
        assertEquals(wallets.findByUserId(user).orElseThrow().getId(),hold(personal).getWalletId());assertNull(hold(personal).getEnterpriseId());
        worker.generateAsync(personal);assertEquals("succeeded",rows.findById(personal).orElseThrow().getStatus());
        assertEquals(969,wallets.findByUserId(user).orElseThrow().getTotalBalance());assertEquals(100,memberWallet(context).getTotalBalance());
    }

    @Test void legacyPersonalRecoveryKeepsItsExistingRepricingAndStoresTheAmountActuallySpent() {
        var context=funded(2,100);String user=context.member().member().userId();pollStatus="failed";
        String id=jobs.submit(body(8),user,MaterialVideoJobService.APP_CELEBRITY).get(0).path("id").asText();
        worker.generateAsync(id);assertEquals(CreditHold.Status.RELEASED,hold(id).getStatus());
        var legacy=rows.findById(id).orElseThrow();legacy.setBillingWalletId(null);legacy.setPayloadJson("{}");rows.saveAndFlush(legacy);
        pollStatus="succeeded";worker.reconcileSucceeded(id);
        assertEquals("succeeded",rows.findById(id).orElseThrow().getStatus());assertEquals(30,rows.findById(id).orElseThrow().getCreditsHeld());
        var recovered=holds.findByReferenceTypeAndReferenceId("material_video_job_recovery",id).orElseThrow();
        assertEquals(CreditHold.Status.COMMITTED,recovered.getStatus());assertEquals(969,wallets.findByUserId(user).orElseThrow().getTotalBalance());
        assertEquals(100,memberWallet(context).getTotalBalance());assertEquals(1,submitted.get());
    }

    @Test void operatorConfirmationOfNoAcceptedTaskReleasesOriginalFundsWithOneImmutableAudit() throws Exception {
        var context=funded(1,100);submitResponse="{}";String id=submit(context,30);worker.generateAsync(id);
        String path="/api/admin/material-video-jobs/"+id+"/reconcile";
        String evidence="Supplier support receipt #321 explicitly confirms original request was not accepted and no task is in flight";
        var request=new com.aistareco.aep.dto.MaterialVideoReconcileRequest(null,evidence,true);
        mvc.perform(post(path).with(user(context.member().member().userId()).roles("PERSONAL"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isForbidden());
        mvc.perform(post(path).with(user("finance").roles("FINANCE_ADMIN"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isForbidden());
        mvc.perform(post(path).with(user("platform-operator").roles("OPERATOR"))
                .contentType("application/json").content(mapper.writeValueAsBytes(new com.aistareco.aep.dto.MaterialVideoReconcileRequest("task-id",evidence,true))))
                .andExpect(status().isBadRequest());
        assertEquals(CreditHold.Status.ACTIVE,hold(id).getStatus());
        for(int i=0;i<2;i++)mvc.perform(post(path).with(user("platform-operator").roles("OPERATOR"))
                .contentType("application/json").content(mapper.writeValueAsBytes(request))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("failed")).andExpect(jsonPath("$.data.error_code").value("VIDEO_CONFIRMED_NOT_ACCEPTED"))
                .andExpect(jsonPath("$.data._not_accepted_proof").doesNotExist());
        assertEquals(CreditHold.Status.RELEASED,hold(id).getStatus());assertEquals(100,memberWallet(context).getTotalBalance());
        assertEquals(0,memberWallet(context).getPendingBalance());assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
        assertNotNull(authorizations.findByReferenceTypeAndReferenceId("material_video_job",id).orElseThrow().getTerminalAt());
        assertEquals(1,auditLogs.findAll().stream().filter(a->id.equals(a.getResourceId())&&"admin.video.confirm_not_accepted".equals(a.getAction())
                &&a.getDetail().contains("receipt #321")&&a.getDetail().contains(memberWallet(context).getId())).count());
        assertEquals("VIDEO_RECOVERY_EVIDENCE_IMMUTABLE",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(id,
                new com.aistareco.aep.dto.MaterialVideoReconcileRequest(null,"different supplier evidence receipt",true),"platform-operator")).getCode());
        worker.generateAsync(id);worker.recoverQueuedGeneration(id);assertEquals(1,submitted.get());assertNotNull(submit(context,30));
    }

    @Test void noAcceptanceConfirmationRejectsQueuedKnownSupplierIdAndSettledFunds() {
        var context=funded(2,100);var request=new com.aistareco.aep.dto.MaterialVideoReconcileRequest(null,
                "Supplier support explicitly confirmed no accepted task",true);
        String queued=submit(context,30);
        assertEquals("VIDEO_JOB_NOT_UNCERTAIN",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(queued,request,"platform-operator")).getCode());
        pollOutage=true;worker.generateAsync(queued);
        assertEquals("VIDEO_ORIGINAL_TASK_IMMUTABLE",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(queued,request,"platform-operator")).getCode());
        assertEquals(CreditHold.Status.ACTIVE,hold(queued).getStatus());pollOutage=false;worker.recoverQueuedGeneration(queued);
        assertEquals(CreditHold.Status.COMMITTED,hold(queued).getStatus());
        assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(queued,request,"platform-operator"));
        submitResponse="{}";String unknown=submit(context,30);worker.generateAsync(unknown);credits.releaseHold("material_video_job",unknown,"already refunded fixture");
        assertEquals("VIDEO_ORIGINAL_HOLD_RELEASED",assertThrows(BusinessException.class,()->jobs.bindOriginalSupplierTask(unknown,request,"platform-operator")).getCode());
        assertEquals(70,memberWallet(context).getTotalBalance());assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());
    }

    @Test void lateNoAcceptanceEvidenceAfterSuspensionReturnsOriginalMembershipFundsToRoot() {
        var context=funded(1,100);submitResponse="{}";String id=submit(context,30);worker.generateAsync(id);
        String owner=context.company().member().userId(),enterprise=context.company().enterprise().id(),member=context.member().member().id();
        var preview=lifecycle.preview(owner,enterprise,new com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.PreviewRequest("suspend",member));
        lifecycle.apply(owner,enterprise,new com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.Request("suspend",member,UUID.randomUUID().toString(),preview.confirmationFingerprint()));
        assertEquals(70,wallets.findByAccountKey("enterprise:"+enterprise).orElseThrow().getTotalBalance());assertEquals(30,memberWallet(context).getPendingBalance());
        var request=new com.aistareco.aep.dto.MaterialVideoReconcileRequest(null,"Supplier incident receipt confirms the original request was never accepted",true);
        jobs.bindOriginalSupplierTask(id,request,"platform-operator");jobs.bindOriginalSupplierTask(id,request,"platform-operator");
        assertEquals(CreditHold.Status.RELEASED,hold(id).getStatus());assertEquals(100,wallets.findByAccountKey("enterprise:"+enterprise).orElseThrow().getTotalBalance());
        assertEquals(0,memberWallet(context).getTotalBalance());assertEquals(0,memberWallet(context).getPendingBalance());
        assertEquals(999,wallets.findByUserId(context.member().member().userId()).orElseThrow().getTotalBalance());assertEquals(1,submitted.get());
    }
}
