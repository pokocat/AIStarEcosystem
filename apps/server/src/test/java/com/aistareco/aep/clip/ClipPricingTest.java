package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos.PricingDto;
import com.aistareco.aep.clip.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 六档单价：键名是与端上的硬契约，缺一档必须报错而不是兜个默认值。 */
class ClipPricingTest {

    private static ClipEstimateService service(ClipProperties props) {
        return new ClipEstimateService(props, mock(ClipProjectService.class), mock(ClipAvatarService.class), mock(ClipAssetService.class));
    }

    private static ClipProperties configured() {
        ClipProperties props = new ClipProperties();
        props.setPricingAvatarSecond("1"); props.setPricingTtsPerKchar("5"); props.setPricingAssemble("3");
        props.setPricingT2iPerImage("2"); props.setPricingT2vSecond("1"); props.setPricingI2vSecond("1");
        return props;
    }

    @Test
    void allSixRatesComeStraightFromConfiguration() {
        PricingDto price = service(configured()).pricing();
        assertEquals(1, price.creditPerAvatarSecond());
        assertEquals(2, price.creditPerImage());
        assertEquals(1, price.creditPerT2vSecond());
        assertEquals(1, price.creditPerI2vSecond());
        assertEquals(3, price.creditPerAssemble());
        assertEquals(5, price.creditPerKChar());
    }

    @Test
    void aMissingRateFailsFastInsteadOfRenderingAMadeUpNumber() {
        ClipProperties props = configured(); props.setPricingT2vSecond("");
        BusinessException error = assertThrows(BusinessException.class, () -> service(props).pricing());
        assertEquals("CLIP_PRICING_NOT_CONFIGURED", error.getCode());
    }

    @Test
    void shotQuoteChargesOnlyWhatThatOneCallActuallyProduces() {
        ClipEstimateService service = service(configured());
        Map<String, Object> shot = new LinkedHashMap<>(Map.of("role", "avatar", "text", "十二个字的一句台词啊"));
        int seconds = ClipProjectService.seconds(shot);
        assertEquals(seconds, service.shotQuote("avatar", shot), "出镜按秒计价");
        assertEquals(2, service.shotQuote("t2i", shot), "出图按张计价，与时长无关");
        assertEquals(seconds, service.shotQuote("t2v", shot));
        assertEquals(seconds, service.shotQuote("i2v", shot));
        assertEquals(3, service.assembleQuote());
    }

    @Test
    void anUnknownModelIsRejectedRatherThanQuotedAtZero() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service(configured()).shotQuote("sora", Map.of("role", "avatar", "text", "一句话")));
        assertEquals("CLIP_SHOT_MODEL_INVALID", error.getCode());
    }
}
