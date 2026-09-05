// config.js — 小程序运行时配置的唯一出口
//
// 真值来自 config/env.js（已 gitignore，模板见 config/env.example.js）。
// env.js 不存在时（首次 clone / CI）回落到 mock 默认值，保持 v0.34 以来的行为不变。
//
// 平台坑：小程序 require 缺失模块会直接 throw，必须 try/catch。详见 agent.md「分包 / 异步加载」

let _env = null;
try {
  _env = require("./config/env.js");
} catch (e) {
  // env.js 不存在 → fallback 走 mock，避免无声打到不存在的线上域名
  _env = null;
}

const FALLBACK = {
  useMock: true,
  apiBaseUrl: "http://localhost:8080/api"
};

const raw = Object.assign({}, FALLBACK, _env || {});

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

// 统一账号中心地址（dev http://localhost:8090 / 生产 https://id.aibuzz.cn）。
// 留空 = 不接账号中心，继续走 legacy 的「手机号 + 短信 + 激活码」注册。
const idBaseUrl = trimSlash(raw.idBaseUrl);

// 登录模式：显式配置优先；没配就按「有没有填 idBaseUrl」推导。
const declaredMode = String(raw.authMode || "").toLowerCase();
let authMode = declaredMode;
if (authMode !== "id" && authMode !== "legacy") {
  authMode = idBaseUrl ? "id" : "legacy";
}

// 显式声明 id 模式却没给地址 = 配置错误，**fail closed**（Codex 三轮 P2-6）。
// 原来这里悄悄退回 legacy：小程序照样能起来、照样能用「手机号 + 激活码」注册一个
// **只存在于产品库、账号中心里没有**的账号 —— 等配置修好，这批人是一堆对不上号的孤儿数据，
// 而现场没有任何人会发现配置错了。所以宁可这一版起不来，也不走错的那条登录线。
// （authMode 没写、靠 idBaseUrl 推导出的 legacy 是正常形态，不在此列。）
const configError = declaredMode === "id" && !idBaseUrl
  ? "配置错误：缺少账号中心地址"
  : "";

const config = {
  // env.js 里显式写 false 才关 mock；缺字段按 FALLBACK（true）
  useMock: raw.useMock !== false,
  apiBaseUrl: trimSlash(raw.apiBaseUrl) || FALLBACK.apiBaseUrl,

  // ── 统一账号中心（docs/unified-identity-plan.md §12.6）─────────────────
  authMode,
  idBaseUrl,
  idClientId: raw.idClientId || "mini-aistar",

  /**
   * 产品短码：id 模式下随每个业务请求发 `X-App-Code`，server 的开通闸（EnrollmentGuard）
   * 据此判定「这次请求属于哪个产品」。必须是产品 key（celebrity），不是入口短码。
   * legacy 模式沿用历史审计短码 celebrity-mp（区分「明星带货·小程序」入口）。
   */
  appCode: raw.appCode || "celebrity",
  legacyAppCode: "celebrity-mp",

  /** 本小程序对应的产品（开通 / 权益判定都用它） */
  product: raw.product || "celebrity",

  /**
   * 配置本身不可用时的说明文案（空串 = 配置正常）。
   * 启动页据此直接渲染错误屏，绝不退回 legacy 登录。
   */
  configError,

  isIdMode() {
    return this.authMode === "id";
  },

  hasConfigError() {
    return !!this.configError;
  }
};

module.exports = config;
