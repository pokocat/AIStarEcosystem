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
}
