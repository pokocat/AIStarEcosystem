# OneToken 素材库发布（2026-11-07）

| 项 | 内容 |
|---|---|
| 发布号 | `20261107-onetoken-assets` |
| 服务 | 只发 server，另改两条模型配置 |
| main | `08f1852b4`，直推 main，没有跑远端 CI |
| 构建 | 仓外干净工作区 `../AIStarEcosystem-long-video` |
| `app.jar` 校验和 | `61d7031d67718e18`，与发布包一致 |
| 上线时间 | 服务端 09:31 CST，配置 09:32 CST |

## 上线内容

OneToken 的 Seedance 2.0（`ai-98b369eb-b59`）和 2.5（`ai-onetoken-seedance25`）不再给厂商发我们的签名链接：首帧、尾帧、参考图和声音先传到 `POST /api/v3/video/assets`，生成请求只带 `asset://ota-…`。规则见 `specs/BUSINESS_RULES.md`「视频素材交给厂商的方式」。

用户要求接素材库。它**不保证真人照片通过审核**：OneToken 文档没有这样写，线上 5 条被判真人的任务全部来自直连火山的 Seedance 2.0 Fast，这个模型不认这种引用。

配置通过模型配置服务写入（`endpointSave`，操作人 `claude-code-donis`），两条规格改前改后逐字段对比，只多了 `inputAssets`：

```json
{"uploadPath": "/api/v3/video/assets", "fileField": "file", "ref": "/ref", "status": "/status", "ready": ["Active"], "expiresAt": "/expires_at"}
```

没有迁移，DTO 和 openapi 没有变化。线上到 main 的服务端差异只有这次改动。

## 发布前真调

上线前用线上那把 Key 在服务器上传了一张程序生成的色块图并读回，Key 只在内存里解密、没有输出，没有创建视频任务，不花钱。

```json
{"expires_at":"2026-11-07T07:15:37Z","id":"ota-7d910a1e5ef094b5d69d7ac0e2d46500","mime_type":"image/png","ref":"asset://ota-7d910a1e5ef094b5d69d7ac0e2d46500","size":3476,"status":"Active","type":"image"}
```

形状和文档一致，有效期约 6 小时。

## 窗口与验收

- 发布前：没有在途文字、出图和视频任务；账号中心 200。
- 重启期间 API 共 12 个 502：部署探测 6 个，用户请求 6 个（视频任务页轮询 5、钱包 1）。verify 全绿，`NRestarts=0`。启动后 2 条 ERROR 和 2 个 500 是同一件事：09:33 验收查价时参数名写错了（`seconds` 应为 `duration`，必填参数缺失按 500 返回），不是用户请求；除此之外没有 ERROR 和 5xx。
- 线上只读：模型列表里两条 Seedance 都在，返回内容不带 `inputAssets`；长视频报价没变，Seedance 2.5 的 60 秒视频 7260 积分，Seedance 2.0 的 30 秒 2400 积分。

测试：服务端相关 186 条（素材上传、回执复用、限流、长视频流程、角色声音、视频规格）全过；`pnpm typecheck:all`、`typecheck:admin`、`mvnw compile`、`check:api-contract` 全过。

## 没有验证的

- **带 `asset://` 引用真正出片。** 要付费，没跑。第一条真实任务才算数，看日志 `素材已上传到素材库` 和任务结果，已记 TODO。
- 引用被厂商提前作废时不会自动重传，要等我们记的有效期到。文档只说过期和他人素材会被拒，没遇到过提前作废。

## 只关素材库

用 `endpointSave` 把规格里的 `inputAssets` 去掉，下一个任务起就改回签名链接，不用重启。

## 回滚代码（回到 `20261107-pc-ui-copy`）

更早的版本遇到 `inputAssets` 会整条规格读不了，值是 null 也一样。这一版的 `endpointSave` 去掉字段时会写成 `"inputAssets":null`（main 上已修，下次发布起不写空值），所以回滚前要这样做：

1. 确认这两条模型没有在途任务。在途任务存的规格快照也带这个字段，回滚后查不了进度。
2. 用备份 `/opt/ai-star-eco/backups/onetoken-assets-20261107T013232Z/before.json` 把两条 `video_request_spec_json` 原样写回数据库。
3. 查 `SELECT id FROM ai_model_providers WHERE video_request_spec_json LIKE '%inputAssets%'`，应该 0 行。这段时间有人保存过别的模型也会带上 null，要一起去掉。
4. `deploy-release.sh dist/deploy/20261107-pc-ui-copy server`（本机没有这个包就从 ECS `/opt/ai-star-eco/releases/` 取）。
