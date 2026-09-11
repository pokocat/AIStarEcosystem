package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipPricing;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.ClipPricingRepository;
import com.aistareco.aep.clip.service.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * 端上报价与服务端核对必须读同一处单价。
 *
 * <p>这是六档单价搬进数据库时最容易搞砸、而且**搞砸了不会报错只会 409** 的一条：
 * 端上调 {@code /api/me/clip/pricing}（走 {@code pricing()}）拿一组数算出报价，
 * 提交时服务端在 {@code estimate()} 里按另一组数核对。两处只要读的不是同一个地方，
 * 用户点一次生成就被拒一次，而日志里只会看到「报价不一致」。
 *
 * <p>改单价前后各验一遍：如果 estimate 还留着直读 application.yml 的老路径，
 * 库里改了价之后这两个数就会分叉。
 */
class ClipEstimatePricingSourceTest {

    private static ClipProperties props() {
        ClipProperties p = new ClipProperties();
        // 配置里的兜底价
        p.setPricingAvatarSecond("1"); p.setPricingTtsPerKchar("5"); p.setPricingAssemble("3");
        p.setPricingT2iPerImage("2"); p.setPricingT2vSecond("1"); p.setPricingI2vSecond("1");
        return p;
    }

    /** 一条 10 秒出镜 + 100 字的草稿。 */
    private static ClipProjectService projectsWith() {
        ClipProjectService projects = mock(ClipProjectService.class);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", List.of(
                Map.of("no", 1, "role", "avatar", "text", "一".repeat(100), "durationSec", 10)));
        ClipProject p = ClipProject.builder()
                .id("cp1").externalOwnerId("u1").templateId("ct1").templateName("t").title("x")
                .payloadJson(payload).build();
        when(projects.required(anyString(), anyString())).thenReturn(p);
        return projects;
    }

    private static ClipEstimateService svc(ClipPricingRepository repo) {
        ClipProperties p = props();
        return new ClipEstimateService(p, projectsWith(), mock(ClipAvatarService.class),
                mock(ClipAssetService.class), new ClipPricingService(repo, p));
    }

    /** 把单价代进 estimate 自己报的出镜秒数与字数。时长模型不在本组用例的验证范围内。 */
    private static int expectedTotal(com.aistareco.aep.clip.dto.ClipDtos.PricingDto price,
                                     com.aistareco.aep.clip.dto.ClipDtos.EstimateDto est) {
        var sum = est.summary();
        return sum.avatarSec() * price.creditPerAvatarSecond()
                + (int) Math.ceil(sum.chars() / 1000d * price.creditPerKChar())
                + price.creditPerAssemble();
    }

    @Test
    void estimateAndPricingAgreeOnTheConfigFallback() {
        ClipPricingRepository repo = mock(ClipPricingRepository.class);
        when(repo.findById(anyString())).thenReturn(Optional.empty());
        var s = svc(repo);

        var quote = s.pricing();
        var est = s.estimate("u1", "cp1", null, null);
        // 期望值用 estimate 自己报的出镜秒数与字数算 —— 时长是按文案字数推的（不是我给的
        // durationSec），在这里重算一遍时长模型只会让这条用例变成「我抄对了没有」。
        // 这条要验的是**两处读的是不是同一组单价**，所以只把单价代进去。
        assertEquals(expectedTotal(quote, est), est.total(), "端上按 pricing() 算出的数和服务端 estimate 对不上");
    }

    @Test
    void estimateFollowsTheDatabasePriceToo() {
        ClipPricingRepository repo = mock(ClipPricingRepository.class);
        when(repo.findById(anyString())).thenReturn(Optional.of(ClipPricing.builder()
                .id(ClipPricing.ROW_ID)
                // 与配置兜底值全不相同 —— 只要 estimate 还留着直读配置的老路径，这条就会红
                .avatarSecond(7).ttsPerKchar(40).assemble(11)
                .t2iPerImage(6).t2vSecond(5).i2vSecond(4).build()));
        var s = svc(repo);

        var quote = s.pricing();
        assertEquals(7, quote.creditPerAvatarSecond(), "pricing() 没读到库里的价");

        var est = s.estimate("u1", "cp1", null, null);
        assertEquals(expectedTotal(quote, est), est.total(),
                "estimate 还在读配置：库里改了价之后，端上报价与服务端核对会分叉，用户每次生成都 409");
        // 再钉死一次「确实用的是库里的价」：拿配置兜底价算出来的数必须与实际不同，
        // 否则上面那条在「两边都读配置」时也会绿。
        var fallback = new com.aistareco.aep.clip.dto.ClipDtos.PricingDto(1, 2, 1, 1, 3, 5);
        assertNotEquals(expectedTotal(fallback, est), est.total(), "这条用例没有区分度：库价与配置价算出来一样");
    }

    @Test
    void assembleQuoteFollowsTheSameSource() {
        ClipPricingRepository repo = mock(ClipPricingRepository.class);
        when(repo.findById(anyString())).thenReturn(Optional.of(ClipPricing.builder()
                .id(ClipPricing.ROW_ID).avatarSecond(1).ttsPerKchar(1).assemble(99)
                .t2iPerImage(1).t2vSecond(1).i2vSecond(1).build()));
        // 合成整片那一步真正扣的数，也必须来自同一处
        assertEquals(99, svc(repo).assembleQuote());
    }
}
