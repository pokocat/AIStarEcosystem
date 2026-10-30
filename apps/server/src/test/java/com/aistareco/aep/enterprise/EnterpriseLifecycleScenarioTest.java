package com.aistareco.aep.enterprise;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos;
import com.aistareco.aep.enterprise.dto.EnterpriseRechargeDtos;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Product scenarios use real JPA/ledger/security. No supplier or payment API is called. */
@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class EnterpriseLifecycleScenarioTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        String url=System.getProperty("enterprise.lifecycle.jdbc","jdbc:h2:mem:enterprise-lifecycle;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST;LOCK_TIMEOUT=20000");
        r.add("spring.datasource.url",()->url);r.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        r.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");r.add("spring.datasource.password",()->"");
    }
    @jakarta.persistence.PersistenceContext jakarta.persistence.EntityManager em;
    @Autowired EnterprisePolicyRepository policyRows; @Autowired EnterpriseAccessService access;
    @Autowired EnterpriseService enterprises; @Autowired EnterprisePointsService points;
    @Autowired EnterpriseLifecycleService lifecycle; @Autowired EnterpriseBillingService billing;
    @Autowired EnterpriseRechargeService recharges; @Autowired EnterpriseQueryService reports;
    @Autowired EnterpriseCreditLotService lots; @Autowired EnterpriseCreditLotRepository lotRows;
    @Autowired EnterpriseMemberRepository members; @Autowired EnterpriseCurrentMembershipRepository current;
    @Autowired EnterpriseRepository enterpriseRows; @Autowired EnterpriseBillingAuthorizationRepository auths;
    @Autowired EnterpriseAuditRepository audits; @Autowired AepUserRepository users;
    @Autowired EnrollmentService enrollment; @Autowired CreditService credits;
    @Autowired WalletRepository wallets; @Autowired LedgerEntryRepository ledger;
    @Autowired CreditHoldRepository holds; @Autowired IpRunRepository runs;
    @Autowired AiModelEndpointRepository endpoints; @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.service.AiGenerationQueueDispatcher dispatcher;
    @Autowired com.aistareco.aep.billing.service.ScopedCreditService scoped;
    @Autowired com.aistareco.aep.billing.repository.CreditCampaignRepository campaigns;
    @Autowired com.aistareco.aep.billing.repository.ModelDiscountRepository discounts;
    @Autowired AdminUserRepository staff;
    @Autowired AiAppEndpointCandidateRepository candidates;
    @Autowired com.aistareco.aep.service.AiAppBindingService appBindings;
    @Autowired com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    @Autowired com.aistareco.aep.service.PlatformConfigService platformConfig;
    @Autowired com.aistareco.aep.ipstudio.repository.IpProjectRepository projectRows;
    @Autowired com.aistareco.aep.billing.repository.ModelPriceRepository modelPrices;
    @Autowired com.aistareco.aep.billing.repository.ModelChargeRepository modelCharges;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.ipstudio.service.IpRunWorker imageWorker;

    String endpoint;
    @BeforeEach void model(){endpoint="life-"+UUID.randomUUID();endpoints.save(AiModelEndpoint.builder().id(endpoint).name("验收图片模型")
            .providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl("http://127.0.0.1:1").upstreamApiKeyEncrypted("test").model("local").modelAlias("验收图片模型").enabled(true).build());}
    String person(){String id=UUID.randomUUID().toString();users.save(AepUser.builder().id(id).username(id).displayName("验收成员")
            .status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);return id;}
    Context company(){return enterprises.create(person(),new CreateRequest("生命周期验收",UUID.randomUUID().toString()));}
    Context join(Context e,String actor){var i=enterprises.invite(e.member().userId(),e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));return enterprises.accept(actor,new AcceptRequest(i.token()));}
    Context join(Context e){return join(e,person());}
    Wallet root(Context e){return wallets.findByAccountKey("enterprise:"+e.enterprise().id()).orElseThrow();}
    Wallet wallet(Context m){return wallets.findByAccountKey("enterprise_member:"+m.enterprise().id()+":"+m.member().userId()).orElseThrow();}
    void fund(Context e,long amount,LedgerEntry.LedgerEntryType bucket){credits.creditWallet(root(e).getId(),amount,bucket,"test",UUID.randomUUID().toString(),"本地验收资金");}
    void allocate(Context e,Context m,long amount){var items=List.of(new EnterprisePointsDtos.Item(m.member().id(),amount));var p=points.preview(e.member().userId(),e.enterprise().id(),"allocate",new EnterprisePointsDtos.PreviewRequest(items));
        points.submit(e.member().userId(),e.enterprise().id(),"allocate",new EnterprisePointsDtos.SubmitRequest(UUID.randomUUID().toString(),p.confirmationFingerprint(),items));}
    void policy(Context e,int cap){var p=enterprises.policy(e.member().userId(),e.enterprise().id());enterprises.updatePolicy(e.member().userId(),e.enterprise().id(),new PolicyUpdate(List.of(endpoint),cap,p.version()));}
    String task(Context m,long cost,boolean dispatched){String id="IPR-"+UUID.randomUUID().toString().substring(0,24);return new TransactionTemplate(transactions).execute(s->{
        var a=billing.reserve(m.member().userId(),new BillingSelection("enterprise",m.enterprise().id()),"ip-run",id,endpoint,cost,"验收生成", com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        runs.saveAndFlush(IpRun.builder().id(id).projectId("local-project").nodeId("node").ownerUserId(m.member().userId()).kind("generate").status("running").stage("queued").cost(cost)
                .billingWalletId(a.walletId()).enterpriseId(a.enterpriseId()).membershipId(a.membershipId()).billingAuthorizationId(a.billingAuthorizationId()).createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
        if(dispatched)billing.requireDispatchAllowed("ip-run",id,endpoint);return id;});}
    EnterpriseLifecycleDtos.Result action(Context actor,Context target,String action){var p=lifecycle.preview(actor.member().userId(),actor.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest(action,target==null?null:target.member().id()));
        return lifecycle.apply(actor.member().userId(),actor.enterprise().id(),new EnterpriseLifecycleDtos.Request(action,target==null?null:target.member().id(),UUID.randomUUID().toString(),p.confirmationFingerprint()));}
    void release(String id){credits.releaseHold("ip-run",id,"供应商确定失败，退回原冻结");}
    long personal(Context m){return wallets.findByUserId(m.member().userId()).map(Wallet::getTotalBalance).orElse(0L);}
    void settle(String id,long actual){new TransactionTemplate(transactions).executeWithoutResult(s->{billing.lockForSettlement("ip-run",id);credits.commitHold("ip-run",id,actual,"供应商实际结算", null);release(id);var r=runs.findById(id).orElseThrow();r.setStatus("done");r.setCost(actual);runs.save(r);billing.complete("ip-run",id);});}

    @Test void scopedAndDiscountedEnterprisePartialSpendPreservesOriginalRechargeLot() throws Exception {
        var e=company();var m=join(e);policy(e,3);fund(e,100,LedgerEntry.LedgerEntryType.RECHARGE);
        String order="scoped-order-"+UUID.randomUUID();lots.origin(root(e),order,100);allocate(e,m,100);
        var target=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",endpoint,"local","standard","image");
        var now=Instant.now();var until=now.plusSeconds(86400);
        var campaign=new com.aistareco.aep.billing.model.CreditCampaign();campaign.setId(UUID.randomUUID().toString());campaign.setName("企业图片体验");
        campaign.setTargetsJson(json.writeValueAsString(List.of(target)));campaign.setResourceUnit("image");
        campaign.setTotalIssueLimit(100);campaign.setPerWalletIssueLimit(100);campaign.setResourceLimit(java.math.BigDecimal.TEN);
        campaign.setPerWalletDailyResourceLimit(java.math.BigDecimal.TEN);campaign.setMaxConcurrentPerWallet(3);campaign.setActive(true);
        campaign.setStartsAt(now.minusSeconds(1));campaign.setExpiresAt(until);campaign.setUpdatedAt(now);campaigns.saveAndFlush(campaign);
        var grant=scoped.grant(wallet(m).getId(),campaign.getId(),15,until,"test",UUID.randomUUID().toString(),"企业体验","staff");
        var discount=new com.aistareco.aep.billing.model.ModelDiscount();discount.setId(UUID.randomUUID().toString());discount.setName("企业八折");
        discount.setTargetKey(target.endpointKey());discount.setTargetJson(json.writeValueAsString(target));discount.setAudience("enterprise");discount.setAudienceId(e.enterprise().id());
        discount.setFactor(new java.math.BigDecimal("0.8"));discount.setAllowGrants(true);discount.setActive(true);discount.setStartsAt(now.minusSeconds(1));discount.setExpiresAt(until);discount.setUpdatedAt(now);discounts.saveAndFlush(discount);
        var context=new com.aistareco.aep.billing.service.ModelChargeContext(target,
                new com.aistareco.aep.billing.service.ModelBillingMath.Usage(new java.math.BigDecimal("3"),null),java.math.BigDecimal.TEN,null,"test-v1",false,9L,null);
        String id="IPR-"+UUID.randomUUID();
        billing.reserve(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),"ip-run",id,endpoint,30,"三张图片",context);
        assertEquals(9,wallet(m).getPendingBalance());assertEquals(91,wallet(m).getRechargeBalance());
        var lot=lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow();assertEquals(9,lot.getFrozen());
        billing.requireDispatchAllowed("ip-run",id,endpoint);credits.markModelDispatched("ip-run",id);
        credits.commitHold("ip-run",id,20,"两张完成",new com.aistareco.aep.billing.service.ModelBillingMath.Usage(new java.math.BigDecimal("2"),null));
        credits.releaseHold("ip-run",id,"第三张未完成");
        assertEquals(0,wallet(m).getPendingBalance());assertEquals(99,wallet(m).getRechargeBalance());
        lot=lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow();assertEquals(0,lot.getFrozen());assertEquals(99,lot.getAvailable());
        var settled=scoped.list(wallet(m).getId()).stream().filter(g->g.getId().equals(grant.getId())).findFirst().orElseThrow();
        assertEquals(15,settled.getSpent());assertEquals(0,settled.getFrozen());
        assertEquals(0,personal(m));
    }

    @Test void endpointDiscountCoversEnterpriseOwnerExistingAndFutureMembersButNotPersonalWallets() {
        var company=company();var existing=join(company);policy(company,3);
        var context=com.aistareco.aep.billing.service.ModelChargeContext.forCredits(endpoints.findById(endpoint).orElseThrow(),100);
        var discount=new com.aistareco.aep.billing.model.ModelDiscount();
        discount.setId(UUID.randomUUID().toString());discount.setName("企业统一八折");discount.setTargetKey(context.target().endpointKey());
        discount.setTargetJson(json.valueToTree(context.target()).toString());discount.setAudience("enterprise");discount.setAudienceId(company.enterprise().id());
        discount.setFactor(new java.math.BigDecimal("0.8"));discount.setAllowGrants(true);discount.setActive(true);
        discount.setStartsAt(Instant.now().minusSeconds(60));discount.setExpiresAt(Instant.now().plusSeconds(3600));discount.setUpdatedAt(Instant.now());discounts.save(discount);
        var future=join(company);
        for(var account:List.of(company,existing,future)) {
            var quote=billing.quote(account.member().userId(),new BillingSelection("enterprise",company.enterprise().id()),context);
            assertEquals(80,quote.payableCredits());assertEquals("企业统一八折",quote.discountName());
            assertEquals(100,billing.quote(account.member().userId(),new BillingSelection("personal",null),context).payableCredits());
        }
    }

    @Test void imageQuoteHttpUsesExistingEndpointPriceAndFreezesAcceptedPrice() throws Exception {
        String actor=person(),project="IPP-"+UUID.randomUUID().toString().substring(0,20);
        credits.creditAccount(actor,100,LedgerEntry.LedgerEntryType.RECHARGE,"test",UUID.randomUUID().toString(),"本地充值");
        projectRows.saveAndFlush(com.aistareco.aep.ipstudio.model.IpProject.builder().id(project).ownerUserId(actor).name("报价验收")
                .status("draft").docJson("{\"nodes\":[],\"connections\":[],\"viewport\":{\"x\":0,\"y\":0,\"k\":1}}")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build());
        candidates.saveAndFlush(AiAppEndpointCandidate.builder().id(UUID.randomUUID().toString()).endpointId(endpoint).purpose(AiModelPurpose.DAP_IMAGE)
                .creditCostOverride(10L).enabled(true).createdAt(Instant.now()).updatedAt(Instant.now()).build());
        scenePolicies.save("studio","image",new com.aistareco.aep.dto.AiAppSceneModelPolicyDto("studio","image","fixed",endpoint,
                List.of(new com.aistareco.aep.dto.AiAppSceneModelPolicyDto.Candidate(endpoint,10L,"per_image"))),"test");
        try {
            var target=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",endpoint,"local","1024x1024","image");
            var body=json.createObjectNode().put("nodeId","image-node").put("prompt","本地报价").put("count",1).put("size","1024x1024").put("model",endpoint).put("clientRequestId","quote-first");
            String path="/api/v1/ip-studio/projects/"+project;
            long runCount=runs.count(),holdCount=holds.count(),ledgerCount=ledger.count();
            var response=mvc.perform(post(path+"/image-quote").with(user(actor)).header("X-App-Code","aiavatar")
                    .contentType("application/json").content(body.toString())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.standardCredits").value(10)).andExpect(jsonPath("$.data.walletCredits").value(10))
                    .andExpect(jsonPath("$.data.canAfford").value(true)).andReturn();
            assertEquals(runCount,runs.count());assertEquals(holdCount,holds.count());assertEquals(ledgerCount,ledger.count());
            assertEquals(100,wallets.findByUserId(actor).orElseThrow().getTotalBalance());
            var workflowBody=body.deepCopy().put("operation","image").put("aspectRatio","1:1");
            mvc.perform(post(path+"/studio-image-quote").with(user(actor)).header("X-App-Code","aiavatar").contentType("application/json").content(workflowBody.toString()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.standardCredits").value(10));
            var nodeDoc=json.createObjectNode();nodeDoc.putArray("connections");var metadata=nodeDoc.putArray("nodes").addObject().put("id","image-node").put("type","image").putObject("metadata");
            metadata.put("prompt","只读报价不应保存文档").put("count",1).put("size","1024x1024").put("model",endpoint);
            var nodeBody=json.createObjectNode();nodeBody.set("doc",nodeDoc);
            mvc.perform(post(path+"/nodes/image-node/image-quote").with(user(actor)).header("X-App-Code","aiavatar").contentType("application/json").content(nodeBody.toString()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.standardCredits").value(10));
            assertTrue(json.readTree(projectRows.findById(project).orElseThrow().getDocJson()).path("nodes").isEmpty());
            assertEquals(runCount,runs.count());assertEquals(holdCount,holds.count());
            var approval=json.readTree(response.getResponse().getContentAsString()).path("data").path("approval");body.set("modelBilling",approval);
            var submitted=mvc.perform(post(path+"/generate").with(user(actor)).header("X-App-Code","aiavatar")
                    .contentType("application/json").content(body.toString())).andExpect(status().isOk()).andReturn();
            String runId=json.readTree(submitted.getResponse().getContentAsString()).path("data").path("id").asText();
            var submittedData=json.readTree(submitted.getResponse().getContentAsString()).path("data");
            assertEquals(10,submittedData.path("cost").asLong());assertEquals(10,submittedData.path("output").path("billingBreakdown").path("pending").path("walletCredits").asLong());
            var hold=holds.findByReferenceTypeAndReferenceId("ip-run",runId).orElseThrow();
            assertEquals(10,hold.getAmount());assertEquals(10,hold.getFromGift());assertEquals(0,hold.getFromRecharge());assertEquals(10,modelCharges.findById(hold.getId()).orElseThrow().getPayableCredits());
            scenePolicies.save("studio","image",new com.aistareco.aep.dto.AiAppSceneModelPolicyDto("studio","image","fixed",endpoint,
                    List.of(new com.aistareco.aep.dto.AiAppSceneModelPolicyDto.Candidate(endpoint,1L,"per_image"))),"test");
            mvc.perform(post(path+"/generate").with(user(actor)).header("X-App-Code","aiavatar").contentType("application/json").content(body.toString()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(runId));
            mvc.perform(get(path+"/billing-selection").with(user(actor)).header("X-App-Code","aiavatar").param("clientRequestId","quote-first"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.modelBilling.priceVersion").value(approval.path("priceVersion").asText()));
            body.put("clientRequestId","quote-changed").put("nodeId","another-image-node");
            mvc.perform(post(path+"/generate").with(user(actor)).header("X-App-Code","aiavatar").contentType("application/json").content(body.toString()))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("MODEL_QUOTE_CHANGED"));
            assertEquals(runCount+1,runs.count());assertEquals(holdCount+1,holds.count());
            mvc.perform(post(path+"/image-quote").with(user(person())).header("X-App-Code","aiavatar").contentType("application/json").content(body.toString())).andExpect(status().isNotFound());
        } finally {platformConfig.delete("ai.scene-policy.studio.image");}
    }

    @Test void enterpriseReadOnlyQuoteAllowsMatchingGrantWithZeroOrdinaryBalanceAndEnforcesPolicy() throws Exception {
        var e=company();var m=join(e);policy(e,2);
        var target=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",endpoint,"local","1024x1024","image");
        Instant until=Instant.now().plusSeconds(3600);var campaign=new com.aistareco.aep.billing.model.CreditCampaign();
        campaign.setId(UUID.randomUUID().toString());campaign.setName("企业图片体验");campaign.setTargetsJson(json.writeValueAsString(List.of(target)));campaign.setResourceUnit("image");
        campaign.setTotalIssueLimit(100);campaign.setPerWalletIssueLimit(100);campaign.setResourceLimit(java.math.BigDecimal.TEN);
        campaign.setPerWalletDailyResourceLimit(java.math.BigDecimal.TEN);campaign.setMaxConcurrentPerWallet(2);campaign.setActive(true);
        campaign.setStartsAt(Instant.now().minusSeconds(10));campaign.setExpiresAt(until);campaign.setUpdatedAt(Instant.now());campaigns.saveAndFlush(campaign);
        scoped.grant(wallet(m).getId(),campaign.getId(),20,until,"test",UUID.randomUUID().toString(),"体验","staff");
        var context=new com.aistareco.aep.billing.service.ModelChargeContext(target,new com.aistareco.aep.billing.service.ModelBillingMath.Usage(java.math.BigDecimal.ONE,null),java.math.BigDecimal.TEN,null,"test",true,0L,null);
        long before=auths.count(),holdCount=holds.count();
        var quote=billing.quote(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),context);
        assertTrue(quote.canAfford());assertEquals(10,quote.scopedCredits());assertEquals(0,quote.walletCredits());assertEquals(wallet(m).getId(),quote.approval().walletId());
        assertEquals(before,auths.count());assertEquals(holdCount,holds.count());assertEquals(0,wallet(m).getPendingBalance());
        var p=enterprises.policy(e.member().userId(),e.enterprise().id());enterprises.updatePolicy(e.member().userId(),e.enterprise().id(),new PolicyUpdate(List.of(),2,p.version()));
        assertThrows(BusinessException.class,()->billing.quote(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),context));
    }

    @Test void endpointGrantCampaignNeedsOnlyCreditsAndExpiryWithoutSupplierResourceSettings() throws Exception {
        var target=new com.aistareco.aep.billing.service.ModelBillingTarget("endpoint","model",endpoint,"local","*","call");
        var body=json.createObjectNode().put("name","接入点赠款").put("totalIssueLimit",300).put("perWalletIssueLimit",100)
                .put("startsAt",Instant.now().minusSeconds(30).toString()).put("expiresAt",Instant.now().plusSeconds(3600).toString()).put("active",true);
        body.putArray("targets").add(json.valueToTree(target));
        mvc.perform(post("/api/admin/model-billing/campaigns").with(user("operator-test").roles("OPERATOR"))
                .contentType("application/json").content(body.toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalIssueLimit").value(300)).andExpect(jsonPath("$.data.perWalletIssueLimit").value(100));
    }

    @Test void modelCreditAdminDoesNotIntroduceASecondStandardPriceSource() throws Exception {
        var target=new com.aistareco.aep.billing.service.ModelBillingTarget("endpoint","model",endpoint,"local","*","call");
        var body=json.createObjectNode().put("name","重复价格").put("unitPrice",10).put("active",true);body.set("target",json.valueToTree(target));
        mvc.perform(post("/api/admin/model-billing/prices").with(user("operator-test").roles("OPERATOR"))
                .contentType("application/json").content(body.toString())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("MODEL_PRICE_USE_ENDPOINT_CONFIG"));
    }

    @Test void scopedBalanceEndpointNeverAcceptsAnotherPersonsWallet() throws Exception {
        var e=company();var m=join(e);var outsider=person();
        String path="/api/me/model-credits";
        mvc.perform(get(path).with(user(m.member().userId())).header("X-App-Code","aiavatar").param("enterpriseId",e.enterprise().id()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagination.total").value(0));
        mvc.perform(get(path).with(user(outsider)).header("X-App-Code","aiavatar").param("enterpriseId",e.enterprise().id()))
                .andExpect(status().isForbidden());
        mvc.perform(get(path).with(user(outsider)).header("X-App-Code","aiavatar").param("walletId",wallet(m).getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagination.total").value(0));
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
    }

    @Test void scopedGrantHttpFlowEnforcesAdminRolesAndShowsApprovedMemberBalance() throws Exception {
        var e=company();var m=join(e);
        var target=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",endpoint,"local","standard","image");
        // 截到毫秒：Linux 上 Instant.now() 带纳秒，存进 TIMESTAMP(6) 会四舍五入，约一半概率入库值比传入值晚一点，
        // 下面原样回传同一个 until 就被判成「缩短有效期」（CI 上偶发红、macOS 只给到微秒所以本机总是绿）。
        // 真实前端回传的是服务端返回、已按库精度存过的值。
        Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS),until=now.plusSeconds(86400);
        var campaign=new com.aistareco.aep.billing.service.ModelBillingConfigService.CampaignInput(
                "审批验收",List.of(target),100000,100000,java.math.BigDecimal.TEN,java.math.BigDecimal.TEN,3,now.minusSeconds(1),until,true,null);
        var created=mvc.perform(post("/api/admin/model-billing/campaigns").with(user("config-staff").roles("OPERATOR"))
                .contentType("application/json").content(json.writeValueAsString(campaign))).andExpect(status().isOk()).andReturn();
        String campaignId=json.readTree(created.getResponse().getContentAsString()).path("data").path("id").asText();
        String maker="ops-"+UUID.randomUUID(),checker="ops-"+UUID.randomUUID();
        staff.saveAndFlush(AdminUser.builder().id(maker).username(maker).role(AdminUser.AdminRole.OPERATOR).status(AdminUser.AdminStatus.ACTIVE).build());
        staff.saveAndFlush(AdminUser.builder().id(checker).username(checker).role(AdminUser.AdminRole.FINANCE_ADMIN).status(AdminUser.AdminStatus.ACTIVE).build());
        String path="/api/admin/finance/adjustments";
        var request=new com.aistareco.aep.controller.AdminCreditOpsController.ScopedGrantRequest(wallet(m).getId(),campaignId,6000,until,"http-retry","企业模型体验");
        String body=json.writeValueAsString(request);
        mvc.perform(post(path+"/scoped-grant").with(user(m.member().userId())).contentType("application/json").content(body)).andExpect(status().isForbidden());
        var response=mvc.perform(post(path+"/scoped-grant").with(user(maker).roles("OPERATOR")).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("pending_approval")).andReturn();
        String id=json.readTree(response.getResponse().getContentAsString()).path("data").path("id").asText();
        mvc.perform(post(path+"/requests/"+id+"/approve").with(user(maker).roles("OPERATOR"))).andExpect(status().isForbidden());
        mvc.perform(post(path+"/requests/"+id+"/approve").with(user(checker).roles("FINANCE_ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.type").value("scoped_grant"))
                .andExpect(jsonPath("$.data.grantId").isString()).andExpect(jsonPath("$.data.ledgerEntryId").isString());
        mvc.perform(post(path+"/scoped-grant").with(user(maker).roles("OPERATOR")).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(id)).andExpect(jsonPath("$.data.status").value("approved"));
        mvc.perform(get("/api/me/model-credits").with(user(m.member().userId())).header("X-App-Code","aiavatar").param("enterpriseId",e.enterprise().id()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].available").value(6000));
        assertEquals(0,wallet(m).getTotalBalance());assertEquals(0,personal(m));
        // Issued grants follow their campaign, so its endpoints are frozen; other fields stay editable.
        String other="life-other-"+UUID.randomUUID();
        endpoints.save(AiModelEndpoint.builder().id(other).name("另一个模型").providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl("http://127.0.0.1:1")
                .upstreamApiKeyEncrypted("test").model("other").modelAlias("另一个模型").enabled(true).build());
        var widened=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",other,"other","standard","image");
        long version=campaigns.findById(campaignId).orElseThrow().getVersion();
        var retarget=new com.aistareco.aep.billing.service.ModelBillingConfigService.CampaignInput(
                "审批验收",List.of(target,widened),100000,100000,java.math.BigDecimal.TEN,java.math.BigDecimal.TEN,3,now.minusSeconds(1),until,true,version);
        mvc.perform(put("/api/admin/model-billing/campaigns/"+campaignId).with(user("config-staff").roles("OPERATOR"))
                .contentType("application/json").content(json.writeValueAsString(retarget)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("SCOPED_CAMPAIGN_TARGETS_LOCKED"));
        var renamed=new com.aistareco.aep.billing.service.ModelBillingConfigService.CampaignInput(
                "审批验收（改名）",List.of(target),100000,100000,java.math.BigDecimal.TEN,java.math.BigDecimal.TEN,3,now.minusSeconds(1),until,true,version);
        mvc.perform(put("/api/admin/model-billing/campaigns/"+campaignId).with(user("config-staff").roles("OPERATOR"))
                .contentType("application/json").content(json.writeValueAsString(renamed)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("审批验收（改名）"));
    }

    @Test void modelBillingAccountChoicesSearchOwnersAndExcludeEnterpriseTreasury() throws Exception {
        var e=company();var m=join(e);String label="额度查找_"+UUID.randomUUID();
        var person=users.findById(m.member().userId()).orElseThrow();person.setDisplayName(label);users.saveAndFlush(person);
        credits.creditAccount(person.getId(),10,LedgerEntry.LedgerEntryType.GIFT,"fixture",UUID.randomUUID().toString(),"本地测试");
        String path="/api/admin/model-billing/wallet-options";
        mvc.perform(get(path).with(user("finance-test").roles("FINANCE_ADMIN")).param("q",label).param("size","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagination.total").value(2)).andExpect(jsonPath("$.pagination.hasNext").value(true))
                .andExpect(jsonPath("$.data[0].displayName").value(label));
        mvc.perform(get(path).with(user("operator-test").roles("OPERATOR")).param("q",label).param("accountType","enterprise_member"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagination.total").value(1))
                .andExpect(jsonPath("$.data[0].id").value(wallet(m).getId())).andExpect(jsonPath("$.data[0].enterpriseName").value(e.enterprise().name()));
        mvc.perform(get(path).with(user("operator-test").roles("OPERATOR")).param("q","%"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagination.total").value(0));
        mvc.perform(get(path).with(user("operator-test").roles("OPERATOR")).param("accountType","enterprise"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path).with(user(person.getId()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/model-billing/enterprise-options").with(user("operator-test").roles("OPERATOR")).param("q",e.enterprise().id()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].name").value(e.enterprise().name()));
    }

    @Test void endpointCatalogDoesNotDuplicateModelsForAppsOrSpecifications() throws Exception {
        var video=endpoints.findById(endpoint).orElseThrow();video.setModel("minimax-h3");video.setBaseUrl("https://jusuanhub.example.test");
        video.setBillingMode(AiModelBillingMode.PER_SECOND);video.setUpstreamApiKeyEncrypted(com.aistareco.common.AepCryptoUtil.encrypt("unused-test-key"));endpoints.saveAndFlush(video);
        candidates.saveAndFlush(AiAppEndpointCandidate.builder().id(UUID.randomUUID().toString()).endpointId(endpoint).purpose(AiModelPurpose.VIDEO_GENERATION)
                .creditCostOverride(40L).enabled(true).createdAt(Instant.now()).updatedAt(Instant.now()).build());
        scenePolicies.saveStudioVideoGroup(new com.aistareco.aep.service.AiAppSceneModelPolicyService.VideoGroup(endpoint,List.of(endpoint)),"test");
        appBindings.bind(AiModelPurpose.VIDEO_GENERATION,endpoint);
        try {
            var result=mvc.perform(get("/api/admin/model-billing/targets").with(user("operator-test").roles("OPERATOR")))
                    .andExpect(status().isOk()).andReturn();
            var rows=json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data");int scopes=0;
            for(var row:rows)if(endpoint.equals(row.path("target").path("endpointId").asText())) {
                scopes++;assertEquals("*",row.path("target").path("specKey").asText());assertEquals("call",row.path("target").path("unit").asText());
                assertEquals(endpoint,row.path("id").asText());
            }
            assertEquals(1,scopes); // One existing endpoint, regardless of product or call type.
            assertFalse(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8).contains("unused-test-key"));
            String actor=person(),project="IPP-"+UUID.randomUUID().toString().substring(0,20);
            credits.creditAccount(actor,500,LedgerEntry.LedgerEntryType.RECHARGE,"test",UUID.randomUUID().toString(),"本地余额");
            projectRows.saveAndFlush(com.aistareco.aep.ipstudio.model.IpProject.builder().id(project).ownerUserId(actor).name("视频报价")
                    .status("draft").docJson("{\"nodes\":[],\"connections\":[]}").createdAt(Instant.now()).updatedAt(Instant.now()).build());
            var body=json.createObjectNode().put("clientRequestId","video-quote").put("nodeId","video").put("operation","video").put("prompt","本地视频报价")
                    .put("durationSec",5).put("aspectRatio","16:9").put("count",2).put("model",endpoint);
            body.putObject("video").put("mode","t2v").put("resolutionTier","768p");
            long taskCount=runs.count(),holdCount=holds.count();
            mvc.perform(post("/api/v1/ip-studio/projects/"+project+"/studio-video-quote").with(user(actor)).header("X-App-Code","aiavatar")
                    .contentType("application/json").content(body.toString())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.usage.quantity").value(10)).andExpect(jsonPath("$.data.standardCredits").value(400)).andExpect(jsonPath("$.data.canAfford").value(true));
            mvc.perform(post("/api/v1/ip-studio/projects/"+project+"/video-quote").with(user(actor)).header("X-App-Code","aiavatar").param("freeOnly","true")
                    .contentType("application/json").content(body.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.canAfford").value(false));
            enrollment.upsert(actor,"celebrity",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);
            var standalone=json.createObjectNode().put("endpointId",endpoint).put("mode","t2v").put("prompt","本地视频报价")
                    .put("resolutionTier","768p").put("aspectRatio","16:9").put("seconds",5);
            mvc.perform(post("/api/me/celebrity/video-studio/quote").with(user(actor)).header("X-App-Code","celebrity")
                    .contentType("application/json").content(standalone.toString())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.usage.quantity").value(5)).andExpect(jsonPath("$.data.standardCredits").value(200))
                    .andExpect(jsonPath("$.data.target.appCode").value("celebrity"));
            assertEquals(taskCount,runs.count());assertEquals(holdCount,holds.count());assertEquals(500,wallets.findByUserId(actor).orElseThrow().getRechargeBalance());
        } finally {platformConfig.delete("ai.app-model-group.studio.video");appBindings.unbind(AiModelPurpose.VIDEO_GENERATION);}
    }

    @Test void modelBillingTargetCatalogUsesExistingEndpointRowsAndNeverReturnsSecrets() throws Exception {
        String path="/api/admin/model-billing/targets";
        var response=mvc.perform(get(path).with(user("operator-test").roles("OPERATOR")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.id == '"+endpoint+"')].target.endpointId").value(org.hamcrest.Matchers.contains(endpoint))).andReturn();
        String content=response.getResponse().getContentAsString();assertFalse(content.contains("upstreamApiKey"));assertFalse(content.contains("baseUrl"));
        var model=endpoints.findById(endpoint).orElseThrow();model.setEnabled(false);endpoints.saveAndFlush(model);
        mvc.perform(get(path).with(user("operator-test").roles("OPERATOR")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.id == '"+endpoint+"')]").isEmpty());
    }

    @Test void configuredDiscountRequiresRealAudienceAndReturnsItsReadableName() throws Exception {
        String user=person();var target=new com.aistareco.aep.billing.service.ModelBillingTarget("aiavatar","image",endpoint,"local","1024x1024","image");
        assertTrue(wallets.findByUserId(user).isEmpty());
        mvc.perform(get("/api/admin/model-billing/user-options").with(user("operator-test").roles("OPERATOR")).param("q",user))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(user)).andExpect(jsonPath("$.pagination.total").value(1));
        mvc.perform(get("/api/admin/model-billing/user-options").with(user(user)))
                .andExpect(status().isForbidden());
        var now=Instant.now();String path="/api/admin/model-billing/discounts";
        var invalid=new com.aistareco.aep.billing.service.ModelBillingConfigService.DiscountInput("八折",target,"user","missing-user",new java.math.BigDecimal("0.8"),true,now,now.plusSeconds(3600),true,null);
        mvc.perform(post(path).with(user("operator-test").roles("OPERATOR")).contentType("application/json").content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("MODEL_DISCOUNT_AUDIENCE_INVALID"));
        var valid=new com.aistareco.aep.billing.service.ModelBillingConfigService.DiscountInput("八折",target,"user",user,new java.math.BigDecimal("0.8"),false,now,now.plusSeconds(3600),true,null);
        mvc.perform(post(path).with(user("operator-test").roles("OPERATOR")).contentType("application/json").content(json.writeValueAsString(valid)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.audienceLabel").value("验收成员")).andExpect(jsonPath("$.data.allowGrants").value(true));
    }

    @Test void suspendCancelsQueuedCollectsAvailableAndPreservesPersonal() {
        var e=company();var m=join(e);policy(e,3);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);
        credits.creditAccount(m.member().userId(),500,LedgerEntry.LedgerEntryType.GIFT,"test",UUID.randomUUID().toString(),"个人");String id=task(m,30,false);
        var preview=lifecycle.preview(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("suspend",m.member().id()));
        assertEquals(70,preview.availableCredits());assertEquals(30,preview.pendingCredits());assertEquals(1,preview.cancellableJobs());
        var result=action(e,m,"suspend");assertEquals(100,result.reclaimedCredits());assertEquals(1,result.cancelledJobs());
        assertEquals(100,root(e).getTotalBalance());assertEquals(0,wallet(m).getTotalBalance());assertEquals(0,wallet(m).getPendingBalance());assertEquals(500,personal(m));
        assertEquals("failed",runs.findById(id).orElseThrow().getStatus());assertEquals("cancelled",auths.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getStatus());
        assertThrows(BusinessException.class,()->task(m,1,false));assertEquals("suspended",enterprises.mine(m.member().userId()).get(0).member().status());
        release(id);assertEquals(100,root(e).getTotalBalance());
    }
    @Test void acceptedTaskSettlesOriginalWalletAfterSuspendAndResume() {
        var e=company();var m=join(e);policy(e,3);fund(e,200,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,60,true);
        assertEquals(40,action(e,m,"suspend").reclaimedCredits());assertEquals(60,wallet(m).getPendingBalance());assertEquals("running",runs.findById(id).orElseThrow().getStatus());
        action(e,m,"resume");allocate(e,m,30);settle(id,20);
        assertEquals(150,root(e).getTotalBalance());assertEquals(30,wallet(m).getTotalBalance());assertEquals(0,wallet(m).getPendingBalance());
        assertEquals(20,reports.usage(e.member().userId(),e.enterprise().id(),0,20).getContent().get(0).cost());
        assertEquals(180,root(e).getTotalBalance()+wallet(m).getTotalBalance());
    }
    @Test void leaveRejoinLateRefundMovesOnlyOriginalCashLotAndBuckets() {
        var e=company();var m=join(e);policy(e,3);fund(e,100,LedgerEntry.LedgerEntryType.RECHARGE);String oldOrder="old-"+UUID.randomUUID();lots.origin(root(e),oldOrder,100);allocate(e,m,100);
        String id=task(m,60,true);action(m,null,"leave");assertTrue(current.findById(m.member().userId()).isEmpty());
        var renewed=join(e,m.member().userId());assertNotEquals(m.member().id(),renewed.member().id());
        fund(e,50,LedgerEntry.LedgerEntryType.RECHARGE);String newOrder="new-"+UUID.randomUUID();lots.origin(root(e),newOrder,50);
        allocate(e,renewed,70); // 40 old-origin + 30 new-origin are new allocations and must stay with this relationship.
        release(id);assertEquals(70,wallet(renewed).getTotalBalance());assertEquals(80,root(e).getTotalBalance());
        assertEquals(40,lotRows.findByRechargeOrderIdAndWalletId(oldOrder,wallet(renewed).getId()).orElseThrow().getAvailable());
        assertEquals(30,lotRows.findByRechargeOrderIdAndWalletId(newOrder,wallet(renewed).getId()).orElseThrow().getAvailable());
        assertEquals(60,lotRows.findByRechargeOrderIdAndWalletId(oldOrder,root(e).getId()).orElseThrow().getAvailable());assertEquals(0,wallet(m).getPendingBalance());
    }
    @Test void changingEnterpriseDoesNotMoveOldFrozenRefundToNewEnterprise() {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,60,true);
        action(m,null,"leave");var other=company();var renewed=join(other,m.member().userId());fund(other,50,LedgerEntry.LedgerEntryType.GIFT);allocate(other,renewed,50);release(id);
        assertEquals(100,root(e).getTotalBalance());assertEquals(50,wallet(renewed).getTotalBalance());assertEquals(0,root(other).getTotalBalance());
    }
    @Test void rejoiningCannotBypassSamePersonsExistingActiveJobCap() {
        var e=company();var m=join(e);policy(e,1);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,60,true);
        action(m,null,"leave");var renewed=join(e,m.member().userId());allocate(e,renewed,30);
        var error=assertThrows(BusinessException.class,()->task(renewed,0,false));assertEquals("ENTERPRISE_ACTIVE_JOB_LIMIT",error.getCode());
        var preview=lifecycle.preview(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("suspend",renewed.member().id()));assertEquals(1,preview.acceptedJobs());assertEquals(60,preview.pendingCredits());
        release(id);assertNotNull(task(renewed,0,false));assertEquals(30,wallet(renewed).getTotalBalance());
    }
    @Test void zeroPriceJobsConsumeCapAndCancelWithoutAnyLedgerMoney() {
        var e=company();var m=join(e);policy(e,1);String id=task(m,0,false);
        var denied=assertThrows(BusinessException.class,()->task(m,0,false));assertEquals("ENTERPRISE_ACTIVE_JOB_LIMIT",denied.getCode());
        assertEquals(1,action(e,m,"suspend").cancelledJobs());assertTrue(auths.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getTerminalAt()!=null);
        action(e,m,"resume");assertNotNull(task(m,0,false));
    }
    @Test void concurrentAdmissionsDoNotExceedCap() throws Exception {
        var e=company();var m=join(e);policy(e,1);var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {List<Future<Boolean>> futures=new ArrayList<>();for(int i=0;i<2;i++)futures.add(pool.submit(()->{gate.await();try{task(m,0,false);return true;}catch(BusinessException ex){assertEquals("ENTERPRISE_ACTIVE_JOB_LIMIT",ex.getCode());return false;}}));
            gate.countDown();assertEquals(1,(futures.get(0).get()?1:0)+(futures.get(1).get()?1:0));
        }finally{pool.shutdownNow();}
    }
    @Test void disablingNewEnterpriseBusinessStillSettlesExistingOriginalHold() {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,30,true);
        var disabled=new EnterpriseBillingService(enterpriseRows,policyRows,auths,access,wallets,holds,credits,json,em,false);
        var error=assertThrows(BusinessException.class,()->new TransactionTemplate(transactions).execute(st->disabled.reserve(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),"ip-run","disabled",endpoint,1,"new", com.aistareco.aep.billing.service.ModelChargeContext.NONE)));
        assertEquals("ENTERPRISE_BILLING_DISABLED",error.getCode());
        new TransactionTemplate(transactions).executeWithoutResult(st->{disabled.lockForSettlement("ip-run",id);credits.commitHold("ip-run",id,20,"实耗", null);release(id);disabled.complete("ip-run",id);});
        assertEquals(80,wallet(m).getTotalBalance());assertEquals(0,wallet(m).getPendingBalance());assertNotNull(auths.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getTerminalAt());
    }
    @Test void enterpriseAllowlistOnlyBlocksNewReservationsAndKeepsExistingSettlement() {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,30,true);
        var scoped=new EnterpriseBillingService(enterpriseRows,policyRows,auths,access,wallets,holds,credits,json,em,true);
        org.springframework.test.util.ReflectionTestUtils.setField(scoped,"allowedIds","another-enterprise");
        var error=assertThrows(BusinessException.class,()->new TransactionTemplate(transactions).execute(st->scoped.reserve(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),"ip-run","outside-rollout",endpoint,1,"new", com.aistareco.aep.billing.service.ModelChargeContext.NONE)));
        assertEquals("ENTERPRISE_BILLING_NOT_ENABLED",error.getCode());
        new TransactionTemplate(transactions).executeWithoutResult(st->{scoped.lockForSettlement("ip-run",id);release(id);scoped.complete("ip-run",id);});assertEquals(100,wallet(m).getTotalBalance());
    }
    @Test void suspendRacingWithAdmissionLeavesNoDispatchableAuthorization()throws Exception {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            var submission=pool.submit(()->{gate.await();try{return task(m,30,false);}catch(BusinessException ex){assertEquals("ENTERPRISE_BILLING_REVOKED",ex.getCode());return null;}});
            var suspension=pool.submit(()->{gate.await();for(int i=0;i<3;i++)try{return action(e,m,"suspend");}catch(BusinessException ex){if(!"ENTERPRISE_LIFECYCLE_PREVIEW_STALE".equals(ex.getCode()))throw ex;}throw new AssertionError("preview remains stale");});
            gate.countDown();String id=submission.get();assertEquals("suspended",suspension.get().status());
            if(id!=null)assertThrows(BusinessException.class,()->billing.requireDispatchAllowed("ip-run",id,endpoint));
            assertEquals(100,root(e).getTotalBalance());assertEquals(0,wallet(m).getPendingBalance());assertEquals(0,wallet(m).getTotalBalance());
        }finally{pool.shutdownNow();}
    }
    @Test void staleLifecyclePreviewRequiresNewConfirmation() {
        var e=company();var m=join(e);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,50);
        var p=lifecycle.preview(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("suspend",m.member().id()));allocate(e,m,10);
        var error=assertThrows(BusinessException.class,()->lifecycle.apply(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.Request("suspend",m.member().id(),UUID.randomUUID().toString(),p.confirmationFingerprint())));
        assertEquals("ENTERPRISE_LIFECYCLE_PREVIEW_STALE",error.getCode());assertEquals("active",members.findById(m.member().id()).orElseThrow().getStatus());assertEquals(60,wallet(m).getTotalBalance());
    }
    @Test void leaveReplayReturnsSameReceiptAfterMembershipHasEnded() {
        var e=company();var m=join(e);var p=lifecycle.preview(m.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("leave",null));
        var request=new EnterpriseLifecycleDtos.Request("leave",null,UUID.randomUUID().toString(),p.confirmationFingerprint());var result=lifecycle.apply(m.member().userId(),e.enterprise().id(),request);
        assertEquals(result,lifecycle.apply(m.member().userId(),e.enterprise().id(),request));assertTrue(current.findById(m.member().userId()).isEmpty());
        assertThrows(BusinessException.class,()->lifecycle.apply(e.member().userId(),e.enterprise().id(),request));
    }
    @Test void closeIsBlockedByFundsActiveJobsAndPendingCashApplication() {
        var e=company();var m=join(e);policy(e,2);String id=task(m,0,true);
        assertFalse(lifecycle.preview(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("close",null)).canProceed());billing.complete("ip-run",id);
        recharges.request(e.member().userId(),e.enterprise().id(),new EnterpriseRechargeDtos.RechargeRequest(UUID.randomUUID().toString(),10000L,"待财务核对"));
        var p=lifecycle.preview(e.member().userId(),e.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("close",null));assertFalse(p.canProceed());assertTrue(p.blockers().stream().anyMatch(s->s.contains("充值")));
        var empty=company();assertEquals("closed",action(empty,null,"close").status());assertTrue(current.findById(empty.member().userId()).isEmpty());
        var funded=company();fund(funded,1,LedgerEntry.LedgerEntryType.GIFT);assertFalse(lifecycle.preview(funded.member().userId(),funded.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest("close",null)).canProceed());
    }
    @Test void suspendedMemberCanReadOwnMoneyButNotManageOrViewPeers() throws Exception {
        var e=company();var m=join(e);var peer=join(e);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,50);action(e,m,"suspend");
        mvc.perform(get("/api/v1/ip-studio/enterprises/"+e.enterprise().id()+"/my-balance").with(user(m.member().userId())).header("X-App-Code","aiavatar"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.userId").value(m.member().userId()));
        assertEquals(1,recharges.memberBalances(m.member().userId(),e.enterprise().id(),0,20).getTotalElements());assertThrows(BusinessException.class,()->enterprises.members(m.member().userId(),e.enterprise().id(),0,20));
        mvc.perform(post("/api/v1/ip-studio/enterprises/"+e.enterprise().id()+"/lifecycle/preview").with(user(peer.member().userId())).header("X-App-Code","aiavatar").contentType("application/json")
                .content(json.writeValueAsString(new EnterpriseLifecycleDtos.PreviewRequest("resume",m.member().id())))).andExpect(status().isForbidden());
        var other=company();assertThrows(BusinessException.class,()->reports.usage(other.member().userId(),e.enterprise().id(),0,20));
    }
    @Test void usageReportsOnlyOwnEnterpriseTransactionsAndHumanNames() {
        var e=company();var m=join(e);var peer=join(e);policy(e,3);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,50);allocate(e,peer,50);
        settle(task(m,10,true),8);settle(task(peer,10,true),7);
        assertEquals(2,reports.usage(e.member().userId(),e.enterprise().id(),0,20).getTotalElements());var mine=reports.usage(m.member().userId(),e.enterprise().id(),0,20);
        assertEquals(1,mine.getTotalElements());assertEquals("验收成员",mine.getContent().get(0).actorName());assertEquals("验收图片模型",mine.getContent().get(0).modelName());assertEquals(8,mine.getContent().get(0).cost());
        assertEquals("验收成员",points.transfers(m.member().userId(),e.enterprise().id(),0,20).getContent().get(0).memberName());
    }
    @Test void financeReportsEnforcePlatformRoleAndReturnPaginatedEnterpriseScope()throws Exception {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,50);String id=task(m,10,true);settle(id,8);
        String base="/api/admin/finance/enterprises/"+e.enterprise().id();
        for(String suffix:List.of("/wallet","/member-balances","/points/transfers","/usage")) {
            mvc.perform(get(base+suffix).with(user("finance-test").roles("FINANCE_ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
            mvc.perform(get(base+suffix).with(user(e.member().userId()))).andExpect(status().isForbidden());
        }
        mvc.perform(get(base+"/usage").with(user("finance-test").roles("FINANCE_ADMIN")).param("limit","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].cost").value(8)).andExpect(jsonPath("$.pagination").exists());
        mvc.perform(get("/api/admin/finance/enterprises").with(user("finance-test").roles("FINANCE_ADMIN")).param("search",e.enterprise().id()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(get(base+"/wallet")).andExpect(status().isUnauthorized());
    }
    @Test void ownerCannotLeaveBeforeTransferAndManagerCannotSuspendOwner() {
        var e=company();var m=join(e);assertThrows(BusinessException.class,()->action(e,null,"leave"));
        enterprises.updateMember(e.member().userId(),e.enterprise().id(),m.member().id(),new MemberUpdate("manager",new Capabilities(true,true,true),m.member().version()));
        assertThrows(BusinessException.class,()->action(m,e,"suspend"));var t=enterprises.requestTransfer(e.member().userId(),e.enterprise().id(),new OwnershipRequest(m.member().id(),UUID.randomUUID().toString()));
        enterprises.acceptTransfer(m.member().userId(),e.enterprise().id(),t.id());assertEquals("removed",action(e,null,"leave").status());
        assertEquals(m.member().userId(),enterpriseRows.findById(e.enterprise().id()).orElseThrow().getOwnerUserId());
    }
}
