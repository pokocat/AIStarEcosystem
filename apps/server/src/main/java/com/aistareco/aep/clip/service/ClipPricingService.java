package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos.PricingDto;
import com.aistareco.aep.clip.model.ClipPricing;
import com.aistareco.aep.clip.repository.ClipPricingRepository;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 六档生成单价的**唯一真源**。
 *
 * <p>在这之前它们只存在于 {@code application.yml}：改一次价要改目标机配置再重启出片服务。
 * 军师那边的铁律是「会影响真实用户的对外数据（定价/权益）归运营后台，代码不许当真相源」，
 * 这六档一直不满足。现在库里有一行就用库里的，没有就回落配置 —— 后台据此显示
 * 「当前是配置兜底价，尚未核定」。
 *
 * <p><b>为什么必须是一个 resolver，不能两处各读各的。</b>
 * 端上按 {@code /api/me/clip/pricing} 拿到一组数算报价，服务端在 {@code estimate()} 里按
 * 另一组数核对 —— 只要这两处读的不是同一个地方，差一分钱就是**每次生成都 409**。
 * 所以 {@link ClipEstimateService} 的 estimate 和 pricing 都只走这里，一个字面量都不留。
 *
 * <p><b>缓存与改价的窗口。</b> 30 秒缓存。运营改价的那一刻，端上手里可能还攥着改价前取到的
 * 价目表，提交时服务端已经按新价核对 → 409「报价已过期，请重新确认」。这是**有意的**：
 * 宁可让用户重看一眼，也不按另一个数扣钱。与克隆定价那边同一口径。
 */
@Service
public class ClipPricingService {
    /** 与克隆定价（军师侧 featureFlag）同一档，保持两边改价的生效延迟一致。 */
    private static final long TTL_MS = 30_000;

    private final ClipPricingRepository repo;
    private final ClipProperties props;

    private volatile ClipPricing cached;
    private volatile long cachedAt;

    public ClipPricingService(ClipPricingRepository repo, ClipProperties props) {
        this.repo = repo; this.props = props;
    }

    /** 库里那一行；null = 运营没核定过。 */
    private ClipPricing row(boolean fresh) {
        if (!fresh && cachedAt > 0 && System.currentTimeMillis() - cachedAt < TTL_MS) return cached;
        ClipPricing found = repo.findById(ClipPricing.ROW_ID).orElse(null);
        cached = found; cachedAt = System.currentTimeMillis();
        return found;
    }

    /** 运营核定过没有。后台据此显示「兜底价」还是「已核定」。 */
    public boolean configured() { return row(false) != null; }

    /**
     * 当前生效的六档。库里有就用库里的，否则回落配置。
     *
     * <p>回落路径上任一档没配仍然 503（{@code CLIP_PRICING_NOT_CONFIGURED}），不给端上
     * 一张半真的价目表 —— 少一档端上读到 undefined，算出来是 NaN，用户看到「NaN 钻石」。
     */
    public PricingDto resolved() {
        ClipPricing r = row(false);
        if (r != null) {
            return new PricingDto(r.getAvatarSecond(), r.getT2iPerImage(), r.getT2vSecond(),
                    r.getI2vSecond(), r.getAssemble(), r.getTtsPerKchar());
        }
        return new PricingDto(props.requirePrice(props.getPricingAvatarSecond(), "avatar-second"),
                props.requirePrice(props.getPricingT2iPerImage(), "t2i-per-image"),
                props.requirePrice(props.getPricingT2vSecond(), "t2v-second"),
                props.requirePrice(props.getPricingI2vSecond(), "i2v-second"),
                props.requirePrice(props.getPricingAssemble(), "assemble"),
                props.requirePrice(props.getPricingTtsPerKchar(), "tts-per-kchar"));
    }

    /** 单价上限。挡住误输入（多打一个 0）把用户余额一次清空。与军师侧克隆定价同一个数。 */
    public static final int MAX = 1_000_000;

    private static int check(Integer v, String key) {
        if (v == null || v < 0 || v > MAX) {
            throw BusinessException.badRequest("CLIP_PRICING_INVALID",
                    "「" + key + "」要是 0 到 " + MAX + " 之间的整数（0 = 这一档免费）");
        }
        return v;
    }

    /**
     * 整组核定。**六档必须一起给**，不接受只改其中几个。
     *
     * <p>只改一档会把另外五档「没人核定过的配置兜底值」一并升格成「运营配过的价」——
     * 从此后台显示「已核定」，但那五个数从来没有人看过。与军师侧克隆定价同一条规矩。
     */
    @Transactional
    public PricingDto save(String operator, Integer avatarSecond, Integer ttsPerKchar, Integer assemble,
                           Integer t2iPerImage, Integer t2vSecond, Integer i2vSecond) {
        Instant now = Instant.now();
        ClipPricing r = repo.findById(ClipPricing.ROW_ID).orElseGet(
                () -> ClipPricing.builder().id(ClipPricing.ROW_ID).createdAt(now).build());
        r.setAvatarSecond(check(avatarSecond, "数字人每秒"));
        r.setTtsPerKchar(check(ttsPerKchar, "配音每千字"));
        r.setAssemble(check(assemble, "合成整片"));
        r.setT2iPerImage(check(t2iPerImage, "文生图每张"));
        r.setT2vSecond(check(t2vSecond, "文生视频每秒"));
        r.setI2vSecond(check(i2vSecond, "图生视频每秒"));
        r.setUpdatedBy(operator == null || operator.isBlank() ? null : operator.substring(0, Math.min(128, operator.length())));
        r.setUpdatedAt(now);
        ClipPricing saved = repo.save(r);
        // 写完立刻失效，不等 TTL —— 运营点了保存却要等 30 秒才看见新价，会以为没存上、再点一次。
        cached = saved; cachedAt = System.currentTimeMillis();
        return resolved();
    }
}
