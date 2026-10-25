package com.aistareco.aep.enterprise;

import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.dto.AiAppSceneModelPolicyDto;
import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controller, ownership, model HTTP, persistence, authorization and ledger. No paid upstreams. */
@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false","aep.dap.monthly-grant=0"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class EnterpriseStudioBillingIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->"jdbc:h2:mem:enterprise-studio-generation;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
    }
    @Autowired EnterpriseService enterprises; @Autowired EnterprisePointsService points; @Autowired EnterpriseBillingService billing;
    @Autowired EnterpriseLifecycleService lifecycle;
    @Autowired EnterpriseBillingAuthorizationRepository authorizations; @Autowired EnrollmentService enrollment;
    @Autowired AepUserRepository users; @Autowired WalletRepository wallets; @Autowired CreditHoldRepository holds;
    @Autowired LedgerEntryRepository ledger; @Autowired AuditLogRepository audits; @Autowired CreditService credits; @Autowired IpProjectService projects;
    @Autowired IpRunRepository runs; @Autowired DapMultimodalClient multimodal; @Autowired DapImageInput imageInput;
    @Autowired DapPricingService pricing; @Autowired FileStorageService storage; @Autowired AiModelInvocationService models;
    @Autowired DramaAssembleService assembly; @Autowired DapAssetService assets; @Autowired PlatformTransactionManager transactions;
    @Autowired AiModelEndpointRepository endpoints; @Autowired AiAppBindingRepository bindings;
    @Autowired AiAppEndpointCandidateRepository candidates; @Autowired AiAppSceneModelPolicyService scenePolicies;
    @Autowired PlatformConfigService configs; @Autowired ObjectMapper json; @Autowired MockMvc mvc; @Autowired StudioFixtureProvider fixtures;
    @MockBean IpRunWorker asyncImages; @MockBean StudioWorkflowWorker asyncText;
    HttpServer http; String base,imageEndpoint,textEndpoint; IpRunWorker imageWorker; StudioWorkflowWorker textWorker;
    final AtomicInteger imageCalls=new AtomicInteger(),textCalls=new AtomicInteger(); volatile int imageFailureAfter;
    static final String PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA3cAAAAASUVORK5CYII=";

    @BeforeEach void provider() throws Exception {
        imageCalls.set(0);textCalls.set(0);imageFailureAfter=Integer.MAX_VALUE;
        http=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        http.createContext("/",exchange->{
            exchange.getRequestBody().readAllBytes();String path=exchange.getRequestURI().getPath();int status=200;String response;
            if(path.endsWith("/images/generations")) {
                int call=imageCalls.incrementAndGet();
                if(call>imageFailureAfter){status=400;response="{\"error\":{\"message\":\"deterministic provider rejection\"}}";}
                else response="{\"data\":[{\"b64_json\":\""+PNG+"\"}]}";
            } else if(path.endsWith("/chat/completions")) {
                textCalls.incrementAndGet();response="{\"choices\":[{\"message\":{\"content\":\"{\\\"summary\\\":\\\"本地测试\\\",\\\"content\\\":\\\"本地模型生成的完整正文。\\\"}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":100}}";
            } else {status=404;response="{}";}
            byte[] bytes=response.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });http.start();base="http://127.0.0.1:"+http.getAddress().getPort();
        imageEndpoint=endpoint("image",AiModelPurpose.DAP_IMAGE);textEndpoint=endpoint("text",AiModelPurpose.DAP_PERSONA);
        scenePolicies.save("studio","image",new AiAppSceneModelPolicyDto("studio","image","selectable",imageEndpoint,
                List.of(new AiAppSceneModelPolicyDto.Candidate(imageEndpoint,8L,"per_image"))),"test");
        ObjectNode price=json.createObjectNode();price.putObject("endpoints").putObject(textEndpoint)
                .put("inputCreditsPerK",1).put("outputCreditsPerK",1).put("maxInputTokens",1000).put("maxOutputTokens",1000);
        configs.upsert(AiChatTokenPricing.KEY,price,"确定性测试价格","test");
        imageWorker=new IpRunWorker(runs,projects,multimodal,imageInput,pricing,storage,credits,json);
        imageWorker.billingTransactions(transactions);ReflectionTestUtils.setField(imageWorker,"enterpriseBilling",billing);
        textWorker=new StudioWorkflowWorker(runs,fixtures,storage,models,assembly,credits,json,transactions,assets);
        ReflectionTestUtils.setField(textWorker,"enterpriseBilling",billing);
    }
    @AfterEach void stop(){if(http!=null)http.stop(0);}
    String endpoint(String kind,AiModelPurpose purpose) {
        String id="test-"+kind+"-"+UUID.randomUUID();
        endpoints.save(AiModelEndpoint.builder().id(id).name("本地 "+kind).providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl(base).model("deterministic-"+kind).upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-key")).enabled(true).build());
        candidates.save(AiAppEndpointCandidate.builder().id("c-"+UUID.randomUUID()).purpose(purpose).endpointId(id).enabled(true).build());
        bindings.save(AiAppBinding.builder().purpose(purpose).endpointId(id).build());return id;
    }
    record Case(Context company,Context member,String project) {String actor(){return member.member().userId();}String enterprise(){return company.enterprise().id();}}
    String person() {
        String id=UUID.randomUUID().toString();users.save(AepUser.builder().id(id).username(id).displayName("验收成员").status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);return id;
    }
    Case funded(long amount,int cap) throws Exception {
        var company=enterprises.create(person(),new CreateRequest("实际生成验收",UUID.randomUUID().toString()));
        var invite=enterprises.invite(company.member().userId(),company.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        var member=enterprises.accept(person(),new AcceptRequest(invite.token()));String enterprise=company.enterprise().id();
        var policy=enterprises.policy(company.member().userId(),enterprise);
        enterprises.updatePolicy(company.member().userId(),enterprise,new PolicyUpdate(List.of(imageEndpoint,textEndpoint),cap,policy.version()));
        var root=wallets.findByAccountKey("enterprise:"+enterprise).orElseThrow();
        credits.creditWallet(root.getId(),amount,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"测试企业资金");
        var items=List.of(new Item(member.member().id(),amount));var preview=points.preview(company.member().userId(),enterprise,"allocate",new PreviewRequest(items));
        points.submit(company.member().userId(),enterprise,"allocate",new SubmitRequest(UUID.randomUUID().toString(),preview.confirmationFingerprint(),items));
        credits.creditAccount(member.member().userId(),999,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"旧个人积分");
        var project=projects.create(member.member().userId(),new IpCreateProjectRequest("真实控制器验收",null));
        var doc=json.readTree("{\"nodes\":[{\"id\":\"text-node\",\"type\":\"text\",\"title\":\"正文\",\"metadata\":{\"content\":\"原文\"}}],\"connections\":[],\"viewport\":{\"x\":0,\"y\":0,\"k\":1}}");
        projects.update(member.member().userId(),project.id(),new com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest(null,doc));
        return new Case(company,member,project.id());
    }
    Wallet memberWallet(Case c){return wallets.findByAccountKey("enterprise_member:"+c.enterprise()+":"+c.actor()).orElseThrow();}
    ObjectNode image(Case c,int count,boolean enterprise) {
        var body=json.createObjectNode().put("clientRequestId",UUID.randomUUID().toString()).put("nodeId","image-node").put("operation","image")
                .put("prompt","local deterministic image").put("model",imageEndpoint).put("size","768x1024").put("aspectRatio","3:4").put("count",count).put("maxCost",8L*count);
        if(enterprise)body.putObject("billing").put("mode","enterprise").put("enterpriseId",c.enterprise());return body;
    }
    JsonNode submit(Case c,ObjectNode body,int expected) throws Exception {
        var response=mvc.perform(post("/api/v1/ip-studio/projects/"+c.project()+"/studio-runs").with(user(c.actor())).header("X-App-Code","aiavatar")
                .contentType("application/json").content(json.writeValueAsBytes(body))).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }
    void settled(Case c,String id,long spent) {
        var row=runs.findById(id).orElseThrow();assertEquals(spent,row.getCost());assertEquals(memberWallet(c).getId(),row.getBillingWalletId());
        assertEquals(0,memberWallet(c).getPendingBalance());assertNotNull(authorizations.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getTerminalAt());
        assertEquals(999,wallets.findByUserId(c.actor()).orElseThrow().getTotalBalance());
    }

    @Test void actualImageHttpSuccessChargesEnterpriseAndReplayKeepsOriginalPayer() throws Exception {
        var c=funded(100,2);var body=image(c,1,true);String id=submit(c,body,200).path("data").path("id").asText();
        assertEquals(8,memberWallet(c).getPendingBalance());imageWorker.runBlocking(id);imageWorker.runBlocking(id);
        assertEquals("done",runs.findById(id).orElseThrow().getStatus());assertEquals(92,memberWallet(c).getTotalBalance());settled(c,id,8);assertEquals(1,imageCalls.get());
        assertEquals(id,submit(c,body,200).path("data").path("id").asText());body.remove("billing");
        assertEquals("STUDIO_REQUEST_CHANGED",submit(c,body,409).path("error").path("code").asText());assertEquals(1,imageCalls.get());
    }
    @Test void actualImagePartialFailureChargesOnlyMirroredSuccessAndReleasesRest() throws Exception {
        var c=funded(100,2);imageFailureAfter=1;String id=submit(c,image(c,2,true),200).path("data").path("id").asText();
        imageWorker.runBlocking(id);var row=runs.findById(id).orElseThrow();assertEquals("failed",row.getStatus());assertEquals(1,json.readTree(row.getOutputJson()).path("candidates").size());
        assertEquals(92,memberWallet(c).getTotalBalance());settled(c,id,8);assertEquals(2,imageCalls.get());
    }
    @Test void actualImageProviderFailureRefundsAndPersonalFundsRemainIndependent() throws Exception {
        var c=funded(100,2);imageFailureAfter=0;String id=submit(c,image(c,1,true),200).path("data").path("id").asText();
        imageWorker.runBlocking(id);assertEquals("failed",runs.findById(id).orElseThrow().getStatus());assertEquals(100,memberWallet(c).getTotalBalance());settled(c,id,0);
        imageFailureAfter=Integer.MAX_VALUE;String personal=submit(c,image(c,1,false),200).path("data").path("id").asText();imageWorker.runBlocking(personal);
        assertEquals("done",runs.findById(personal).orElseThrow().getStatus());assertEquals(991,wallets.findByUserId(c.actor()).orElseThrow().getTotalBalance());assertEquals(100,memberWallet(c).getTotalBalance());
    }
    @Test void actualTextHttpUsesFrozenTokenRateAndRefundsUnusedReservation() throws Exception {
        var c=funded(100,2);var body=json.createObjectNode().put("clientRequestId",UUID.randomUUID().toString()).put("nodeId","text-node").put("operation","text")
                .put("prompt","修改正文").put("model",textEndpoint).put("maxCost",2);body.putObject("textEdit").put("content","原文");body.putObject("billing").put("mode","enterprise").put("enterpriseId",c.enterprise());
        String id=submit(c,body,200).path("data").path("id").asText();assertEquals(2,memberWallet(c).getPendingBalance());
        textWorker.runBlocking(id);textWorker.runBlocking(id);assertEquals("done",runs.findById(id).orElseThrow().getStatus());assertEquals(99,memberWallet(c).getTotalBalance());settled(c,id,1);assertEquals(1,textCalls.get());
    }
    @Test void insufficientEnterpriseFundsCannotFallbackToWellFundedPersonalWallet() throws Exception {
        var c=funded(4,2);submit(c,image(c,1,true),402);assertEquals(4,memberWallet(c).getTotalBalance());assertEquals(0,memberWallet(c).getPendingBalance());assertEquals(999,wallets.findByUserId(c.actor()).orElseThrow().getTotalBalance());assertEquals(0,imageCalls.get());
    }
    @Test void zeroPriceActualSupplierStillCountsUntilItsAuthorizationCompletes() throws Exception {
        var c=funded(100,1);
        scenePolicies.save("studio","image",new AiAppSceneModelPolicyDto("studio","image","selectable",imageEndpoint,
                List.of(new AiAppSceneModelPolicyDto.Candidate(imageEndpoint,0L,"per_image"))),"test");
        String id=submit(c,image(c,1,true),200).path("data").path("id").asText();
        assertTrue(holds.findByReferenceTypeAndReferenceId("ip-run",id).isEmpty());
        assertEquals("ENTERPRISE_ACTIVE_JOB_LIMIT",submit(c,image(c,1,true).put("nodeId","another-image-node"),409).path("error").path("code").asText());
        imageWorker.runBlocking(id);assertEquals("done",runs.findById(id).orElseThrow().getStatus());settled(c,id,0);
        submit(c,image(c,1,true),200);assertEquals(1,imageCalls.get());assertEquals(100,memberWallet(c).getTotalBalance());
    }
    @Test void finalModelWhitelistRejectsBeforeAnyWalletFreezeOrSupplierCall() throws Exception {
        var c=funded(100,2);var policy=enterprises.policy(c.company().member().userId(),c.enterprise());
        enterprises.updatePolicy(c.company().member().userId(),c.enterprise(),new PolicyUpdate(List.of(),2,policy.version()));
        assertEquals("ENTERPRISE_MODEL_NOT_ALLOWED",submit(c,image(c,1,true),403).path("error").path("code").asText());
        assertEquals(100,memberWallet(c).getTotalBalance());assertEquals(0,memberWallet(c).getPendingBalance());assertEquals(0,imageCalls.get());
    }

    @Test void acceptedNativeImageRetainsHoldAndQueriesOriginalAfterPolicyChange() throws Exception {
        var c=funded(100,1);var nativeClient=org.mockito.Mockito.mock(JusuanImageClient.class);
        ReflectionTestUtils.setField(imageWorker,"jusuanImages",nativeClient);
        org.mockito.Mockito.when(nativeClient.supportsEndpoint(imageEndpoint)).thenReturn(true);
        var submissions=new AtomicInteger();
        org.mockito.Mockito.when(nativeClient.generate(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenAnswer(inv->{
            JsonNode previous=inv.getArgument(9);java.util.function.Consumer<ObjectNode> checkpoint=inv.getArgument(10);
            if(!previous.path("submitAttempted").asBoolean()) {
                submissions.incrementAndGet();checkpoint.accept(json.createObjectNode().put("submitAttempted",true).put("jobId","original-native-job").put("requestBody","original-body").put("baseUrl",base).put("model","original-model"));
                throw new JusuanImageClient.Pending(true,new IllegalStateException("poll outage"));
            }
            assertEquals("original-native-job",previous.path("jobId").asText());assertEquals("original-body",previous.path("requestBody").asText());return Base64.getDecoder().decode(PNG);
        });
        String id=submit(c,image(c,1,true),200).path("data").path("id").asText();imageWorker.runBlocking(id);
        assertEquals("running",runs.findById(id).orElseThrow().getStatus());assertEquals(CreditHold.Status.ACTIVE,holds.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getStatus());
        assertEquals(8,memberWallet(c).getPendingBalance());assertNull(authorizations.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getTerminalAt());
        var policy=enterprises.policy(c.company().member().userId(),c.enterprise());enterprises.updatePolicy(c.company().member().userId(),c.enterprise(),new PolicyUpdate(List.of(),1,policy.version()));
        org.mockito.Mockito.when(nativeClient.supportsEndpoint(imageEndpoint)).thenReturn(false);imageWorker.recoverNative(id);
        assertEquals("done",runs.findById(id).orElseThrow().getStatus());assertEquals(1,submissions.get());assertEquals(92,memberWallet(c).getTotalBalance());settled(c,id,8);
    }
    @Test void operatorCanBindMissingOriginalImageIdWithAuditAndNoSecondSubmission() throws Exception {
        var c=funded(100,1);var nativeClient=org.mockito.Mockito.mock(JusuanImageClient.class);ReflectionTestUtils.setField(imageWorker,"jusuanImages",nativeClient);
        org.mockito.Mockito.when(nativeClient.supportsEndpoint(imageEndpoint)).thenReturn(true);var submissions=new AtomicInteger();
        org.mockito.Mockito.when(nativeClient.generate(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenAnswer(inv->{
            JsonNode previous=inv.getArgument(9);java.util.function.Consumer<ObjectNode> checkpoint=inv.getArgument(10);
            if(!previous.path("submitAttempted").asBoolean()) {
                submissions.incrementAndGet();checkpoint.accept(json.createObjectNode().put("submitAttempted",true).put("requestBody","immutable-body").put("baseUrl",base).put("model","original-model"));
                throw new JusuanImageClient.Pending(false,new IllegalStateException("submission reply lost"));
            }
            assertEquals("original-recovered-job",previous.path("jobId").asText());assertEquals("immutable-body",previous.path("requestBody").asText());return Base64.getDecoder().decode(PNG);
        });
        String id=submit(c,image(c,1,true),200).path("data").path("id").asText();imageWorker.runBlocking(id);
        assertEquals("STUDIO_IMAGE_SUBMISSION_UNKNOWN",runs.findById(id).orElseThrow().getErrorCode());assertFalse(imageWorker.canResumeNative(runs.findById(id).orElseThrow()));
        mvc.perform(get("/api/admin/ip-studio/runs/"+id).with(user(c.actor()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/ip-studio/runs/"+id).with(user("finance").roles("FINANCE_ADMIN"))).andExpect(status().isForbidden());
        var receipt=json.createObjectNode().put("imageIndex",0).put("externalTaskId","original-recovered-job").put("evidence","供应商后台查询原请求回执 2026-10-15");
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/reconcile").with(user("finance").roles("FINANCE_ADMIN")).contentType("application/json").content(receipt.toString())).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/reconcile").with(user("operator").roles("OPERATOR")).contentType("application/json").content(receipt.toString())).andExpect(status().isOk());
        imageWorker.recoverNative(id);assertEquals("done",runs.findById(id).orElseThrow().getStatus());assertEquals(1,submissions.get());assertEquals(92,memberWallet(c).getTotalBalance());settled(c,id,8);
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/reconcile").with(user("operator").roles("OPERATOR")).contentType("application/json").content(receipt.toString())).andExpect(status().isOk());
        assertEquals(1,ledger.findAll().stream().filter(l->id.equals(l.getReferenceId())&&l.getEntryType()==LedgerEntry.LedgerEntryType.SPEND).count());
        assertEquals(1,audits.findAll().stream().filter(a->id.equals(a.getResourceId())&&"studio.image.bind_original_task".equals(a.getAction())).count());
    }
    @Test void supplierConfirmedUnknownRefundsOriginalEnterpriseAfterRemovalAndPreservesPartialSuccess() throws Exception {
        var c=funded(100,1);var nativeClient=org.mockito.Mockito.mock(JusuanImageClient.class);ReflectionTestUtils.setField(imageWorker,"jusuanImages",nativeClient);
        org.mockito.Mockito.when(nativeClient.supportsEndpoint(imageEndpoint)).thenReturn(true);var submissions=new AtomicInteger();
        org.mockito.Mockito.when(nativeClient.generate(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenAnswer(inv->{
            submissions.incrementAndGet();String key=inv.getArgument(4);java.util.function.Consumer<ObjectNode> checkpoint=inv.getArgument(10);
            var state=json.createObjectNode().put("submitAttempted",true).put("requestBody","original-"+key).put("baseUrl",base).put("model","original-model");
            if(key.endsWith("-image-0")){state.put("jobId","already-successful");checkpoint.accept(state);return Base64.getDecoder().decode(PNG);}
            checkpoint.accept(state);throw new JusuanImageClient.Pending(false,new IllegalStateException("submission reply lost"));
        });
        String id=submit(c,image(c,2,true),200).path("data").path("id").asText();imageWorker.runBlocking(id);
        var before=runs.findById(id).orElseThrow();String retained=before.getOutputJson();assertEquals(8,before.getCost());assertEquals(8,memberWallet(c).getPendingBalance());
        var preview=lifecycle.preview(c.company().member().userId(),c.enterprise(),new com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.PreviewRequest("remove",c.member().member().id()));
        lifecycle.apply(c.company().member().userId(),c.enterprise(),new com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.Request("remove",c.member().member().id(),UUID.randomUUID().toString(),preview.confirmationFingerprint()));
        assertEquals(0,memberWallet(c).getTotalBalance());assertEquals(8,memberWallet(c).getPendingBalance());
        var receipt=json.createObjectNode().put("imageIndex",1).put("evidence","供应商已核对原请求记录并确认没有受理和上游任务").put("confirmedNoUpstreamTask",true);
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/release-unknown").with(user(c.actor())).contentType("application/json").content(receipt.toString())).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/release-unknown").with(user("finance").roles("FINANCE_ADMIN")).contentType("application/json").content(receipt.toString())).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/release-unknown").with(user("operator").roles("OPERATOR")).contentType("application/json").content(receipt.toString())).andExpect(status().isOk());
        var after=runs.findById(id).orElseThrow();assertEquals("failed",after.getStatus());assertEquals(retained,after.getOutputJson());settled(c,id,8);
        assertEquals(0,memberWallet(c).getTotalBalance());assertEquals(92,wallets.findByAccountKey("enterprise:"+c.enterprise()).orElseThrow().getTotalBalance());
        mvc.perform(post("/api/admin/ip-studio/runs/"+id+"/release-unknown").with(user("operator").roles("OPERATOR")).contentType("application/json").content(receipt.toString())).andExpect(status().isOk());
        assertEquals(2,submissions.get());assertEquals(1,ledger.findAll().stream().filter(l->id.equals(l.getReferenceId())&&l.getEntryType()==LedgerEntry.LedgerEntryType.UNFREEZE).count());
        assertEquals(1,audits.findAll().stream().filter(a->id.equals(a.getResourceId())&&"studio.image.release_confirmed_unknown".equals(a.getAction())).count());
    }

}
