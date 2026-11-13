# 音频版权拒绝提示与最新 main 生产发布（2026-11-13）

应用提交为 `27bed09c15eaa8518caf25c9e26df00970c896fc`，包含音频版权拒绝映射修复及此前最新 main 的 Studio 媒体后台任务、截取和复刻改动。范围为 PostgreSQL V82、API、A 独立后台及 Studio 前端。短剧前端仅同步 A 当前已上线制品到 B，避免切换整个前端组时回退；其余前端制品保留。SAU、独立成片导出进程、DNS 和旧 ECS 未更新。

- [完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43456367871) 绑定上述 SHA，30 项检查全部成功，含后端三分片、PostgreSQL 18 实库门禁、前端类型/测试/构建及浏览器检查。正式 JAR 来自同次 `verified-backend`，元数据为 196 张业务表、Flyway V82。
- 发布制品为 `9fdc91574addfc26`；JAR SHA-256 为 `9fdc91574addfc262b6431be50cccc2723fb13ff303a95e57c44817d64ff8647`，镜像配置为 `sha256:751999751d6b908fa974e1bd54cdaf31c55fef8682d187083d443786bd02bb69`，A/B 私有 OCI 归档全量 SHA-256 为 `0adf50eb680100c202da25633b76fa62b14258ddc95b0c09fae6b22176859b3e`。归档通过私有 SSH 传输并全量核对，未使用公开对象中转。
- 迁移前仅有 V82 待执行，当前版本为 V81。迁移角色通过严格 TLS 只应用 `V82__studio_media_jobs.sql`，新增 `studio_media_job` 及索引；验证应用角色四项 DML 权限。候选和原 B 版本的 Flyway 校验均通过，未修改任务、钱包或历史迁移字节。
- 2026-11-13 08:11:31 PST，API 新版 B 接管 100% 流量；两个正式 VIP 的严格 TLS、就绪 200、固定普通账号 `/api/me` 200、匿名 401、普通账号访问后台 403 均通过。A 保留 `d9416012b6e8f9b98ddb175bd07fb2e89594d820` / `8884d30e25e2e08d` 零权重热备。A 独立后台暂停领取并连续三次确认本机调度、请求、线程和队列归零，再换到同一新版镜像，就绪通过，重启计数 0。
- Studio standalone 从干净同 SHA 构建，保留生产 OIDC、`web-aiavatar` client 和企业功能开关。`BUILD_ID` 为 `iRJbX2WJZYBw8r99SHxT6`。B 的短剧站同步 A 当前 `AnS1YIJHDUjBqTnIrmVIF`。新目录合并保留 A/B 旧页面需要的静态文件。B 零权重阶段首次启动因缺少只读挂载目标 `.next/cache` 失败，补齐挂载目录并规范容器读取权限后，两个准确构建的直连静态资源检查均为 200，重启计数 0；期间前端流量始终留在 A。
- 2026-11-13 08:19:29 PST，前端独立 ALB 组切为 B100/A0。双 VIP 的 38 项页面、静态构建、视频页、同域配置及匿名身份请求检查和 ALB 健康检查通过，全部前端域名保留正确版本，A 原前端作为热备。2026-11-13 08:20:34 PST 再次核对 API 和前端组均为 B100/A0，并重验 API 双 VIP 鉴权。
- 在已发布镜像的禁网、只读隔离容器运行脱敏 fixture：`copyright_audio` 得到 `VIDEO_AUDIO_COPYRIGHT_RESTRICTED`，保留「服务方提示生成的音频可能涉及版权限制。请调整提示词后再生成。」；普通 `service_busy` 仍为 `VIDEO_PROVIDER_INTERNAL`。未调用供应商、重跑客户任务或修改客户账本，历史失败记录不改写，供应商判定真实性未据此确认。
- 发布窗口内 A/B API 与后台 journal 的 ERROR 行计数均为 0；匹配规则覆盖 `-ERROR` 和 `ERROR`。两机实际 ilogtail daemon 均在运行（并非同名 systemd 单元）；正式 SLS `aistar-app` 的发布窗口聚合查询完整返回 185 行，最新时间晚于发布。没有导出日志正文、请求或素材链接。

最终回执与制品保存在本机 `/tmp/aistar-release-audio-20261113/`，包括 API 准备/切流、后台、前端、数据库、禁网 fixture、SLS 聚合和最终版本/权重记录。回退使用仍在运行的 A 原 API/前端，经统一发布入口重新验收并切流；保留向前兼容的 V82。后台旧 override 保存在 A `/opt/aistar-cluster/control/background-before-9fdc91574addfc26.conf`，按排空流程恢复，禁止回启旧 ECS API/SAU。
