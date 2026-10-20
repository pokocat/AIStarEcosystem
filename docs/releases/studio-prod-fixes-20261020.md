# Studio 生产问题五项修复 · 发布与验收（2026-10-20）

范围：server + web-aiavatar。代码先合入 `main`，再从干净 `main` 构建发布。规则真源：`specs/BUSINESS_RULES.md`「Studio 对话 agent」22–25 条；实现说明：`apps/server/README.md`「原创创作技能、看图、节点规格与动作协议」。

## 1. 事故与修复

| # | 线上现象（证据） | 根因 | 修复 |
|---|---|---|---|
| 1 | IPP-51a92043 原创女性 IP 三视图，对话 IPR-ad518c2e09c64c759182 共 8 次模型调用、5 次工具调用、消费 12 积分，没有可执行方案（`STUDIO_SKILL_OPERATION_NOT_ALLOWED`、`STUDIO_TURN_BUDGET`） | 收费方案必须挂技能，唯一技能是「参考视频复刻」，且强制先分析、分析阶段不许出图 | 新增只有制作阶段的「原创创作」技能；`StudioSkill.firstStage()` 决定线程、方案与执行的起始阶段；无进行中执行时可换技能（线程锁内复核）。确认卡、服务端报价、阶段预算不变 |
| 2 | IPP-45bead91：用户要男女主三视图 + 客厅、16:9、4 秒；IPR-fde32da6c2cc4664974f（mvj_6b01aa2358d7）发出 9:16、8 秒、只带男主首帧 | 助手只能把规格写进提示词；面板静默钳制时长；描述与设置不一致不提示；女主、客厅没连到节点（方案里还编了不存在的节点编号） | `create_nodes` / 新 `update_nodes` 写 `studio.spec`（画幅、时长、数量、参考与用途，参考为完整清单并连线）；面板按 spec 打开，用途决定首帧 / 全能参考；时长超出模型范围给阻断提示与「改成 N 秒」；描述与设置不一致付费前询问 |
| 3 | IPT-2f13c2ed42994624907d seq 10 回复 `<studio-actions>[{"tool":"propose_plan",…}]</studio-actions>`，blocks=[]，方案没提出；seq 12 正文模仿「[查看画布：done…]」 | 解析只认 `<<<studio-actions>>>` 与 `<tool_call>`；近期对话里内联的英文工作记录被模型照抄 | 解析与流式过滤改为同一个顺序扫描，认 `<studio-actions>`，残缺 / 嵌套未闭合 / JSON 后有多余内容整批不执行；模仿记录按格式错误；连续两次纠正失败本轮停止；历史记录改为单独的「（服务端记录…）」行 |
| 4 | 同一对话：助手称「两张三视图我都读到了」，按文件名分男女主并编名字 | `read_canvas` 只给名称、提示词 | 新工具 `view_images`：本人 key 校验、服务端读字节内联给本轮对话端点（须声明看图）、计入本轮 token 预算；素材清单注明不含画面 |
| 5 | 失败节点仍显示「上传图片或使用 AI 创作」「上传视频，开始解析或拉片」，生成按钮重复；已下架模型同一节点三次失败（M64E8LSCR77Q，各 640 积分已释放） | 失败态与空态共用渲染；`model_delisted` 没有专门错误码 | 失败面板（原因 + 修改后重试 / 改为上传），工具条单一恢复动作；`400 model_delisted` → `VIDEO_MODEL_RETIRED`，冻结前拒绝；面板不再预选失败的模型 |

关联事故按原样保留：图片 IPR-dab3d37f（logId PSQ8YXAAJLVD）为 Agnes 上游 503「生图队列已满」，30 积分已释放；视频 M64E8LSCR77Q 上游 400 `model_delisted`，三次各 640 积分已释放、无 externalTaskId。本次不改旧任务、不改账本、不自动补偿。

## 2. 生产模型配置（Codex 同日完成，非本次代码发布）

