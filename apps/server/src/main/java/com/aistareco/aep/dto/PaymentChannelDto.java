package com.aistareco.aep.dto;

import java.util.List;

/**
 * 收银台可用渠道（v0.94 多渠道）。给前端「选支付方式」用 —— 只含展示信息，绝无机密。
 *
 * @param code           渠道代码（alipay / wechat / shadow）
 * @param label          展示名（支付宝 / 微信支付 / 模拟收银台）
 * @param sandbox        是否沙箱（前端可加角标）
 * @param defaultWayCode 默认支付方式
 * @param wayCodes       该渠道支持的支付方式（按场景：电脑网站 / 手机网站 / 扫码 / 小程序…）
 */
public record PaymentChannelDto(
        String code,
        String label,
        boolean sandbox,
        String defaultWayCode,
        List<Way> wayCodes
) {
    /** 单个支付方式：code（ALI_PC/WX_NATIVE…）+ 展示名 + 场景（pc/wap/qr/jsapi/h5/shadow）。 */
    public record Way(String code, String label, String scene) {}
}
