package com.aistareco.aep.service;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real staff roles, wallet/ledger transactions and simultaneous approval of the same original request. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.datasource.url=jdbc:h2:mem:credit-super-admin;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST"})
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(replace=org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
@Import({CreditOpsService.class,CreditService.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class CreditOpsSuperAdminIntegrationTest {
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.billing.service.ModelChargeService modelCharges;
    // CreditOpsService also issues model grants; this test covers ordinary gifts only.
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.billing.service.ScopedCreditService scopedCredits;

    @Autowired CreditOpsService service;
    @Autowired AdminUserRepository admins;
    @Autowired WalletRepository wallets;
    @Autowired LedgerEntryRepository ledger;
    @Autowired CreditAdjustmentRequestRepository requests;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseCreditLotService lots;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseBillingService billing;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService recovery;

    @BeforeEach void setup() {
        requests.deleteAll();ledger.deleteAll();wallets.deleteAll();admins.deleteAll();
        admins.saveAndFlush(AdminUser.builder().id("root").username("root").role(AdminUser.AdminRole.SUPER_ADMIN).status(AdminUser.AdminStatus.ACTIVE).build());
        admins.saveAndFlush(AdminUser.builder().id("finance").username("finance").role(AdminUser.AdminRole.FINANCE_ADMIN).status(AdminUser.AdminStatus.ACTIVE).build());
        wallets.saveAndFlush(Wallet.builder().id("wallet").userId("user").totalBalance(1586).rechargeBalance(1586).pendingBalance(30).build());
    }
    @Test void directSuperAdminGrantCreditsGiftOnlyWithAnApprovedAuditReceipt() {
        var result=service.grantGift("user",10000,"campaign","用户授权","root");
        assertFalse(result.pending());assertEquals(1,ledger.count());
        var wallet=wallets.findById("wallet").orElseThrow();
        assertEquals(11586,wallet.getTotalBalance());assertEquals(10000,wallet.getGiftBalance());
        assertEquals(1586,wallet.getRechargeBalance());assertEquals(30,wallet.getPendingBalance());assertEquals(0,wallet.getLicenseBalance());
        var audit=requests.findAll().get(0);assertEquals(CreditAdjustmentRequest.Status.APPROVED,audit.getStatus());
        assertEquals(result.entry().id(),audit.getLedgerEntryId());assertEquals("root",audit.getMakerId());
        assertTrue(audit.getDecideNote().contains("超管直接发放"));
        assertEquals("DUPLICATE_CAMPAIGN_GRANT",assertThrows(BusinessException.class,()->service.grantGift("user",10000,"campaign","用户授权","root")).getCode());
        assertEquals(1,ledger.count());
    }
    @Test void financeLargeGrantStillNeedsAnotherReviewer() {
        var result=service.grantGift("user",10000,null,"用户授权","finance");
        assertTrue(result.pending());
        assertEquals("MAKER_CHECKER_SAME",assertThrows(BusinessException.class,()->service.approve(result.requestId(),"finance")).getCode());
        assertEquals(0,ledger.count());assertEquals(1586,wallets.findById("wallet").orElseThrow().getTotalBalance());
        service.approve(result.requestId(),"root");assertEquals(1,ledger.count());
    }
    @Test void simultaneousSelfApprovalsCreditTheOriginalRequestExactlyOnce() throws Exception {
        requests.saveAndFlush(CreditAdjustmentRequest.builder().id("original").type(CreditAdjustmentRequest.Type.GRANT)
            .targetUserId("user").amount(10000).reason("用户授权").makerId("root").createdAt(java.time.Instant.now()).build());
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        Callable<String> approve=()->{start.await();try{service.approve("original","root");return "approved";}catch(BusinessException e){return e.getCode();}};
        try {
            var first=pool.submit(approve);var second=pool.submit(approve);start.countDown();
            assertEquals(java.util.Set.of("approved","REQUEST_NOT_PENDING"),java.util.Set.of(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS)));
        } finally {pool.shutdownNow();}
        assertEquals(1,ledger.count());assertEquals(11586,wallets.findById("wallet").orElseThrow().getTotalBalance());
        var audit=requests.findById("original").orElseThrow();assertEquals("root",audit.getCheckerId());
        assertEquals(CreditAdjustmentRequest.Status.APPROVED,audit.getStatus());assertNotNull(audit.getLedgerEntryId());
    }
}
