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
        String url=System.getProperty("enterprise.lifecycle.jdbc","jdbc:h2:mem:enterprise-lifecycle;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
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
        var a=billing.reserve(m.member().userId(),new BillingSelection("enterprise",m.enterprise().id()),"ip-run",id,endpoint,cost,"验收生成");
        runs.saveAndFlush(IpRun.builder().id(id).projectId("local-project").nodeId("node").ownerUserId(m.member().userId()).kind("generate").status("running").stage("queued").cost(cost)
                .billingWalletId(a.walletId()).enterpriseId(a.enterpriseId()).membershipId(a.membershipId()).billingAuthorizationId(a.billingAuthorizationId()).createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
        if(dispatched)billing.requireDispatchAllowed("ip-run",id,endpoint);return id;});}
    EnterpriseLifecycleDtos.Result action(Context actor,Context target,String action){var p=lifecycle.preview(actor.member().userId(),actor.enterprise().id(),new EnterpriseLifecycleDtos.PreviewRequest(action,target==null?null:target.member().id()));
        return lifecycle.apply(actor.member().userId(),actor.enterprise().id(),new EnterpriseLifecycleDtos.Request(action,target==null?null:target.member().id(),UUID.randomUUID().toString(),p.confirmationFingerprint()));}
    void release(String id){credits.releaseHold("ip-run",id,"供应商确定失败，退回原冻结");}
    long personal(Context m){return wallets.findByUserId(m.member().userId()).map(Wallet::getTotalBalance).orElse(0L);}
    void settle(String id,long actual){new TransactionTemplate(transactions).executeWithoutResult(s->{billing.lockForSettlement("ip-run",id);credits.commitHold("ip-run",id,actual,"供应商实际结算");release(id);var r=runs.findById(id).orElseThrow();r.setStatus("done");r.setCost(actual);runs.save(r);billing.complete("ip-run",id);});}

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
        var error=assertThrows(BusinessException.class,()->new TransactionTemplate(transactions).execute(st->disabled.reserve(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),"ip-run","disabled",endpoint,1,"new")));
        assertEquals("ENTERPRISE_BILLING_DISABLED",error.getCode());
        new TransactionTemplate(transactions).executeWithoutResult(st->{disabled.lockForSettlement("ip-run",id);credits.commitHold("ip-run",id,20,"实耗");release(id);disabled.complete("ip-run",id);});
        assertEquals(80,wallet(m).getTotalBalance());assertEquals(0,wallet(m).getPendingBalance());assertNotNull(auths.findByReferenceTypeAndReferenceId("ip-run",id).orElseThrow().getTerminalAt());
    }
    @Test void enterpriseAllowlistOnlyBlocksNewReservationsAndKeepsExistingSettlement() {
        var e=company();var m=join(e);policy(e,2);fund(e,100,LedgerEntry.LedgerEntryType.GIFT);allocate(e,m,100);String id=task(m,30,true);
        var scoped=new EnterpriseBillingService(enterpriseRows,policyRows,auths,access,wallets,holds,credits,json,em,true);
        org.springframework.test.util.ReflectionTestUtils.setField(scoped,"allowedIds","another-enterprise");
        var error=assertThrows(BusinessException.class,()->new TransactionTemplate(transactions).execute(st->scoped.reserve(m.member().userId(),new BillingSelection("enterprise",e.enterprise().id()),"ip-run","outside-rollout",endpoint,1,"new")));
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
