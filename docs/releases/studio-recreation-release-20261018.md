# Studio 全能创作 · 对话驱动视频复刻（S1/S2/S3）生产发布记录 · 2026-10-18

- 发布：`20261018-studio-recreation-s1s3`，`GIT_SHA=c6f4080899792e63434ac693811a238f1535ef4c`（分支 `release/studio-recreation-20261018` = `dev/ai-video-replacement-skill-27b923` + 合入生产基线 `2f67939a`），服务 `server web-aiavatar admin`，构建参数与前一版相同（`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`）。
- 基线核对：线上此前为 `20261018-studio-demos-layout`（`2f67939a`，在 `codex/studio-demos-layout`），其相对 `codex/unified-ip-studio` 7649dd42 多出画布分组描述与模板复制 groupId 修复；本次先把 `2f67939a` 合进发布分支（唯一代码冲突 `IpDemoTemplateService` 白名单，合并为同时保留 `groupId` 与 `videoMode/vquality/videoCount`），文档冲突取发布分支版本。
- 迁移：Flyway 一次应用 4 个（V60 端点能力开关、V61 对话线程 / 消息 / 事件 / 转向、V62 计划执行、V63 技能表），启动日志 `Successfully applied 4 migrations`；技能 `reference-video-recreation` 由仓内文件 seed 为 v1。重启后 15 分钟内 `-ERROR` 0 条。
- `verify.sh` ALL GREEN；`/api/v1/ip-studio/studio/skills`、`/api/admin/studio/skills` 匿名 401（按预期）；`aiavatar.aibuzz.cn/projects`、`/create` 200。
- 方案与实现：`docs/ip-studio-conversational-video-recreation-plan.md`；实现说明 `apps/server/README.md`「Studio 对话 agent、技能与计划执行」、`apps/web-aiavatar/PRODUCT.md`「2026-10-18 · 全能创作」、`specs/BUSINESS_RULES.md` 同名节。本地 Codex 七轮验收报告与脚本在工作树 `.studio-e2e/`（gitignored）。
- **上线后要做的配置**（后台「AI 模型与 Key」）：给 Studio 文本端点按实际能力勾「支持工具调用 / 支持流式」（默认都按不支持：对话走 JSON 动作协议、整段一次给出，不假流式）；确认 Studio 文本端点有按量售价（否则对话 503 `AI_TOKEN_PRICE_NOT_CONFIGURED`）。
- **未验证**：S0 付费实测（真实供应商换主体 / 创意重写效果、检查可靠性）尚未做，`autoFixChecks` 保持为空；真实供应商流式延迟、企业付款、跨节点租约竞争未在生产验证。

## 上线后第一次真对话暴露的问题与热修（2026-10-18 晚，仅 server）

线上对话模型是聚算 `ai-studio-jusuan-qwen38`（Qwen3.8 27B）：已声明看图，**未**声明流式、工具调用和 `response_format`。S1–S3 此前只用确定性假响应验收，真模型第一次对话连撞三处格式问题，每一处都发生在「要求模型按我们的格式输出」的地方：

