# 画布个人资产库本地验收 · 2026-10-11

状态：实际应用已于 2026-10-11（America/Los_Angeles）提交并生产部署；本地与生产验收分别记录。AiAvatar 3013 / 后端 18080，独立本地 H2 数据，测试账号 Luna。

## 用户动线

1. 上传《废市》电影剧本.md，完整正文 26,476 字；选中剧本/文本节点 → 提取资产。剧本编辑器入口在素材 → 本剧资产，没有增加一级提取菜单。
2. 使用实际 Agnes 文本端点解析全文，成功任务 IPR-2778ba673da74c458184。提取 17 项，1 项缺少可靠原文依据被排除并显示提示；用户核对后保存到手动文件夹《废市》。成功消耗 2 积分，排查期间三个失败任务均释放积分，失败成本 0。
3. 保存后直接进入快速完善；江口上传主图，安子与贝原家批量生成缺图。两项图片采用明确标注的本地测试响应，未再次调用付费模型。真实任务、存储、版本与自动入库链路仍经过后端。
4. 刷新并重开同一节点，可以进入“完善本剧已有资产 · 17 项”。在资产库查询安子，从“在新画布使用”进入 IPP-d51bb137，保留具体对象、版本、存储 key 和设定快照。提示词输入 @贝原家后，个人资产选择器默认定位《废市》文件夹，添加后新画布保存了第二个参考节点；提示词原有文字保留。临时改变安子主图后验证旧画布 key/版本/描述不变，再恢复主图。

## 针对性验证

- 重复保存同一次提取，保持同一批对象；不同剧本的同名角色默认独立；明确复用才能连接原对象，原描述保持。
- 其他已登录测试账号读取对象返回 404。
- 删除测试文件夹，内容移到未分类，对象主图与源文件保留。
- 上传与两项批量生成均保存在素材区，未采用候选也自动入库。
- 每页 24 项的 PageEnvelope，筛选后分页、分页后签名；空态与错误重试可见。
- 桌面 1440×900、手机 375×812 检查资产库与快速编辑；画布手机柔性闸仍保留。

## 检查与边界

全 workspace typecheck、admin typecheck、API 契约检查通过；后端编译及 StudioAssetExtractionTest 两个有针对性的测试通过。Astra 轻量独立 review 找到一处保存竞态：busy 保存期间表单仍可编辑。已禁用四个编辑字段，并经同一 reviewer 静态复核为 resolved / ship；修复后 AiAvatar typecheck 通过。该 review 仅覆盖指定代码与五张截图，不代表生产或完整无障碍验收。

本轮范围是 AiAvatar 画布与 Studio 生成；未统一 music / drama / celebrity 的跨应用素材，也未实测付费图片生成质量。数据库增加 V52 personal asset library，不修改已执行迁移。不改生产、账户权限或直接修改积分余额。验收完成已关闭本地图片测试响应并恢复真实模型配置；已保存的样例版本仍标注为测试图片。文档收尾确认属于现有 Operate 界面的普通扩展，既有设计文档与 sidecar 漂移保留，核对记录见 .studio-e2e/asset-library/documenter-note.md。

本地证据：.studio-e2e/asset-library/rules-proof.json、extraction-success.json、all-types.log、tests.log、contract.log。界面截图：.impeccable/review/asset-library/。


## 生产发布 · 2026-10-11（America/Los_Angeles）

功能提交 `50ffb4ba6`、历史素材命名补丁 `bb99a3d86` 均已推送 `codex/unified-ip-studio`。以干净独立工作树构建；原型目录及本地验收数据库/图片未进入 Git 提交或生产制品。生产配置不变，真实 OIDC / 实际模型 / 关闭 mock 与开发登录。

