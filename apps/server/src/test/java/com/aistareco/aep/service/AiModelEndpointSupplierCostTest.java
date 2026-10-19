package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelEndpointCostUpsertDto;
import com.aistareco.aep.dto.AiModelEndpointDto;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiModelEndpointSupplierCostTest {
    @Test
    void costUpdatePreservesCustomerBillingUnitAndLimits() {
        var endpoint = AiModelEndpoint.builder().id("video").billingMode(AiModelBillingMode.PER_SECOND)
                .concurrencyLimit(2).rpmLimit(10).unitPriceMicros(100).build();
        var repo = mock(AiModelEndpointRepository.class);
        when(repo.findById("video")).thenReturn(Optional.of(endpoint));
        when(repo.save(any(AiModelEndpoint.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new AiModelEndpointAdminService(repo, null, null);

        var dto = service.updateCosts("video", new AiModelEndpointCostUpsertDto("PER_CALL", 0L, 0L, 200L));

        assertEquals(AiModelBillingMode.PER_SECOND, endpoint.getBillingMode());
        assertEquals(AiModelBillingMode.PER_CALL, endpoint.effectiveSupplierBillingMode());
        assertEquals("PER_SECOND", dto.billingMode());
        assertEquals("PER_CALL", dto.supplierBillingMode());
        assertEquals(200L, endpoint.getUnitPriceMicros());
        assertEquals(2, endpoint.getConcurrencyLimit());
        assertEquals(10, endpoint.getRpmLimit());
        var candidate = AiAppEndpointCandidate.builder().creditCostOverride(40L).build();
        assertEquals("per_second", AiModelInvocationService.videoBillingUnit(endpoint, candidate));
    }

    @Test
    void legacyNullKeepsOldCostUnitButExplicitAutoDoesNotChangeCustomerUnit() {
        var endpoint = AiModelEndpoint.builder().billingMode(AiModelBillingMode.PER_SECOND).build();
        assertEquals(AiModelBillingMode.PER_SECOND, endpoint.effectiveSupplierBillingMode());
        assertEquals("PER_SECOND", AiModelEndpointDto.from(endpoint).supplierBillingMode());

        endpoint.setSupplierBillingMode("AUTO");
        assertNull(endpoint.effectiveSupplierBillingMode());
        assertEquals(AiModelBillingMode.PER_SECOND, endpoint.getBillingMode());
        assertEquals("AUTO", AiModelEndpointDto.from(endpoint).supplierBillingMode());

        endpoint.setSupplierBillingMode(null);
        endpoint.setBillingMode(null);
        assertNull(endpoint.effectiveSupplierBillingMode());
        assertEquals("AUTO", AiModelEndpointDto.from(endpoint).supplierBillingMode());
    }
}
