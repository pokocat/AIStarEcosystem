# Studio Seedance 2.5 原生编辑上线（2026-11-14，北京时间）

Studio「爆款复刻 → 元素替换」已开启 OneToken Seedance 2.5 的原生编辑。单段原片 4–30 秒，允许一段 MP4 原片与最多九张替换图。视频规格有 480P、720P、1080P，以及 16:9 和 9:16。默认保留原声，后台将原片音轨合入成片。原片无音轨时交付无声视频。

方舟官方编辑接口使用 `omni_reference_task_type=edit`、`ratio=adaptive`、`duration=-1`。线上 OneToken 计费网关使用同一个任务类型，发送 Studio 所选画幅和整数秒时长。OneToken 实测在 `adaptive` 下将带方形替换图的横版原片输出成方形，因此线上使用显式画幅。OneToken 编辑允许替换图片，独立参考声音会被拒绝。普通全能参考的参数和价格沿用原配置。[方舟 Seedance 2.5 指南](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh) · [OneToken 接口说明](https://onetoken.love/docs?video_model=seedance-2.5#video-tutorial)

| 清晰度 | 编辑基准价（积分/秒） |
| --- | ---: |
| 480P | 119 |
| 720P | 137 |
| 1080P | 305 |

费率采用 OneToken 编辑档成本，按现行 60% 加价向上取整。15:16 在新版 API 上经模型管理命令先写费率，再启用 `ai-onetoken-seedance25` 的编辑合同。两条写入均有成功审计，读回与写入一致，模型候选、限额及普通参考配置保持原值。改前备份为 A 节点 `/opt/aistar-cluster/control/seedance25-edit-before-20261114T071644Z.json`。[OneToken 模型报价](https://onetoken.love/models)

## 发布与验收

- 生产应用提交 `3b6e5c32c08a6c2a714d0f1aa4fbbd5ae10a7977`，包含 `d4f9f8ff5` 的编辑参数及独立定价和 `3b6e5c32c` 的原声功能。Mac mini 定向后端检查、Studio 类型检查、32 条交互测试和接口契约检查通过。主线 CI 30 项全通过，包含 PostgreSQL 18 门禁。[主线 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43568422129)
- API、独立后台和 Studio 前端与同一主线提交上的官方形象变更合并滚动。15:12 API 切到 A 承流，B 保留 `a3721995a257b425`（`0200357bad`）。A 的 API 和独立后台均运行 `b84a3bbc49f88c21`。JAR SHA-256 为 `b84a3bbc49f88c219ffbe8258746993030d43a0c22d8bec045bc930a58a2d70e`，镜像配置为 `sha256:ae2c66ac5731a7fc61edf5830651d7570efda5810bd89d585be0777d42e68d20`，镜像归档摘要为 `619e53eeff765e07f9104c4c69b380e0a80b5da4a891fd152e744f569b9852c5`。两个正式 VIP 的 TLS、就绪与鉴权通过，独立后台就绪、重启数为 0，容器内 FFmpeg 和 FFprobe 可用。上线观察窗口里 API 和独立后台的日志采集正常，ERROR 为 0。官方形象的 V83 迁移随同一制品验收，编辑功能无新迁移。[同批发布记录](./studio-official-avatars-production-20261113.md)
- 15:16 Studio 前端独立 ALB 切到 A100/B0，双 VIP 和 ALB 健康通过。A 的 BUILD_ID 为 `ygy5Kj1e3NW9FKL9Ejow1`，包 SHA-256 `d71b3324edf13a89b6cd1a31eb48ab94a98afbf0b8f9e0ee58426502b2a601e8`。B 保留 `FNTQyS1iEuc6CYoJ3u0_x`。登录生产 Studio，进入元素替换并选中 Seedance 2.5，核实三档清晰度、30 秒设置、默认勾选且可切换的「保留原声」及独立参考声音入口隐藏。验收未在 Studio 提交付费订单。[Studio 生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43568447533)
- 同一 OneToken 生产接入点受理并完成了两条合成测试素材的元素替换。30 秒测试 `sdn_fd8b17acc5364997ba4f75321d326a58` 带一张替换图，原片内嵌 660 Hz 测试音。供应商成片实际 1280×720、30.02 秒，替换画面符合要求，输出音轨无原片的测试音。应用的 FFmpeg 回填流程验证了原片音轨合入后的视频时长、画幅及 1、8、15、23、28 秒位置的 660 Hz 测试音。首次供应商试片为 480P，30 秒样片为 720P。

## 替换图上限修正

同日发布 `3b9e0792701524757a0202d739599ec273392704`。选中 Seedance 2.5 时，Studio 显示最多九张替换图，添加素材、报价和提交均使用端点上限。超过上限的已有草稿提示移除多余图片。Mac mini 后端定向检查、Studio 类型检查、33 条交互测试和接口契约检查通过，主线 CI 30 项全通过。[后端 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43570840096) · [Studio 构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43570855486)

- 15:43 API 切到 B100/A0，A 保留 `b84a3bbc49f88c21`。B 的 API 和 A 的独立后台运行 `dccdfee3ae3fd32a`。JAR SHA-256 `dccdfee3ae3fd32a0406cd727ecc267d94b0f1935e17bbc1b216a6ec7ded8f19`，镜像配置 `sha256:26307b9f36f9936151f6b627a507f5cae433fba7e2189af2a435e00e3786d82f`，镜像归档摘要 `66dc68204dfe66437c6a85d4ba21bb9ebde2c29bd3617eb81f24dc305813ae7e`。云端发布包下载遇到 SSH 连接中断，续传后用云端摘要复核了完整包。两个正式 VIP 的严格 TLS、就绪和鉴权通过，独立后台就绪、重启数为零，SLS 仍收到新日志。既有编辑合同和费率读回一致。
- 15:46 Studio 前端切到 B100/A0。两处 VIP 的元素替换页面均为 200，BUILD_ID 为 `GG_gtwXDkJ7aiImMFPUR8`，包 SHA-256 `f8503476c039cedb0d14e64b152fc82052c3c403229eb3edf213a6467ffa46e0`。A 保留 `ygy5Kj1e3NW9FKL9Ejow1`。线上登录复验「图片 0 / 9」、30 秒、原声默认开启和三档清晰度。未在 Studio 提交付费订单。

## 30 秒切片边界修复

2026-11-14 00:32（洛杉矶时间）生产 API 切到 A100/B0，A 的独立后台也运行同一应用提交 `fc8ddf84d200503eba6b78c02b3435aa7908777d`。A 的制品为 `49a829183dc6a72f`，B 热备保留 `dccdfee3ae3fd32a`。JAR SHA-256 `49a829183dc6a72f3f99d9845f1e7e3568e84565ffca74034a3c030dfcbfad51`，镜像配置 `sha256:cb1096e302a2243ce7959091dd3e0c6e00d8136b84814a6cfe416a7597f47925`，镜像归档摘要 `ee24fa7928192091cf62d895026de043d969c09b3623dfd35d5daf792f9707ed`。双 VIP TLS、就绪与鉴权通过，后台就绪且重启数为零，Studio 页面返回 200，SLS 收到切流后日志。编辑合同读回仍是 4–30 秒。本次后端修复随同一主线制品发布，数据库没有新增迁移。[主线 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43574531190)

直传判定与提交校验都以 MP4 容器时长为准。切片编码先留 0.1 秒余量，30 秒上限对应 29.9 秒目标；FFprobe 发现容器仍超限时，后台自动用固定 25 fps 重新切片，再测量。只保存符合时长限制的成品。30.010 秒原声样片走实际切片 worker 后产出一段 29.900 秒，60 秒带原声素材的两个切片实测均为 29.930 秒。低帧率素材首切实测 30.857 秒，自动重切为 29.920 秒。双节点用生产候选镜像分别验证了 29.900 秒和 29.920 秒两种输出，以及两段末尾的原声频率。Mac mini 定向测试 62 项通过。验证覆盖实际切片和原声，没有提交供应商生成任务。

## 恢复配置

当前热备 `3b9e07927` 支持编辑合同与原声音轨。需要回退至早于本次原声发布的版本时，先暂停新接编辑任务，核对并保留在途编辑任务。确认没有需要按编辑合同继续提交的在途任务后，在新版上通过审计命令用改前备份移除端点 `edit`，恢复该端点的编辑费率条目，再按生产手册切回已验收的版本。早于 `d4f9f8ff5` 的端点规格解析器无法读取新增字段。无需回滚 PostgreSQL 结构。
