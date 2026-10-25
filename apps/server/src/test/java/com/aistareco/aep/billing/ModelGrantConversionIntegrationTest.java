package com.aistareco.aep.billing;

import com.aistareco.aep.billing.model.CreditCampaign;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.transaction.annotation.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Converting general non-cash credits into a model grant: one transaction per customer, paid recharge untouched. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:grant-conversion;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST;LOCK_TIMEOUT=10000"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@Import({ModelGrantConversionService.class,ScopedCreditService.class,ModelPricingService.class,ModelChargeService.class,
        com.aistareco.aep.service.CreditService.class,ModelGrantConversionIntegrationTest.Config.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class ModelGrantConversionIntegrationTest {
    @org.springframework.test.context.DynamicPropertySource
    static void database(org.springframework.test.context.DynamicPropertyRegistry properties) {
        String url=System.getProperty("model-scoped.jdbc","jdbc:h2:mem:grant-conversion;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST;LOCK_TIMEOUT=10000");
        properties.add("spring.datasource.url",()->url);
        properties.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        properties.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        properties.add("spring.datasource.password",()->"");
    }
    @TestConfiguration static class Config {@Bean ObjectMapper mapper(){return new ObjectMapper().findAndRegisterModules();}}

    @Autowired ModelGrantConversionService conversions;
    @Autowired WalletRepository wallets;
    @Autowired AepUserRepository users;
    @Autowired AdminUserRepository admins;
    @Autowired LedgerEntryRepository ledger;
    @Autowired CreditGrantRepository grants;
    @Autowired CreditCampaignRepository campaigns;
    @Autowired CreditAdjustmentRequestRepository requests;
    @Autowired AuditLogRepository audits;
    @Autowired ObjectMapper mapper;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseCreditLotService lots;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseBillingService billing;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService recovery;

    private final Instant campaignEnd=Instant.now().plus(60,ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);

    @BeforeEach void setup() throws Exception {
        audits.deleteAll();requests.deleteAll();ledger.deleteAll();grants.deleteAll();campaigns.deleteAll();wallets.deleteAll();users.deleteAll();admins.deleteAll();
        admins.saveAndFlush(AdminUser.builder().id("root").username("root").role(AdminUser.AdminRole.SUPER_ADMIN).status(AdminUser.AdminStatus.ACTIVE).build());
        admins.saveAndFlush(AdminUser.builder().id("ops").username("ops").role(AdminUser.AdminRole.OPERATOR).status(AdminUser.AdminStatus.ACTIVE).build());
        customer("rich",5000,10000,200);   // gift + license above keep, plus paid recharge
        customer("small",800,0,0);         // already below the kept balance
        customer("paid",0,0,5000);         // only paid recharge: never converted
        var h3=new ModelBillingTarget("endpoint","model","ai-jusuan-minimax-h3","minimax-h3","*","call");
        var campaign=new CreditCampaign();campaign.setId("h3");campaign.setName("H3 体验赠款");campaign.setTargetsJson(mapper.writeValueAsString(List.of(h3)));
        campaign.setResourceUnit("credit");campaign.setTotalIssueLimit(100000);campaign.setPerWalletIssueLimit(20000);
        campaign.setResourceLimit(java.math.BigDecimal.valueOf(100000));campaign.setPerWalletDailyResourceLimit(java.math.BigDecimal.valueOf(20000));
        campaign.setMaxConcurrentPerWallet(100);campaign.setActive(true);campaign.setStartsAt(Instant.now().minusSeconds(60));
        campaign.setExpiresAt(campaignEnd);campaign.setUpdatedAt(Instant.now());campaigns.saveAndFlush(campaign);
    }
    private void customer(String id,long gift,long license,long recharge) {
        users.saveAndFlush(AepUser.builder().id(id).username(id).displayName("客户 "+id).status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        wallets.saveAndFlush(Wallet.builder().id("w-"+id).userId(id).giftBalance(gift).licenseBalance(license).rechargeBalance(recharge)
                .totalBalance(gift+license+recharge).build());
    }
    private ModelGrantConversionService.Request request(String batch,List<String> ids) {
        return new ModelGrantConversionService.Request(batch,"h3",1000,30,ids,"H3 体验，保留 10 元通用余额");
    }
    private Wallet wallet(String id){return wallets.findById("w-"+id).orElseThrow();}

    @Test void convertsGiftAndLicenseAboveTheKeptBalanceButNeverPaidRecharge() {
        var plan=conversions.preview(List.of("rich","small","paid"),1000);
        assertEquals(List.of(14200L,0L,0L),plan.stream().map(ModelGrantConversionService.Line::amount).toList());
        assertEquals(15200,wallet("rich").getTotalBalance(),"preview must not change balances");

        var result=conversions.execute(request("batch-0001",List.of("rich","small","paid")),"root");
        assertEquals(List.of("converted","nothing","nothing"),result.stream().map(ModelGrantConversionService.Line::status).toList());
        var rich=wallet("rich");
        assertEquals(1000,rich.getTotalBalance());assertEquals(0,rich.getGiftBalance());assertEquals(800,rich.getLicenseBalance());assertEquals(200,rich.getRechargeBalance());
        assertEquals(5000,wallet("paid").getRechargeBalance());assertEquals(800,wallet("small").getTotalBalance());
        var grant=grants.findAll().get(0);
        assertEquals("w-rich",grant.getWalletId());assertEquals(14200,grant.getAmount());assertEquals(14200,grant.getAvailable());
        assertFalse(grant.getExpiresAt().isAfter(Instant.now().plus(30,ChronoUnit.DAYS)));
        var rows=ledger.findAll().stream().filter(e->"w-rich".equals(e.getWalletId())).toList();
        assertEquals(1,rows.stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.ADJUST&&e.getAmount()==-14200
                &&ModelGrantConversionService.SOURCE.equals(e.getReferenceType())).count());
        assertEquals(1,rows.stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.SCOPED_GRANT&&e.getAmount()==14200).count());
        assertEquals(1,audits.count());
    }

    @Test void repeatingTheSameBatchNeverConvertsTwice() {
        conversions.execute(request("batch-0002",List.of("rich")),"root");
        var again=conversions.execute(request("batch-0002",List.of("rich")),"root");
        assertEquals("already",again.get(0).status());assertEquals(14200,again.get(0).amount());
        assertEquals(1000,wallet("rich").getTotalBalance());assertEquals(1,grants.count());
        assertEquals(1,ledger.findAll().stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.ADJUST).count());
    }

    @Test void onlyActiveSuperAdminsMayConvert() {
        var e=assertThrows(BusinessException.class,()->conversions.execute(request("batch-0003",List.of("rich")),"ops"));
        assertEquals("GRANT_CONVERSION_FORBIDDEN",e.getCode());assertEquals(15200,wallet("rich").getTotalBalance());assertEquals(0,grants.count());
    }

    @Test void aCustomerThatCannotBeGrantedRollsBackAloneWhileOthersConvert() {
        customer("other",3000,0,0);
        var campaign=campaigns.findById("h3").orElseThrow();campaign.setPerWalletIssueLimit(5000);campaigns.saveAndFlush(campaign);
        var result=conversions.execute(request("batch-0004",List.of("rich","other")),"root");
        assertEquals("failed",result.get(0).status());assertTrue(result.get(0).message().startsWith("SCOPED_GRANT_LIMIT"));
        assertEquals(15200,wallet("rich").getTotalBalance(),"the withdrawal rolls back with the refused grant");
        assertEquals("converted",result.get(1).status());assertEquals(1000,wallet("other").getTotalBalance());
        assertEquals(1,grants.count());
    }

    @Test void candidatesAreCustomersWithRecentApprovedGifts() {
        requests.saveAndFlush(CreditAdjustmentRequest.builder().id("g1").type(CreditAdjustmentRequest.Type.GRANT).targetUserId("rich").amount(5000)
                .reason("体验").makerId("root").status(CreditAdjustmentRequest.Status.APPROVED).createdAt(Instant.now().minus(1,ChronoUnit.DAYS)).build());
        requests.saveAndFlush(CreditAdjustmentRequest.builder().id("g2").type(CreditAdjustmentRequest.Type.GRANT).targetUserId("paid").amount(5000)
                .reason("太早").makerId("root").status(CreditAdjustmentRequest.Status.APPROVED).createdAt(Instant.now().minus(10,ChronoUnit.DAYS)).build());
        requests.saveAndFlush(CreditAdjustmentRequest.builder().id("g3").type(CreditAdjustmentRequest.Type.GRANT).targetUserId("small").amount(9000)
                .reason("待审").makerId("ops").status(CreditAdjustmentRequest.Status.PENDING_APPROVAL).createdAt(Instant.now()).build());
        var found=conversions.candidates(3,1000);
        assertEquals(List.of("rich"),found.stream().map(ModelGrantConversionService.Line::userId).toList());
        assertEquals(14200,found.get(0).amount());
    }
}
