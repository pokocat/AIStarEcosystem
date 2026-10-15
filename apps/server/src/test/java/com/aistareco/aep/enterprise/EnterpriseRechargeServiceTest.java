package com.aistareco.aep.enterprise;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterpriseRechargeDtos.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop","aep.seed.dev-data.enabled=false",
        "aep.cdn.driver=local","aep.enterprise.enabled=true","aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class EnterpriseRechargeServiceTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        String url=System.getProperty("enterprise.test.jdbc","jdbc:h2:mem:enterprise-recharge;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
        r.add("spring.datasource.url",()->url);r.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        r.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");r.add("spring.datasource.password",()->"");
    }
    @Autowired EnterpriseRechargeService service;
    @Autowired EnterpriseService enterprise;
    @Autowired AepUserRepository users;
    @Autowired EnrollmentService enrollment;
    @SpyBean CreditService credits;
    @Autowired RechargeService personalRecharge;
    @Autowired RechargeOrderRepository orders;
    @Autowired WalletRepository wallets;
    @Autowired EnterpriseCreditLotRepository lots;
    @Autowired LedgerEntryRepository ledger;
    @Autowired EnterprisePointsBatchRepository batches;
    @Autowired EnterprisePointsTransferRepository transfers;
    @Autowired MockMvc mvc;
    private String person(){String id=UUID.randomUUID().toString();users.save(AepUser.builder().id(id).username(id).displayName("充值验收成员").status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);return id;}
    private Context company(String owner){return enterprise.create(owner,new CreateRequest("充值验收企业",UUID.randomUUID().toString()));}
    private Context join(String owner,Context company,String member){var i=enterprise.invite(owner,company.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));return enterprise.accept(member,new AcceptRequest(i.token()));}
    private Order request(String owner,Context company){return service.request(owner,company.enterprise().id(),new RechargeRequest(UUID.randomUUID().toString(),null,"线下充值"));}
    private Order paid(String owner,Context company,long price,long amount){var order=request(owner,company);return service.confirm("finance",order.id(),new ConfirmRequest(UUID.randomUUID().toString(),price,amount,"receipt-"+UUID.randomUUID(),"实收核准"));}
    private Wallet root(Context c){return wallets.findByAccountKey("enterprise:"+c.enterprise().id()).orElseThrow();}
    private Wallet member(Context c,String user){return wallets.findByAccountKey("enterprise_member:"+c.enterprise().id()+":"+user).orElseThrow();}
    private void allocate(Context c,String user,long amount){credits.transferEnterpriseCredits(c.enterprise().id(),root(c).getId(),member(c,user).getId(),amount,c.enterprise().ownerUserId(),c.member().id(),UUID.randomUUID().toString(),"验收分配");}
    private RefundRequest refundRequest(RefundPreview p){return new RefundRequest(UUID.randomUUID().toString(),p.previewToken(),"人工退款已完成","refund-"+UUID.randomUUID());}

    @Test void requestIsIdempotentAndDoesNotCreditOrEnterPersonalLists() {
        String owner=person();var c=company(owner);String key=UUID.randomUUID().toString();var input=new RechargeRequest(key,500L,"申请");
        var a=service.request(owner,c.enterprise().id(),input);assertEquals(a.id(),service.request(owner,c.enterprise().id(),input).id());
        assertThrows(BusinessException.class,()->service.request(owner,c.enterprise().id(),new RechargeRequest(key,501L,"申请")));
        assertEquals(0,root(c).getTotalBalance());assertTrue(personalRecharge.listMyOrders(owner).stream().noneMatch(o->o.id().equals(a.id())));
        assertThrows(BusinessException.class,()->personalRecharge.getOrderForUser(owner,a.id()));assertThrows(BusinessException.class,()->personalRecharge.cancelOrder(owner,a.id()));
        assertEquals(1,service.list(owner,c.enterprise().id(),0,20).getTotalElements());
    }
    @Test void confirmationCreditsOnlyOriginalEnterpriseAndIsIdempotent() {
        String owner=person(),next=person();var c=company(owner);var member=join(owner,c,next);credits.creditAccount(owner,777,LedgerEntry.LedgerEntryType.GIFT,"test",owner,"个人");
        var order=request(owner,c);var transfer=enterprise.requestTransfer(owner,c.enterprise().id(),new OwnershipRequest(member.member().id(),UUID.randomUUID().toString()));enterprise.acceptTransfer(next,c.enterprise().id(),transfer.id());
        var input=new ConfirmRequest(UUID.randomUUID().toString(),899L,1234L,"receipt-"+UUID.randomUUID(),"确认");
        var result=service.confirm("finance",order.id(),input);assertEquals("paid",result.status());assertEquals(result,service.confirm("finance",order.id(),input));
        assertEquals(1234,root(c).getRechargeBalance());assertEquals(777,wallets.findByUserId(owner).orElseThrow().getTotalBalance());assertEquals(order.targetWalletId(),result.targetWalletId());
        assertEquals(1234,lots.findByRechargeOrderIdOrderByWalletIdAsc(order.id()).stream().mapToLong(x->x.getAvailable()).sum());
        assertThrows(BusinessException.class,()->service.confirm("finance",order.id(),new ConfirmRequest(input.clientRequestId(),899L,1235L,input.receiptReference(),"确认")));
    }
    @Test void duplicateReceiptAcrossEnterprisesRequiresReviewAndDoesNotIssueCredits() {
        String a=person(),b=person();var ca=company(a);var cb=company(b);var oa=request(a,ca);var ob=request(b,cb);String receipt="BANK-"+UUID.randomUUID();
        service.confirm("finance",oa.id(),new ConfirmRequest(UUID.randomUUID().toString(),100L,1000L,receipt,null));
        var ex=assertThrows(BusinessException.class,()->service.confirm("finance",ob.id(),new ConfirmRequest(UUID.randomUUID().toString(),100L,1000L,"  "+receipt.toLowerCase(Locale.ROOT)+"  ",null)));
        assertEquals("ENTERPRISE_RECEIPT_REVIEW_REQUIRED",ex.getCode());assertEquals(0,root(cb).getTotalBalance());assertEquals(RechargeOrder.Status.PENDING,orders.findById(ob.id()).orElseThrow().getStatus());
    }
    @Test void refundRecallsOnlyOriginalAvailableCreditsAndExcludesFrozenGiftAndPersonal() {
        String owner=person(),user=person();var c=company(owner);var m=join(owner,c,user);var order=paid(owner,c,999,1000);allocate(c,user,600);
        var wallet=member(c,user);credits.creditWallet(wallet.getId(),50,LedgerEntry.LedgerEntryType.GIFT,"test","g","赠送");credits.creditAccount(user,800,LedgerEntry.LedgerEntryType.RECHARGE,"test","p","个人");
        String ref=UUID.randomUUID().toString();credits.holdWallet(wallet.getId(),150,"enterprise-recharge-test",ref,"冻结",user,m.member().id(),"auth-"+ref);
        var preview=service.refundPreview(order.id());assertEquals(900,preview.reclaimableCredits());assertEquals(899,preview.refundPriceCents());assertEquals(500,preview.memberRecallCredits());assertEquals(100,preview.pendingCredits());
        var failure=assertThrows(BusinessException.class,()->service.refund("finance",order.id(),refundRequest(preview)));assertTrue(failure.getMessage().contains("在途任务"));
        assertEquals(400,root(c).getTotalBalance());assertEquals(150,member(c,user).getPendingBalance());
        credits.releaseHold("enterprise-recharge-test",ref,"失败退回原来源");var fresh=service.refundPreview(order.id());assertEquals(1000,fresh.reclaimableCredits());assertEquals(0,fresh.pendingCredits());
        var input=refundRequest(fresh);var result=service.refund("finance",order.id(),input);assertEquals("refunded",result.status());assertEquals(1000,result.refundedCredits());assertEquals(999,result.refundedPriceCents());
        assertEquals(result,service.refund("finance",order.id(),input));assertEquals(0,root(c).getTotalBalance());assertEquals(50,member(c,user).getTotalBalance());assertEquals(0,member(c,user).getPendingBalance());
        assertEquals(800,wallets.findByUserId(user).orElseThrow().getTotalBalance());assertEquals(50,member(c,user).getGiftBalance());assertEquals(0,member(c,user).getRechargeBalance());
    }
    @Test void spentOriginalOrderCannotBeRefundedUsingLaterRecharge() {
        String owner=person();var c=company(owner);var original=paid(owner,c,100,100);allocate(c,owner,100);String ref=UUID.randomUUID().toString();
        credits.holdWallet(member(c,owner).getId(),100,"enterprise-recharge-test",ref,"生成",owner,c.member().id(),ref);credits.commitHold("enterprise-recharge-test",ref,100,"成功");
        var later=paid(owner,c,250,100);var preview=service.refundPreview(original.id());assertEquals(0,preview.reclaimableCredits());assertEquals(100,preview.spentCredits());
        assertThrows(BusinessException.class,()->service.refund("finance",original.id(),refundRequest(preview)));assertEquals(100,service.refundPreview(later.id()).reclaimableCredits());
    }
    @Test void staleRefundPreviewFailsWithoutDebitingAndBatchTransfersDoNotCreateRevenue() {
        String owner=person();var c=company(owner);var order=paid(owner,c,123,1000);var preview=service.refundPreview(order.id());long revenue=ledger.sumAmountByType(LedgerEntry.LedgerEntryType.RECHARGE);
        allocate(c,owner,300);assertThrows(BusinessException.class,()->service.refund("finance",order.id(),refundRequest(preview)));
        assertEquals(1000,service.wallet(owner,c.enterprise().id()).totalBalance());assertEquals(revenue,ledger.sumAmountByType(LedgerEntry.LedgerEntryType.RECHARGE));
        var p=service.refundPreview(order.id());assertEquals(300,p.memberRecallCredits());assertEquals(123,p.refundPriceCents());
    }
    @Test void proportionalMixedBucketReleaseCannotCreateCashBackedCredits() {
        String owner=person();var c=company(owner);var order=paid(owner,c,100,1);allocate(c,owner,1);var w=member(c,owner);
        credits.creditWallet(w.getId(),1,LedgerEntry.LedgerEntryType.GIFT,"test","gift","gift");credits.creditWallet(w.getId(),1,LedgerEntry.LedgerEntryType.LICENSE_GRANT,"test","license","license");
        String ref=UUID.randomUUID().toString();credits.holdWallet(w.getId(),3,"enterprise-rounding",ref,"冻结",owner,c.member().id(),ref);credits.commitHold("enterprise-rounding",ref,1,"部分成功");credits.releaseHold("enterprise-rounding",ref,"余量");
        assertEquals(1,member(c,owner).getRechargeBalance());assertEquals(1,service.refundPreview(order.id()).reclaimableCredits());assertEquals(2,member(c,owner).getTotalBalance());
    }
    @Test void multipleDifferentlyPricedSourcesSettleFifoAndKeepTheirOwnRefundRatios() {
        String owner=person();var c=company(owner);var first=paid(owner,c,100,100);var second=paid(owner,c,900,100);allocate(c,owner,200);
        String ref=UUID.randomUUID().toString();credits.holdWallet(member(c,owner).getId(),200,"enterprise-source-fifo",ref,"两来源冻结",owner,c.member().id(),ref);
        credits.commitHold("enterprise-source-fifo",ref,120,"部分成功");credits.releaseHold("enterprise-source-fifo",ref,"失败余量");
        assertEquals(0,service.refundPreview(first.id()).reclaimableCredits());var remaining=service.refundPreview(second.id());assertEquals(80,remaining.reclaimableCredits());assertEquals(720,remaining.refundPriceCents());assertEquals(80,member(c,owner).getRechargeBalance());
    }
    @Test void legacyFinanceAndPaymentEntryPointsCannotBypassEnterpriseConfirmation() {
        String owner=person();var c=company(owner);var order=request(owner,c);
        assertThrows(BusinessException.class,()->personalRecharge.approveOrder(order.id(),"finance","旧入口"));assertThrows(BusinessException.class,()->personalRecharge.refundOrder(order.id(),"finance","旧入口"));
        assertThrows(BusinessException.class,()->personalRecharge.settlePaidOrder(order.id(),"shadow","fake",null,null));assertThrows(BusinessException.class,()->personalRecharge.settlePaidOrder(order.id(),"manual",null,"finance",null));
        var row=orders.findById(order.id()).orElseThrow();row.setCreatedAt(Instant.EPOCH);orders.save(row);personalRecharge.closeStalePendingOrders(30);
        assertEquals(RechargeOrder.Status.PENDING,orders.findById(order.id()).orElseThrow().getStatus());assertEquals(0,root(c).getTotalBalance());
    }
    @Test void financialRoutesRequirePlatformFinanceRoleAndUsePageEnvelope()throws Exception {
        String owner=person(),ordinary=person(),outsider=person();var c=company(owner);join(owner,c,ordinary);var order=request(owner,c);
        mvc.perform(get("/api/admin/finance/enterprise-recharges").with(user(owner).roles("PERSONAL"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/finance/enterprise-recharges").with(user("finance").roles("FINANCE_ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray()).andExpect(jsonPath("$.pagination").exists());
        mvc.perform(get("/api/v1/ip-studio/enterprises/"+c.enterprise().id()+"/wallet").with(user(outsider).roles("PERSONAL"))).andExpect(status().isForbidden());
        assertThrows(BusinessException.class,()->service.request(ordinary,c.enterprise().id(),new RechargeRequest(UUID.randomUUID().toString(),null,"越权")));
        mvc.perform(post("/api/admin/finance/enterprise-recharges/"+order.id()+"/confirm").with(user("finance").roles("FINANCE_ADMIN")).contentType("application/json").content("{\"clientRequestId\":\"decimal\",\"priceCents\":1.5,\"credits\":10,\"receiptReference\":\"receipt\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void concurrentConfirmationIssuesOnceAndDuplicateReceiptAcrossCompaniesIssuesOnce()throws Exception {
        String owner=person();var c=company(owner);var order=request(owner,c);var input=new ConfirmRequest(UUID.randomUUID().toString(),100L,1000L,"receipt-"+UUID.randomUUID(),null);
        assertEquals(2,race(()->service.confirm("f1",order.id(),input),()->service.confirm("f2",order.id(),input)).stream().filter(Boolean::booleanValue).count());assertEquals(1000,root(c).getTotalBalance());
        String other=person();var d=company(other);var oa=request(owner,c);var ob=request(other,d);String receipt="shared-"+UUID.randomUUID();
        var a=new ConfirmRequest(UUID.randomUUID().toString(),100L,200L,receipt,null);var b=new ConfirmRequest(UUID.randomUUID().toString(),100L,200L,receipt,null);
        assertEquals(1,race(()->service.confirm("f1",oa.id(),a),()->service.confirm("f2",ob.id(),b)).stream().filter(Boolean::booleanValue).count());
        assertEquals(1200,root(c).getTotalBalance()+root(d).getTotalBalance());
    }
    @Test void concurrentRefundRecordsCashOnceAndDoesNotChangePersonalWallet()throws Exception {
        String owner=person();var c=company(owner);var order=paid(owner,c,999,1000);var request=refundRequest(service.refundPreview(order.id()));
        assertEquals(2,race(()->service.refund("f1",order.id(),request),()->service.refund("f2",order.id(),request)).stream().filter(Boolean::booleanValue).count());
        assertEquals(0,root(c).getTotalBalance());assertEquals(1000,orders.findById(order.id()).orElseThrow().getRefundedCredits());
    }
    @Test void rejectionAndReadPermissionDoNotGrantMoneyIssuance() {
        String owner=person();var c=company(owner);var order=request(owner,c);assertEquals("rejected",service.reject("finance",order.id(),"收款不符").status());
        assertThrows(BusinessException.class,()->service.confirm("finance",order.id(),new ConfirmRequest(UUID.randomUUID().toString(),10L,10L,"unused",null)));
        assertEquals(0,root(c).getTotalBalance());assertEquals(1,service.memberBalances(owner,c.enterprise().id(),0,1).getTotalElements());
    }
    @Test void refundFailureAfterMemberRecallRollsBackWalletsLotsReceiptLedgerAndTransferBatch() {
        String owner=person();var c=company(owner);var order=paid(owner,c,599,1000);allocate(c,owner,700);var preview=service.refundPreview(order.id());var input=refundRequest(preview);
        long batchCount=batches.count(),transferCount=transfers.count(),ledgerCount=ledger.count();
        doThrow(new IllegalStateException("确定性回收失败")).when(credits).refundCashReclaimWallet(eq(root(c).getId()),eq(1000L),eq(order.id()),anyString());
        try{assertThrows(IllegalStateException.class,()->service.refund("finance",order.id(),input));}finally{reset(credits);}
        assertEquals(300,root(c).getTotalBalance());assertEquals(700,member(c,owner).getTotalBalance());assertEquals(batchCount,batches.count());assertEquals(transferCount,transfers.count());assertEquals(ledgerCount,ledger.count());
        assertEquals(RechargeOrder.Status.PAID,orders.findById(order.id()).orElseThrow().getStatus());assertEquals(preview.previewToken(),service.refundPreview(order.id()).previewToken());
        assertEquals("refunded",service.refund("finance",order.id(),input).status());
    }
    @Test void oneShotPartialRefundPreservesConsumedCreditsAndRejectsChangedReplayBody() {
        String owner=person();var c=company(owner);var order=paid(owner,c,999,1000);allocate(c,owner,100);String ref=UUID.randomUUID().toString();
        credits.holdWallet(member(c,owner).getId(),100,"enterprise-partial-refund",ref,"生成",owner,c.member().id(),ref);credits.commitHold("enterprise-partial-refund",ref,100,"已交付");
        var preview=service.refundPreview(order.id());assertEquals(100,preview.spentCredits());assertEquals(900,preview.reclaimableCredits());assertEquals(899,preview.refundPriceCents());
        var input=refundRequest(preview);var refunded=service.refund("finance",order.id(),input);assertEquals(899,refunded.refundedPriceCents());assertEquals(100,service.wallet(owner,c.enterprise().id()).spent());
        assertThrows(BusinessException.class,()->service.refund("finance",order.id(),new RefundRequest(input.clientRequestId(),input.previewToken(),"更换原因",input.receiptReference())));
        assertEquals(refunded,service.refund("finance",order.id(),input));
    }
    private List<Boolean> race(Callable<?> first,Callable<?> second)throws Exception {
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try{var a=pool.submit(()->call(start,first));var b=pool.submit(()->call(start,second));start.countDown();return List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));}finally{pool.shutdownNow();}
    }
    private boolean call(CountDownLatch start,Callable<?> action)throws Exception {start.await();try{action.call();return true;}catch(BusinessException e){return false;}}
}
