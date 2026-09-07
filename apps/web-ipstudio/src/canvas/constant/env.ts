// 上游这里读的是 Vite 的构建期注入（__APP_VERSION__ / import.meta.env）。
// 本仓是 Next，没有这些，改成常量。

export const APP_VERSION = "ipstudio";

export const DOCS_URL = "";

/**
 * **插件市场地址：本仓刻意留空 = 关闭。**
 *
 * 上游默认指向 jsDelivr 上的官方插件清单，画布会去那儿拉第三方插件代码**下载进来执行**。
 * 那是上游作为独立桌面工具的合理设计，但本仓的画布跑在登录态里、旁边就是钱包和资产 ——
 * 让一个 CDN 上的第三方脚本进到这个页面里执行，风险与收益完全不成比例。
 *
 * 要开插件必须先有自己的审核与分发（我方托管 + 签名 + 白名单），不能直接接上游的清单。
 */
export const PLUGIN_REGISTRY_URL = "";
