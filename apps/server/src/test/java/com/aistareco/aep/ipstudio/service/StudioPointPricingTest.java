package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioPointPricingTest {
    @Test void markupRoundsOnceForTheWholeJobAndSnapshotSurvivesPolicyChanges() throws Exception {
        var config=mock(PlatformConfigService.class);var mapper=new ObjectMapper();
        var value=mapper.readTree("{\"supplierToPlatformRatio\":1,\"markupPercent\":50,\"endpointCosts\":{\"tts\":1}}");
        when(config.findByKey(StudioPointPricing.KEY)).thenReturn(Optional.of(new PlatformConfigDto(StudioPointPricing.KEY,value,1,null,null,null)));
        var pricing=new StudioPointPricing(config);var rate=pricing.find("tts");
        assertEquals(new BigDecimal("1.50"),rate.platformPointsPerSecond());
        assertEquals(5,rate.cost(3)); // ceil(3 * 1.5), not 3 * ceil(1.5).
        var snapshot=mapper.valueToTree(rate);
        ((com.fasterxml.jackson.databind.node.ObjectNode)value).put("markupPercent",100);
        assertEquals(6,pricing.find("tts").cost(3));
        assertEquals(5,StudioPointPricing.Rate.fromSnapshot(snapshot).cost(3));
        assertTrue(pricing.enabled());assertNull(pricing.find("unpriced"));
    }
    @Test void reservationCountsUnicodeCodePointsAndHasAnExplicitCeiling() {
        assertEquals(13,StudioPointPricing.speechReservationSeconds("你好😀"));
        assertEquals(600,StudioPointPricing.speechReservationSeconds("字".repeat(600)));
    }
}
