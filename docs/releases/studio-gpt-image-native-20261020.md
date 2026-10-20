# Studio GPT Image 2 接入 · 2026-10-20

用户要求把 CATech（`https://ai.aiprox.tech`）的 `gpt-image-2-1k-pic` 接入 Studio，并对齐 2K 和图生图能力；用户确认沿用当前图片售价。

## 配置与实际合同

- 端点：`ai-abadd123-a06`，OpenAI compatible，基础地址 `https://ai.aiprox.tech/v1`。供应商密钥通过后台服务 AES-GCM 加密保存，未写入代码、文档或前端。
- 仅向 Studio 开放图片用途；场景由固定改为可选，保留原默认端点 `ai-7f6cce37-778`。新模型沿用 **30 积分/张**，原模型价格、全局用途默认绑定及文字/视频配置保持不变。
- 原生文生图：JSON `POST /images/generations`；图生图：multipart `POST /images/edits`，参考图按原顺序发送为 `image[]`。模型别名包含 1K 不代表只能返回 1K，实际尺寸由 `size` 指定。
- 原生协议扩展使用端点 `wire.inputMode=multipart` 与 `referenceSubmitPath`；无参考图保持 JSON。读取和验证本方文件在提交检查点前，未知受理不自动重投。现有异步 asset/url 模式保持原路径。
- 模型目录新增 `capability.imageSizes[{size,aspectRatio}]`，前端按画幅展示并保存精确尺寸。规格在受理时快照，已受理任务不受后台改规格影响。

## 已完成实测

- Studio 项目 `IPP-2ff9d22b`，首次文生图运行 `IPR-f92b5e11`：模型为目标端点，供应商 HTTP 200，返回 1024×1024 PNG；运行 `done`，30 积分正常 commit，图片已在画布显示。
- 同模型原生图生图直接接口实测：以该猫图为参考，要求保持猫、桌面、窗户和风格，仅把窗外蓝天改成星空月牙。multipart 请求 `size=2048x2048` 返回真正的 **2048×2048 PNG**；已查看成图核对参考内容与修改结果。该测试未经过 Studio 钱包，供应商按自身账号计量。
- JSON 图生图数组 `image_url` 被该平台明确拒绝（400：`image file or image_url is required`），未当作成功、未把数组静默丢弃；实际采用已成功的原生 multipart 文件接口。
- 受限备份：`/opt/ai-star-eco/backups/studio-aiprox-20261020T095154Z`。配置命令经独立短时签名管理接口，四项初始修改均有成功审计。

## 原生扩展发布与 Studio 验收

后端原生协议/规格回归 19 项、Studio 创作面板回归 74 项通过；全工作区/后台类型检查及 API 契约检查通过。工作区类型检查串行执行以控制资源占用。准备发布 `server,web-aiavatar`，发布编号 `20261020-studio-gpt-image-native`；代码基于已核对的线上 server `eb2f5259` / web `5bcfbc1f` 合并基线，不包含后续 H3 本地变更。正式制品和线上 2K 图生图终态发布后补记。
