package com.aistareco.aep.enterprise;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class EnterprisePointsServiceTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        String url=System.getProperty("enterprise.test.jdbc","jdbc:h2:mem:enterprise-points;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        registry.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        registry.add("spring.datasource.password",()->"");
    }
    @Autowired EnterpriseService enterprises;
    @Autowired EnterprisePointsService service;
    @Autowired EnterprisePointsBatchRepository batches;
    @Autowired EnterprisePointsTransferRepository transfers;
    @Autowired EnterpriseCreditLotService sourceLots;
    @Autowired EnterpriseCreditLotRepository lotRows;
    @Autowired EnterpriseMemberRepository members;
    @Autowired AepUserRepository users;
    @Autowired EnrollmentService enrollment;
    @Autowired WalletRepository wallets;
    @Autowired LedgerEntryRepository ledger;
    @Autowired CreditHoldRepository holds;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
    @Autowired MockMvc mvc;
    @SpyBean CreditService credits;
    @AfterEach void resetSpies(){reset(credits);}

    private String person() {
        String id=UUID.randomUUID().toString();users.save(AepUser.builder().id(id).username(id).displayName("积分验收")
                .status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);return id;
    }
    private Context company() {return enterprises.create(person(),new CreateRequest("积分验收企业",UUID.randomUUID().toString()));}
    private Context join(Context e) {
        var invite=enterprises.invite(e.enterprise().ownerUserId(),e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        return enterprises.accept(person(),new AcceptRequest(invite.token()));
    }
    private Wallet root(Context e){return wallets.findByAccountKey("enterprise:"+e.enterprise().id()).orElseThrow();}
    private Wallet wallet(Context member){return wallets.findByAccountKey("enterprise_member:"+member.enterprise().id()+":"+member.member().userId()).orElseThrow();}
    private void fund(Wallet wallet,long amount,LedgerEntry.LedgerEntryType bucket){credits.creditWallet(wallet.getId(),amount,bucket,"test",UUID.randomUUID().toString(),"验收入账");}
    private Preview preview(Context actor,String direction,Item...items){return service.preview(actor.member().userId(),actor.enterprise().id(),direction,new PreviewRequest(List.of(items)));}
    private Batch execute(Context actor,String direction,Item...items) {
        var preview=preview(actor,direction,items);return submit(actor,direction,preview,UUID.randomUUID().toString(),items);
    }
    private Batch submit(Context actor,String direction,Preview preview,String key,Item...items) {
        return service.submit(actor.member().userId(),actor.enterprise().id(),direction,new SubmitRequest(key,preview.confirmationFingerprint(),List.of(items)));
    }
    private long total(Context e,Context...members){long total=root(e).getTotalBalance()+root(e).getPendingBalance();for(var m:members)total+=wallet(m).getTotalBalance()+wallet(m).getPendingBalance();return total;}

    @Test void singleAllocationAndReclaimPreserveBucketsAndLinkedLedger() {
        var e=company();var m=join(e);fund(root(e),60,LedgerEntry.LedgerEntryType.GIFT);fund(root(e),40,LedgerEntry.LedgerEntryType.LICENSE_GRANT);fund(root(e),200,LedgerEntry.LedgerEntryType.RECHARGE);
        long issued=ledger.sumTotalCreditsIssued();var b=execute(e,"allocate",new Item(m.member().id(),150L));
        assertEquals(150,b.totalAmount());assertEquals(1,b.transfers().size());var transfer=b.transfers().get(0);
        assertEquals(60,transfer.fromGift());assertEquals(40,transfer.fromLicense());assertEquals(50,transfer.fromRecharge());
        var out=ledger.findById(transfer.outLedgerId()).orElseThrow();var in=ledger.findById(transfer.inLedgerId()).orElseThrow();
        assertEquals(out.getReferenceId(),in.getReferenceId());assertEquals(transfer.id(),out.getReferenceId());assertEquals(0,out.getAmount()+in.getAmount());
        assertEquals(LedgerEntry.LedgerEntryType.TRANSFER_OUT,out.getEntryType());assertEquals(LedgerEntry.Plane.CREDIT,in.getPlane());assertNull(in.getCashArtifactId());
        assertEquals(e.member().userId(),out.getActorUserId());assertEquals(m.member().id(),out.getMembershipId());
        assertEquals(300,total(e,m));assertEquals(issued,ledger.sumTotalCreditsIssued());assertEquals(50,wallet(m).getRechargeBalance());
        var reclaimed=execute(e,"reclaim",new Item(m.member().id(),100L));assertEquals(100,reclaimed.totalAmount());
        assertEquals(50,wallet(m).getTotalBalance());assertEquals(60,root(e).getGiftBalance());assertEquals(40,root(e).getLicenseBalance());
        assertEquals(b.id(),service.batch(e.member().userId(),e.enterprise().id(),b.id()).id());
    }

    @Test void batchReclaimsAvailableOnlyAndSkipsZeroMembers() {
        var e=company();var a=join(e);var b=join(e);fund(root(e),200,LedgerEntry.LedgerEntryType.RECHARGE);
        execute(e,"allocate",new Item(a.member().id(),100L));String ref=UUID.randomUUID().toString();
        credits.holdWallet(wallet(a).getId(),80,"e05",ref,"冻结",a.member().userId(),a.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        var p=preview(e,"reclaim",new Item(a.member().id(),null),new Item(b.member().id(),null));
        assertEquals(2,p.memberCount());assertEquals(20,p.totalAmount());assertEquals(120,p.rootAvailableAfter());
        var result=submit(e,"reclaim",p,UUID.randomUUID().toString(),new Item(a.member().id(),null),new Item(b.member().id(),null));
        assertEquals(1,result.transfers().size());assertEquals(80,wallet(a).getPendingBalance());assertEquals(0,wallet(a).getTotalBalance());assertEquals(200,total(e,a,b));
        assertThrows(BusinessException.class,()->preview(e,"reclaim",new Item(b.member().id(),null)));
        credits.releaseHold("e05",ref,"释放");assertEquals(80,wallet(a).getTotalBalance());
    }

    @Test void insufficientWholeBatchDoesNotTransferAndDuplicateMembersAreRejected() {
        var e=company();var a=join(e);var b=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);
        var failure=assertThrows(BusinessException.class,()->preview(e,"allocate",new Item(a.member().id(),60L),new Item(b.member().id(),60L)));
        assertEquals("ENTERPRISE_POINTS_INSUFFICIENT",failure.getCode());assertEquals(0,wallet(a).getTotalBalance());assertEquals(100,root(e).getTotalBalance());
        assertThrows(BusinessException.class,()->preview(e,"allocate",new Item(a.member().id(),1L),new Item(a.member().id(),2L)));
        assertThrows(BusinessException.class,()->preview(e,"allocate",new Item(a.member().id(),null)));
        assertThrows(BusinessException.class,()->preview(e,"reclaim",new Item(a.member().id(),0L)));
        var oversized=new ArrayList<Item>();for(int i=0;i<101;i++)oversized.add(new Item("member-"+i,1L));
        assertThrows(BusinessException.class,()->service.preview(e.member().userId(),e.enterprise().id(),"allocate",new PreviewRequest(oversized)));
        var p=preview(e,"allocate",new Item(a.member().id(),1L));
        assertThrows(BusinessException.class,()->submit(e,"allocate",p,"finance:reserved",new Item(a.member().id(),1L)));
        assertTrue(batches.findAll().stream().noneMatch(batch->e.enterprise().id().equals(batch.getEnterpriseId())));
    }

    @Test void staleConfirmationChangesNothingAndMustBeReconfirmed() {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);var p=preview(e,"allocate",new Item(m.member().id(),50L));
        fund(root(e),1,LedgerEntry.LedgerEntryType.GIFT);
        var error=assertThrows(BusinessException.class,()->submit(e,"allocate",p,UUID.randomUUID().toString(),new Item(m.member().id(),50L)));
        assertEquals("ENTERPRISE_POINTS_PREVIEW_STALE",error.getCode());assertEquals(0,wallet(m).getTotalBalance());
        execute(e,"allocate",new Item(m.member().id(),50L));assertEquals(50,wallet(m).getTotalBalance());
    }

    @Test void duplicateConcurrentBatchIsIdempotentAndItemOrderIsCanonical() throws Exception {
        var e=company();var a=join(e);var b=join(e);fund(root(e),200,LedgerEntry.LedgerEntryType.RECHARGE);
        var p=preview(e,"allocate",new Item(a.member().id(),30L),new Item(b.member().id(),40L));String key=UUID.randomUUID().toString();
        var result=race(()->submit(e,"allocate",p,key,new Item(a.member().id(),30L),new Item(b.member().id(),40L)),
                ()->submit(e,"allocate",p,key,new Item(b.member().id(),40L),new Item(a.member().id(),30L)));
        assertEquals(((Batch)result.get(0)).id(),((Batch)result.get(1)).id());assertEquals(130,root(e).getTotalBalance());
        assertEquals(30,wallet(a).getTotalBalance());assertEquals(40,wallet(b).getTotalBalance());
        assertEquals(2,transfers.findByBatchIdOrderByMemberIdAsc(((Batch)result.get(0)).id()).size());
        var conflict=assertThrows(BusinessException.class,()->submit(e,"allocate",p,key,new Item(a.member().id(),31L),new Item(b.member().id(),40L)));
        assertEquals("ENTERPRISE_REQUEST_CONFLICT",conflict.getCode());
    }

    @Test void replayAfterConsumptionStillReturnsOriginalBatch() {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);
        var item=new Item(m.member().id(),80L);var p=preview(e,"allocate",item);String key=UUID.randomUUID().toString();var b=submit(e,"allocate",p,key,item);
        String ref=UUID.randomUUID().toString();credits.holdWallet(wallet(m).getId(),50,"e05",ref,"生成",m.member().userId(),m.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        assertEquals(b.id(),submit(e,"allocate",p,key,item).id());assertEquals(30,wallet(m).getTotalBalance());assertEquals(20,root(e).getTotalBalance());
    }

    @Test void distinctConcurrentBatchesCannotOverspendTheRootWallet() throws Exception {
        var e=company();var a=join(e);var b=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);
        var ia=new Item(a.member().id(),80L);var ib=new Item(b.member().id(),80L);
        var pa=preview(e,"allocate",ia);var pb=preview(e,"allocate",ib);
        var result=race(()->{try {submit(e,"allocate",pa,UUID.randomUUID().toString(),ia);return true;}catch(BusinessException ex){assertEquals("ENTERPRISE_POINTS_PREVIEW_STALE",ex.getCode());return false;}},
                ()->{try {submit(e,"allocate",pb,UUID.randomUUID().toString(),ib);return true;}catch(BusinessException ex){assertEquals("ENTERPRISE_POINTS_PREVIEW_STALE",ex.getCode());return false;}});
        assertEquals(1,result.stream().filter(Boolean.TRUE::equals).count());assertEquals(20,root(e).getTotalBalance());assertEquals(100,total(e,a,b));
        assertEquals(80,wallet(a).getTotalBalance()+wallet(b).getTotalBalance());
    }

    @Test void concurrentConsumeAndReclaimCannotOverspend() throws Exception {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);execute(e,"allocate",new Item(m.member().id(),100L));
        var item=new Item(m.member().id(),80L);var p=preview(e,"reclaim",item);String ref=UUID.randomUUID().toString();
        var result=race(()->{try {submit(e,"reclaim",p,UUID.randomUUID().toString(),item);return true;}catch(BusinessException ex){assertEquals("ENTERPRISE_POINTS_PREVIEW_STALE",ex.getCode());return false;}},
                ()->{try {credits.holdWallet(wallet(m).getId(),80,"race-e05",ref,"生成",m.member().userId(),m.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);return true;}catch(ResponseStatusException ex){assertEquals(402,ex.getStatusCode().value());return false;}});
        assertEquals(1,result.stream().filter(Boolean.TRUE::equals).count());assertEquals(100,total(e,m));assertEquals(20,wallet(m).getTotalBalance());
        assertTrue(root(e).getTotalBalance()>=0);assertTrue(wallet(m).getPendingBalance()>=0);
    }

    @Test void failureAfterFirstTransferRollsBackEntireBatchAndLedger() {
        var e=company();var a=join(e);var b=join(e);fund(root(e),200,LedgerEntry.LedgerEntryType.RECHARGE);
        String order=UUID.randomUUID().toString();sourceLots.origin(root(e),order,200);
        var p=preview(e,"allocate",new Item(a.member().id(),50L),new Item(b.member().id(),50L));
        Context second=a.member().id().compareTo(b.member().id())>0?a:b;String secondWallet=wallet(second).getId();
        doAnswer(invocation->{if(secondWallet.equals(invocation.getArgument(2)))throw new IllegalStateException("injected second transfer fault");return invocation.callRealMethod();})
                .when(credits).transferEnterpriseCredits(anyString(),anyString(),anyString(),anyLong(),anyString(),anyString(),anyString(),anyString());
        assertThrows(IllegalStateException.class,()->submit(e,"allocate",p,UUID.randomUUID().toString(),new Item(a.member().id(),50L),new Item(b.member().id(),50L)));
        assertEquals(200,root(e).getTotalBalance());assertEquals(0,wallet(a).getTotalBalance());assertEquals(0,wallet(b).getTotalBalance());
        assertTrue(batches.findAll().stream().noneMatch(batch->e.enterprise().id().equals(batch.getEnterpriseId())));
        assertTrue(ledger.findByWalletId(wallet(a).getId(),org.springframework.data.domain.PageRequest.of(0,100)).isEmpty());
        assertEquals(200,lotRows.findByRechargeOrderIdAndWalletId(order,root(e).getId()).orElseThrow().getAvailable());
        assertTrue(lotRows.findByRechargeOrderIdAndWalletId(order,wallet(a).getId()).isEmpty());
    }

    @Test void managerCannotManageSelfOwnerOrOtherManagersAndForeignMembersAreDenied() {
        var e=company();var manager=join(e);var peer=join(e);var member=join(e);var outsider=company();var foreign=join(outsider);
        for(Context m:List.of(manager,peer))enterprises.updateMember(e.member().userId(),e.enterprise().id(),m.member().id(),new MemberUpdate("manager",new Capabilities(true,true,true),m.member().version()));
        fund(root(e),200,LedgerEntry.LedgerEntryType.RECHARGE);
        for(Context target:List.of(manager,peer,e))assertThrows(BusinessException.class,()->preview(manager,"allocate",new Item(target.member().id(),10L)));
        execute(manager,"allocate",new Item(member.member().id(),10L));assertEquals(10,wallet(member).getTotalBalance());
        execute(e,"allocate",new Item(e.member().id(),10L));assertEquals(10,wallet(e).getTotalBalance());
        assertEquals(2,service.transfers(e.member().userId(),e.enterprise().id(),0,20).getTotalElements());
        assertEquals(1,service.transfers(member.member().userId(),e.enterprise().id(),0,20).getTotalElements());
        assertEquals(1,service.transfers(e.member().userId(),e.enterprise().id(),0,1).getContent().size());
        assertThrows(BusinessException.class,()->service.transfers(foreign.member().userId(),e.enterprise().id(),0,20));
        assertThrows(BusinessException.class,()->preview(e,"allocate",new Item(foreign.member().id(),10L)));
        assertThrows(BusinessException.class,()->preview(member,"allocate",new Item(member.member().id(),10L)));
        var row=members.findById(member.member().id()).orElseThrow();row.setStatus("suspended");members.saveAndFlush(row);
        assertThrows(BusinessException.class,()->preview(e,"allocate",new Item(member.member().id(),1L)));
        execute(e,"reclaim",new Item(member.member().id(),null));assertEquals(0,wallet(member).getTotalBalance());
    }

    @Test void lowLevelTransfersRejectPersonalForeignAndMemberToMemberWallets() {
        var e=company();var m=join(e);var other=join(e);var foreign=company();fund(root(e),200,LedgerEntry.LedgerEntryType.GIFT);
        String personal=person();credits.creditAccount(personal,100,LedgerEntry.LedgerEntryType.GIFT,"test","personal","个人");
        var personalWallet=wallets.findByUserId(personal).orElseThrow();
        for(var pair:List.of(List.of(personalWallet.getId(),wallet(m).getId()),List.of(root(e).getId(),root(foreign).getId()),List.of(wallet(m).getId(),wallet(other).getId())))
            assertThrows(ResponseStatusException.class,()->credits.transferEnterpriseCredits(e.enterprise().id(),pair.get(0),pair.get(1),10,e.member().userId(),m.member().id(),UUID.randomUUID().toString(),"越界"));
        assertEquals(100,wallets.findById(personalWallet.getId()).orElseThrow().getTotalBalance());assertEquals(200,root(e).getTotalBalance());
    }

    @Test void cashReclaimIsExactRechargeOnlyAndLeavesGiftsUntouched() {
        var e=company();fund(root(e),100,LedgerEntry.LedgerEntryType.GIFT);fund(root(e),50,LedgerEntry.LedgerEntryType.RECHARGE);
        assertThrows(ResponseStatusException.class,()->credits.refundCashReclaimWallet(root(e).getId(),51,"refund-over","退款"));
        assertEquals(150,root(e).getTotalBalance());var row=credits.refundCashReclaimWallet(root(e).getId(),40,"refund-ok-"+e.enterprise().id(),"退款");
        assertEquals(-40,row.amount());assertEquals(100,root(e).getGiftBalance());assertEquals(10,root(e).getRechargeBalance());
    }

    @Test void rechargeOrderProvenanceFollowsTransfersFreezeSettlementAndRelease() {
        var e=company();var m=join(e);fund(root(e),150,LedgerEntry.LedgerEntryType.RECHARGE);
        String order="source-"+UUID.randomUUID();sourceLots.origin(root(e),order,150);
        execute(e,"allocate",new Item(m.member().id(),100L));
        assertEquals(50,lotRows.findByRechargeOrderIdAndWalletId(order,root(e).getId()).orElseThrow().getAvailable());
        assertEquals(100,lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow().getAvailable());
        String ref=UUID.randomUUID().toString();credits.holdWallet(wallet(m).getId(),50,"provenance",ref,"冻结",m.member().userId(),m.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        var frozen=lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow();assertEquals(50,frozen.getAvailable());assertEquals(50,frozen.getFrozen());
        credits.commitHold("provenance",ref,20,"部分完成", null);
        execute(e,"reclaim",new Item(m.member().id(),null));
        assertEquals(100,lotRows.findByRechargeOrderIdAndWalletId(order,root(e).getId()).orElseThrow().getAvailable());
        credits.releaseHold("provenance",ref,"剩余退回");
        var remaining=lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow();assertEquals(30,remaining.getAvailable());assertEquals(0,remaining.getFrozen());
        assertEquals(130,total(e,m));assertEquals(30,wallet(m).getRechargeBalance());
    }

    @Test void corporatePartialRoundingCannotInventRechargeCredits() {
        var e=company();var m=join(e);
        fund(root(e),1,LedgerEntry.LedgerEntryType.GIFT);fund(root(e),1,LedgerEntry.LedgerEntryType.LICENSE_GRANT);fund(root(e),1,LedgerEntry.LedgerEntryType.RECHARGE);
        String order=UUID.randomUUID().toString();sourceLots.origin(root(e),order,1);execute(e,"allocate",new Item(m.member().id(),3L));
        String ref=UUID.randomUUID().toString();credits.holdWallet(wallet(m).getId(),3,"rounding",ref,"冻结",m.member().userId(),m.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        credits.commitHold("rounding",ref,1,"部分完成", null);credits.releaseHold("rounding",ref,"退回两分");
        assertEquals(2,wallet(m).getTotalBalance());assertEquals(1,wallet(m).getRechargeBalance());assertEquals(1,wallet(m).getLicenseBalance());assertEquals(0,wallet(m).getGiftBalance());
        assertEquals(1,lotRows.findByRechargeOrderIdAndWalletId(order,wallet(m).getId()).orElseThrow().getAvailable());
    }

    @Test void previouslyManagedWalletMustRefreshAfterWaitingForAnotherHold() throws Exception {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);execute(e,"allocate",new Item(m.member().id(),100L));
        String walletId=wallet(m).getId(),firstRef=UUID.randomUUID().toString(),secondRef=UUID.randomUUID().toString();
        var read=new CountDownLatch(1);var changed=new CountDownLatch(1);
        var result=race(()->new org.springframework.transaction.support.TransactionTemplate(transactionManager).execute(status->{
            wallets.findById(walletId).orElseThrow();read.countDown();await(changed);
            try {credits.holdWallet(walletId,80,"snapshot",secondRef,"第二笔",m.member().userId(),m.member().id(),secondRef, com.aistareco.aep.billing.service.ModelChargeContext.NONE);return true;}
            catch(ResponseStatusException ex){assertEquals(402,ex.getStatusCode().value());status.setRollbackOnly();return false;}
        }),()->{await(read);try {credits.holdWallet(walletId,80,"snapshot",firstRef,"第一笔",m.member().userId(),m.member().id(),firstRef, com.aistareco.aep.billing.service.ModelChargeContext.NONE);return true;}finally {changed.countDown();}});
        assertEquals(1,result.stream().filter(Boolean.TRUE::equals).count());assertEquals(20,wallet(m).getTotalBalance());assertEquals(80,wallet(m).getPendingBalance());
    }

    @Test void previouslyManagedHoldMustRefreshBeforePartialSettlement() throws Exception {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.RECHARGE);execute(e,"allocate",new Item(m.member().id(),100L));
        String walletId=wallet(m).getId(),ref=UUID.randomUUID().toString();credits.holdWallet(walletId,100,"settle-snapshot",ref,"冻结",m.member().userId(),m.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        var read=new CountDownLatch(1);var changed=new CountDownLatch(1);
        race(()->new org.springframework.transaction.support.TransactionTemplate(transactionManager).execute(status->{
            wallets.findById(walletId).orElseThrow();holds.findByReferenceTypeAndReferenceId("settle-snapshot",ref).orElseThrow();read.countDown();await(changed);
            credits.commitHold("settle-snapshot",ref,40,"剩余完成", null);return true;
        }),()->{await(read);try {credits.commitHold("settle-snapshot",ref,60,"先完成六十", null);return true;}finally {changed.countDown();}});
        var hold=holds.findByReferenceTypeAndReferenceId("settle-snapshot",ref).orElseThrow();assertEquals(CreditHold.Status.COMMITTED,hold.getStatus());assertEquals(0,hold.getRemainingAmount());
        assertEquals(0,wallet(m).getPendingBalance());assertEquals(0,wallet(m).getTotalBalance());
    }

    @Test void httpRequiresAuthenticationPreviewAndIntegralAmount() throws Exception {
        var e=company();var m=join(e);fund(root(e),100,LedgerEntry.LedgerEntryType.GIFT);String path="/api/v1/ip-studio/enterprises/"+e.enterprise().id()+"/points/allocate";
        mvc.perform(post(path+"/preview").contentType("application/json").content("{\"items\":[]}")).andExpect(status().isUnauthorized());
        mvc.perform(post(path+"/preview").with(user(e.member().userId()).roles("PERSONAL")).header("X-App-Code","aiavatar")
                .contentType("application/json").content("{\"items\":[{\"memberId\":\""+m.member().id()+"\",\"amount\":1.5}]}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).with(user(e.member().userId()).roles("PERSONAL")).header("X-App-Code","aiavatar")
                .contentType("application/json").content("{\"clientRequestId\":\"missing-preview\",\"items\":[{\"memberId\":\""+m.member().id()+"\",\"amount\":10}]}")).andExpect(status().isBadRequest());
        mvc.perform(post(path+"/preview").with(user(e.member().userId()).roles("PERSONAL")).header("X-App-Code","aiavatar")
                .contentType("application/json").content("{\"items\":[{\"memberId\":\""+m.member().id()+"\",\"amount\":10}]}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberCount").value(1)).andExpect(jsonPath("$.data.totalAmount").value(10)).andExpect(jsonPath("$.data.confirmationFingerprint").isString());
        assertEquals(0,wallet(m).getTotalBalance());
    }

    private List<Object> race(Callable<?> first,Callable<?> second)throws Exception {
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try {List<Future<?>> results=new ArrayList<>();for(var callable:List.of(first,second))results.add(pool.submit(()->{start.await();return callable.call();}));
            start.countDown();return List.of(results.get(0).get(30,TimeUnit.SECONDS),results.get(1).get(30,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();}
    }
    private static void await(CountDownLatch latch) {
        try {assertTrue(latch.await(15,TimeUnit.SECONDS),"concurrent test timed out");}
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
    }
}
