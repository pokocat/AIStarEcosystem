# Studio 默认模型与用户选择入口 · 2026-10-25

## 配置切换已生效

- 用户授权导演台与 Studio 画布共同切换图片默认，Agent 交互切官方 DeepSeek，再提供选择入口。
- 图片接入点 `ai-624cb6b2-379`：`Doubao-Seedream-4.5`，真实模型 `doubao-seedream-4-5-251128`，北京方舟 `/api/v3`，同步 URL 返回；7 个 2K 画幅、0–14 张参考图。默认 16 积分/张，保留其他候选的现有售价。
- 对话接入点 `ai-1bd2eefd-d1e`：`deepseek-flash`，官方 `https://api.deepseek.com`，流式，API 模型清单标明 DeepSeek V4.1 Flash、支持视觉、1M 上下文。原生 tools 关闭，复用 Studio JSON action 协议（避免默认 thinking 的 reasoning_content 续轮不兼容）；不改变用户费率：输入 0.59、输出 2.36 积分/千 Token。
- 通过专用签名模型管理接口写端点、Studio 授权、候选和场景配置；密钥仅加密落库，不进仓库 / 本文 / 操作输出。配置备份 `/opt/ai-star-eco/backups/studio-model-switch-20261025T172619Z`。既有其他产品绑定不随 Studio 场景覆盖改变。

## 实际供应商验证

- 方舟模型清单确认真正 4.5；真实单张 2560×1440 蓝圆测试：6.32 秒，返回模型 ID 正确，输出 JPEG 140103 字节、像素正确、下载主机符合白名单。空参考数组可正常出图。
- DeepSeek 余额可用；真实 SSE 两轮动作回放：首轮生成 read_canvas action 0.92 秒，追加画布结果后续答 0.39 秒，无 reasoning_content 丢失导致的续轮错误。此结果是小请求耗时，不能当成长上下文 SLA。
- 未重提客户任务、未更改客户积分 / 开通。原有测试身份已被停用，未绕过身份状态进行真实客户登录验收。

## 入口实现

- 助手：恢复 Git `cf9050f04^` 的底部胶囊设计，按钮位于输入框内 @、附件右侧；多候选才显示，点击选择，按画布本地记忆，回复中禁用。费用用悬停提示，保留小数。
- 导演台：作品设置增加图片模型，所选 ID 保存到作品；资产参考图、分镜图、预算和实际请求统一使用该 ID 的价格与规格；下架模型必须重新选择。
- 原画布图片生成面板已有选择入口，继续共享 image 场景与新默认。
- 不需要数据库迁移。

## 本地验证

- 前端助手 / 导演设置 / wiring 83 项通过；后端 DirectorImageModelTest、DirectorSplitTest、DirectorLibraryImportTest 均通过。
- pnpm typecheck:all、typecheck:admin、后端离线 compile、check:api-contract 通过（契约扫描保留 24 个既有 handler 警告）。
- 浏览器验证菜单切换、刷新恢复和 360px 面板布局；底部模型按钮与发送按钮同一行，不覆盖输入。测试预览页只用于本地验收，正式制品不包含。

## 发布

已合并原导演台分支的资产库导入、画布分组和下载入口，保留最新 main 的停止结算修复；正式构建与线上检查待记录。
