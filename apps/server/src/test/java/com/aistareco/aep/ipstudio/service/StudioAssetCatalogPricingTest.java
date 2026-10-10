package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioAssetCatalogPricingTest {
    @Test void fixedCustomerPriceOpensLipSyncWithoutLegacyCandidatePrice() {
        var products=mock(DapProductRepository.class);
        var avatars=mock(DapAvatarRepository.class);
        var voices=mock(DapVoiceRepository.class);
        var models=mock(AiModelInvocationService.class);
        var pricing=mock(StudioPointPricing.class);
        var endpoint=AiModelEndpoint.builder().id("lip").enabled(true).model("x-dub")
                .baseUrl("https://api.jusuanhub.com/v1").billingMode(AiModelBillingMode.PER_SECOND).build();
        var candidate=AiAppEndpointCandidate.builder().enabled(true).build();
        when(models.listCandidates(AiModelPurpose.DAP_LIP_SYNC)).thenReturn(
                List.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true)));
        when(pricing.enabled()).thenReturn(true);
        when(pricing.find("lip")).thenReturn(new StudioPointPricing.Rate(null,null,null,BigDecimal.ZERO,null,null,null));
        var catalog=new StudioAssetCatalogService(products,avatars,voices,mock(FileStorageService.class),new ClipProperties());
        ReflectionTestUtils.setField(catalog,"models",models);
        ReflectionTestUtils.setField(catalog,"pricing",pricing);
        assertTrue(catalog.list("owner").videoLipSyncReady());
        when(pricing.find("lip")).thenReturn(null);
        assertFalse(catalog.list("owner").videoLipSyncReady());
        candidate.setCreditCostOverride(5L);
        assertFalse(catalog.list("owner").videoLipSyncReady());
        when(pricing.enabled()).thenReturn(false);
        assertTrue(catalog.list("owner").videoLipSyncReady());
        endpoint.setEnabled(false);
        assertFalse(catalog.list("owner").videoLipSyncReady());
    }
}
