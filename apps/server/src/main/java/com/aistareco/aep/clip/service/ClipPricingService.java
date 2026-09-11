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

    /**
     * 缓存。两个字段合成一个不可变快照一起换，而不是各自 volatile 地写
     * （codex 2026-09-11 审出）：分开写的话，「线程 A 读到旧行 → 暂停 → 线程 B 存了新价并
     * 更新缓存 → A 恢复后把旧行写回缓存」这条交错会让新价在 30 秒内被旧价盖掉，
     * 刚按新价拿到报价的端上提交时会被按旧价核对，收到一次莫名其妙的 409。
     *
     * 换成 CAS：只有当自己读到的快照仍然是当时那一份时才发布，否则认输，让更新的那份留着。
     */
    private record Snapshot(ClipPricing row, long at, long seq) {}
    private final java.util.concurrent.atomic.AtomicReference<Snapshot> cache =
            new java.util.concurrent.atomic.AtomicReference<>(null);
    private final java.util.concurrent.atomic.AtomicLong seqGen = new java.util.concurrent.atomic.AtomicLong();

    public ClipPricingService(ClipPricingRepository repo, ClipProperties props) {
        this.repo = repo; this.props = props;
    }

    /** 库里那一行；null = 运营没核定过。 */
    private ClipPricing row(boolean fresh) {
        Snapshot seen = cache.get();
        if (!fresh && seen != null && System.currentTimeMillis() - seen.at() < TTL_MS) return seen.row();
        long mySeq = seqGen.incrementAndGet();
        ClipPricing found = repo.findById(ClipPricing.ROW_ID).orElse(null);
        // 只有缓存还停在我出发时那一份，才轮得到我发布 —— 否则期间有人存了更新的价，
        // 我手里这份已经是旧的了，写回去就是把新价盖掉。
        cache.compareAndSet(seen, new Snapshot(found, System.currentTimeMillis(), mySeq));
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
        return new PricingDto(fromConfig(props.getPricingAvatarSecond(), "avatar-second"),
                fromConfig(props.getPricingT2iPerImage(), "t2i-per-image"),
                fromConfig(props.getPricingT2vSecond(), "t2v-second"),
                fromConfig(props.getPricingI2vSecond(), "i2v-second"),
                fromConfig(props.getPricingAssemble(), "assemble"),
                fromConfig(props.getPricingTtsPerKchar(), "tts-per-kchar"));
    }

    /**
     * 读一档配置兜底价，**同样卡 {@link #MAX} 上限**。
     *
     * <p>库里的价走 {@link #check} 挡住了超范围，回落这条路径原来没挡（codex 2026-09-11 审出）：
     * 配置里写 100000000，30 秒出镜在 {@code ClipEstimateService} 的 int 乘法里溢出成负数 ——
     * 报价变成负数，扣费口径跟着失真。配置写错是运维事故，要当场 503 说清楚，
     * 不能让它一路算成一个看起来正常的负数。
     */
    private int fromConfig(String raw, String key) {
        int v = props.requirePrice(raw, key);
        if (v > MAX) {
            throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "CLIP_PRICING_NOT_CONFIGURED",
                    "口播视频计费配置越界（" + key + "=" + v + "，上限 " + MAX + "）");
        }
        return v;
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
        // **不在这里发布缓存。** 这个方法带 @Transactional，事务还没提交；这时把新价塞进缓存，
        // 万一事务最终回滚，一个从未落库的价会在缓存里生效 30 秒（codex 2026-09-11 审出）。
        // 改成提交后再失效：运营点了保存却要等 30 秒才看见新价会以为没存上，所以是
        // **失效**（下次读重新查库）而不是等 TTL 自然过期。
        final PricingDto pending = new PricingDto(saved.getAvatarSecond(), saved.getT2iPerImage(),
                saved.getT2vSecond(), saved.getI2vSecond(), saved.getAssemble(), saved.getTtsPerKchar());
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCompletion(int status) { cache.set(null); }
                    });
        } else {
            // 没有外层事务（直接调用 / 单测）：没有「提交」这个时刻可等，当场失效即可。
            // 用 isSynchronizationActive 判断而不是让 registerSynchronization 抛 ——
            // 「只在有事务时才能调」这种前提不该用异常来表达。
            cache.set(null);
        }
        // 回给调用方的是**这次要写的值**，不是再读一次缓存 —— 事务里读缓存只会读到旧的。
        return pending;
    }
}
