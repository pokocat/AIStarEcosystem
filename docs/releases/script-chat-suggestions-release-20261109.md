# AI 编导对话与修改建议

2026-11-09。按用户确认的局部设计实现，范围仅 `web-aiavatar`，不改服务端、API、模型配置、积分账本和视频生成策略。

## 最终行为

- 删除 AI 编导标题栏与回复底部的两处「返回编辑」。成功的 AI 脚本按只读对话展示，「采用脚本」进入原有脚本编辑区。完整返回文本和历史回复保留。
- 最新一轮成功且有内容时显示三条修改建议；电商场景为「开头更抓人」「台词更自然」「突出商品卖点」，其他场景第三项为「突出内容重点」。
- 点建议仅填入修改意见并聚焦，可自行修改，发送后才提交一次文字任务。生成中、失败及空结果不展示建议。
- 多行输入：Enter 发送、Shift+Enter 换行；输入法确认回车不触发发送。素材、规格、采用与付费调用沿用现有流程。

## 验收

Mac mini 队列 `92b8d0c4e3fa`：5 个相关测试文件 96 项全部通过；全工作区串行类型检查、管理后台类型检查、后端离线编译和 API 契约检查通过，退出码 0。首轮发现旧测试在采用脚本后仍查找「AI 编导」，已按既有真实按钮名「AI 改写」修正，未跳过测试。

Chrome 实际打开当前 Next 前端；API 为隔离界面数据，不连接生产或付费供应商。桌面验证删除入口、只填入、手工补充后一次发送、旧回复保留和采用最新脚本；390×844 手机宽度验证建议、发送和采用，建议高 44px、文档宽 379px，无横向溢出。模拟文字请求共 2 次，视频提交 0 次。手机测试是浏览器视口模拟，不代表真机输入法验收；中文组合输入保护由组件测试覆盖。

截图：[桌面对话](evidence/script-chat-20261109/desktop-dialogue.png)、[建议填入](evidence/script-chat-20261109/desktop-suggestion.png)、[连续回复](evidence/script-chat-20261109/desktop-revised.png)、[手机宽度](evidence/script-chat-20261109/mobile-suggestion.png)。[交互观察](evidence/script-chat-20261109/browser-observations.json)、[请求汇总](evidence/script-chat-20261109/api-observations.json)、[隔离界面服务](evidence/script-chat-20261109/ui-preview.mjs)。本聊天预览服务和 SSH 隧道已释放。

设计扫描仅有场景页已有尺寸、圆角和颜色的 advisory；新增按钮沿用该页控件及用户确认的设计，未新增忽略或修改设计元数据。

## 发布

已于 2026-11-09 16:07（北京时间）发布。

- main 代码提交：`fe1a75e756f3478b901cb80c732862524381f38f`，干净提交构建。
- Mac mini 构建队列 `c43a06899e75` 退出码 0；制品 `20261109-script-chat-fe1a75e7`，校验和通过，线上 Next build ID `ypxM1J2lCQBuNJEODgQCr`。
- 仅更新 `web-aiavatar`，保留 OIDC、企业开关 `1` 和原 API 构建配置；server PID `3021825`、启动时间 14:56:33 均未变化。
- `deploy-release.sh` 退出码 0；环境预检、公共路由、所有现有服务、后端 API、SAU 健康和 nginx 配置检查 `ALL GREEN`，见 [健康检查](evidence/script-chat-20261109/verify.txt)。本机探针沿用已核对的 aistar 域名与生产 IP 解析，SSH 绑定 en0。
- 线上真实已有草稿打开 AI 改写后验证：零个「返回编辑」、三条建议、选择后多行输入获得焦点；脚本原文与对话轮数不变、发送按钮可用。未点击线上发送或重新生成，未发起付费模型任务。见 [线上观察](evidence/script-chat-20261109/production-observations.json)。线上素材和原文截图仅本地交付，不提交仓库。
