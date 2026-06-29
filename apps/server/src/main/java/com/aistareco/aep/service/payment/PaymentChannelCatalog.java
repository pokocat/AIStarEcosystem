package com.aistareco.aep.service.payment;

import com.aistareco.aep.dto.PaymentChannelDto;

import java.util.List;
import java.util.Map;

/**
 * 支付渠道静态目录（v0.94）—— 渠道元数据的单一事实源：展示名 / 默认支付方式 / 机密字段名 /
 * 支持的支付方式（场景）。admin 配置页（即便某渠道尚未配置也列出表单）与收银台渠道列表共用，
 * 避免「字段名 / 场景」在网关、DTO、前端三处漂移。
 *
 * <p>机密字段只存"名字"（用于 admin 表单渲染 + 必填校验），真实值在
 * {@link PaymentChannelConfigService} 加密存取。
 */
public final class PaymentChannelCatalog {

    private PaymentChannelCatalog() {}

    /**
     * @param code          渠道代码（= PaymentGateway.driverName()）
     * @param label         默认展示名
     * @param defaultWayCode 默认支付方式
     * @param requiredCreds 必填机密字段（齐全才算 configured / 可下单）
     * @param allCreds      全部机密字段（admin 表单渲染顺序）
     * @param ways          支持的支付方式（前端「选支付方式」）
     */
    public record ChannelMeta(
            String code,
            String label,
            String defaultWayCode,
            List<String> requiredCreds,
            List<String> allCreds,
            List<PaymentChannelDto.Way> ways
    ) {}

    public static final ChannelMeta ALIPAY = new ChannelMeta(
            "alipay", "支付宝", "ALI_PC",
            List.of("appId", "merchantPrivateKey", "alipayPublicKey", "notifyUrl", "gatewayHost"),
            List.of("appId", "merchantPrivateKey", "alipayPublicKey", "gatewayHost", "notifyUrl", "returnUrl", "signType", "protocol"),
            List.of(
                    new PaymentChannelDto.Way("ALI_PC", "电脑网站", "pc"),
                    new PaymentChannelDto.Way("ALI_WAP", "手机网站", "wap"),
                    new PaymentChannelDto.Way("ALI_QR", "扫码支付", "qr")
            ));

    public static final ChannelMeta WECHAT = new ChannelMeta(
            "wechat", "微信支付", "WX_NATIVE",
            List.of("mchId", "appId", "apiV3Key", "merchantPrivateKey", "merchantSerialNumber", "notifyUrl"),
            List.of("mchId", "appId", "apiV3Key", "merchantPrivateKey", "merchantSerialNumber", "notifyUrl"),
            List.of(
                    new PaymentChannelDto.Way("WX_NATIVE", "扫码支付", "qr"),
                    new PaymentChannelDto.Way("WX_JSAPI", "微信小程序", "jsapi"),
                    new PaymentChannelDto.Way("WX_H5", "手机浏览器", "h5")
            ));

    public static final ChannelMeta SHADOW = new ChannelMeta(
            "shadow", "模拟收银台", "SHADOW",
            List.of(), List.of(),
            List.of(new PaymentChannelDto.Way("SHADOW", "模拟支付", "shadow")));

    /** 可经 admin 配置的真实渠道（不含 shadow —— shadow 由 dev 开关控制，无机密）。 */
    public static final List<ChannelMeta> CONFIGURABLE = List.of(ALIPAY, WECHAT);

    private static final Map<String, ChannelMeta> BY_CODE = Map.of(
            "alipay", ALIPAY, "wechat", WECHAT, "shadow", SHADOW);

    public static ChannelMeta of(String code) {
        return code == null ? null : BY_CODE.get(code);
    }

    /** wayCode → 渠道代码（对账 / 查单 / 回调路由用）。ALI_*→alipay，WX_*→wechat，SHADOW→shadow。 */
    public static String channelFromWayCode(String wayCode) {
        if (wayCode == null) return null;
        if (wayCode.startsWith("ALI_")) return "alipay";
        if (wayCode.startsWith("WX_")) return "wechat";
        if ("SHADOW".equals(wayCode)) return "shadow";
        return null;
    }
}
