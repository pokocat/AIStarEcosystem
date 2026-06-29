package com.aistareco.aep.service;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.dto.PaymentChannelDto;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.model.PaymentChannelConfig;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.service.payment.PayCreateCommand;
import com.aistareco.aep.service.payment.PayCreateResult;
import com.aistareco.aep.service.payment.PayQueryResult;
import com.aistareco.aep.service.payment.PaymentChannelCatalog;
import com.aistareco.aep.service.payment.PaymentChannelConfigService;
import com.aistareco.aep.service.payment.PaymentGateway;
import com.aistareco.aep.service.payment.PaymentGatewayRegistry;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 充值在线支付编排（v2 §4.1 / §6.4 / §6.7；v0.94 多渠道）。
 *
 * checkout：定渠道（用户选 / 默认）→ 建 PENDING 订单 → 调对应 {@link PaymentGateway} 统一下单 → 返回 payData。
 * 入账不在这里：支付成功后由各渠道异步回调（支付宝 / 微信 notify）/ 影子确认调
 * {@link RechargeService#settlePaidOrder}。渠道启用 + 机密以 {@link PaymentChannelConfigService}（DB）为准。
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final RechargeService rechargeService;
    private final PaymentGatewayRegistry registry;
    private final PaymentChannelConfigService channelConfig;

    public PaymentService(RechargeService rechargeService, PaymentGatewayRegistry registry,
                          PaymentChannelConfigService channelConfig) {
        this.rechargeService = rechargeService;
        this.registry = registry;
        this.channelConfig = channelConfig;
    }

    /** 收银台可用渠道（已启用 + 机密齐全 + 有网关实现）。前端「选支付方式」据此渲染。 */
    public List<PaymentChannelDto> enabledChannels() {
        List<PaymentChannelDto> out = new ArrayList<>();
        // 真实渠道：DB enabled + 网关 configured + 已注册
        for (PaymentChannelConfig row : channelConfig.listEnabled()) {
            PaymentChannelCatalog.ChannelMeta meta = PaymentChannelCatalog.of(row.getCode());
            PaymentGateway gw = registry.get(row.getCode());
            if (meta == null || gw == null || !gw.isConfigured()) continue;
            out.add(new PaymentChannelDto(
                    row.getCode(),
                    row.getLabel() != null ? row.getLabel() : meta.label(),
                    row.isSandbox(),
                    row.getDefaultWayCode() != null ? row.getDefaultWayCode() : meta.defaultWayCode(),
                    meta.ways()));
        }
        // 影子渠道：dev 开关开 + 网关在册（不进 DB；置于末尾）
        PaymentGateway shadow = registry.get("shadow");
        if (shadow != null && shadow.isConfigured()) {
            out.add(new PaymentChannelDto("shadow", PaymentChannelCatalog.SHADOW.label(), true,
                    "SHADOW", PaymentChannelCatalog.SHADOW.ways()));
        }
        return out;
    }

    /**
     * 子应用内充值下单。返回 payData 供前端拉起支付（页面跳转 / 二维码 / JSAPI 参数 / 影子）。
     *
     * @param channel 支付渠道（alipay / wechat / shadow），空则取首个可用渠道
     * @param wayCode 支付方式，空则按渠道取默认
     * @param openid  微信小程序 openid（WX_JSAPI 必填）
     */
    public CheckoutResponse checkout(String userId, String packageId, String channel, String wayCode,
                                     String openid, String clientIp, String sourceApp) {
        String ch = resolveChannel(channel);
        PaymentGateway gateway = registry.require(ch);
        if (!gateway.isConfigured() || (!"shadow".equals(ch) && !channelConfig.isEnabled(ch))) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_CHANNEL_UNAVAILABLE",
                    "支付渠道暂不可用，请换一种支付方式或稍后再试");
        }
        String resolvedWay = (wayCode == null || wayCode.isBlank()) ? defaultWayCode(ch) : wayCode;

        // v2 §6 防重复支付：复用 TTL 内的同套餐 PENDING 单（双击/重试不生成重复单）。
        RechargeOrder order = rechargeService.createOrReuseCheckoutOrder(userId, packageId, resolvedWay, sourceApp);

        PayCreateResult res;
        try {
            res = gateway.createPayOrder(new PayCreateCommand(
                    order.getId(), order.getPriceCents(), resolvedWay, "AIStarEco 积分充值", openid, clientIp));
        } catch (BusinessException be) {
            // 渠道未配置等带码错误：取消订单后原样上抛（§8.0：不入账、不建假单）
            rechargeService.cancelForGatewayError(order.getId(), "支付下单失败：" + be.getMessage());
            throw be;
        } catch (RuntimeException e) {
            log.warn("[pay] gateway createPayOrder failed orderId={} channel={} err={}",
                    order.getId(), ch, e.toString());
            rechargeService.cancelForGatewayError(order.getId(), "支付下单失败：" + e.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "PAYMENT_GATEWAY_ERROR", "支付下单失败，请稍后再试");
        }

        rechargeService.attachPayOrder(order.getId(), res.payOrderId());
        log.info("[pay] checkout ok orderId={} channel={} way={} payOrderId={} payDataType={}",
                order.getId(), ch, resolvedWay, res.payOrderId(), res.payDataType());
        return new CheckoutResponse(order.getId(), res.payDataType(), res.payData());
    }

    /**
     * v2 §6 主动查单（收银台「我已支付 / 刷新状态」+ 订单详情同步）。
     * 仅对 PENDING 在线订单查网关：已支付→结算（幂等闸）；超 TTL 未支付→关单（CLOSED）；
     * 否则返回当前态。终态 / 影子链路 / 未拉起网关（无 payOrderId）直接返回当前态。
     */
    public RechargeOrderDto syncOrder(String userId, String orderId) {
        return syncOrderCore(rechargeService.getOrderForUser(userId, orderId), orderId); // 用户侧:归属校验
    }

    /** v2 §6 admin 查单同步：无用户归属限制 —— 运营对在线 PENDING 订单核对网关支付结果 → 自动入账/关单。 */
    public RechargeOrderDto syncOrderForAdmin(String orderId) {
        return syncOrderCore(rechargeService.getOrder(orderId), orderId);
    }

    private RechargeOrderDto syncOrderCore(RechargeOrderDto dto, String orderId) {
        if (!"pending".equalsIgnoreCase(dto.status())) {
            return dto; // 终态不再查
        }
        boolean overTtl = dto.createdAt() != null
                && dto.createdAt().isBefore(Instant.now().minus(Duration.ofMinutes(rechargeService.pendingTtlMinutes())));
        String channel = PaymentChannelCatalog.channelFromWayCode(dto.wayCode());
        if (channel != null && !"shadow".equals(channel) && dto.payOrderId() != null) {
            PaymentGateway gateway = registry.get(channel);
            if (gateway != null) {
                try {
                    PayQueryResult q = gateway.queryPayOrder(orderId);
                    if (q.paid()) {
                        return rechargeService.settlePaidOrder(orderId, channel, q.channelPayNo(), null, null);
                    }
                } catch (RuntimeException e) {
                    log.warn("[pay] syncOrder 查单失败 orderId={}: {}", orderId, e.toString());
                }
            }
        }
        if (overTtl) {
            return rechargeService.closeOrder(orderId, "支付超时自动关闭");
        }
        return dto;
    }

    /** 解析渠道：显式传入优先，否则取首个可用渠道；都没有 → 503。 */
    private String resolveChannel(String channel) {
        if (channel != null && !channel.isBlank()) return channel.trim();
        List<PaymentChannelDto> avail = enabledChannels();
        if (avail.isEmpty()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_NO_CHANNEL",
                    "暂无可用支付渠道，请稍后再试或联系客服");
        }
        return avail.get(0).code();
    }

    private String defaultWayCode(String channel) {
        if ("shadow".equals(channel)) return "SHADOW";
        return channelConfig.find(channel)
                .map(PaymentChannelConfig::getDefaultWayCode)
                .filter(w -> w != null && !w.isBlank())
                .orElseGet(() -> {
                    PaymentChannelCatalog.ChannelMeta meta = PaymentChannelCatalog.of(channel);
                    return meta != null ? meta.defaultWayCode() : "SHADOW";
                });
    }
}
