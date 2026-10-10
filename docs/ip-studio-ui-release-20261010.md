# Studio 界面整合发布 · 2026-10-10

本次按用户“全都一起发布”提交构建开始前的全部迭代，包含已合并的模型运营后端，以及首页、IP 管理、创作、模板市场、账号与素材页、全屏画布、登录和模型价格展示。

## 发布版本

- 分支：`codex/unified-ip-studio`，已推送。
- 应用代码：`2fb9ad5c59ba4e04f3df1e68ea994efebebdc251`。
- 发布包：`20261010-studio-unified-2fb9ad5c`。
- 服务：`aistareco-server`、`aistareco-web-aiavatar`。
- 入口：<https://aistar.aibuzz.cn/>，创作页 <https://aistar.aibuzz.cn/create>。
- 部署时间：2026-10-10 16:57 UTC；两服务 `active`、`NRestarts=0`。

构建在干净工作树完成，使用 Java 17、pnpm 10.33.2，真实接口与统一账号中心配置：`NEXT_PUBLIC_AUTH_MODE=id`、issuer `https://id.aibuzz.cn`、mock 与开发登录关闭。前端制品不含环境文件、本地身份配置、测试数据库或媒体 fixture。既有生产环境和业务价格配置保持；本次没有运行新的定价配置写入。

首个发布包不含构建后的品牌迭代；品牌名、slogan 与 logo 已独立发布，最终版本及验收见下方追加记录。

## 用户可见变化

- 首页使用写实人物主图及统一浅色导航；IP 管理采用真实资产列表和详情面。
- 创作页集中快速入口与个人画布，画布卡保留节点小地图；`/projects` 跳转 `/create`，既有画布地址继续有效。
- “查看更多模板”进入 `/templates`，官方与个人模板继续支持只读预览和显式保存副本；社区模板标为待建设。
- 个人画布与模板预览使用完整视口，不再叠加网站顶栏；返回创作及画布积分入口保留。
- 桌面账号、会员与素材页统一浅色外观；修复账号菜单层级与收起逻辑。
- 登录启动失败回到可重试登录页，本地 localhost/127.0.0.1 回调配置单独维护。
- 前端遵守后台固定/可选模型策略，图片及文本报价读取对应候选价格；原受理请求保持不可变。

## 验证与边界

提交前四门通过：workspace typecheck、admin typecheck、后端离线编译、API 契约检查。前端全量 546 项首次回归发现一处旧测试缺少模型候选；补齐候选并覆盖可选、固定及模型移出候选的行为后，相关 90 项定向回归通过，未重复全量。后端模型管理、场景定价和供应商积分相关 35 项测试通过。生产构建、制品校验、部署脚本和 `verify.sh` 均通过。

线上检查 10 条页面路径及 41 个资源：JS/CSS 与干净构建逐文件 SHA256 一致，3 个字体分片及首页两张图片返回正确内容类型。`/projects` 正确跳转 `/create`；模型与能力接口的匿名访问返回 401。两服务制品校验一致，Flyway 验证 49 项迁移，本次无新增迁移。

没有付费生成、重提旧任务或修改用户画布。浏览器视觉截图验收仍待补：当前 Codex 内置浏览器控制会话超时，HTTP 与资源检查不等于视觉或登录后的完整交互验收。

## 回滚与证据

线上受限备份：`/opt/ai-star-eco/backups/20261010-studio-unified-2fb9ad5c`，目录 0700、旧 JAR 与前端压缩包 0600，gzip 校验通过。原生产制品和各自校验和已保存。

发布包及 manifest：`dist/deploy/20261010-studio-unified-2fb9ad5c/`；本地 HTTP 与资源证据：`.studio-e2e/release-20261010-unified/http-acceptance.json`。两者均为 gitignored 运维产物。部署临时目录已清理，构建工作树可归档。

## 品牌更新独立发布 · 2026-10-10 17:24 UTC

- 应用代码：`fb4502a26c6607de6bfbf00631c40818b1b4dfad`（品牌提交 `4c6a22d0` + 手机简介标点 `fb4502a2`），已推送同一分支。
- 最终发布包：`20261010172357-fb4502a2`，仅部署 `web-aiavatar`。
- 品牌名：「IP Studio · 声量引擎旗下」；slogan：「让灵感成形，让 IP 出圈」。
- icon 沿用老版数字人多面体侧脸与三角碎片，内置 imagegen 编辑为低饱和蓝灰、深墨配色；首页、旧资产外壳与登录、favicon / Apple 图标统一引用 `/brand/ip-studio-logo.png`。原始文件保留，最终提示词见应用 README。

提交前四门通过；前端全量 66 文件 / 548 项测试通过（存量 React act 提示仍在）。最终标点增量由应用 typecheck 与生产构建再次验证。保留生产 OIDC 构建配置，mock 与开发登录关闭；未改后端、生产环境或数据库，未执行生成任务。同期其他会话的 server/admin 编辑未纳入前端制品。

`verify.sh` 全绿；公开首页返回新标题、slogan、完整句号及新 favicon。21 个 JS/CSS/logo 资源与最终发布包逐字节一致；远端 BUILD_ID 与制品同为 `Hnbh9XYqo-Cw8_q-3EgRT`。服务 `active`、`NRestarts=0`，启动时间 2026-10-10 17:24:55 UTC。Chrome 本地桌面与 440px 手机模拟视图、生产首页视觉检查通过；没有充值、创建画布或生成操作。

独立备份：`/opt/ai-star-eco/backups/20261010-studio-brand-4c6a22d0/web-aiavatar.tar.gz`（目录 0700、文件 0600，gzip 检查通过，SHA256 `7baf2e770d7c2c3471f1addbbe670393bb0fa0b2bfefd168d6f2876e6da0ad47`）。最终远端包与 manifest 保存在 `/opt/ai-star-eco/releases/20261010172357-fb4502a2`，部署暂存已清理；HTTP 校验证据为 `.studio-e2e/release-20261010-brand/http-acceptance.json`。

## IP 管理、素材库与账号复查 · 2026-10-10

Chrome 登录态复查 `/ips`、`/assets`、`/me` 及 `/studio#/membership`：常规桌面与 960×650 下账号菜单六项中心均可命中；960×300 下菜单内部滚动可到达末项，没有充值或退出操作。Escape、跳转收起通过。375×812 模拟手机三页没有横向溢出，但 IP 管理缺少底部导航。

本次修复 IP 管理顶栏周围旧蓝灰底色；三页桌面统一暖灰背景、12px 外边距、26px 内容内边距、32px 衬线标题及 13px 卡片圆角。素材库标题与正文归于同一白色内容面，账号工具保留侧栏和隔离层级。手机 IP 管理补回共享底部导航及底部安全区，资产项选中。

提交前 workspace/admin typecheck、Java 17 后端离线编译、API 契约门通过；IP 管理与外壳/菜单定向测试 3 文件 / 21 项通过。API 门仍报告既有其他产品未接 handler 警告，路径与方法检查通过。本轮仅准备发布 web-aiavatar；正式发布标识和修复后浏览器验收追加于下方。
