// ─────────────────────────────────────────────────────────────────────────────
// types/payment-config.ts — 支付渠道配置（v0.94 多渠道直连）。
// 机密永不明文返回：creds 的值是脱敏掩码（sk-…XXXX）或空串。
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentChannelConfig {
  code: string;            // alipay / wechat
  label: string;
  enabled: boolean;
  sandbox: boolean;
  sortOrder: number;
  defaultWayCode: string;
  configured: boolean;     // 必填机密是否齐全（可启用）
  creds: Record<string, string>; // 字段名 → 脱敏值（""=未配置）
  updatedAt?: string;
  updatedBy?: string;
}

/** 更新入参：creds 留空=保留原值；"__CLEAR__"=清空；其余=覆盖。 */
export interface PaymentChannelUpsert {
  enabled?: boolean;
  sandbox?: boolean;
  label?: string;
  sortOrder?: number;
  defaultWayCode?: string;
  creds?: Record<string, string>;
}

/** 各渠道机密字段元数据（表单渲染 + 说明）。与后端 PaymentChannelCatalog 对齐。 */
export const PAYMENT_CRED_FIELDS: Record<string, { key: string; label: string; required: boolean; multiline?: boolean }[]> = {
  alipay: [
    { key: "appId", label: "应用 APPID", required: true },
    { key: "merchantPrivateKey", label: "应用私钥（RSA2 PKCS8）", required: true, multiline: true },
    { key: "alipayPublicKey", label: "支付宝公钥", required: true, multiline: true },
    { key: "gatewayHost", label: "网关 host（沙箱 openapi-sandbox.dl.alipaydev.com / 生产 openapi.alipay.com）", required: true },
    { key: "notifyUrl", label: "异步回调地址（…/api/pay/notify/alipay）", required: true },
    { key: "returnUrl", label: "同步跳回地址（可空，仅展示）", required: false },
    { key: "signType", label: "签名类型（默认 RSA2）", required: false },
  ],
  wechat: [
    { key: "mchId", label: "商户号 mchid", required: true },
    { key: "appId", label: "appid（公众号/小程序/App）", required: true },
    { key: "apiV3Key", label: "APIv3 密钥", required: true },
    { key: "merchantPrivateKey", label: "商户私钥（PEM）", required: true, multiline: true },
    { key: "merchantSerialNumber", label: "商户证书序列号", required: true },
    { key: "notifyUrl", label: "异步回调地址（…/api/pay/notify/wechat）", required: true },
  ],
};

/** 各渠道默认支付方式选项（与后端 catalog 对齐）。 */
export const PAYMENT_WAY_OPTIONS: Record<string, { code: string; label: string }[]> = {
  alipay: [
    { code: "ALI_PC", label: "电脑网站" },
    { code: "ALI_WAP", label: "手机网站" },
    { code: "ALI_QR", label: "扫码支付" },
  ],
  wechat: [
    { code: "WX_NATIVE", label: "扫码支付" },
    { code: "WX_JSAPI", label: "微信小程序" },
    { code: "WX_H5", label: "手机浏览器" },
  ],
};
