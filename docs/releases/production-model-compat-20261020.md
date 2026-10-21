# 正式模型与旧入口兼容修复（2026-10-20）

范围：server、web-celebrity。接续 [Studio 五项生产问题修复](studio-prod-fixes-20261020.md) §2.1，经用户明确要求修复全部所列生产入口，生图统一 GPT，文本与分析使用正式模型，保留原积分规则。先合入 main，再从干净主线构建部署。

## 调用与计费

- 数字资产形象生成、克隆、迭代、精调、造型、图集、场景、商品、合成及短剧图片，复用 `JusuanImageClient` 配置化原生传输。无参考图发送 JSON，有参考图发送 `/images/edits` multipart 文件；内联图片与本人存储地址均读取实际字节。用途与应用归属按调用方记录，不强制解析为 Studio。
- 旧尺寸优先选择相同比例的合法 GPT 画布，再等比缩放并居中裁切为旧画布；旧场景 1024×640（16:10）使用 1536×1024 中央安全区。Studio 的 1K / 2K 原生请求和严格尺寸检查保持原样。图生图读取失败直接失败，不降成无参考生成。
- 数字资产文本复用统一 chat 调用，显式输出长度，JSON 调用带结构要求，按端点声明过滤供应商不支持的参数。名片对话与改写继续免费；原有 DAP 动作价格、短剧配置价及 Studio 场景价格不变，新增 GPT 候选不设置售价覆盖。
- 数字资产运镜视频经 `DapVideoBridge` 接入现有 H3 持久化媒体任务，5 秒、9:16、有定妆首帧。子任务为内部 `dap` 分区，首帧仅来自核验本人归属的形象；子任务 0 积分，由父 DapJob 按原单次 50 积分结算，系统待机循环仍免费。父任务保存子任务 ID，与子任务同事务提交后派发，恢复先查原任务，避免重复供应商提交。
- 爆款雷达下载实际解析出的单条视频，限 128 MB / 3 分钟，取四帧与采样时刻交给声明看图能力的正式模型。界面明确“采样画面”、未分析音轨与完整镜头切分，播放/点赞未知；下载或抽帧失败不调用模型，不凭链接猜画面。跳转地址逐跳校验公开 HTTP(S) 来源。
- DAP 提交编排增加事务：引擎或余额拒绝后，形象状态、造型行与衍生状态回滚；worker 继续 afterCommit 派发。

## 验证与发布

已通过 workspace / admin 类型检查、API 契约检查及82 项不同后端定向回归（含最后名片上下文修复）。真实上游已完成：数字资产场景 16:10、商品图、上传素材生成、带参考图迭代、短剧 16:9 出图（原价 2 积分）。H3 原生首帧任务已生成 768×1344、5 秒 MP4 并镜像，本地存储 key 兼容后重试父任务，复用原媒体子任务完成回收，没有再次提交供应商。名片改写实测发现旧模板未传用户事实，已改为用户消息显式附带事实，不把用户数据填入系统角色；同一正式 Qwen 端点复验改写返回产品原型设计内容，通过。

用户随后收敛验收范围：只验数字人和短剧，不再扩展其他产品或重复细碎测试。爆款雷达与带货 UI 只保留已完成的编译/回归结果，不宣称正式链路已验收；本机 DNS 被代理映射为保留地址，视频下载公开地址校验按设计拒绝，未因此放宽公开地址限制。

验收证据在本地 `.studio-e2e/production-model-compat-20261020/`，生产模型变更前备份 `/opt/ai-star-eco/backups/production-model-compat-20261021T005638Z/`。本地数字人及短剧验收已完成；生产发布与配置核对结果在主线发布后补齐。


## 生产发布（2026-10-21 UTC）

- 修复提交 `27a0396d`，主线合并 / 构建提交 `76ef8ee8329dc22f6930af19ace5bb80ba70e446`，已推送 origin/main；保留 main 原有测试整理提交。发布编号 `20261021-production-model-compat`，仅替换 server、web-celebrity。
- 主线 JAR SHA256 `8a23069c2036398dd362fd2ca5855787303e388d984c3f2437103d0c651da342`；web-celebrity BUILD_ID `7RM2mGmP6N3EXBaV0ndM3`，线上文件与构建制品一致。服务已重启为 active，正式配置 `mock=0` / 开发登录关闭 / OIDC。
- 发布检查通过：数字资产入口 `aistar.aibuzz.cn` 的首页、登录、projects、studio、API 配置，短剧首页与 dashboard；后端本地 API、服务状态与 nginx 检查全绿。未重复提交生产收费生成。
- 经原签名管理 API 完成 26 项配置写入。`DAP_IMAGE` / `IMAGE_GENERATION` 默认与唯一候选都是 GPT `ai-abadd123-a06`；`DAP_PERSONA` / `DRAMA_SCRIPT_DRAFT` / `VIDEO_REF_ANALYSIS` / `APPEARANCE_FORGE` / `GENERAL` 默认均为正式 Qwen `ai-studio-jusuan-qwen38`。Agnes 三端点与退役 Seedance 仍禁用，DAP 视频继续正式 H3。
- 数字人和短剧涉及图片 / 人设 / 剧本的 37 个功能配置状态均为 configured。动作价格与 Studio 场景策略 / 场景价格逐项对比相同；短剧默认图片仍 2 积分，新 GPT 候选没有售价覆盖；端点供应商价格、额度、参数配置未变。保留 DAP 原有动作价（生产常用生图 20、运镜 50）、Studio 生图 30 / 张等既有规则。
- 配置前后、26 项变更与断言结果保存在生产 `/opt/ai-star-eco/backups/production-model-compat-20261021T013822Z-apply/`；本地 `production-config-verification.json`、`production-feature-verification.json`、`runtime-artifacts.txt`、`deploy.log` 与 `acceptance-summary.json` 记录发布证据。制品核对后同步 server / web-celebrity 发布标记，旧标记在 release 目录备份。
