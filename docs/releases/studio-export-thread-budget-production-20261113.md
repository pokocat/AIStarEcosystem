# Studio 成片导出线程限制发布（2026-11-13）

- 生产制品取自 `main` 的 `4e872a4a1e3074107719e39499aa0e6469caaac6`。[发布 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43463601640) 的 30 项检查全部通过，包括后端三分片和 PostgreSQL 18 实库门禁。Mac mini 上提交前的编译、接口契约和 43 项定向回归均通过。
- 发布范围为节点 A 的独立导出进程 `aistar-studio-export`。制品 `c8da42d27994de55`，JAR SHA-256 `c8da42d27994de55defd0f3f62191b50ba8713a32a508a1b1df44c21a8f97ace`，镜像配置 `sha256:ff69151d3ce191951e940a0372b17cef36b831b41789100566f4ccfaeae030e0`。A/B 私有 OCI 归档 SHA-256 `dd8e28d2cf80b63fa5d11b7596e6d564b159f62fe51794ddf640d012faaf4bc0` 已一致核验。
- 在集群发布锁内暂停领取，连续三次确认四项本地执行计数为零。首次切换时 Podman 保留的已退出容器占用原名。核对该容器 ID、原镜像和退出状态，确认 Java 与 conmon 均已退出后移除这条容器记录并启动新版。原单元留存于 A 的 `/opt/aistar-cluster/control/studio-export-before-c8da42d27994de55.service`。工作进程就绪后仍为 2 核、2304 MiB、128 线程或进程。
- 原任务 `PEX-70725c3d4bb14b56882c` 的六次历史导出在混合规格重编码时触发了容器线程上限。修复为每路视频解码使用一个线程、滤镜图使用一个线程、H.264 编码使用两个线程。2026-11-13 08:54:17 PST，原任务通过页面一次重试后进入完成状态。导出 `IPR-025ef69ed0e247609709` 的有序素材引用与历史导出一致，五个生成步骤的运行 ID 和尝试次数一致。导出费用为 0 积分，任务累计 7200 积分，冻结 0。OSS 成片为 1280×720，浏览器播放器实际读取 59.908 秒并实播。验收后导出容器的线程上限命中、OOM 和重启均为 0。
- API 双 VIP 就绪与固定账号鉴权通过，承流 B 为 100%，SHA 为 `27bed09c15eaa8518caf25c9e26df00970c896fc`。A 热备为 0%，SHA 为 `d9416012b6e8f9b98ddb175bd07fb2e89594d820`。两台 ECS 的 SLS 采集进程均在运行，发布和成片状态以节点 journal、PostgreSQL 和 Studio 页面交叉核对。回执保存在本机 `/tmp/aistar-studio-export-20261113.jPoynB/`。
