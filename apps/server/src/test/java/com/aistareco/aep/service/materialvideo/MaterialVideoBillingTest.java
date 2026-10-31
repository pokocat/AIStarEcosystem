package com.aistareco.aep.service.materialvideo;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class MaterialVideoBillingTest {
    final MaterialVideoModelClient.BillingRoute route=new MaterialVideoModelClient.BillingRoute("ep","video-v1",true,"https://provider.invalid","");
    @Test void nativeVideoKeepsPerSecondPriceAndReferenceSpecification() {
        var spec=new VideoGenSpec("universal_reference_video","768p",1L,null,null,List.of(new VideoGenSpec.Reference("image","owned-a")));
        var charge=MaterialVideoBilling.plan("ipstudio",route,spec,"16:9",5,100,true,120L);
        assertEquals("aiavatar",charge.target().appCode());assertEquals("second",charge.target().unit());
        assertEquals(0,charge.unitPrice().compareTo(BigDecimal.valueOf(20)));assertEquals(0,charge.usage().quantity().compareTo(BigDecimal.valueOf(5)));
        assertFalse(charge.target().specKey().contains("owned-a"));assertEquals(120,charge.maxWalletCredits());
        var otherKey=new VideoGenSpec("universal_reference_video","768p",99L,null,null,List.of(new VideoGenSpec.Reference("image","owned-b")));
        assertEquals(charge.target().specKey(),MaterialVideoBilling.specification(otherKey,"16:9",5,"second"));
        assertNotEquals(charge.target().specKey(),MaterialVideoBilling.specification(otherKey,"9:16",5,"second"));
        assertNotEquals(charge.target().specKey(),MaterialVideoBilling.specification(new VideoGenSpec("universal_reference_video","544p",null,null,null,List.of()),"16:9",5,"second"));
    }
    @Test void flatCallerPriceDoesNotBecomeTheEndpointProcurementRate() {
        var charge=MaterialVideoBilling.plan("drama",route,VideoGenSpec.EMPTY,"9:16",7,100,true,null);
        assertEquals("call",charge.target().unit());assertEquals(BigDecimal.ONE,charge.usage().quantity());assertEquals(0,charge.unitPrice().compareTo(BigDecimal.valueOf(100)));
        assertNotEquals(charge.target().specKey(),MaterialVideoBilling.specification(VideoGenSpec.EMPTY,"9:16",8,"call"));
    }
    @Test void ordinaryPerSecondCandidateUsesSecondsAndLegacyFlatPricesUseCalls() {
        assertEquals("second",MaterialVideoBilling.plan("celebrity",route,VideoGenSpec.EMPTY,"9:16",5,200,false,null).target().unit());
        var flat=new MaterialVideoModelClient.BillingRoute("ep","video-v1",false,"https://provider.invalid","");
        assertEquals("call",MaterialVideoBilling.plan("celebrity",flat,VideoGenSpec.EMPTY,"9:16",5,30,false,null).target().unit());
    }
    @Test void zeroModelPriceDoesNotCreateUnlimitedFreeConsumptionButDapChildStaysWithItsParent() {
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->MaterialVideoBilling.plan("celebrity",route,VideoGenSpec.EMPTY,"9:16",5,0,false,null)).getCode());
        assertNull(MaterialVideoBilling.plan("dap",route,VideoGenSpec.EMPTY,"9:16",5,0,true,null).target());
    }
    @Test void queuedVideoCannotSilentlySwitchAddressOrRequestSpecification() {
        var charge=MaterialVideoBilling.plan("celebrity",route,VideoGenSpec.EMPTY,"9:16",5,100,false,null);
        var job=com.aistareco.aep.model.MaterialVideoJob.builder().id("job").payloadJson("{}")
                .upstreamBaseUrlSnapshot("https://provider.invalid").videoRequestSpecSnapshotJson("").build();
        MaterialVideoBilling.store(job,charge);
        var original=new MaterialVideoModelClient.SubmitResult(null,null,"provider","video-v1","generic","ep","celebrity","https://provider.invalid","");
        assertDoesNotThrow(()->MaterialVideoBilling.requireRoute(job,original));
        var moved=new MaterialVideoModelClient.SubmitResult(null,null,"provider","video-v1","generic","ep","celebrity","https://new.invalid","");
        assertEquals("MODEL_BILLING_ROUTE_CHANGED",assertThrows(BusinessException.class,()->MaterialVideoBilling.requireRoute(job,moved)).getCode());
        var changed=new MaterialVideoModelClient.SubmitResult(null,null,"provider","video-v1","generic","ep","celebrity","https://provider.invalid","{\"new\":true}");
        assertThrows(BusinessException.class,()->MaterialVideoBilling.requireRoute(job,changed));
    }
}
