package com.aistareco.aep.repository;

import com.aistareco.aep.model.RechargeOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface RechargeOrderRepository extends JpaRepository<RechargeOrder, String> {

    /** 用户自己的充值订单（最新在前）。 */
    List<RechargeOrder> findByUserIdOrderByCreatedAtDesc(String userId);

    /** 单个订单 + 归属校验（避免越权操作他人订单）。 */
    Optional<RechargeOrder> findByIdAndUserId(String id, String userId);

    /** admin：全部订单（最新在前）。 */
    List<RechargeOrder> findAllByOrderByCreatedAtDesc();

    /** admin：按状态过滤（最新在前）。 */
    List<RechargeOrder> findByStatusOrderByCreatedAtDesc(RechargeOrder.Status status);

    /** 用户待确认订单数（下单防刷的软上限判断）。 */
    long countByUserIdAndStatus(String userId, RechargeOrder.Status status);

    /** 支付回调按网关订单号查单（幂等 + 对账）。 */
    Optional<RechargeOrder> findByPayOrderId(String payOrderId);

    /**
     * 入账幂等闸（v2 §4.3）：条件 UPDATE 抢占 PENDING → PAID。
     * 返回受影响行数：1 = 本次抢到结算权，继续入账；0 = 已被结算（幂等 no-op）。
     * clearAutomatically 清持久化上下文，调用方需重新 findById 拿到最新行再回填。
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE RechargeOrder o SET o.status = com.aistareco.aep.model.RechargeOrder.Status.PAID, "
            + "o.paidAt = :paidAt, o.updatedAt = :paidAt "
            + "WHERE o.id = :id AND o.status = com.aistareco.aep.model.RechargeOrder.Status.PENDING")
    int markPaid(@Param("id") String id, @Param("paidAt") Instant paidAt);

    // ── v2 §11 对账聚合：订单侧现金事实（与账本 RECHARGE 勾稽） ─────────────────
    // 曾入账过的订单 = PAID + REFUNDED（退款只改状态、不删 RECHARGE 账本分录），故两态都算。

    /** 曾入账订单的积分合计，指定 paidVia（如 "shadow"），用于把影子单从真实现金勾稽里剔除。 */
    @Query("SELECT COALESCE(SUM(o.credits), 0) FROM RechargeOrder o "
            + "WHERE o.status IN :statuses AND o.paidVia = :paidVia")
    long sumCreditsByStatusesAndPaidVia(@Param("statuses") List<RechargeOrder.Status> statuses,
                                        @Param("paidVia") String paidVia);

    /** 曾入账订单的积分合计，排除指定 paidVia（真实现金侧 = 非 shadow）。 */
    @Query("SELECT COALESCE(SUM(o.credits), 0) FROM RechargeOrder o "
            + "WHERE o.status IN :statuses AND (o.paidVia IS NULL OR o.paidVia <> :paidVia)")
    long sumCreditsByStatusesExcludingPaidVia(@Param("statuses") List<RechargeOrder.Status> statuses,
                                              @Param("paidVia") String paidVia);

    /** 退款回收积分合计（REFUNDED 订单的 refundedCredits），排除 shadow（与 grossRecharge 同口径）。 */
    @Query("SELECT COALESCE(SUM(o.refundedCredits), 0) FROM RechargeOrder o "
            + "WHERE o.status = com.aistareco.aep.model.RechargeOrder.Status.REFUNDED "
            + "AND (o.paidVia IS NULL OR o.paidVia <> :paidVia)")
    long sumRefundedCreditsExcludingPaidVia(@Param("paidVia") String paidVia);
}
