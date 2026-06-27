package com.aistareco.aep.service;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.service.payment.PayCreateCommand;
import com.aistareco.aep.service.payment.PayCreateResult;
import com.aistareco.aep.service.payment.PayQueryResult;
import com.aistareco.aep.service.payment.PaymentGateway;
import com.aistareco.aep.service.payment.PaymentProperties;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * 充值在线支付编排（v2 §4.1 / §6.4 / §6.7）。
 *
 * checkout：建 PENDING 订单 → 调 {@link PaymentGateway} 统一下单 → 回填 payOrderId → 返回 payData。
 * 入账不在这里：支付成功后由 PayNotify（Jeepay）/ 影子确认调 {@link RechargeService#settlePaidOrder}。
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final RechargeService rechargeService;
    private final PaymentGateway gateway;
    private final PaymentProperties props;

    public PaymentService(RechargeService rechargeService, PaymentGateway gateway, PaymentProperties props) {
        this.rechargeService = rechargeService;
        this.gateway = gateway;
        this.props = props;
    }

    /**
     * 子应用内充值下单。返回 payData 供前端拉起支付（影子链路 → 模拟收银台）。
     *
     * @param wayCode 支付方式，空则按 driver 取默认（shadow→SHADOW，jeepay→WX_LITE）
     * @param openid  微信小程序 openid（WX_LITE 必填）
     */
    public CheckoutResponse checkout(String userId, String packageId, String wayCode,
                                     String openid, String clientIp, String sourceApp) {
        String resolvedWay = (wayCode == null || wayCode.isBlank()) ? defaultWayCode() : wayCode;

        // v2 §6 防重复支付：复用 TTL 内的同套餐 PENDING 单（双击/重试不生成重复单）。
        RechargeOrder order = rechargeService.createOrReuseCheckoutOrder(userId, packageId, resolvedWay, sourceApp);

        PayCreateResult res;
        try {
            res = gateway.createPayOrder(new PayCreateCommand(
                    order.getId(), order.getPriceCents(), resolvedWay, "AIStarEco 积分充值", openid, clientIp));
        } catch (RuntimeException e) {
            // 网关异常 → 标 CANCELLED（不留悬挂 PENDING）+ 抛带码错误（§8.0：不入账、不建假单）
            log.warn("[pay] gateway createPayOrder failed orderId={} driver={} err={}",
                    order.getId(), gateway.driverName(), e.toString());
            rechargeService.cancelForGatewayError(order.getId(), "支付下单失败：" + e.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "PAYMENT_GATEWAY_ERROR", "支付下单失败，请稍后再试");
        }

        rechargeService.attachPayOrder(order.getId(), res.payOrderId());
        log.info("[pay] checkout ok orderId={} driver={} payOrderId={} payDataType={}",
                order.getId(), gateway.driverName(), res.payOrderId(), res.payDataType());
        return new CheckoutResponse(order.getId(), res.payDataType(), res.payData());
    }

    /**
     * v2 §6 主动查单（收银台「我已支付 / 刷新状态」+ 订单详情同步）。
     * 仅对 PENDING 在线订单查网关：已支付→结算（幂等闸）；超 TTL 未支付→关单（CLOSED）；
     * 否则返回当前态。终态 / 影子链路 / 未拉起网关（无 payOrderId）直接返回当前态。
     */
    public RechargeOrderDto syncOrder(String userId, String orderId) {
        RechargeOrderDto dto = rechargeService.getOrderForUser(userId, orderId); // 归属校验
        if (!"pending".equalsIgnoreCase(dto.status())) {
            return dto; // 终态不再查
        }
        boolean overTtl = dto.createdAt() != null
                && dto.createdAt().isBefore(Instant.now().minus(Duration.ofMinutes(rechargeService.pendingTtlMinutes())));
        if (!"shadow".equals(gateway.driverName()) && dto.payOrderId() != null) {
            try {
                PayQueryResult q = gateway.queryPayOrder(orderId);
                if (q.paid()) {
                    return rechargeService.settlePaidOrder(orderId, gateway.driverName(), q.channelPayNo(), null, null);
                }
            } catch (RuntimeException e) {
                log.warn("[pay] syncOrder 查单失败 orderId={}: {}", orderId, e.toString());
            }
        }
        if (overTtl) {
            return rechargeService.closeOrder(orderId, "支付超时自动关闭");
        }
        return rechargeService.getOrderForUser(userId, orderId);
    }

    private String defaultWayCode() {
        return switch (gateway.driverName()) {
            case "shadow" -> "SHADOW";
            case "alipay" -> props.getAlipay().getDefaultWayCode();
            case "jeepay" -> props.getJeepay().getDefaultWayCode();
            default -> "WX_LITE";
        };
    }
}
