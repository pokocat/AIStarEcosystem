# Studio 方案素材范围跨轮 · 发布记录

- 发布号：`20261024-studio-plan-material-scope`
- 构建提交：`main` `a3c90874`（合并 `fix/studio-plan-material-scope` `d21e36c6`；干净工作区 `../AIStarEcosystem-main-release` 构建）
- 服务范围：`server`、`web-aiavatar`
- 上线时间：2026-10-24 19:48（北京时间）
- 数据库迁移：无；生产配置：未改
- 回滚：在 `AIStarEcosystem-main-release` 里 `deploy-release.sh dist/deploy/20261023-studio-dialogue-no-continue server,web-aiavatar`（本机没有该包时从 ECS `/opt/ai-star-eco/releases/` 取）
- 设计真源：[`docs/ip-studio-dialogue-intents.md`](../ip-studio-dialogue-intents.md)「2026-10-24：方案素材范围跨轮」；规则 `specs/BUSINESS_RULES.md` Studio 对话第 32 条

## 起因

线上 `PEX-fc87e85770074aa9ad51`（`IPP-c2fe43a8`）：首轮点选「原视频」「三视图」，隔两轮才出方案；确认后执行的素材名单只有原视频，「编排制作计划」三次被拒（「第 1 步引用了不存在的素材」），界面只说「这份方案还没准备好」，用户点「继续」两次撞同一个错后停止。

## 内容

- 对话方案的素材范围只按一条规则算（`StudioPlanMaterials.scope`）：出方案那轮点选 → 方案 `materialNodeIds` → 步骤点名 → 同一对话更早用户消息的点选 / 附件；只留画布上还在的，≤16。两条加载路径共用，不放开校验、不加整张画布。
- 越界报 `STUDIO_PLAN_MATERIAL_OUT_OF_SCOPE`（列出全部 id）；执行停下时用画布标题说清是哪个素材，进度条给「在画布上看 / 加入这次制作，重新编排 / 不用它，重新编排」，都只重跑编排，不重跑拉片、不再扣费。
- 提示词 v27：分析方案写 `materialNodeIds`、编排指令写全替换边界；换人物外观按设定图写，不沿用原片外观（如白西装）。`reference-video-recreation` 技能随文件改动重新入库。

## 发布前验证

- fix 分支（与合并后 main 代码树相同）：`typecheck:all`、`typecheck:admin`、`mvnw compile -o`、`check:api-contract` 全过。
- server ipstudio 整包 878 条，0 失败（5 跳过）；新增跨轮素材、两条路径一致、16 个上限、加入素材只重跑编排且拉片不重跑、非法素材 400、「不用它」写明排除等用例。
- web-aiavatar vitest 1203 条，1 条失败：`select-field-wiring.test.ts`（main 上原有，admin 审计页原生 select，非本次）。

## 线上验收

- `verify.sh`：ALL GREEN。
- server 19:48:35 启动，17 秒完成；启动后日志 0 条 ERROR。
- `PromptTemplateSeeder` 刷新 54 个未改动提示词 → `v27-2026-10-24-plan-material-scope`；`StudioSkillStore` 把 `reference-video-recreation` 重新入库为 v3。

## 未验证

- 没有用真模型跑过复刻全流程（§8.0.1 ⑦）：模型是否稳定写出 `materialNodeIds`、替换边界是否遵守，需看首批真实复刻任务。跨轮点选的兜底不依赖模型。
- 浏览器里没有实际触发过「加入这次制作，重新编排」（只有组件单测）；需要等下一次越界停下时观察。
- 结束制作后重开会对同一参考视频重新拉片计费（已记 TODO）。