经现有短时签名管理接口完成并复核，无代码发版、无新增生成：

- Agnes 的 text / image / video 三个端点及 `seedance20-onetoken` 均 `enabled=false`；清除 14 个候选与 6 个原 Agnes 默认绑定：`VIDEO_REF_ANALYSIS`、`APPEARANCE_FORGE`、`IMAGE_GENERATION`、`DAP_PERSONA`、`DAP_IMAGE`、`GENERAL`。
- GPT Image 2（`ai-abadd123-a06`）仍只对 Studio 开放：`ai.scene-policy.studio.image` 默认 `ai-abadd123-a06`、30 积分 / 张，公开 `/models` 验证 `isDefault=true`；视频仅 H3。原 script 场景（`ai.scene-policy.studio.script` → `ai-studio-jusuan-qwen38`）及其他售价未改。
- 受限回滚与验收证据：生产 `/opt/ai-star-eco/backups/studio-model-routing-20261020T153511Z`（`before.json`、`after.json`、`changes.json`、`public-api-verification.json`），管理审计 26 项。

### 2.1 下架兼容性检查（本次核对，2026-10-20）

`AiModelInvocationService.resolveDefaultEndpoint` 没有任何兜底：用途没有默认绑定就解析为空，调用方报「未配置」。逐个用途核对代码入口与生产可达性（近 30 天用量取自 `ai_model_usage_record`）：

| 用途 | 仍可达的生产入口（只读默认绑定） | 现在的结果 | 需要的协议 |
|---|---|---|---|
| `DAP_IMAGE` + `DAP_PERSONA` | 数字资产 `/studio` 旧 SPA 的全部资产任务：形象生成 / 克隆 / 迭代 / 变形 / 造型 / 衍生 / 场景 / 商品 / 合成 / 重试（`DapJobService.requireEngineOrPlaceholderAllowed` 要求两者之一有默认绑定）。`dap-img` 近 30 天 66 次，最后一次 Agnes 在 2026-10-20 09:35 UTC | 提交即 503 `DAP_ENGINE_NOT_CONFIGURED`，冻结前拒绝；`generate` / 衍生 / 造型等路径在拒绝前已保存的「生成中」状态可能残留（`DapWorkflowService` 无事务，推断） | 图片：`POST {base}/v1/images/generations` JSON，参考图放顶层 `image` 与 `extra_body.image`，尺寸 768x1024 / 1024x1024 / 768x1365 等；**不是** multipart。文本：OpenAI 兼容 chat/completions |
| `DAP_PERSONA` | 数字名片人设对话 / 改写（`CardPersonaService`，`/cards/[id]/edit`） | 503 `AI_NOT_CONFIGURED` | chat/completions + `response_format: json_object` |
| `IMAGE_GENERATION` | 短剧定妆照、场景图、三视图、场景 AI 修图（`DramaRenderService` 默认路径；分镜首帧与画布出图会带候选 id，不受影响） | 503 `IMAGE_NOT_CONFIGURED`，冻结前拒绝 | `POST {base}/images/generations` JSON，参考图只放 `extra_body.image`，尺寸 720x1280 / 1280x720 / 1024x1024 / 1024x768 / 768x1024 |
| `VIDEO_REF_ANALYSIS` | 带货「爆款雷达」链接分析（`MaterialAiService.analyzeViralLink`） | 503 `AI_NOT_CONFIGURED` | 纯文本 chat/completions（JSON 模式） |
| `APPEARANCE_FORGE` | 形象锻造：入口已于 v0.60 下线，只剩直接调接口 | 不可达，无影响 | — |
| `GENERAL` | 无业务运行路径；仅后台「Prompt 管理」对 `card.*` 等无前缀键的试运行 | 后台试运行 503 | — |

Studio 不受影响：对话、方案与看图走 `studio.script`（qwen38），画布出图与原创创作的图片步骤走 `studio.image`（GPT Image 2），两行场景策略均在生产。