| 现象 | 根因 | 热修 |
|---|---|---|
| 助手回复里直接露出 `<tool_call>{...}</tool_call>`，没有执行任何动作 | 解析器只认 `<<<studio-actions>>>` 分隔行，Qwen 习惯写标签形式 | 发布 `20261018-studio-toolcall-tag`（`adb30018`）：同一套回退协议也接受 `<tool_call>` 块（`tool`/`name`、`args`/`arguments`），流式过滤器同样在标签处截断，写不完整的块整批不执行 |
| 「整理制作方案」连续失败，助手最终如实说明方案工具没通过 | 对话里的 `propose_plan` 另写了一份规划输入，只列操作名，漏了各操作 `settings` 字段契约，模型给 recreation 步骤编了 `videoId`/`analysisType`；回复还裹着 ```json 围栏；`questions` 写成 `{question, default}` 对象，校验器只收字符串 | 发布 `20261018-studio-plan-contract`（`237c1134`）：规划输入与执行侧、后台试跑共用 `StudioWorkflowService.skillPlanStageText/skillPlanConstraints/planCapabilities`；新增 `ModelJson` 去围栏解析（执行侧文字任务与后台试跑同样使用）；`questions` 两种写法都收。校验仍然严格，猜错键名照旧被拒并带可操作的原因 |

- 提示词文件**没有改**。`prompt_template` 行首次启动入库后，只有 `PromptTemplateSeeder.SEED_VERSION` 变更才会刷新「没人改过」的行；生产库里 Studio 的 8 条提示词与文件长度一致，`dap.ip_canvas_image` 是运营改过的版本 3，刷新也不会碰它。
- 测试：`ProposePlanToolTest`（用真实回复形状：围栏 + 问题对象 + 正确/猜错的 settings）、`ModelJsonTest`、`StudioPlanValidatorSkillTest` 新增 2 项、`DialogueActionProtocolTest` 新增 4 项。整个 `ipstudio` 包 623 项里只有 3 项失败（`IpVideoModelChoiceWiringTest` 2 项、`StudioAssetCatalogPricingTest` 1 项），在未改动的开发分支上同样失败，与本次无关。
- 两次发布都只动 server，`verify.sh` ALL GREEN，重启后 `-ERROR` 0 条（该 grep 先在近三天日志里验证能命中 13 条）。

### 继续走到制作阶段时的后续热修（同晚）

| 现象 | 根因 | 热修 |
|---|---|---|
| 分析方案被接受后，第三次规划仍可能把「编排制作计划」放在拉片之前、把步骤编号写进素材引用、把 `videoModel` 写成模型别名 | 规划输入没说明分析阶段的固定顺序、referenceNodeIds 能放什么、videoModel 是端点 id | `20261018-studio-plan-structure`：契约补阶段结构、引用规则与端点 id；校验器拒绝 plan-compile 之后的拉片、丢掉 plan-compile 上多余的 editTarget；propose_plan 拒绝不在可用列表里的视频模型并列出可选 id |
| 拉片第一次调用被聚算 Qwen 400 `unsupported_geometry`（visual activation/HBM headroom budget） | 总览图最长边 2800 像素，超出该视觉端点预算 | `20261018-studio-vision-budget`：同一批画面按 1600 → 1024 → 640 缩小重试，不丢帧、不换帧；实测 640 通过，分段分析的 960 帧原样通过 |
| 拉片失败后进度条只有「停止」，原因里却写「可以继续重试这一步」 | 前端只在「已暂停」时显示继续按钮 | web `20261018-studio-retry-step`：失败步骤显示「重试这一步」，待确认步骤显示「继续制作」，调用既有 resume |
| 「编排制作计划」被拒：引用了不存在的素材（用户的婴儿图） | 分析方案在一轮没有附件的对话里确认，执行记录的画布素材为空 | `20261018-studio-plan-context`：确认的步骤里引用过的画布素材（拉片原片、referenceNodeIds、绑定、改稿对象）一并作为后续规划的可用素材；契约列出校验器接受的参考用途；同一次拉片记住端点接受的图片尺寸 |
| 「编排制作计划」再被拒：只能引用更早步骤的产物 | 模型把画布素材 id 写在绑定的 `stepId` 里 | `20261018-studio-binding-ids`：该值恰好是可用画布素材且不是更早步骤时，按 `nodeId` 绑定；其余照旧拒绝；契约说明素材一律写 nodeId |
| 合成成片做出来了，但画布里拿不到签名地址（日志「文档里出现非本人资产 key，不重签」） | 合成成片按上传结果落库，key 带 OSS 前缀 `media/`，归属检查只认不带前缀的 `ipstudio_gen/<用户>/`；资产库收录对同类旧 key 每 5 秒无限重试也是这个原因 | `20261018-studio-owned-prefix`：归属检查接受恰好一段前缀，属主段仍须是本人（与视频 key 的既有规则一致）；`IpDemoAssetGateTest` |

- 结果：整条流程在线上走通。分析阶段实际 10 积分（上限 63）；制作方案 7 步（三段 H3 全能参考视频各接一次检查，最后合成），报价 663、实际 604；三段检查都判通过，合成 16 秒成片在画布上正常加载播放，主角已换成婴儿。本次会话账本：冻结 915、结算 649（视频 600、对话 / 拉片 / 规划 / 检查 49）、释放 266，无残留冻结。
- 实测还发现：步骤失败不会在对话线程里发消息；`IpLibraryCollector` 对两条旧合成任务每 5 秒无限重试刷 WARN；对话端点未声明工具 / 流式。均已记入 `TODO.md`。
