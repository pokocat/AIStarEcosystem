package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.cdn.*;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real wallet, lot and transaction accounting; the model boundary is mocked and never sends a paid request. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:video-scoped;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@Import({CreditService.class,ScopedCreditService.class,ModelPricingService.class,ModelChargeService.class,MaterialVideoScopedBillingIntegrationTest.Config.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class MaterialVideoScopedBillingIntegrationTest {
    @TestConfiguration static class Config {@Bean ObjectMapper mapper(){return new ObjectMapper().findAndRegisterModules();}}
    @Autowired CreditService credits; @Autowired ScopedCreditService scoped;
    @Autowired ModelChargeService charging;
    @Autowired WalletRepository wallets; @Autowired CreditHoldRepository holds; @Autowired LedgerEntryRepository ledger;
    @Autowired CreditCampaignRepository campaigns; @Autowired CreditGrantRepository grants; @Autowired CreditGrantHoldRepository allocations;
    @Autowired CreditResourceReservationRepository resources; @Autowired ModelChargeRepository charges; @Autowired ModelDiscountRepository discounts;
    @Autowired ModelPriceRepository prices; @Autowired MaterialVideoJobRepository jobs; @Autowired ObjectMapper json;
    @Autowired PlatformTransactionManager manager; @Autowired EntityManager em;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseCreditLotService lots;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseBillingService enterprise;
    @org.springframework.boot.test.mock.mockito.MockBean com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService recovery;
    MaterialVideoModelClient client; MaterialVideoJobService service; MaterialVideoWorker worker; TransactionTemplate tx;
    MaterialVideoModelClient.SubmitResult accepted;
    final VideoGenSpec spec=new VideoGenSpec("t2v","768p",null,null,null,List.of());
    final ModelBillingTarget target=new ModelBillingTarget("celebrity","video","ep","video-v1",
            MaterialVideoBilling.specification(spec,"16:9",5,"second"),"second");

    @BeforeEach void setup() {
        jobs.deleteAll();charges.deleteAll();prices.deleteAll();discounts.deleteAll();resources.deleteAll();allocations.deleteAll();ledger.deleteAll();grants.deleteAll();holds.deleteAll();campaigns.deleteAll();wallets.deleteAll();
        wallets.saveAndFlush(Wallet.builder().id("wallet").userId("customer").accountKey("personal:customer").accountType("personal")
                .totalBalance(100).rechargeBalance(100).build());
        var campaign=new CreditCampaign();campaign.setId("trial");campaign.setName("视频体验");campaign.setTargetsJson(write(List.of(target)));
        campaign.setResourceUnit("second");campaign.setTotalIssueLimit(10000);campaign.setPerWalletIssueLimit(1000);
        campaign.setResourceLimit(BigDecimal.valueOf(100));campaign.setPerWalletDailyResourceLimit(BigDecimal.valueOf(100));campaign.setMaxConcurrentPerWallet(2);
        campaign.setStartsAt(Instant.now().minusSeconds(60));campaign.setExpiresAt(Instant.parse("2030-01-01T00:00:00Z"));campaign.setActive(true);campaign.setUpdatedAt(Instant.now());campaigns.saveAndFlush(campaign);
        scoped.grant("wallet","trial",50,Instant.parse("2030-01-01T00:00:00Z"),"test","first","test","测试发放");
        var d=new ModelDiscount();d.setId("discount");d.setName("视频八折");d.setTargetKey(target.endpointKey());d.setTargetJson(write(target));d.setAudience("all");d.setFactor(new BigDecimal("0.8"));
        d.setAllowGrants(true);d.setStartsAt(Instant.now().minusSeconds(60));d.setExpiresAt(Instant.parse("2030-01-01T00:00:00Z"));d.setActive(true);d.setUpdatedAt(Instant.now());discounts.saveAndFlush(d);
        client=mock(MaterialVideoModelClient.class);
        when(client.billingRoute(any(),any())).thenReturn(new MaterialVideoModelClient.BillingRoute("ep","video-v1",true,"https://provider.invalid",""));
        accepted=new MaterialVideoModelClient.SubmitResult("vendor-job",null,"Test provider","video-v1","generic","ep","celebrity","https://provider.invalid","");
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any(),any())).thenAnswer(i->{Consumer<MaterialVideoModelClient.SubmitResult> before=i.getArgument(7);before.accept(accepted);return accepted;});
        when(client.resumeExistingTask(any(),any(),any(),any(),any(),any(),any())).thenReturn(accepted);
        when(client.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(success());
        var props=new MaterialVideoProperties();props.setUploadToCdn(false);props.setPollIntervalSeconds(0);props.setMaxWaitSeconds(10);
        ObjectProvider<CdnUploader> provider=mock(ObjectProvider.class);
        worker=new MaterialVideoWorker(jobs,client,props,credits,mock(StorageQuotaService.class),provider,null);worker.transactionManager(manager);
        ReflectionTestUtils.setField(worker,"enterpriseBilling",enterprise);ReflectionTestUtils.setField(worker,"entityManager",em);
        // Match production's personal wallet -> hold -> task settlement order.
        doAnswer(i->{var h=holds.findByReferenceTypeAndReferenceId(i.getArgument(0),i.getArgument(1)).orElse(null);
            if(h!=null)em.find(Wallet.class,h.getWalletId(),LockModeType.PESSIMISTIC_WRITE);return null;}).when(enterprise).lockForSettlement(any(),any());
        service=new MaterialVideoJobService(jobs,client,mock(MaterialVideoWorker.class),credits,mock(CelebrityActionPricingService.class),
                mock(ProductService.class),mock(AiModelInvocationService.class),json,mock(CdnUrlSigner.class));
        tx=new TransactionTemplate(manager);
    }
    ModelBillingTarget batchTarget(){return new ModelBillingTarget("aiavatar",target.action(),target.endpointId(),target.providerModel(),target.specKey(),target.unit());}
    com.fasterxml.jackson.databind.node.ObjectNode quotedBatch() {
        var campaign=campaigns.findById("trial").orElseThrow();campaign.setTargetsJson(write(List.of(batchTarget())));campaigns.saveAndFlush(campaign);
        var discount=discounts.findById("discount").orElseThrow();discount.setFactor(new BigDecimal("0.5"));discount.setTargetKey(batchTarget().endpointKey());discounts.saveAndFlush(discount);
        ReflectionTestUtils.setField(service,"enterpriseBilling",enterprise);
        when(enterprise.quoteRepeated(eq("customer"),any(),any(),anyInt())).thenAnswer(i->charging.quoteRepeated(wallet(),i.getArgument(2),i.getArgument(3)));
        when(enterprise.approveRepeated(eq("customer"),any(),any(),anyInt(),any())).thenAnswer(i->charging.approveRepeated(wallet(),i.getArgument(2),i.getArgument(3),i.getArgument(4)));
        when(enterprise.reserve(eq("customer"),any(),anyString(),anyString(),anyString(),anyLong(),anyString(),any())).thenAnswer(i->{
            credits.hold("customer",i.getArgument(5),i.getArgument(2),i.getArgument(3),i.getArgument(6),i.getArgument(7));
            return new com.aistareco.aep.enterprise.service.EnterpriseBillingService.BillingAccount(wallet().getId(),null,null,null);
        });
        var body=json.createObjectNode();var items=body.putArray("items");
        for(int i=0;i<2;i++) {var item=items.addObject().put("name","候选 "+i).put("duration_sec",5).put("aspect_ratio","16:9").put("credit_cost",53);
            spec.writeTo(item.putObject("variant_config"));}
        return body;
    }
    @Test void confirmedBatchUsesOneAllowanceBalanceAndOneSharedWalletCeilingIncludingPerJobRounding() {
        var body=quotedBatch();var quote=service.quote(body,"customer",MaterialVideoJobService.APP_IPSTUDIO,null,false);
        assertEquals(106,quote.standardCredits());assertEquals(54,quote.payableCredits());assertEquals(50,quote.scopedCredits());assertEquals(4,quote.walletCredits());
        assertEquals(0,jobs.count());assertEquals(0,holds.count());assertEquals(100,wallet().getRechargeBalance());
        assertFalse(service.quote(body,"customer",MaterialVideoJobService.APP_IPSTUDIO,null,true).canAfford());
        body.set("modelBilling",json.valueToTree(quote.approval()));
        var changed=body.deepCopy();((com.fasterxml.jackson.databind.node.ArrayNode)changed.path("items")).add(changed.path("items").get(0).deepCopy());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,()->tx.execute(status->service.submit(changed,"customer",MaterialVideoJobService.APP_IPSTUDIO))).getCode());
        assertEquals(0,jobs.count());assertEquals(0,holds.count());
        tx.execute(status->service.submit(body,"customer",MaterialVideoJobService.APP_IPSTUDIO));
        assertEquals(2,jobs.count());assertEquals(2,holds.count());assertEquals(50,grant().getFrozen());
        assertEquals(96,wallet().getRechargeBalance());assertEquals(4,wallet().getPendingBalance());
        assertEquals(54,charges.findAll().stream().mapToLong(ModelCharge::getPayableCredits).sum());
        var bill=charging.breakdown(MaterialVideoJobService.CREDIT_REF_TYPE,jobs.findAll().stream().map(MaterialVideoJob::getId).toList());
        assertEquals(50,bill.pending().scopedCredits());assertEquals(4,bill.pending().walletCredits());assertEquals(54,bill.displayedCost());
    }
    @Test void grantConsumedAfterBatchQuoteCannotIncreaseTheConfirmedWalletDebit() {
        var body=quotedBatch();var quote=service.quote(body,"customer",MaterialVideoJobService.APP_IPSTUDIO,null,false);body.set("modelBilling",json.valueToTree(quote.approval()));
        var other=new ModelChargeContext(batchTarget(),new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.valueOf(100),null,"other",true,0L,null);
        credits.hold("customer",100,"test","other","另一请求",other);
        assertEquals(50,grant().getFrozen());assertEquals(100,wallet().getRechargeBalance());
        assertEquals("MODEL_QUOTE_CHANGED",assertThrows(BusinessException.class,()->tx.execute(status->service.submit(body,"customer",MaterialVideoJobService.APP_IPSTUDIO))).getCode());
        assertEquals(0,jobs.count());assertEquals(1,holds.count());assertEquals(100,wallet().getRechargeBalance());assertEquals(0,wallet().getPendingBalance());
    }

    @Test void videoStudioConfirmationUsesOnlyItsModelGrantAndApprovedOrdinaryCeiling() {
        ReflectionTestUtils.setField(service,"enterpriseBilling",enterprise);
        when(enterprise.quoteRepeated(eq("customer"),any(),any(),anyInt())).thenAnswer(i->charging.quoteRepeated(wallet(),i.getArgument(2),i.getArgument(3)));
        when(enterprise.approveRepeated(eq("customer"),any(),any(),anyInt(),any())).thenAnswer(i->charging.approveRepeated(wallet(),i.getArgument(2),i.getArgument(3),i.getArgument(4)));
        var item=json.createObjectNode().put("name","视频生成区").put("duration_sec",5).put("aspect_ratio","16:9").put("credit_cost",100);
        spec.writeTo(item.putObject("variant_config"));var body=json.createObjectNode();body.putArray("items").add(item);
        var quote=service.quote(body,"customer",MaterialVideoJobService.APP_VIDEO_STUDIO,null,false);
        assertEquals(100,quote.standardCredits());assertEquals(80,quote.payableCredits());assertEquals(50,quote.scopedCredits());assertEquals(30,quote.walletCredits());
        assertFalse(service.quote(body,"customer",MaterialVideoJobService.APP_VIDEO_STUDIO,null,true).canAfford());
        assertEquals(0,jobs.count());assertEquals(0,holds.count());
        body.set("modelBilling",json.valueToTree(quote.approval()));
        tx.execute(status->service.submit(body,"customer",MaterialVideoJobService.APP_VIDEO_STUDIO));
        assertEquals(1,jobs.count());assertEquals(1,holds.count());assertEquals(50,grant().getFrozen());
        assertEquals(70,wallet().getRechargeBalance());assertEquals(30,wallet().getPendingBalance());
    }

    String create() {
        return tx.execute(status->{var item=json.createObjectNode().put("name","本地视频").put("duration_sec",5).put("aspect_ratio","16:9").put("credit_cost",100);
            spec.writeTo(item.putObject("variant_config"));var body=json.createObjectNode();body.putArray("items").add(item);
            var card=service.submit(body,"customer",MaterialVideoJobService.APP_VIDEO_STUDIO).get(0);
            assertFalse(card.has(MaterialVideoBilling.PAYLOAD_KEY));return card.path("id").asText();});
    }
    MaterialVideoModelClient.PollResult success(){return new MaterialVideoModelClient.PollResult("succeeded","https://provider.invalid/video.mp4",null,"succeeded",100,null,null);}
    CreditGrant grant(){return grants.findAll().get(0);} Wallet wallet(){return wallets.findById("wallet").orElseThrow();}
    CreditHold hold(String id){return credits.findHold(MaterialVideoJobService.CREDIT_REF_TYPE,id);}
    String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}

    @Test void priceAndDiscountChangesAfterReservationDoNotRepriceTheOriginalVideo() {
        String id=create();assertEquals(70,wallet().getTotalBalance());assertEquals(30,wallet().getPendingBalance());assertEquals(50,grant().getFrozen());
        var current=discounts.findById("discount").orElseThrow();current.setFactor(new BigDecimal("0.5"));discounts.saveAndFlush(current);
        var price=new ModelPrice();price.setId("changed");price.setName("新价格");price.setTargetKey(target.key());price.setTargetJson(write(target));price.setUnitPrice(BigDecimal.valueOf(50));price.setActive(true);price.setUpdatedAt(Instant.now());prices.saveAndFlush(price);
        worker.generateAsync(id);
        assertEquals("succeeded",jobs.findById(id).orElseThrow().getStatus());assertEquals(CreditHold.Status.COMMITTED,hold(id).getStatus());
        assertEquals(70,wallet().getTotalBalance());assertEquals(0,wallet().getPendingBalance());assertEquals(50,grant().getSpent());assertEquals(0,grant().getFrozen());
        assertEquals(0,campaigns.findById("trial").orElseThrow().getResourceUsed().compareTo(BigDecimal.valueOf(5)));
        worker.generateAsync(id);assertEquals(50,grant().getSpent());
        verify(client,times(1)).submit(any(),anyInt(),any(),any(),any(),eq("ep"),any(),any());
    }
    @Test void changedProviderModelIsRejectedBeforeDispatchAndReturnsTheOriginalBalances() {
        String id=create();var changed=new MaterialVideoModelClient.SubmitResult(null,null,"provider","another-model","generic","ep");
        doAnswer(i->{((Consumer<MaterialVideoModelClient.SubmitResult>)i.getArgument(7)).accept(changed);throw new AssertionError("must not dispatch");})
                .when(client).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());
        worker.generateAsync(id);
        assertEquals("failed",jobs.findById(id).orElseThrow().getStatus());assertEquals(100,wallet().getTotalBalance());assertEquals(0,wallet().getPendingBalance());assertEquals(50,grant().getAvailable());
        var usage=resources.findAll().get(0);assertNull(usage.getDispatchedAt());assertEquals(0,usage.getUsed().signum());
        verify(client,never()).poll(any(MaterialVideoModelClient.SubmitResult.class));
    }
    @Test void temporaryPollingFailureRetainsOriginalHoldAndRecoveryNeverSubmitsAgain() {
        String id=create();when(client.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenThrow(new IllegalStateException("temporary poll failure")).thenReturn(success());
        worker.generateAsync(id);assertEquals("generating",jobs.findById(id).orElseThrow().getStatus());assertEquals(CreditHold.Status.ACTIVE,hold(id).getStatus());assertEquals(50,grant().getFrozen());
        worker.generateAsync(id);assertEquals("succeeded",jobs.findById(id).orElseThrow().getStatus());assertEquals(70,wallet().getTotalBalance());assertEquals(50,grant().getSpent());
        verify(client,times(1)).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());verify(client).resumeExistingTask(eq("vendor-job"),eq("ep"),any(),eq("video-v1"),any(),any(),any());
    }
    @Test void missingOutputRefundDoesNotRestoreSupplierResourcesOrChargeARecoveryAgainstNewGrants() {
        String id=create();when(client.poll(any(MaterialVideoModelClient.SubmitResult.class)))
                .thenReturn(new MaterialVideoModelClient.PollResult("succeeded",null,null,"succeeded",100,null,null));
        worker.generateAsync(id);assertEquals("failed",jobs.findById(id).orElseThrow().getStatus());assertEquals(100,wallet().getTotalBalance());assertEquals(50,grant().getAvailable());
        assertEquals(0,campaigns.findById("trial").orElseThrow().getResourceUsed().compareTo(BigDecimal.valueOf(5)));
        when(client.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(success());
        assertEquals("VIDEO_MODEL_RECOVERY_REQUIRES_REVIEW",assertThrows(BusinessException.class,()->worker.reconcileSucceeded(id)).getCode());
        assertEquals(1,holds.count());assertEquals(50,grant().getAvailable());assertEquals(100,wallet().getTotalBalance());
    }
    @Test void listPriceJobWithoutGrantOrDiscountStillRecoversAtItsFrozenPrice() throws Exception {
        discounts.deleteAll();
        var campaign=campaigns.findById("trial").orElseThrow();campaign.setActive(false);campaigns.saveAndFlush(campaign);
        String id=create();assertEquals(0,wallet().getTotalBalance());assertEquals(100,wallet().getPendingBalance());assertEquals(0,grant().getFrozen());
        when(client.poll(any(MaterialVideoModelClient.SubmitResult.class)))
                .thenReturn(new MaterialVideoModelClient.PollResult("succeeded",null,null,"succeeded",100,null,null));
        worker.generateAsync(id);assertEquals("failed",jobs.findById(id).orElseThrow().getStatus());assertEquals(100,wallet().getTotalBalance());
        // Recovery always mirrors the provider output into our storage: serve real bytes locally and capture the upload.
        var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/video.mp4",exchange->{byte[] body="local-video".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type","video/mp4");exchange.sendResponseHeaders(200,body.length);
            try(var out=exchange.getResponseBody()){out.write(body);}});
        server.start();
        try {
            var uploader=mock(CdnUploader.class);
            when(uploader.upload(any(),any(),any())).thenAnswer(i->new CdnUploader.CdnUploadResult("/cdn/"+i.getArgument(1),i.getArgument(1),11,Instant.now()));
            ObjectProvider<CdnUploader> provider=mock(ObjectProvider.class);when(provider.getIfAvailable()).thenReturn(uploader);
            var props=new MaterialVideoProperties();props.setUploadToCdn(true);props.setPollIntervalSeconds(0);props.setMaxWaitSeconds(10);
            var recovering=new MaterialVideoWorker(jobs,client,props,credits,mock(StorageQuotaService.class),provider,null);recovering.transactionManager(manager);
            ReflectionTestUtils.setField(recovering,"enterpriseBilling",enterprise);ReflectionTestUtils.setField(recovering,"entityManager",em);
            String url="http://127.0.0.1:"+server.getAddress().getPort()+"/video.mp4";
            when(client.poll(any(MaterialVideoModelClient.SubmitResult.class))).thenReturn(new MaterialVideoModelClient.PollResult("succeeded",url,null,"succeeded",100,null,null));
            recovering.reconcileSucceeded(id);
        } finally {server.stop(0);}
        assertEquals("succeeded",jobs.findById(id).orElseThrow().getStatus());
        assertEquals(CreditHold.Status.COMMITTED,credits.findHold("material_video_job_recovery",id).getStatus());
        assertEquals(0,wallet().getTotalBalance());assertEquals(0,wallet().getPendingBalance());assertEquals(50,grant().getAvailable());
    }
}
