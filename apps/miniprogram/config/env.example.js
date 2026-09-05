// ─────────────────────────────────────────────────────────────────────────────
// 小程序多环境配置 — 拷为 env.js（已在 .gitignore）后按本机环境填写
//
// 用法：
//   cp apps/miniprogram/config/env.example.js apps/miniprogram/config/env.js
//   vim apps/miniprogram/config/env.js   // 改 apiBaseUrl / useMock
//
// 没有 env.js 时（首次 clone / CI），app.js 用 mock fallback（useMock=true），
// **不会**用本文件的 default —— 让首次 clone 的开发者无需配置即可启动。
// 想用本文件的「联线上」default，必须 cp 一份成 env.js。
//
// 小程序「上传发布」前确保 env.js 是生产值；微信开发者工具会把整个目录打包，所以 env.js
// 会随代码上传 → **绝不要** 在 env.js 里写敏感密钥（如 admin token）。
//
// 多套环境推荐做法（手动切）：
//   apps/miniprogram/config/env.dev.js
//   apps/miniprogram/config/env.staging.js
//   apps/miniprogram/config/env.prod.js
//   切换时：cp env.<target>.js env.js
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // 是否走 mock 数据：dev 可 true 避免依赖 server；生产必须 false
  useMock: false,

  // 后端 base url
  // 本地联调：http://localhost:8080/api （需把 localhost 加进小程序「不校验合法域名」白名单）
  // 生产    ：https://api.aibuzz.cn/api
  apiBaseUrl: "https://api.aibuzz.cn/api",

  // ── 统一账号中心（docs/unified-identity-plan.md §12.6）─────────────────────
  //
  // authMode:
  //   "id"     统一账号中心：启动即微信静默授权登录（wx.login），不再填手机号 / 验证码；
  //            激活码降级为登录后的「开通带货」一步。
  //   "legacy" 老流程：手机号 + 短信验证码 + 激活码注册页。
  //   省略此字段时按「填没填 idBaseUrl」自动推导（填了 = id）。
  authMode: "id",

  // 账号中心地址
  // 本地联调：http://localhost:8090
  // 生产    ：https://id.aibuzz.cn
  // 两个地址都要加进小程序管理后台的 request 合法域名（生产必须 https）。
  idBaseUrl: "https://id.aibuzz.cn",

  // 本小程序在账号中心注册的 OAuth2 客户端 id（公开客户端，无 secret）
  idClientId: "mini-aistar",

  // 产品短码：随每个业务请求发 X-App-Code，server 的开通闸据此判定产品归属
  appCode: "celebrity",
};
