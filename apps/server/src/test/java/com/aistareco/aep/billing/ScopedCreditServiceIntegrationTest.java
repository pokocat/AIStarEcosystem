package com.aistareco.aep.billing;

import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real transactions: grant limits, scope checks, partial settlement, expiry and shared resource races. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:model-scoped;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST;LOCK_TIMEOUT=10000"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@Import({ScopedCreditService.class,ModelPricingService.class,ModelChargeService.class,
        com.aistareco.aep.service.CreditOpsService.class,
        com.aistareco.aep.service.CreditService.class,ScopedCreditServiceIntegrationTest.Config.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class ScopedCreditServiceIntegrationTest {
    @org.springframework.test.context.DynamicPropertySource
    static void database(org.springframework.test.context.DynamicPropertyRegistry properties) {
        String url=System.getProperty("model-scoped.jdbc","jdbc:h2:mem:model-scoped;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST;LOCK_TIMEOUT=10000");
        properties.add("spring.datasource.url",()->url);
        properties.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        properties.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        properties.add("spring.datasource.password",()->"");
    }
    @TestConfiguration static class Config {@Bean ObjectMapper mapper(){return new ObjectMapper().findAndRegisterModules();}}
    @Autowired ScopedCreditService service;
    @Autowired CreditCampaignRepository campaigns;
    @Autowired CreditGrantRepository grants;
    @Autowired com.aistareco.aep.ipstudio.repository.IpRunRepository tokenRuns;
    @Autowired CreditGrantHoldRepository allocations;
    @Autowired CreditResourceReservationRepository resources;
    @Autowired ModelChargeRepository charges;
    @Autowired ModelChargeService charging;
    @Autowired ModelDiscountRepository discounts;
    @Autowired ModelPriceRepository prices;
    @Autowired com.aistareco.aep.service.CreditService credits;
    @Autowired com.aistareco.aep.service.CreditOpsService operations;
    @Autowired CreditAdjustmentRequestRepository requests;
    @Autowired AdminUserRepository admins;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseCreditLotService enterpriseLots;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService enterpriseRecovery;
    @Autowired WalletRepository wallets;
    @Autowired CreditHoldRepository holds;
    @Autowired LedgerEntryRepository ledger;
    @Autowired ObjectMapper mapper;
    @Autowired PlatformTransactionManager transactions;
    private TransactionTemplate tx;
    private final ModelBillingTarget target=new ModelBillingTarget("aiavatar","image","endpoint-a","model-a","standard","image");
    private final Instant expires=Instant.parse("2030-01-01T00:00:00Z");

    @BeforeEach void setup() throws Exception {
        tx=new TransactionTemplate(transactions);
        requests.deleteAll();admins.deleteAll();tokenRuns.deleteAll();
        charges.deleteAll();discounts.deleteAll();prices.deleteAll();resources.deleteAll();allocations.deleteAll();ledger.deleteAll();grants.deleteAll();holds.deleteAll();campaigns.deleteAll();wallets.deleteAll();
        for(String user:List.of("one","two"))wallets.saveAndFlush(Wallet.builder().id(user).userId(user).totalBalance(100).rechargeBalance(100).build());
        campaign("campaign",1000,500,10);
        for(String id:List.of("operator","checker","super"))admins.saveAndFlush(AdminUser.builder().id(id).username(id)
                .role("super".equals(id)?AdminUser.AdminRole.SUPER_ADMIN:AdminUser.AdminRole.OPERATOR)
                .status(AdminUser.AdminStatus.ACTIVE).build());
    }

    @Test void grantsAreSeparateFromWalletAndIdempotentWithConflictingReplayRejected() {
        var g=grant("one",100,"request");assertEquals(g.getId(),grant("one",100,"request").getId());
        assertEquals(1,grants.count());assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
        assertEquals(0,wallets.findById("one").orElseThrow().getGiftBalance());
        assertEquals("SCOPED_GRANT_REPLAY_MISMATCH",assertThrows(BusinessException.class,()->grant("one",101,"request")).getCode());
        assertEquals(0,ledger.sumTotalCreditsIssued());
        var entry=ledger.findAll().get(0);assertEquals(g.getId(),entry.getGrantId());assertNull(entry.getCashArtifactId());
    }

    @Test void onlyEndpointAndWalletDetermineAllowanceEligibility() {
        grant("one",100,"request");
        assertEquals(30,service.preview("one",target,30,true,Instant.now()).credits());
        assertEquals(0,service.preview("two",target,30,true,Instant.now()).credits());
        assertEquals(0,service.preview("one",target,30,false,Instant.now()).credits());
        assertEquals(0,service.preview("one",new ModelBillingTarget("aiavatar","image","endpoint-b","model-a","standard","image"),30,true,Instant.now()).credits());
        assertEquals(30,service.preview("one",new ModelBillingTarget("drama","dialogue","endpoint-a","model-a","high","ktoken"),30,true,Instant.now()).credits());
        assertEquals(0,service.preview("one",target,30,true,expires).credits());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints={0,2,3,4})
    void endpointCreditExtensionsUseOriginalDiscountAndRoundTheWholeInvoiceOnce(int actual) throws Exception {
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setResourceUnit("credit");campaigns.saveAndFlush(campaign);
        var wallet=wallets.findById("one").orElseThrow();wallet.setTotalBalance(0);wallet.setRechargeBalance(0);wallets.saveAndFlush(wallet);
        grant("one",2,"qwen-budget");
        var discount=new ModelDiscount();discount.setId("credit-discount");discount.setName("Endpoint discount");discount.setTargetKey(target.endpointKey());
        discount.setTargetJson(mapper.writeValueAsString(target));discount.setAudience("all");discount.setFactor(new BigDecimal("0.5"));discount.setAllowGrants(true);
        discount.setStartsAt(Instant.now().minusSeconds(10));discount.setExpiresAt(expires);discount.setActive(true);discount.setUpdatedAt(Instant.now());discounts.saveAndFlush(discount);
        var endpoint=AiModelEndpoint.builder().id(target.endpointId()).model(target.providerModel()).build();
        var context=ModelChargeContext.forCredits(endpoint,1);
        assertEquals(4,credits.availableModelCredits(wallet,context.target()));
        credits.hold("one",1,"test","credit-root","Root",context);
        discount.setFactor(BigDecimal.ONE);discounts.saveAndFlush(discount);
        credits.holdExtension("test","credit-root","credit-1",1,"Extension",null);
        assertEquals(1,grants.findAll().get(0).getFrozen()); // No extra rounded debit for this extension.
        credits.holdExtension("test","credit-root","credit-2",1,"Extension",null);
        assertEquals(1,credits.availableExtensionCredits("test","credit-root"));
        credits.holdExtension("test","credit-root","credit-3",1,"Extension",null);
        var refs=List.of("credit-root","credit-1","credit-2","credit-3");
        assertEquals(2,charges.findAll().stream().mapToLong(ModelCharge::getPayableCredits).sum());
        assertTrue(credits.settleModelCredits("test",refs,actual));
        long paid=(actual+1)/2;
        var receipt=charging.breakdown("test",refs);assertEquals(paid,receipt.spent().scopedCredits());assertEquals(0,receipt.spent().walletCredits());
        assertEquals(0,receipt.pending().scopedCredits());assertEquals(0,receipt.pending().walletCredits());
        assertEquals(2-paid,grants.findAll().get(0).getAvailable());assertEquals(paid,grants.findAll().get(0).getSpent());
        long count=ledger.count();assertTrue(credits.settleModelCredits("test",refs,actual));assertEquals(count,ledger.count());
        assertEquals(0,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void sameQwenEndpointAcrossAppsActionsAndMeteringUsesOneGrantWhileAnotherEndpointUsesBalance() throws Exception {
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setResourceUnit("credit");campaigns.saveAndFlush(campaign);
        grant("one",100,"qwen");
        var image=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"endpoint-price",false,10L,null);
        var dialogueTarget=new ModelBillingTarget("drama","dialogue",target.endpointId(),target.providerModel(),"script","ktoken");
        var dialogue=new ModelChargeContext(dialogueTarget,new ModelBillingMath.Usage(BigDecimal.ONE,BigDecimal.ONE),BigDecimal.valueOf(5),BigDecimal.valueOf(5),"endpoint-price",false,10L,null);
        var other=new ModelChargeContext(new ModelBillingTarget("drama","text","another-qwen",target.providerModel(),"script","call"),
                new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"endpoint-price",false,10L,null);
        credits.hold("one",10,"test","image","入口一",image);credits.hold("one",10,"test","dialogue","入口二",dialogue);
        credits.hold("one",10,"test","another-endpoint","同名的另一个接入点",other);
        assertEquals(20,grants.findAll().get(0).getFrozen());assertEquals(90,wallets.findById("one").orElseThrow().getRechargeBalance());
        credits.commitHold("test","image",10,"完成",image.usage());credits.commitHold("test","dialogue",10,"完成",dialogue.usage());
        assertEquals(20,grants.findAll().get(0).getSpent());assertEquals(0,resources.count());
    }

    @Test void concurrentIssuanceAcrossWalletsCannotExceedCampaignTotal() throws Exception {
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setTotalIssueLimit(150);campaigns.saveAndFlush(campaign);
        var outcomes=race(()->grantOutcome("one","request-one"),()->grantOutcome("two","request-two"));
        assertEquals(Set.of("ok","SCOPED_GRANT_LIMIT"),new HashSet<>(outcomes));
        assertEquals(100,campaigns.findById("campaign").orElseThrow().getIssued());assertEquals(1,grants.count());
    }

    @Test void concurrentReservationsAcrossWalletsCannotExceedPhysicalResources() throws Exception {
        grant("one",100,"one");grant("two",100,"two");
        var outcomes=race(()->reserveOutcome("one","h1",6),()->reserveOutcome("two","h2",6));
        assertEquals(Set.of("ok","SCOPED_RESOURCE_LIMIT"),new HashSet<>(outcomes));
        assertEquals(0,new BigDecimal("6").compareTo(campaigns.findById("campaign").orElseThrow().getResourceReserved()));
        assertEquals(1,allocations.count());assertEquals(1,resources.count());assertEquals(1,holds.count());
        assertEquals(180,grants.findAll().stream().mapToLong(CreditGrant::getAvailable).sum());
    }

    @Test void partialSettlementReturnsUnspentAllowanceToOriginalLotsAndExpiryNeverRevivesIt() {
        var first=service.grant("one","campaign",15,expires.minusSeconds(60),"test","first","test","operator");
        var second=grant("one",50,"second");reserve("one","hold",40,3);
        inHold("hold",(wallet,hold)->service.consume(wallet,hold,20,Instant.now()));
        assertEquals(15,grants.findById(first.getId()).orElseThrow().getSpent());
        assertEquals(5,grants.findById(second.getId()).orElseThrow().getSpent());
        inHold("hold",(wallet,hold)->service.release(wallet,hold,expires.plusSeconds(1)));
        var g=grants.findById(second.getId()).orElseThrow();assertEquals(0,g.getAvailable());assertEquals(0,g.getFrozen());assertEquals(45,g.getExpired());
        long rows=ledger.count();inHold("hold",(wallet,hold)->service.release(wallet,hold,expires.plusSeconds(2)));assertEquals(rows,ledger.count());
        assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void unsubmittedCancellationRestoresResourceButDispatchedFailureConsumesResourceEvenWhenCustomerRefunded() {
        grant("one",100,"one");reserve("one","unsubmitted",20,3);
        inHold("unsubmitted",(w,h)->{service.release(w,h,Instant.now());service.finishResources(h.getId(),null,Instant.now());});
        assertEquals(0,BigDecimal.ZERO.compareTo(campaigns.findById("campaign").orElseThrow().getResourceReserved()));
        assertEquals(0,BigDecimal.ZERO.compareTo(campaigns.findById("campaign").orElseThrow().getResourceUsed()));
        reserve("one","submitted",20,3);
        inHold("submitted",(w,h)->service.markDispatched(h.getId(),Instant.now()));
        inHold("submitted",(w,h)->{service.release(w,h,Instant.now());service.finishResources(h.getId(),null,Instant.now());});
        assertEquals(100,grants.findAll().get(0).getAvailable());
        assertEquals(0,new BigDecimal("3").compareTo(campaigns.findById("campaign").orElseThrow().getResourceUsed()));
    }

    @Test void dailyAndConcurrentLimitsSurviveSeparateRequestsAndRelease() {
        grant("one",100,"one");
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setMaxConcurrentPerWallet(1);campaign.setPerWalletDailyResourceLimit(new BigDecimal("4"));campaigns.saveAndFlush(campaign);
        reserve("one","h1",20,3);
        assertEquals("SCOPED_CONCURRENT_LIMIT",assertThrows(BusinessException.class,()->reserve("one","h2",20,1)).getCode());
        inHold("h1",(w,h)->{service.markDispatched(h.getId(),Instant.now());service.finishResources(h.getId(),null,Instant.now());});
        assertEquals("SCOPED_RESOURCE_LIMIT",assertThrows(BusinessException.class,()->reserve("one","h3",20,2)).getCode());
    }

    @Test void discountThenAllowanceUsesFrozenPriceAndCumulativeActualUsage() {
        grant("one",15,"one");
        var discount=new ModelDiscount();discount.setId("discount");discount.setName("八折");discount.setTargetKey(target.endpointKey());discount.setTargetJson("{}");
        discount.setAudience("all");discount.setFactor(new BigDecimal("0.8"));discount.setAllowGrants(true);discount.setActive(true);
        discount.setStartsAt(Instant.parse("2020-01-01T00:00:00Z"));discount.setExpiresAt(expires);discounts.saveAndFlush(discount);
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),new BigDecimal("10"),null,"price-v1",false,9L,null);
        var quote=charging.quote(wallets.findById("one").orElseThrow(),context);
        assertEquals(30,quote.standardCredits());assertEquals(24,quote.payableCredits());assertEquals(15,quote.scopedCredits());assertEquals(9,quote.walletCredits());
        tx.executeWithoutResult(status->{
            var wallet=wallets.findByIdForUpdate("one").orElseThrow();var hold=hold("one","priced",30);holds.saveAndFlush(hold);
            assertEquals(9,charging.reserve(wallet,hold,context,Instant.now(),null));
        });
        discount=discounts.findById("discount").orElseThrow();discount.setFactor(new BigDecimal("0.1"));discounts.saveAndFlush(discount);
        inHold("priced",(w,h)->{
            var first=charging.consume(w,h,10,new ModelBillingMath.Usage(BigDecimal.ONE,null),Instant.now());
            assertEquals(8,first.scoped());assertEquals(0,first.ordinary());
            var second=charging.consume(w,h,10,new ModelBillingMath.Usage(new BigDecimal("2"),null),Instant.now());
            assertEquals(7,second.scoped());assertEquals(1,second.ordinary());assertEquals(8,second.ordinaryRemaining());
            assertEquals(8,charging.release(w,h,Instant.now()));
        });
        assertEquals(16,charges.findById("priced").orElseThrow().getSettledPayableCredits());
        assertEquals(15,grants.findAll().get(0).getSpent());
    }

    @Test void freeOnlyFailureRollsBackAllGrantAndResourceReservations() {
        grant("one",15,"one");
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),new BigDecimal("10"),null,"v1",true,0L,null);
        assertEquals("SCOPED_CREDITS_INSUFFICIENT",assertThrows(BusinessException.class,()->tx.executeWithoutResult(status->{
            var wallet=wallets.findByIdForUpdate("one").orElseThrow();var hold=hold("one","free",30);holds.saveAndFlush(hold);
            charging.reserve(wallet,hold,context,Instant.now(),null);
        })).getCode());
        assertEquals(0,holds.count());assertEquals(0,allocations.count());assertEquals(0,resources.count());
        assertEquals(15,grants.findAll().get(0).getAvailable());assertEquals(1,ledger.count());
    }

    @Test void realWalletHoldPartialSpendAndReleasePreserveEverySource() {
        grant("one",15,"one");
        var discount=new ModelDiscount();discount.setId("wallet-discount");discount.setName("八折");discount.setTargetKey(target.endpointKey());discount.setTargetJson("{}");
        discount.setAudience("all");discount.setFactor(new BigDecimal("0.8"));discount.setAllowGrants(true);discount.setActive(true);
        discount.setStartsAt(Instant.parse("2020-01-01T00:00:00Z"));discount.setExpiresAt(expires);discounts.saveAndFlush(discount);
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),new BigDecimal("10"),null,"v1",false,9L,null);
        var hold=credits.hold("one",30,"test","wallet-hold","三张图片",context);
        assertEquals(30,hold.getAmount());assertEquals(9,hold.getFromRecharge());
        var wallet=wallets.findById("one").orElseThrow();assertEquals(91,wallet.getTotalBalance());assertEquals(9,wallet.getPendingBalance());
        assertEquals(15,grants.findAll().get(0).getFrozen());
        var reserved=charging.breakdown("test",List.of("wallet-hold"));
        assertEquals(15,reserved.pending().scopedCredits());assertEquals(9,reserved.pending().walletCredits());assertEquals(24,reserved.displayedCost());
        assertEquals(hold.getId(),credits.hold("one",30,"test","wallet-hold","三张图片",context).getId());
        credits.markModelDispatched("test","wallet-hold");
        credits.commitHold("test","wallet-hold",10,"第一张",new ModelBillingMath.Usage(BigDecimal.ONE,null));
        credits.commitHold("test","wallet-hold",10,"第二张",new ModelBillingMath.Usage(new BigDecimal("2"),null));
        credits.releaseHold("test","wallet-hold","第三张未完成");
        wallet=wallets.findById("one").orElseThrow();assertEquals(99,wallet.getTotalBalance());assertEquals(0,wallet.getPendingBalance());
        assertEquals(99,wallet.getRechargeBalance());assertEquals(15,grants.findAll().get(0).getSpent());
        long rows=ledger.count();credits.releaseHold("test","wallet-hold","重复释放");assertEquals(rows,ledger.count());
        assertEquals(-1,ledger.sumAmountByType(LedgerEntry.LedgerEntryType.SPEND));
        assertEquals(-15,ledger.sumAmountByType(LedgerEntry.LedgerEntryType.SCOPED_SPEND));
        var actual=charging.breakdown("test",List.of("wallet-hold"));
        assertEquals(15,actual.spent().scopedCredits());assertEquals(1,actual.spent().walletCredits());
        assertEquals(0,actual.pending().scopedCredits());assertEquals(0,actual.pending().walletCredits());
        assertEquals(8,actual.released().walletCredits());assertEquals(16,actual.displayedCost());
    }

    @Test void textWorkflowUsesRealTokensOriginalDiscountAndGrantThenRefundsUnusedOrdinaryCredits() throws Exception {
        var endpoint=AiModelEndpoint.builder().id("text-route").model("text-v1").baseUrl("https://text.invalid").enabled(true).build();
        var rate=new com.aistareco.aep.service.AiChatTokenPricing.Rate(BigDecimal.valueOf(2),BigDecimal.valueOf(4),10000,10000);
        var context=com.aistareco.aep.ipstudio.service.StudioTokenBilling.plan(endpoint,rate);
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setTargetsJson(mapper.writeValueAsString(List.of(context.target())));
        campaign.setResourceUnit("credit");campaign.setResourceLimit(BigDecimal.valueOf(100));campaign.setPerWalletDailyResourceLimit(BigDecimal.valueOf(100));campaigns.saveAndFlush(campaign);
        grant("one",3,"text-grant");
        var discount=new ModelDiscount();discount.setId("text-discount");discount.setName("文字五折");discount.setTargetKey(context.target().endpointKey());
        discount.setTargetJson(mapper.writeValueAsString(context.target()));discount.setAudience("all");discount.setFactor(new BigDecimal("0.5"));discount.setAllowGrants(true);
        discount.setStartsAt(Instant.now().minusSeconds(10));discount.setExpiresAt(expires);discount.setActive(true);discount.setUpdatedAt(Instant.now());discounts.saveAndFlush(discount);
        String id="token-workflow";
        var input=mapper.createObjectNode().put("operation","text").put("mock",false);
        var execution=input.putObject("_exec").put("endpointId",endpoint.getId()).put("systemPrompt","system").put("userPrompt","user").put("maxTokens",10000);
        execution.set("tokenPricing",mapper.valueToTree(rate));com.aistareco.aep.ipstudio.service.StudioTokenBilling.store(execution,context,endpoint);
        credits.hold("one",60,"ip-run",id,"文字创作",context);
        tokenRuns.saveAndFlush(com.aistareco.aep.ipstudio.model.IpRun.builder().id(id).ownerUserId("one").projectId("local").nodeId("text-node")
                .kind("studio-text").status("running").stage("queued").cost(60).inputJson(input.toString()).outputJson("{}").createdAt(Instant.now()).build());
        assertEquals(73,wallets.findById("one").orElseThrow().getRechargeBalance());assertEquals(27,wallets.findById("one").orElseThrow().getPendingBalance());
        discount.setFactor(new BigDecimal("0.9"));discounts.saveAndFlush(discount); // Accepted work keeps its original five-fold price.
        var models=org.mockito.Mockito.mock(com.aistareco.aep.service.AiModelInvocationService.class);
        org.mockito.Mockito.when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,endpoint.getId(),"studio"))
                .thenReturn(Optional.of(new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        org.mockito.Mockito.when(models.invokeChatOnEndpoint(org.mockito.ArgumentMatchers.eq(endpoint),org.mockito.ArgumentMatchers.eq(AiModelPurpose.DAP_PERSONA),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn(new com.aistareco.aep.service.AiModelInvocationService.AiModelResponse("{\"summary\":\"完成\",\"content\":\"新正文\"}","stop",2750L,"text-v1","test",1500L,1250L));
        var worker=new com.aistareco.aep.ipstudio.service.StudioWorkflowWorker(tokenRuns,org.mockito.Mockito.mock(com.aistareco.aep.ipstudio.service.StudioFixtureProvider.class),
                org.mockito.Mockito.mock(com.aistareco.aep.service.storage.FileStorageService.class),models,org.mockito.Mockito.mock(com.aistareco.aep.service.DramaAssembleService.class),
                credits,mapper,transactions,org.mockito.Mockito.mock(com.aistareco.aep.dap.service.DapAssetService.class));
        org.springframework.test.util.ReflectionTestUtils.setField(worker,"modelCharges",charging);
        worker.runBlocking(id);worker.runBlocking(id);
        var run=tokenRuns.findById(id).orElseThrow();assertEquals("done",run.getStatus());assertEquals(8,run.getCost());
        assertEquals(4,mapper.readTree(run.getOutputJson()).path("billing").path("credits").asLong());
        assertEquals(3,grants.findAll().get(0).getSpent());assertEquals(99,wallets.findById("one").orElseThrow().getRechargeBalance());
        assertEquals(0,wallets.findById("one").orElseThrow().getPendingBalance());
        var bill=charging.breakdown("ip-run",List.of(id));assertEquals(3,bill.spent().scopedCredits());assertEquals(1,bill.spent().walletCredits());assertEquals(26,bill.released().walletCredits());
        assertEquals(0,resources.count());
        org.mockito.Mockito.verify(models,org.mockito.Mockito.times(1)).invokeChatOnEndpoint(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyMap());
    }

    @Test void zeroOrdinaryBalanceCanUseOnlyScopedCreditsAndUnrelatedOperationsCannot() {
        var wallet=wallets.findById("one").orElseThrow();wallet.setTotalBalance(0);wallet.setRechargeBalance(0);wallets.saveAndFlush(wallet);
        grant("one",30,"one");
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),new BigDecimal("10"),null,"v1",true,0L,null);
        var hold=credits.hold("one",30,"test","scoped-only","三张图片",context);
        assertEquals(0,wallets.findById("one").orElseThrow().getPendingBalance());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->credits.hold("one",1,"test","publish","分发",ModelChargeContext.NONE));
        credits.markModelDispatched("test","scoped-only");
        credits.commitHold("test","scoped-only",30,"三张完成",new ModelBillingMath.Usage(new BigDecimal("3"),null));
        assertEquals(CreditHold.Status.COMMITTED,holds.findById(hold.getId()).orElseThrow().getStatus());
        assertEquals(30,grants.findAll().get(0).getSpent());assertEquals(0,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void completingRoundedBaseAmountRefundsUnconsumedPricedUsage() {
        // Legacy base price rounds both 0.1 and 1 unit to one credit; the configured rate is 10.
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"endpoint-v1",false,10L,null);
        var hold=credits.hold("one",1,"test","rounded-base","预占",context);
        assertEquals(10,wallets.findById("one").orElseThrow().getPendingBalance());
        credits.commitHold("test","rounded-base",1,"完成",new ModelBillingMath.Usage(new BigDecimal("0.1"),null));
        var wallet=wallets.findById("one").orElseThrow();
        assertEquals(0,wallet.getPendingBalance());assertEquals(99,wallet.getTotalBalance());assertEquals(99,wallet.getRechargeBalance());
        assertEquals(CreditHold.Status.COMMITTED,holds.findById(hold.getId()).orElseThrow().getStatus());
        assertEquals(9,ledger.sumAmountByType(LedgerEntry.LedgerEntryType.UNFREEZE));
    }

    @Test void completingRoundedBaseAmountReturnsUnusedScopedAllocation() {
        grant("one",10,"one");
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"v1",true,0L,null);
        credits.hold("one",1,"test","rounded-scoped","预占",context);
        credits.commitHold("test","rounded-scoped",1,"完成",new ModelBillingMath.Usage(new BigDecimal("0.1"),null));
        var grant=grants.findAll().get(0);
        assertEquals(0,grant.getFrozen());assertEquals(1,grant.getSpent());assertEquals(9,grant.getAvailable());
    }

    @Test void quoteReportsResourceExhaustionWithoutSilentlyChargingOrdinaryCredits() {
        grant("one",100,"one");grant("two",100,"two");reserve("two","occupied",30,10);
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"v1",false,10L,null);
        var quote=charging.quote(wallets.findById("one").orElseThrow(),context);
        assertEquals(10,quote.scopedCredits());assertEquals(0,quote.walletCredits());assertFalse(quote.canAfford());
        assertEquals("SCOPED_RESOURCE_LIMIT",quote.unavailableCode());
        assertEquals(100,grants.findByWalletIdOrderByExpiresAtAscIdAsc("one").get(0).getAvailable());
    }

    @Test void measuredProviderUsageAndCustomerSettlementCloseTogether() {
        grant("one",30,"one");
        var context=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),BigDecimal.TEN,null,"v1",true,0L,null);
        var hold=credits.hold("one",30,"test","measured","预占",context);
        credits.markModelDispatched("test","measured");
        tx.executeWithoutResult(status->{
            credits.finishModelResources("test","measured",BigDecimal.ONE);
            credits.commitHold("test","measured",10,"一张完成",new ModelBillingMath.Usage(BigDecimal.ONE,null));
            credits.releaseHold("test","measured","未用额度");
        });
        var resource=resources.findByHoldIdOrderByCampaignIdAsc(hold.getId()).get(0);
        assertEquals(0,BigDecimal.ONE.compareTo(resource.getUsed()));assertEquals(0,new BigDecimal("2").compareTo(resource.getReleased()));
        assertEquals(10,grants.findAll().get(0).getSpent());assertEquals(20,grants.findAll().get(0).getAvailable());
    }

    @Test void scopedOperationsRetryReturnsOriginalGrantAndLeavesOrdinaryMoneyUnchanged() {
        var first=operations.grantScoped("one","campaign",100,expires,"click-1","欢迎体验","operator");
        var replay=operations.grantScoped("one","campaign",100,expires,"click-1","欢迎体验","operator");
        assertEquals("approved",first.status());assertEquals(first.id(),replay.id());assertNotNull(first.grantId());
        assertNotNull(first.ledgerEntryId());assertEquals(1,requests.count());assertEquals(1,grants.count());assertEquals(1,ledger.count());
        assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
        assertEquals(0,wallets.findById("one").orElseThrow().getGiftBalance());
        assertEquals("SCOPED_GRANT_REPLAY_MISMATCH",assertThrows(BusinessException.class,
                ()->operations.grantScoped("two","campaign",100,expires,"click-1","欢迎体验","operator")).getCode());
    }

    @Test void scopedLargeGrantRequiresIndependentApprovalAndOnlyCreditsOnce() throws Exception {
        campaign("campaign",100000,100000,10);
        var pending=operations.grantScoped("one","campaign",6000,expires,"large","测试审批","operator");
        assertEquals("pending_approval",pending.status());assertEquals(0,grants.count());assertEquals(0,ledger.count());
        assertEquals("MAKER_CHECKER_SAME",assertThrows(BusinessException.class,()->operations.approve(pending.id(),"operator")).getCode());
        var outcomes=race(()->approveOutcome(pending.id()),()->approveOutcome(pending.id()));
        assertEquals(Set.of("ok","REQUEST_NOT_PENDING"),new HashSet<>(outcomes));
        assertEquals(1,grants.count());assertEquals(6000,grants.findAll().get(0).getAvailable());
        assertEquals("approved",operations.grantScoped("one","campaign",6000,expires,"large","测试审批","operator").status());
        assertEquals(1,ledger.count());
    }

    @Test void approvalRechecksActivityAndRollsBackWithoutMarkingApproved() throws Exception {
        campaign("campaign",100000,100000,10);
        var pending=operations.grantScoped("one","campaign",6000,expires,"large","测试审批","operator");
        var row=campaigns.findById("campaign").orElseThrow();row.setActive(false);campaigns.saveAndFlush(row);
        assertEquals("SCOPED_GRANT_WINDOW_INVALID",assertThrows(BusinessException.class,()->operations.approve(pending.id(),"checker")).getCode());
        assertEquals(CreditAdjustmentRequest.Status.PENDING_APPROVAL,requests.findById(pending.id()).orElseThrow().getStatus());
        assertEquals(0,grants.count());assertEquals(0,ledger.count());
        operations.reject(pending.id(),"checker","活动结束");
        assertEquals("rejected",operations.grantScoped("one","campaign",6000,expires,"large","测试审批","operator").status());
    }

    @Test void pendingAndDirectGrantsShareConcurrentDailyLimit() throws Exception {
        campaign("campaign",100000,100000,10);
        var outcomes=race(()->scopedOutcome("one","first",30000,"operator"),()->scopedOutcome("two","second",30000,"operator"));
        assertEquals(Set.of("ok","ACTOR_DAILY_LIMIT"),new HashSet<>(outcomes));
        assertEquals(1,requests.count());assertEquals(0,grants.count());
        assertEquals("ACTOR_DAILY_LIMIT",assertThrows(BusinessException.class,
                ()->operations.grantGift("one",21000,null,"普通赠送也占同一限额","operator")).getCode());
    }

    @Test void concurrentDuplicateRequestsIssueOnceAndSuperAdminRetainsLimits() throws Exception {
        campaign("campaign",100000,100000,10);
        assertEquals(List.of("ok","ok"),race(()->scopedOutcome("one","same",30000,"super"),()->scopedOutcome("one","same",30000,"super")));
        assertEquals(1,requests.count());assertEquals(1,grants.count());assertEquals(1,ledger.count());
        assertEquals("ACTOR_DAILY_LIMIT",scopedOutcome("one","other",30000,"super"));
    }

    @Test void differentOperatorsAndIndependentCampaignsCanIssueConcurrently() throws Exception {
        campaign("independent",1000,500,10);
        var outcomes=race(()->scopedOutcome("one","one",100,"operator"),()->{
            operations.grantScoped("two","independent",100,expires,"two","独立活动","checker");return "ok";
        });
        assertEquals(List.of("ok","ok"),outcomes);assertEquals(2,grants.count());assertEquals(2,requests.count());
    }

    @Test void grantToEnterpriseMemberRemainsSeparateAndTreasuryCannotReceiveIt() {
        wallets.saveAndFlush(Wallet.builder().id("member").accountType("enterprise_member").enterpriseId("company").memberUserId("one").build());
        wallets.saveAndFlush(Wallet.builder().id("treasury").accountType("enterprise").enterpriseId("company").build());
        var result=operations.grantScoped("member","campaign",100,expires,"member-grant","企业模型体验","operator");
        assertEquals("one",result.targetUserId());assertEquals("member",result.walletId());
        assertEquals(0,service.preview("one",target,100,true,Instant.now()).credits());
        assertEquals(100,service.preview("member",target,100,true,Instant.now()).credits());
        assertEquals("SCOPED_GRANT_WALLET_INVALID",scopedOutcome("treasury","invalid",100,"operator"));
        assertEquals(1,requests.count());
    }

    /** Free use comes only from model grants: a zero list price is rejected even when the payer holds a matching grant. */
    @Test void zeroPriceIsRejectedSoFreeUseComesOnlyFromGrants() {
        grant("one",50,"free-grant");
        var zero=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.valueOf(2),null),BigDecimal.ZERO,null,"v1",false,null,null);
        var wallet=wallets.findById("one").orElseThrow();
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->charging.quoteRepeated(wallet,zero,2)).getCode());
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->credits.hold("one",2,"test","zero","零价任务",zero)).getCode());
        assertEquals(50,grants.findAll().get(0).getAvailable());assertEquals(0,holds.count());assertEquals(0,allocations.count());
        assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void quoteIsReadOnlyAndApprovalCapsRechargeWhenAnotherTaskUsesTheGrant() {
        grant("one",15,"quote-grant");
        var context=quoteContext(null);
        var quote=charging.quote(wallets.findById("one").orElseThrow(),context);
        assertTrue(quote.canAfford());assertEquals(15,quote.walletCredits());
        assertEquals(0,holds.count());assertEquals(0,allocations.count());assertEquals(0,resources.count());
        assertEquals(1,ledger.count());assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
        assertEquals(15,quote.approval().maxWalletCredits());
        var other=new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"v1",true,0L,null);
        credits.hold("one",10,"test","other", "另一请求",other);
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,
                ()->credits.hold("one",30,"test","approved","原确认价",quoteContext(quote.approval()))).getCode());
        assertEquals(1,holds.count());assertEquals(1,charges.count());
        assertEquals(5,grants.findAll().get(0).getAvailable());
        assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void approvedWalletTargetAndUsageCannotChangeAndPriceUpdatesRequireNewConfirmation() {
        var quote=charging.quote(wallets.findById("one").orElseThrow(),quoteContext(null));
        var approved=quoteContext(quote.approval());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,
                ()->credits.hold("two",30,"test","wrong-wallet","账户变化",approved)).getCode());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,()->new ModelChargeContext(
                new ModelBillingTarget("aiavatar","image","endpoint-b","model-a","standard","image"),approved.usage(),
                BigDecimal.TEN,null,"v1",false,100L,quote.approval())).getCode());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,()->new ModelChargeContext(
                target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"v1",false,100L,quote.approval())).getCode());
        var changed=new ModelChargeContext(target,approved.usage(),BigDecimal.ONE,null,"changed-endpoint-price",false,100L,quote.approval());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,
                ()->credits.hold("one",30,"test","changed-price","价格变化",changed)).getCode());
        assertEquals(0,holds.count());assertEquals(100,wallets.findById("one").orElseThrow().getTotalBalance());
    }

    @Test void approvalKeepsFreeOnlyAndAcceptedReplayUsesOriginalDecisionAfterPriceChanges() {
        grant("one",30,"free-grant");
        var request=new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),BigDecimal.TEN,null,"v1",true,0L,null);
        var quote=charging.quote(wallets.findById("one").orElseThrow(),request);
        assertTrue(quote.canAfford());assertEquals(0,quote.approval().maxWalletCredits());
        var approved=quoteContext(quote.approval());assertTrue(approved.freeOnly());assertEquals(0,approved.maxWalletCredits());
        var held=credits.hold("one",30,"test","accepted-quote","赠款",approved);
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setActive(false);campaigns.saveAndFlush(campaign);
        assertEquals(held.getId(),credits.hold("one",30,"test","accepted-quote","赠款",approved).getId());
        assertEquals(0,wallets.findById("one").orElseThrow().getPendingBalance());
        assertEquals(30,grants.findAll().get(0).getFrozen());assertEquals(1,holds.count());
    }

    @Test void h3ModelGrantCoversItsVideoSpecificationsWhileSeedanceUsesRechargeAndExpiryOnlyReclaimsTheGrant() throws Exception {
        var h3=new ModelBillingTarget("aiavatar","video","h3-channel","minimax-h3","t2v-768p","second");
        var otherH3=new ModelBillingTarget("aiavatar","video","h3-channel","minimax-h3","i2v-544p","second");
        var seedance=new ModelBillingTarget("aiavatar","video","seedance-channel","seedance","t2v-768p","second");
        var campaign=campaigns.findById("campaign").orElseThrow();campaign.setTargetsJson(mapper.writeValueAsString(List.of(h3.allSpecifications())));
        campaign.setResourceUnit("second");campaigns.saveAndFlush(campaign);var grant=grant("one",30,"h3-trial");
        assertEquals(20,service.preview("one",otherH3,20,true,Instant.now()).credits());
        assertEquals(0,service.preview("one",seedance,20,true,Instant.now()).credits());
        var usage=new ModelBillingMath.Usage(BigDecimal.valueOf(2),null);
        var paid=new ModelChargeContext(seedance,usage,BigDecimal.TEN,null,"v1",false,20L,null);
        credits.hold("one",20,"test","seedance-paid","Seedance",paid);
        credits.commitHold("test","seedance-paid",20,"完成",usage);
        assertEquals(80,wallets.findById("one").orElseThrow().getRechargeBalance());assertEquals(30,grants.findById(grant.getId()).orElseThrow().getAvailable());
        var free=new ModelChargeContext(otherH3,usage,BigDecimal.TEN,null,"v1",true,0L,null);
        credits.hold("one",20,"test","h3-free","H3",free);credits.commitHold("test","h3-free",20,"完成",usage);
        assertEquals(80,wallets.findById("one").orElseThrow().getRechargeBalance());assertEquals(10,grants.findById(grant.getId()).orElseThrow().getAvailable());
        service.expireWallet("one",expires.plusSeconds(1));
        assertEquals(0,grants.findById(grant.getId()).orElseThrow().getAvailable());assertEquals(10,grants.findById(grant.getId()).orElseThrow().getExpired());
        assertEquals(80,wallets.findById("one").orElseThrow().getRechargeBalance());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans={true,false})
    void dapTextAndMediaHaveSeparateEndpointGrantsAndTextRemainsPaidAfterMediaFailure(boolean mediaSucceeded) throws Exception {
        var models=org.mockito.Mockito.mock(com.aistareco.aep.service.AiModelInvocationService.class);
        var tokenPrice=org.mockito.Mockito.mock(com.aistareco.aep.service.AiChatTokenPricing.class);
        var jobs=org.mockito.Mockito.mock(com.aistareco.aep.dap.repository.DapJobRepository.class);
        var billing=new com.aistareco.aep.dap.service.DapModelBilling(models,tokenPrice,credits,jobs,
                org.mockito.Mockito.mock(com.aistareco.aep.dap.repository.DapLookRepository.class),
                org.mockito.Mockito.mock(com.aistareco.aep.dap.service.DapCatalogService.class),mapper);
        var image=AiModelEndpoint.builder().id(target.endpointId()).model(target.providerModel()).baseUrl("https://image.invalid").build();
        var text=AiModelEndpoint.builder().id("qwen").model("qwen").baseUrl("https://text.invalid")
                .upstreamApiKeyEncrypted(com.aistareco.common.AepCryptoUtil.encrypt("test-key")).build();
        org.mockito.Mockito.when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_IMAGE,"aiavatar")).thenReturn(Optional.of(image));
        org.mockito.Mockito.when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_PERSONA,"aiavatar")).thenReturn(Optional.of(text));
        org.mockito.Mockito.when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"qwen","aiavatar"))
                .thenReturn(Optional.of(new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(text,null,true)));
        org.mockito.Mockito.when(tokenPrice.find("qwen")).thenReturn(new com.aistareco.aep.service.AiChatTokenPricing.Rate(new BigDecimal("2"),new BigDecimal("4"),1000,1000));
        var textTarget=new ModelBillingTarget("aiavatar","text","qwen","qwen","standard","ktoken");
        var c=campaign("qwen-campaign",1000,500,1000);c.setResourceUnit("credit");c.setTargetsJson(mapper.writeValueAsString(List.of(textTarget)));campaigns.saveAndFlush(c);
        var gift=service.grant("one",c.getId(),20,expires,"test","qwen-gift","文本体验","operator");
        var discount=new ModelDiscount();discount.setId("qwen-discount");discount.setName("文本八折");discount.setTargetKey(textTarget.endpointKey());
        discount.setTargetJson(mapper.writeValueAsString(textTarget));discount.setFactor(new BigDecimal("0.8"));discount.setAudience("all");
        discount.setActive(true);discount.setAllowGrants(true);discount.setStartsAt(Instant.now().minusSeconds(60));discount.setExpiresAt(expires);discount.setUpdatedAt(Instant.now());discounts.saveAndFlush(discount);
        var job=com.aistareco.aep.dap.model.DapJob.builder().id("split-job").ownerUserId("one").type("generate").kind("生成形象").payload(Map.of()).build();
        tx.executeWithoutResult(st->billing.reserve(job,10));
        assertEquals(2,charges.count());assertEquals(90,wallets.findById("one").orElseThrow().getTotalBalance());
        assertEquals(5,grants.findById(gift.getId()).orElseThrow().getFrozen());
        // Changing the current default or discount never redirects the already accepted text call.
        org.mockito.Mockito.when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_PERSONA,"aiavatar")).thenReturn(Optional.of(image));
        discount.setFactor(BigDecimal.ONE);discounts.saveAndFlush(discount);
        org.mockito.Mockito.when(models.invokeChatOnEndpoint(org.mockito.ArgumentMatchers.eq(text),org.mockito.ArgumentMatchers.eq(AiModelPurpose.DAP_PERSONA),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any()))
                .thenReturn(new com.aistareco.aep.service.AiModelInvocationService.AiModelResponse("{\"name\":\"角色\"}","stop",878L,"qwen","qwen",751L,127L));
        var client=new com.aistareco.aep.dap.service.DapMultimodalClient(new com.aistareco.aep.dap.config.DapProperties(),models,
                org.mockito.Mockito.mock(com.aistareco.aep.service.AiModelUsageService.class),org.mockito.Mockito.mock(com.aistareco.aep.service.ai.UpstreamModelHttp.class),
                org.mockito.Mockito.mock(AiAppEndpointCandidateRepository.class));
        try(var execution=billing.open(job)){assertEquals("角色",client.chatJson("system","user").path("name").asText());}
        tx.executeWithoutResult(st->assertTrue(billing.finish(job,mediaSucceeded,"图片失败")));
        assertEquals(3,grants.findById(gift.getId()).orElseThrow().getSpent());
        assertEquals(17,grants.findById(gift.getId()).orElseThrow().getAvailable());
        assertEquals(mediaSucceeded?90:100,wallets.findById("one").orElseThrow().getTotalBalance());
        assertEquals(0,wallets.findById("one").orElseThrow().getPendingBalance());
        assertEquals(mediaSucceeded?13:3,job.getCost());
        assertEquals(job.getCost(),ledger.actualCreditsSpentSince("one","dap-job",Instant.EPOCH));
        long entries=ledger.count();tx.executeWithoutResult(st->billing.finish(job,mediaSucceeded,"重复回调"));assertEquals(entries,ledger.count());
        org.mockito.Mockito.when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_IMAGE,image.getId(),"aiavatar"))
                .thenReturn(Optional.of(new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(image,null,true)));
        job.setRetryCount(1);
        tx.executeWithoutResult(st->billing.reserve(job,10));
        assertEquals("qwen",billing.plan(job).text().charge().target().endpointId(),"retry keeps the originally accepted text endpoint");
        tx.executeWithoutResult(st->billing.finish(job,false,"重试取消"));
        assertEquals(mediaSucceeded?13:3,job.getCost(),"prior completed text is counted once across attempts");
        assertEquals(17,grants.findById(gift.getId()).orElseThrow().getAvailable());
    }

    @Test void dapSplitReservationRollsBackMediaIfTheTextStageCannotBeFunded() {
        var models=org.mockito.Mockito.mock(com.aistareco.aep.service.AiModelInvocationService.class);
        var rate=org.mockito.Mockito.mock(com.aistareco.aep.service.AiChatTokenPricing.class);
        var billing=new com.aistareco.aep.dap.service.DapModelBilling(models,rate,credits,
                org.mockito.Mockito.mock(com.aistareco.aep.dap.repository.DapJobRepository.class),
                org.mockito.Mockito.mock(com.aistareco.aep.dap.repository.DapLookRepository.class),
                org.mockito.Mockito.mock(com.aistareco.aep.dap.service.DapCatalogService.class),mapper);
        var image=AiModelEndpoint.builder().id("image").model("image").build();var text=AiModelEndpoint.builder().id("qwen").model("qwen").build();
        org.mockito.Mockito.when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_IMAGE,"aiavatar")).thenReturn(Optional.of(image));
        org.mockito.Mockito.when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_PERSONA,"aiavatar")).thenReturn(Optional.of(text));
        org.mockito.Mockito.when(rate.find("qwen")).thenReturn(new com.aistareco.aep.service.AiChatTokenPricing.Rate(BigDecimal.ONE,BigDecimal.ONE,1000,1000));
        var wallet=wallets.findById("one").orElseThrow();wallet.setTotalBalance(10);wallet.setRechargeBalance(10);wallets.saveAndFlush(wallet);
        var job=com.aistareco.aep.dap.model.DapJob.builder().id("cannot-fund-text").ownerUserId("one").type("generate").kind("形象").payload(Map.of()).build();
        assertEquals("MODEL_CREDITS_INSUFFICIENT",assertThrows(BusinessException.class,()->tx.executeWithoutResult(st->billing.reserve(job,10))).getCode());
        assertEquals(10,wallets.findById("one").orElseThrow().getTotalBalance());assertEquals(0,holds.count());assertEquals(0,charges.count());assertEquals(0,ledger.count());
    }

    private ModelChargeContext quoteContext(ModelBillingApproval approval) {
        return new ModelChargeContext(target,new ModelBillingMath.Usage(new BigDecimal("3"),null),BigDecimal.TEN,null,"v1",false,100L,approval);
    }

    private String scopedOutcome(String wallet,String request,long amount,String actor) {
        try{operations.grantScoped(wallet,"campaign",amount,expires,request,"验收发放",actor);return "ok";}
        catch(BusinessException e){return e.getCode();}
    }
    private String approveOutcome(String id) {
        try{operations.approve(id,"checker");return "ok";}catch(BusinessException e){return e.getCode();}
    }

    private CreditCampaign campaign(String id,long total,long perWallet,long units)throws Exception {
        var c=new CreditCampaign();c.setId(id);c.setName("免费图片");c.setTargetsJson(mapper.writeValueAsString(List.of(target)));
        c.setResourceUnit("image");c.setTotalIssueLimit(total);c.setPerWalletIssueLimit(perWallet);c.setResourceLimit(BigDecimal.valueOf(units));
        c.setPerWalletDailyResourceLimit(BigDecimal.valueOf(units));c.setMaxConcurrentPerWallet(5);c.setActive(true);
        c.setStartsAt(Instant.parse("2020-01-01T00:00:00Z"));c.setExpiresAt(expires);c.setUpdatedAt(Instant.now());return campaigns.saveAndFlush(c);
    }
    private CreditGrant grant(String wallet,long amount,String request) {return service.grant(wallet,"campaign",amount,expires,"test",request,"test","operator");}
    private String grantOutcome(String wallet,String request){try{grant(wallet,100,request);return "ok";}catch(BusinessException e){return e.getCode();}}
    private String reserveOutcome(String wallet,String id,int units){try{reserve(wallet,id,20,units);return "ok";}catch(BusinessException e){return e.getCode();}}
    private void reserve(String walletId,String id,long credits,int units) {
        tx.executeWithoutResult(status->{
            Wallet wallet=wallets.findByIdForUpdate(walletId).orElseThrow();
            CreditHold h=hold(walletId,id,credits);
            holds.saveAndFlush(h);service.reserve(wallet,h,target,credits,BigDecimal.valueOf(units),true,Instant.now());
        });
    }
    private CreditHold hold(String walletId,String id,long credits) {
        return CreditHold.builder().id(id).walletId(walletId).userId(walletId).actorUserId(walletId).referenceType("test")
                .referenceId(id).amount(credits).remainingAmount(credits).status(CreditHold.Status.ACTIVE).description("test")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
    private void inHold(String id,java.util.function.BiConsumer<Wallet,CreditHold> action) {
        tx.executeWithoutResult(status->{var snapshot=holds.findById(id).orElseThrow();
            var wallet=wallets.findByIdForUpdate(snapshot.getWalletId()).orElseThrow();
            var hold=holds.findByReferenceTypeAndReferenceIdForUpdate("test",id).orElseThrow();action.accept(wallet,hold);});
    }
    private static List<String> race(Callable<String> a,Callable<String> b)throws Exception {
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try{var first=pool.submit(()->{start.await();return a.call();});var second=pool.submit(()->{start.await();return b.call();});start.countDown();
            return List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();}
    }
}
