package com.aistareco.aep.service.payment;

import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.repository.RechargeOrderRepository;
import com.aistareco.aep.service.RechargeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 支付查单兜底（v2 §6.4 兜底通道，直连方案补强）。
 *
 * 异步回调（notify）是主路,但回调可能丢失 / 隧道抖动 / 本地无公网收不到。本服务主动对 PENDING
 * 在线订单调 {@link PaymentGateway#queryPayOrder} 查支付网关侧真实态,已支付则复用
 * {@link RechargeService#settlePaidOrder}（条件 UPDATE 幂等,与 notify 共用入账核心,重复无害）。
 *
 * <p>与 notify <b>双保险</b>:任一先到都正确入账且只入账一次。<b>本地无公网联调时,纯靠它也能跑通沙箱全流程</b>。
 * shadow driver 无外部支付态（结算由 confirm 推动）→ 直接跳过。
 */
@Service
public class PaymentReconcileService {

    private static final Logger log = LoggerFactory.getLogger(PaymentReconcileService.class);

    /** 给 notify 留的窗口：太新的订单先不查（等回调）。 */
    private static final long MIN_AGE_SECONDS = 10;
    /** 放弃阈值：太老的待支付订单视为用户已弃单,不再查。 */
    private static final long MAX_AGE_MINUTES = 30;

    private final RechargeOrderRepository orderRepo;
    private final PaymentGateway gateway;
    private final RechargeService rechargeService;

    public PaymentReconcileService(RechargeOrderRepository orderRepo, PaymentGateway gateway,
                                   RechargeService rechargeService) {
        this.orderRepo = orderRepo;
        this.gateway = gateway;
        this.rechargeService = rechargeService;
    }

    /** 定时兜底：默认每 20s 扫一遍待支付在线订单。回调正常时基本是 no-op（已 PAID 不在 PENDING 列）。 */
    @Scheduled(fixedDelayString = "${aep.payment.reconcile.interval-ms:20000}", initialDelay = 20000)
    public void scheduledReconcile() {
        try {
            reconcilePending();
        } catch (Exception e) {
            log.warn("[pay][reconcile] 定时兜底异常（吞,下轮重试）：{}", e.toString());
        }
    }

    /**
     * 扫 PENDING 在线订单（有 payOrderId、年龄在 [10s, 30min]）,逐单查网关,已支付则结算。
     * @return 本轮新结算的订单数
     */
    public int reconcilePending() {
        if ("shadow".equals(gateway.driverName())) {
            return 0; // 影子无外部支付态,结算由 confirm 推动,无需查单
        }
        List<RechargeOrder> pending = orderRepo.findByStatusOrderByCreatedAtDesc(RechargeOrder.Status.PENDING);
        Instant now = Instant.now();
        int settled = 0;
        for (RechargeOrder o : pending) {
            if (o.getPayOrderId() == null) {
                continue; // 未走网关下单（如纯线下订单）
            }
            Duration age = Duration.between(o.getCreatedAt(), now);
            if (age.getSeconds() < MIN_AGE_SECONDS || age.toMinutes() > MAX_AGE_MINUTES) {
                continue; // 给 notify 留窗口 + 放弃过老
            }
            try {
                PayQueryResult q = gateway.queryPayOrder(o.getId());
                if (q.paid()) {
                    rechargeService.settlePaidOrder(o.getId(), gateway.driverName(), q.channelPayNo(), null, null);
                    settled++;
                    log.info("[pay][reconcile] 查单兜底结算 orderId={} channelPayNo={}", o.getId(), q.channelPayNo());
                }
            } catch (Exception e) {
                log.debug("[pay][reconcile] 查单失败 orderId={}（跳过,下轮重试）：{}", o.getId(), e.toString());
            }
        }
        if (settled > 0) {
            log.info("[pay][reconcile] 本轮兜底结算 {} 单", settled);
        }
        return settled;
    }
}
