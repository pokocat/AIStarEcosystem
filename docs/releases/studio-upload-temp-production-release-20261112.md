# Studio 视频上传临时目录发布（2026-11-12）

2026-11-12 07:54:44 PST，API 从 A100/B0 切为 A0/B100。修复提交 `e79c1ea8f` 将 API 容器的 `/tmp` 从 128 MiB 的 tmpfs 改为每节点、每环境独立的磁盘目录。上传接收和媒体探测会同时保存视频，转码还可能额外写入一份。容器以 UID 10001 访问权限为 0700 的目录。

- A、B 的应用制品均为 `1ec009e8a3cd2f32`，来源 `1c5144b2b0bf0174c69b2cb7e7eb0ba99df6d764`。JAR SHA-256 为 `1ec009e8a3cd2f327c1bb6e4e89776b0d96c205b84621f6517de98b47167ac66`，镜像为 `sha256:421a1ae9445238554962f61f0e9b4e9834b0527cfb5017d405839f2143c71265`。应用源码树与构建输入一致，复用[已验收制品](https://github.com/pokocat/AIStarEcosystem/actions/runs/43227090729)。
- B 排空后重建容器，部署接口与本机就绪检查通过。切流后在两个正式 VIP 验证严格 TLS、实际节点 B、就绪和业务配置 HTTP 200，以及管理员路由匿名请求 HTTP 401。B 启动日志至验收时未出现 ERROR。
- B 承流容器的 `/tmp` 实测为可写磁盘挂载。用运行用户同时保留两份 70 MiB MP4，FFprobe 成功读取 H.264、尺寸和时长。验收使用合成视频，临时文件已清理。已登录的 Studio 网页上传未实测。
- A 保留原容器为零权重热备。回退时恢复 A 承流，上传仍受原临时盘容量影响。本次发布范围为 API 容器运行配置。

正式运行配置更新可用同一制品执行 `deploy.sh server --refresh-runtime`。省略 `--probe-file` 时，由节点本地部署接口和双 VIP 检查完成验收。详见[生产发布手册](../runbooks/aistar-production-release.md#2-更新-api-备用机并切流)。
