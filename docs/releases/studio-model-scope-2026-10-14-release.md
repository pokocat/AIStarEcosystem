# Studio 视频模型按开放范围生效（2026-10-14）

用户要求录入模型并配置开放范围后即可在应用选择，取消 Studio 视频模型组的第二次候选选择。原链路需要先建端点、配置视频协议和范围，再单独加入 Studio 模型组；漏掉最后一步就会出现“模型已录入，Studio 选不到”。

## 变更

- Studio 视频候选从已启用的视频用途候选和显式 `video` 类型、Studio 开放范围推导。旧模型组只保留默认模型及无显式范围策略的存量候选兼容；从 Studio 范围移除模型会阻止新任务继续选择它。
- `modelAccessSave` 在一个事务中验证视频协议、保存范围并准备或启用视频候选；共享候选变更沿用精确影响集合确认，并记录独立审计。缺视频协议时拒绝保存 Studio 视频开放配置。
- 不修改用户售价、供应商成本、已有任务或旧组默认项；无数据库迁移。

## 发布与验证

- 代码提交 `1ff430398` 已推送 `codex/unified-ip-studio`。`AiModelAccessPolicyServiceTest`、`AiAppSceneModelPolicyServiceTest`、`ModelManagementServiceTest`、`ModelFeatureManagementServiceTest` 通过；工作区类型检查、服务端离线编译与 API 契约检查通过（契约检查仍报告存量的缺 handler 警告）。服务端 JAR 构建成功。生产 release `20261014-studio-scope-1ff43039` 仅更新 server，`verify.sh` 全绿。
- 发布前旧 JAR 备份在 `/opt/ai-star-eco/backups/studio-scope-20261014T083721Z`；运行 JAR SHA256 为 `79971abbcf2af98723fbd2c1dad759cc9d8ab2371ed0751879986692645f2379`，与本地构建产物一致。
- 线上运营后台的 Studio 视频功能行列出 `seedance20-onetoken` 和 `jusuanhub- MiniMax H3`，H3 仍为默认。未发起付费生成，供应商视频生成与积分结算未在本轮复测。