- 首包 `20261011-personal-assets-50ffb4ba` 发布 server / web-aiavatar；后端补丁 `20261011-asset-history-bb99a3d8` 仅发布 server。
- 备份 `/opt/ai-star-eco/backups/20261011-personal-assets-043849`：数据库压缩转储、旧 JAR、旧前端包；权限 0700/0600，gzip 校验通过。日期前缀为本地工作日，备份时刻 UTC 2026-10-12 04:38:49。
- 前端 BUILD_ID `QMwpqzVibtdBQ2GMmbe9j`；前端包 SHA256 `c389c3c260c1e1f3d220d59f869644c85166a20a4d721871bd9073c919301680`；最终 JAR SHA256 `0b8819594aae733669fb648637c07e53fd5d3c81ae2132ff1a0615312a807d89`，生产与本地一致。
- 两服务 active、NRestarts=0；V52 成功、失败迁移 0。上线时自动归集产生 95 个回执与 74 份全库素材；当前验收账号能看到其本人 33 份素材，每页 24 项。
- 正式 [资产库](https://aistar.aibuzz.cn/assets)、创作、登录、API 配置和兼容 aiavatar 域检查通过，两次部署 verify 均 ALL GREEN。

登录态在现有《池边的界限》画布 `IPP-aa81ea7d` 验证：选中剧本节点看到提取资产入口；已有结构化人物/场景/道具免费整理为 5 项，核对后保存至手工文件夹“池边的界限”。快速完善显示 0/5、生产图片端点与 30 积分报价；只保存林远的提示词，没有提交生成。原文与描述保留，MySQL 读取确认 5 对象、5 绑定、1 文件夹。

从资产库“在新画布使用”创建 `IPP-7009070a`，无图角色以文字设定引用；数据库确认具体 objectId/描述/来源快照和文件夹偏好持久化。来源画布仍是 2 节点，新画布 1 节点；新画布选择器默认“池边的界限”，5 项可选择。余额持续 1,303；本次线上没有新增模型调用或付费生成。

历史原节点已移除的素材曾显示 `generate · IPR-...`；补丁仅归一服务自动生成的默认名称，手工改名写入豁免标志；未来入库优先节点/项目名称，搜索和普通/不可读 DTO 使用同一名称。Astra 对两文件静态复核未见实际缺陷；未重复广泛测试。

《废市》17 项及测试图片属于本地验收，没有迁移到生产。付费图片质量、跨子产品资产统一及完整无障碍不作为本次上线结论。

发布证据位于 `.studio-e2e/asset-library/`：release-backup.json、release-artifacts.json、release-final-runtime.txt、production-proof.json、两次 build/deploy 日志、online-library.jpg、online-editor.jpg、online-new-canvas.jpg。

## 文件夹选择器修复 · 2026-10-12（Asia/Shanghai）

提取资产弹窗的保存文件夹选择器改为占用操作行剩余宽度，选中名称和下拉选项完整换行；支持按名称搜索，读取/保存期间禁用。下拉菜单仍挂在 Studio 的令牌作用域中，窄屏限制菜单宽度、按钮自动换行。没有新增 API、数据迁移或模型调用。

本地真实组件预览检查了桌面、375px 移动布局视口、约 100 字名称、搜索与键盘选择；菜单修复后位于视口内，页面宽度为 375px。全 workspace/admin 类型检查、后端离线编译与 API 契约门通过；前端提取/助手/剧本/工作台定向 101 例、后端文本计费与工作流 10 例通过。额外前端全套测试为 574 通过、6 失败：附件选择器 4 例缺少 antd Modal mock、助手文档读取 2 例断言失败，未声称全套测试通过。

发布前核对生产仍是 `20261012-studio-model-alias-c8c54f35`；本次发布范围为 server、web-aiavatar、admin，包含最新文本计费提交与文件夹修复。停止迭代的独立原型和本地测试页不进入正式应用制品。实际发布编号、制品与线上验收在部署完成后补记。

### 刷新后保存提取结果被误判为正文改变

追查号 `TQLG3LYW566A` 对应 `IPP-738bf268` 的 `IP_LIBRARY_CHANGED`。生产只读核对：当前正文与已受理任务 `IPR-e947509c02e04745be10` 的不可变输入均为 2958 字、同一 SHA-256；画布 `assetExtraction.sourceHash` 却仍为更早的指纹。前端提交前保存文档后未把接口返回的指纹写入任务元数据，刷新时又使用旧元数据恢复。

修复：新受理任务持久化接口返回的 sourceHash；整剧历史任务从不可变 scriptEdit.markdown 计算原始指纹，恢复已有候选，不调用模型。真正改变正文时仍携原任务指纹，服务端继续拒绝保存；分集任务只存分集正文，不能用分集哈希替换整剧校验，旧记录缺输入也保留原校验。回归覆盖刷新后保存、正文确实变化、受理前后的指纹差异及分集/旧任务。

### 本轮生产验收

发布 `20261012-studio-frontend-214fe182`，代码 SHA `214fe1827e97edf68be9622c4604a40d25822eb3`，范围 server / web-aiavatar / admin。包含文件夹修复、提取指纹恢复，以及此前已提交的全操作文本计费。备份在 `/opt/ai-star-eco/backups/20261012-studio-frontend-214fe182`；未修改生产环境配置。

- 本地与生产 JAR SHA256 均为 `a7271aa821b6957525ab819df8050d928dbfa572f3ab85870a9a283c2e7f0045`；AiAvatar BUILD_ID `wrgKDUQIk7o_J0_tshDwF`、admin BUILD_ID `QuXFiZR8neavc6UgeHMXI` 均与构建一致。
- 三服务 active、NRestarts=0；生产部署 verify ALL GREEN；正式域创作/资产/登录/API 配置、兼容 aiavatar 域及后台页面检查通过。
- 线上刷新 `IPP-738bf268`，剧本编辑器“素材处理”恢复原任务的 6 个候选，保存文件夹下拉完整显示“池边的界限”。10 项缺少可靠原文依据的提示仍是筛选结果，不阻止其余 6 项保存。
- 在浏览器发出前临时拦截保存请求，确认 6 个 items、原节点 ID，以及 sourceHash `6cefe483fc8c45af9ef32d773991797d07eb89fae5ac3ef71cdcb457839f0483` 与已受理正文/当前正文完全一致。随后取消请求并清除拦截，没有替用户写入资产库，也没有新增模型调用；此项是线上请求验证，不声称实际保存入库验收。

新增提取恢复回归 6 例通过，全 workspace/admin 类型与 API 契约检查通过。既有前端全套 6 例失败仍单独记录。证据位于 `.studio-e2e/frontend-folder-release/`：build-final.log、deploy.log、production-runtime.txt、online-request-proof.json、extraction-recovery-tests.log；线上截图位于 Codex 本次可视化目录的 `frontend-folder/online-extraction.png`。

## 剧本素材直接展示已保存资产 · 2026-10-12（Asia/Shanghai，已上线）

本节记录后续的素材入口调整，不能沿用上节发布编号作为本次已上线证明。打开素材时，有已保存对象默认展示「已保存资产」，不再经由「完善」按钮才能看到；数量和类型筛选、名称、描述、文件夹、主图及配图状态直接可见。缺图显示「待配图／暂无配图」，不会误称没有资产；原文字设定继续可用。来源剧本的对象读取所有分页，本地回归覆盖第 25 项。

提取保留为独立的「提取与核对」页，没有已保存对象时默认进入提取。核对候选、原文依据、显式复用、文件夹保存、原请求恢复与实际文本计费继续使用既有链路。保存后回到已保存集合；进入逐项编辑或批量配图后，关闭编辑器返回集合并刷新。读取或保存期间锁定候选字段，避免保存中的改动丢失。

本地证据与结果：

- `library-extraction-panel.test.tsx` 定向 14 例通过，覆盖打开即见已保存对象、保存返回集合、编辑后刷新、全部分页、分析设置失败和文件夹／偏好失败时保留可用对象，以及提取指纹恢复、计费行为和 StrictMode 取消旧初始化后不重复追加恢复消息。日志为 `.studio-e2e/script-assets-redesign/tests.log`；测试中的 Antd 替身有 DOM 属性警告，不代表真实浏览器的控件验收。
- 全 workspace 类型检查、admin 类型检查、后端离线编译与 API 契约门通过，日志为同目录 `all-types.log`、`admin-types.log`、`backend-compile.log`、`contract.log`。契约检查仍报告其他产品线的既有 handler/orphan 提示，不能据此声称所有 API 均已实装；本次未重复全套前端测试。
- 本地真实组件预览使用明确标注的合成数据，不调用模型。桌面 CSS 视口 1440×900、手机 390×844，检查已保存集合与提取页；桌面双列、手机单列，集合独立滚动，恢复提示和底部动作位于集合之外。截图位于 `.impeccable/review/script-assets/`；`.studio-e2e/script-assets-redesign/capture-proof.json` 当前记录 PNG 像素尺寸、CSS 视口和验收样例关闭动画的状态，不记录底部位置几何。这些截图不代表生产账号的数据或生产入口验收。
- 独立 finish review 初次结论为 `fix`，要求可选文件夹／偏好失败不隐藏已成功读取的集合。第一次修复复核为 `partial`：读取依赖已解决，恢复提示仍在手机上重叠、桌面上重复。后续修复使用 Antd 6 的实际内容滚动容器，恢复区不参与压缩，旧初始化取消后不再追加错误；14 例回归通过。同一 reviewer 最终结论为 `ship`，将可选文件夹依赖、手机恢复区重叠、重复错误消息三项均评分为 `resolved`，六张截图有效。该 verdict 只覆盖列出的修复项，依据源码和本地合成验收截图，不代表重新完整审查界面、生产完成或更广的端到端验收；reviewer 没有独立重跑测试。结果见 `.studio-e2e/script-assets-redesign/review-verdict.md`。

这是既有 Operate 界面的普通扩展：复用 `.ip-surface` 令牌、Antd、签名图片与现有资产对象；形态读取 `html[data-layout]`，没有新增视觉系统、依赖、后端接口、迁移或计费变化。本地测试页和合成数据不进入生产制品，完整键盘／无障碍不作为结论。原设计文档、sidecar 与其他未提交的索引／原型内容保留，文档核对见 `.studio-e2e/script-assets-redesign/documenter.md`。

### 本轮生产发布与实际入口验收

代码 `539511cf7e963adc2f8bd40837bbe397864d244d` 已推送。干净独立工作树构建并发布 `20261012-script-materials-539511cf`，仅更新 web-aiavatar，正式 OIDC、关闭 mock 与开发登录。制品 SHA256 `f49d5dd7785fc9da4d1803a4c736fa10d66dfb7f789d53f0b8e1a86da2453913`，本地与生产一致；BUILD_ID `-EFXPx6zkfzbQMV7dKaJz`，运行服务 active、NRestarts=0。旧前端备份在 `/opt/ai-star-eco/backups/20261012-script-materials-539511cf`，目录 0700、压缩包 0600。

部署 verify ALL GREEN，正式域创作、资产、登录及配置路线、兼容 aiavatar 域和服务检查通过。登录态打开正式域的 `IPP-738bf268`：剧本编辑器点击“素材处理”直接选中“已保存资产 6”，显示原 6 个对象，真实状态为 1 个已有主图、5 个待配图。角色筛选显示 3 个角色及原有梵高主图；进入该角色编辑再返回集合，关闭并再次打开素材仍默认看到 6 项。验收没有修改资产信息，也没有提交 AI 分析或配图任务。

移除临时预览页后，本机开发缓存残留了对应类型文件；仅清理该生成文件，最终 AiAvatar 类型检查通过。构建日志、部署日志、运行与制品核对、真实入口断言分别见 `.studio-e2e/script-assets-redesign/{build.log,deploy.log,production-runtime.txt,online-proof.json}`。线上截图保存在本会话可视化目录 `script-materials/online-materials.png`，截图处于角色筛选状态，不冒充默认全部列表。

## 资产库分类与文件夹浏览 · 2026-10-12（Asia/Shanghai）

按用户指定的本机 `gpt-tasteskill` 重做 `/assets` 浏览界面，沿用暖灰／深墨与原有产品接口：默认剧本资产，生成与上传、人物形象、声音独立分类；全集数量与当前筛选数量区分；桌面侧栏与手机可换行文件夹选择器；缺图对象保留已保存设定状态；完整文本详情和按需音视频预览。新增 GSAP 轻量入场并尊重减少动态效果。没有新增服务端接口、迁移或计费。

- 定向 20 例回归通过（个人库 6 例 + 提取恢复 14 例），覆盖默认可见、独立错误、搜索选择清空、异步旧请求忽略、完整文本预览与第 25 项分页。日志 `.studio-e2e/asset-library-redesign/targeted-tests.log`。
- 全 workspace/admin 类型、后端离线编译与 API 契约门通过。误用 pnpm test 的参数分隔导致跑了全套；新增库用例已修正断言并通过，既有附件上下文 2 例与附件选择器 4 例失败仍存在，本轮不宣称全套绿色。
- 本地实际组件使用合成数据验收 1440×900 和 390×844，标题一行、按钮对比度、文件夹长名、完整文本详情、资产编辑返回、局部文件夹失败保留六对象及无横向溢出。截图 `.studio-e2e/asset-library-redesign/{desktop.png,mobile.png,folder-error-mobile.png}` 仅证明组件与布局，不能冒充生产数据。
- 新版给资产库挂载 Antd App/ConfigProvider，保证消息／确认弹窗有提供者，主题和弹出层留在当前页面作用域。临时本地预览路由与合成数据在提交前删除。生产发布与实际入口验收待下节记录。
