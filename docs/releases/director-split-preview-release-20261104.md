# 导演台拆分弹窗增加剧本预览（2026-11-04）

- 发布：`20261104-director-split-preview`，只发 web-aiavatar，构建自 main `44edadaeb`，在仓外工作区 `../AIStarEcosystem-release-episode-codes` 构建。
- 线上上一版：server 与 web-aiavatar 都是 `20261104-inspiration-hover-video`（`c3dc6750b`）。两版之间只有这次的前端改动和文档，没有服务端、接口或迁移改动。server 未重启。
- 构建参数：`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 `manifest.env`）。BUILD_ID `08JQ1r1UYczYOV63SM_pu`。
- 回滚：`deploy-release.sh <20261104-inspiration-hover-video 制品> web-aiavatar`（制品在 `../AIStarEcosystem-release-inspiration/dist/deploy/` 和生产机 releases 下）。

## 改了什么

程序认不出分集标题时，「拆分剧本」先弹窗选择拆分方式。弹窗右侧新增剧本预览（手机上在下方），用户可以在预览里找到第 1 集标题行，复制到「按分集标题拆分」的输入框。预览最多显示前 3 万字，超出时写明总字数和显示范围。

## 发布过程

18:51:02（CST）服务重启，`verify.sh` ALL GREEN。18:50–18:51 共 63 个请求，没有 5xx（同一条统计今天全天有 60 个 5xx，确认统计本身有效）。

## 线上验收

用线上已部署的页面打开「火星殖民」作品，在浏览器内存里把接口返回的剧本换成 70 段示例文字，并拦下全部写请求（验收期间实际拦到 0 个）。作品和账号数据没有改动，验收后整页刷新，作品仍显示「待写剧本」。

- 1440 宽：弹窗 960，左侧拆分方式、右侧剧本预览各 450，页面无横向溢出。
- 375 宽：拆分方式和预览上下排列，无横向溢出。
- 预览文字可选中，超出时可滚动。

## 没有验证的

- 线上没有实际提交过一次按标题拆分或 AI 拆分：账号里没有待拆分的作品，上面的验收只打开了弹窗。按标题拆分的完整流程只在本地走通（确认落库、不扣积分）。
- 没有跑 `/impeccable critique`。
- 这次是直接推 main，没有 CI 记录。提交前本机通过 web-aiavatar 类型检查和导演台 132 个测试。