建议（待决定，本次未改配置）：要延续上面四类入口，只能绑定**已用同一协议验证过**的正式端点，不恢复 Agnes，也不把只支持 multipart / 尺寸协议的 GPT Image 2 指给这些 JSON `images/generations` 旧调用。数据上的候选：`DAP_IMAGE` 的 `dap-img` 路径 2026-10-07 前用「火山-seedream4.5」（`ai-5335940f-a27`，现为该用途启用候选）36/36 成功；`DAP_PERSONA` 的 qwen38 已在 Studio 以 JSON 模式稳定运行。`IMAGE_GENERATION` 现有唯一候选（ERNIE via jusuanhub）在短剧路径 2026-10-03 有 6 次全失败，不能视为已验证；`VIDEO_REF_ANALYSIS` 没有候选。是否恢复、用哪个端点，需运营决定后经同一管理接口配置并单独验收。

## 3. 验证

Codex 接手工作树 `/Users/donis/dev/AIStarEcosystem-prodfix`，保留 Claude 的 `39ca9218`、合并提交 `d9a21f09` 及未提交评审修复，未改根工作区的其他工作。

- 后端：对话协议、循环、原创创作、执行与视频错误映射相关 121 项通过；规格校验补充拒绝小数和字符串（避免 4.5 秒 / 1.9 条被截断），原创创作 14 项再次通过。
- 前端：完整回归 1089 项通过。保存失败后重试的两处测试增加“按钮已恢复可用”断言；编辑器卸载后菜单关闭的延迟聚焦确为生命周期问题，已检查 `isDestroyed` 并补 UI 回归。
- 编译门：`pnpm typecheck:all`、`pnpm typecheck:admin`、`mvnw compile -q -o`、`pnpm check:api-contract` 通过；`git diff --check` 无错误。
- 本地浏览器：独立 H2 副本 + fixture，真实接口、不调用生图或视频模型。失败视频 / 图片节点显示原因和单一恢复入口；下架模型打开面板后换成可用模型；时长超出范围时禁用生成并提供主动修改；点击生成时描述与设置冲突先弹窗，未发送生成请求；390×844 窄屏经“仍然打开”可打开恢复面板，提示和操作未溢出。截图见 `.studio-e2e/takeover-20261021/local-spec-conflict.png`、`local-mobile-recovery.png`。
- impeccable 一次检测：现有样式的 77 项设计表建议及 1 项原有宽度过渡告警；本次新增失败态沿用相邻字号、间距和令牌，无新增相关阻断项。旧 `PRODUCT.md` / `DESIGN.md` 缓存与现行 Studio 结构有差异，本次不改全局设计系统。
- 评审修复覆盖：嵌套 / 未闭合 / 尾随 JSON 整批拒绝；标记与标签重叠不漏；参考为完整清单（替换、清空）；局部规格更新保留其余字段；用途决定首帧；同一轮确认后不能换技能。原创视频指引补充能力约束：没有多图参考模式时，全部参考先合成关键帧，再出视频，额外步骤须计入报价确认。

### 3.1 生产看图能力配置

发布前发现 `ai-studio-jusuan-qwen38` 的模型列表为空，代码按未声明看图处理，不能仅据工具已接通宣称可用。依据[厂商当前协议](https://docs.jusuanhub.com/docs/models/text)并向同一端点提交一张自制红 / 蓝左右分区测试图，实际回答“红色，蓝色”，usage 97 输入 + 4 输出 tokens。未触发生成、未写客户钱包。

经签名管理接口补充该固定模型条目 `qwen38-27b` 的 `supportsVision:true`、上下文 262144；逐字段核对保留原模型、地址、限流、费用、启用状态。受限快照和验收记录：`/opt/ai-star-eco/backups/studio-vision-20261020T180752Z`；本地 `production-vision-acceptance.json`。密钥只在远端进程内解密使用，不写报告。

## 4. 发布与线上验收

（发布后补）
