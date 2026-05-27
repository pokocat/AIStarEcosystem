// ─────────────────────────────────────────────────────────────────────────────
// 小程序多环境配置 — 拷为 env.js（已在 .gitignore）后按本机环境填写
//
// 用法：
//   cp apps/miniprogram/config/env.example.js apps/miniprogram/config/env.js
//   vim apps/miniprogram/config/env.js   // 改 apiBaseUrl / useMock
//
// 没有 env.js 时（首次 clone / CI），app.js 用 module 内部 fallback（与本文件 default 一致）。
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
  // 生产    ：https://api.aistar.com/api
  apiBaseUrl: "https://api.aistar.com/api",
};
