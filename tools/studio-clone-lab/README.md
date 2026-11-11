# 独立复刻实验脚本（归档，不接入产品）

这是2026-11-08至09日对9861/9862两段素材实际运行的脚本快照，不是可泛化的自动复刻SDK。工具箱的正式服务代码仍在ipstudio域；本目录不被其导入或调用。

- `provider.mjs`：既有渠道适配、请求/原回包保存、幂等与预算预留。读取运行目录下独立private配置；仓库不提供凭据。归档默认保留`PAID_WORK_DISABLED`，禁止新付费调用。
- `prepare-more.py`：特定素材的动作窗口准备。
- `complete-batch.py`：只续查已受理任务，并在预算内以原幂等键处理预先确定的剩余造型；不能当通用自动重试器使用。
- `fan-compose.py`：H3入画、Wan主体、原片扇叶与局部背景的分层合成；包含针对本素材调出的阈值、时间和区域，不能直接集成。
- `wheel-assemble.py`：按原时钟对齐日/夜动作片并保留原声。
- `verify-media.py`：完整解码、时长/尺寸、唯一任务和新增预算核验。
- `export-results.py`：H3基线导出与联系表。

脚本保留实际运行路径：Mini `/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108`；本地归档位置及结果见[实验复盘](../../docs/audits/studio-clone-independent-lab-20261109.md)。路径和输入需按实验清单准备，依赖位于Mini隔离venv，不写入生产环境。

所有安装、批量测试、推理、转码经共享devq；实际执行必须遵循仓库AGENTS.md。`provider.mjs`还依赖private/channels-encrypted.json、private/transport-key及budget-additional.json；这些配置不随源码提交。不要通过删除禁用标记来绕过预算审核或复用别人的凭据。没有新授权时不增加预算，不更换已受理任务的幂等键。

本目录只归档研究，不安装依赖、不下载权重、不自动发起生成。现有媒体、原始回包与受理记录保留在原实验目录，未加入Git。
