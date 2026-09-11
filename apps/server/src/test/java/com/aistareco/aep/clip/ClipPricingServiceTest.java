package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipPricing;
import com.aistareco.aep.clip.repository.ClipPricingRepository;
import com.aistareco.aep.clip.service.ClipPricingService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 六档单价：库里有就用库里的，没有回落配置。
 *
 * <p>这组用例里最要紧的一条不是「存得进去」，是 <b>estimate 与 pricing 读同一处</b> ——
 * 端上按 pricing() 的数算报价，服务端按 estimate() 的数核对，两处只要读的不是同一个地方，
 * 差一分钱就是每次生成都 409。那条在 ClipEstimatePricingSourceTest 里。
 */
class ClipPricingServiceTest {
    private ClipPricingRepository repo;
    private ClipProperties props;
    private ClipPricingService svc;

    @BeforeEach
    void setUp() {
        repo = mock(ClipPricingRepository.class);
        props = new ClipProperties();
        props.setPricingAvatarSecond("1"); props.setPricingTtsPerKchar("5");
        props.setPricingAssemble("0"); props.setPricingT2iPerImage("2");
        props.setPricingT2vSecond("1"); props.setPricingI2vSecond("1");
        // 让 mock 像个真仓库：save 之后 findById 要能读回来。
        // 不这么做的话，save() 清缓存后重新查库仍然读到空，用例验的就不是「存进去了」
        // 而是「mock 没配」—— 这正是修完缓存竞态之后暴露出来的（写完不再直接塞缓存，
        // 改成失效 + 下次读重新查库）。
        var store = new java.util.concurrent.atomic.AtomicReference<ClipPricing>(null);
        when(repo.findById(ClipPricing.ROW_ID)).thenAnswer(i -> Optional.ofNullable(store.get()));
        when(repo.save(any(ClipPricing.class))).thenAnswer(i -> {
            ClipPricing row = i.getArgument(0);
            store.set(row);
            return row;
        });
        svc = new ClipPricingService(repo, props);
    }

    @Test
    void fallsBackToConfigWhenOperatorNeverApproved() {
        assertFalse(svc.configured(), "库里没那行 = 运营没核定过");
        var p = svc.resolved();
        assertEquals(1, p.creditPerAvatarSecond());
        assertEquals(5, p.creditPerKChar());
        assertEquals(2, p.creditPerImage());
    }

    @Test
    void dbRowWinsOverConfig() {
        var seeded = mock(ClipPricingRepository.class);
        when(seeded.findById(ClipPricing.ROW_ID)).thenReturn(Optional.of(ClipPricing.builder()
                .id(ClipPricing.ROW_ID).avatarSecond(9).ttsPerKchar(8).assemble(7)
                .t2iPerImage(6).t2vSecond(5).i2vSecond(4).build()));
        var fresh = new ClipPricingService(seeded, props);
        assertTrue(fresh.configured());
        var p = fresh.resolved();
        assertEquals(9, p.creditPerAvatarSecond());
        assertEquals(8, p.creditPerKChar());
        assertEquals(7, p.creditPerAssemble());
        assertEquals(6, p.creditPerImage());
        assertEquals(5, p.creditPerT2vSecond());
        assertEquals(4, p.creditPerI2vSecond());
    }

    @Test
    void saveTakesEffectImmediatelyWithoutWaitingForTtl() {
        svc.resolved(); // 先暖一次缓存（此时是配置兜底值）
        svc.save("op1", 11, 12, 13, 14, 15, 16);
        // 不等 30 秒 TTL：运营点了保存却要等半分钟才看见新价，会以为没存上、再点一次
        assertEquals(11, svc.resolved().creditPerAvatarSecond());
        assertTrue(svc.configured());
    }

    @Test
    void rejectsOutOfRangeRatherThanClamping() {
        // 多打一个 0 能把用户余额一次清空，所以是拒绝而不是截断
        assertThrows(BusinessException.class, () -> svc.save("op", 1, 1, 1, 1, 1, 100_000_001));
        assertThrows(BusinessException.class, () -> svc.save("op", -1, 1, 1, 1, 1, 1));
        verify(repo, never()).save(any());
    }

    @Test
    void everySlotIsRequired() {
        // 只给一半会把另一半「没人核定过的配置兜底值」一并升格成「运营配过的价」，
        // 从此后台显示「已核定」，而那几个数从来没有人看过。
        assertThrows(BusinessException.class, () -> svc.save("op", 1, null, 1, 1, 1, 1));
        verify(repo, never()).save(any());
    }

    // 库里的价走 check() 挡住了超范围，回落配置这条路径原来没挡：配置写 100000000，
    // 30 秒出镜在 estimate 的 int 乘法里溢出成负数 —— 报价变负、扣费口径失真。
    // 配置写错是运维事故，要当场 503 说清楚，不能一路算成一个看起来正常的负数。
    @Test
    void configFallbackAlsoEnforcesTheCeiling() {
        props.setPricingAvatarSecond("100000000");
        assertThrows(BusinessException.class, () -> new ClipPricingService(repo, props).resolved());
    }

    @Test
    void zeroIsAValidPriceAndNotTreatedAsMissing() {
        // 0 = 这一档免费，是运营的正当选择。若把 0 当成「没填」就永远配不出免费档。
        svc.save("op", 0, 0, 0, 0, 0, 0);
        assertEquals(0, svc.resolved().creditPerAssemble());
        assertTrue(svc.configured());
    }
}
