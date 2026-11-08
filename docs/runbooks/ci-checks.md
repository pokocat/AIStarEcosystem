# CI 检查范围

2026-11-07 起，`.github/workflows/impersonation-ci.yml` 保持工作流名称，PR 按改动范围执行，手动触发与每周一 10:23 UTC 定时执行全量。不在 push 时重复执行。

| 改动 | PR 检查 |
|---|---|
| 文档、应用 README / PRODUCT | 范围选择器与结果汇总，不启动构建测试 |
| 单个前端应用 | 对应应用类型检查、已有测试、生产构建、接口契约扫描 |
| 共享 workspace 包 | 本包及沿 dependencies / devDependencies / peerDependencies / optionalDependencies 反向依赖的全部 workspace |
| server | 完整 Maven verify 与接口契约扫描；保持计费、并发、幂等与任务恢复测试 |
| server 场景目录 / 素材提示词 | 额外检查直接读取这些资源的 Studio / 短剧前端 |
| OIDC、认证、布局、shell、proxy、Next 配置、共享包 | 额外对受影响且支持附身的应用验证生产页面登录交接与退出 |
| pnpm 锁文件、workspace、补丁、根包配置 | 全部前端类型检查、测试、构建、支持的浏览器验证 |
| CI 配置 / 选择器、未知代码或配置 | 回退全量，不静默跳过 |

范围真源为 `scripts/ci/affected.mjs`。选择器读取 workspace 的 package.json，按最长目录匹配，所以 `apps/web-aiavatar/studio-admin` 独立于 Studio。PR 使用 base SHA 对 GitHub 实际测试的 merge SHA 做 diff，关闭重命名检测以同时检查旧目录和新目录。删除、跨应用移动不会漏掉原应用。

每个 workspace 使用独立 runner，避免多个 Vitest worker 池在同一台 runner 上争 CPU。最长的 Studio 测试再用 Vitest 原生 `--shard` 分成两组，类型检查只执行一次。接口扫描仅依赖 Node 内置模块，无需 pnpm install。各任务结果由稳定的 `backend`、`frontend-tests` 与 `CI` 汇总；选中的任务失败或取消会失败，未选中的任务可以跳过。建议新增分支保护时使用固定 `CI` 检查名，不绑定动态矩阵项；本次不修改仓库保护配置。

后端仍完整执行 `verify`，按 Surefire 默认命名规则发现当前源码中的测试类，由 `scripts/ci/server-tests.mjs` 分成三组，各在独立 runner 串行执行（单测试 fork，不用 Maven `-T` 或 JUnit 并行）。`server-test-times.json` 是本 PR 首轮完整运行的耗时样本，仅用于均衡负载，不是测试白名单；新增测试没有耗时样本也会分配。范围回归检查所有类恰好出现一次；每组完成后核对 Surefire 报告，缺类或混入别组都会失败。参数化与嵌套测试由原测试类正常发现，不按用例方法拆分。报告和分组清单作为三份独立制品上传。

全量包括此前构建矩阵遗漏的 studio-admin 与 web-incubator；附身浏览器脚本仍只支持原六个产品，不对原型和运营后台套用错误的登录路径。

## 测试边界

- 保留用户输入、素材引用、技能映射、保存成功 / 失败、权限、付款账户、重复提交、真实任务状态等行为。
- 不逐字固定标题、介绍、空态、提示等展示文案；行为测试可以按可访问名称找到控件后操作。
- 不用正则固定 CSS 色值、尺寸或选择器写法；涉及布局与可读性的修改仍需实际页面验收。
- 禁词 / 标点扫描、旧未接入页面的接线检查、强制组件出现次数、全站禁止原生 `<select>` 不作默认 PR 测试；保留实际入口、共享控件的键盘操作和选中回调。
- 模型原文、用户文案、接口返回数据属于被测数据，继续验证原样保留；生成提示词测试验证输入和选项不丢失，避免整段照抄固定句子。

## 验证选择器

检查也通过 devq 进入 Mini 队列：

```sh
/Users/donis/.local/bin/devq remote submit --name ci-scope-regression \
  --cwd /Users/donis/dev/AIStarEcosystem -- bash -lc 'node --test scripts/ci/*.test.mjs'
```

选择器用例覆盖文档跳过、应用隔离、嵌套后台、反向依赖、服务端 Markdown 资源、跨仓资源引用、认证浏览器范围、配置回退和真实 Git 重命名 / 删除。每次 Actions 的 scope 任务会在 Summary 输出所选范围，方便检查为什么某任务运行或跳过。
