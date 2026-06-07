package com.aistareco.aep.repository;

import com.aistareco.aep.model.RechargeOrder;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
