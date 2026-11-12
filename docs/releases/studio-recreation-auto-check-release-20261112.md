# 爆款复刻自动检查发布记录（2026-11-12）

北京时间 10:09:35 发布 `20261112020053-4e2a436`，制品构建自远端 `main` 的 `4e2a4361ea66e462c68f9326713e8eaa2ddf8ce9`。按用户本次指示，更新当前承载公开域名的旧 ECS 上的 `web-aiavatar`，仅重启 `aistareco-web-aiavatar`。旧机的 API 与 SAU 发布后仍为 inactive。相较线上基线，本次 main 制品还包含主线已有的充值弹窗轮询状态修正。

- Mac mini 的 devq 任务 `b4b5184cc5d2` 退出码为 0，三组定向测试共 51 项通过，类型检查和 Next 生产构建通过。
- 发布机校验了归档 SHA-256 `0a5570db16fe2c486ea15665c5ad0270a09b8911a959284256fc5d3d319dde52`。运行目录与两域名公开页面的 BUILD_ID 均为 `ZOynPnlFBnciUuSJsqGlD`。
- 两域名的爆款复刻、工具箱、配置接口与示意图返回 200。登录态 Chrome 打开爆款复刻，在底部「视频规格」展开后确认「自动检查」在面板内且默认关闭。本次验收没有提交生成。
- 回滚基线为 `20261111-optimize-credits-eb7bb9da`，BUILD_ID `rKi5MGMcX2OMaIjNsaHFg`。发布目录保留了切换前的完整前端目录 `previous-live`。
