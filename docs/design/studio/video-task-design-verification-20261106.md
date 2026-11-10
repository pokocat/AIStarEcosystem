# AI 视频统一任务：设计系统复核

日期：2026-11-06。范围：本地实现的 AI 视频页、任务历史、任务设置及画布任务返回条。Impeccable 文档阶段；模式为 Operate，属于既有界面的普通扩展。

## 结论与边界

> **已被 2026-11-06 评审修正**：本文以 `DESIGN.md` 为基准，把场景页的新版样式当成「既有差异」。之后的评审发现主按钮、圆角、字号都和 AI 图片页不一致，失败页主按钮黑底黑字，已按 `studio-scenes.css` 改正，见[方案 §11](../../studio-video-workflow-redesign.md)。下文的颜色、字号、列宽和截图是修正前的记录。

本次延续 IP Studio 的白色工作面、深墨操作、细边线、紧凑控件与设备形态规则。新增的是同页任务制作、结果交付和历史恢复的组成方式，不创建或替换视觉系统，不批准新的全局令牌。三列仅服务于视频任务工作区，不提升为所有 Studio 页面的固定布局。

保留 [现行 DESIGN.md](../../../apps/web-aiavatar/DESIGN.md) 与 [设计 sidecar](../../../apps/web-aiavatar/.impeccable/design.json) 原文，不重生成、不补写设计演进。产品约束来自 [PRODUCT.md](../../../apps/web-aiavatar/PRODUCT.md)，本次页面方向来自 [流程与界面方案](../../studio-video-workflow-redesign.md)；[批准的组成参考](video-workflow-20261106.png) 是示意图，不能作为真实任务或成片证据。

最终独立复核的两项修正范围结论为 **ship**：已完成原生视频封面与历史抽屉键盘操作已解决。此前完整复核已接受三列组成、真实状态进度、最终视频交付与手机重排。本文件记录该复核交接结论及下列实际检查，不把两项修正复核扩写成新的全量验收。

## 继承与复用

| 项目 | 当前实现与继承关系 |
|---|---|
| 表面与颜色 | 新区块读取既有 `--ip-bg`、`--ip-paper`、`--ip-soft`、`--ip-ink`、`--ip-line`、`--ip-muted`；不在 `:root` 新建品牌色。实际场景页颜色受 `studio-scenes.css` 的既有局部覆盖控制，见下方差异记录。 |
| 正文与标题 | 复用 `--ip-ui`（Manrope / Noto Sans SC / 系统无衬线）。任务区正文 14px、辅助说明主要 12–13px，历史时间和状态 11px；作品与设置标题 17px，制作状态标题桌面 23px、手机 21px。操作页采用既有场景页的无衬线习惯，不新增展示字体。 |
| 工作面与控件 | 复用 `scene-card`、原配置表单、场景选择、素材选择与视频设置；视频区工作面局部为 13px 圆角，主要按钮与预览为 8px 圆角。深墨主操作、白面细边线次操作，hover 改底色，常规工作面无常驻投影。 |
| 状态与焦点 | 完成以绿色和“已完成”并用，错误以小范围红色和原因并用；当前步骤、未来步骤另有文字。沿用 2px 深墨焦点线、3px 外偏移，不依赖颜色单独表达状态。 |
| 媒体 | 复用 `SignedImage`、`SignedVideo`、`SignedAudio` 与下载能力，按存储 key 读取/换签。成片和输入预览保留完整比例；历史缩略图可裁切。视频播放器使用原生 controls、playsInline、metadata 预载，无自动播放配置。 |
| 历史抽屉 | 复用现有 `dialogFocus`，打开时移入焦点，Tab / Shift+Tab 限制在抽屉，Escape 关闭，清理时返回原触发器。模态状态有 dialog / aria-modal，任务选中有 aria-current。 |
| 画布 | `CanvasVideoTask` 在既有画布提供同一任务的状态、定位问题、返回视频页与明确的“继续制作”。返回条不是另一套画布主题；停靠助手出现时按已有面板宽度避让。 |

来源代码：

- [视频页](../../../apps/web-aiavatar/src/ip/scenes/scene-video-studio.tsx)
- [任务工作区与历史](../../../apps/web-aiavatar/src/ip/scenes/scene-video-workspace.tsx)
- [任务工作区样式](../../../apps/web-aiavatar/src/styles/studio-video-workspace.css)
- [既有场景页样式](../../../apps/web-aiavatar/src/styles/studio-scenes.css)
- [既有品牌令牌](../../../apps/web-aiavatar/src/styles/ip-brand.css)
- [共用焦点处理](../../../apps/web-aiavatar/src/ip/dialog-focus.ts)
- [画布任务上下文](../../../apps/web-aiavatar/src/ip/canvas-video-task.tsx)与[挂载位置](../../../apps/web-aiavatar/src/ip/studio-flow-canvas.tsx)

## 组成与状态行为

桌面保持导航、左配置或本次设置、中间作品、右侧最近任务。任务工作区桌面列为 `minmax(320px,380px) minmax(360px,1fr) 176px`，列间隔 12px；展开全部场景时增加局部场景列。桌面 1250px 以下收起常驻历史，右上“任务”打开 230px 侧抽屉；这属于容纳内容的宽度约束。

手机通过 `html[data-layout]` 切换“制作 / 作品”面板，历史仍从作品标题旁打开，保留既有底部导航与滚动空间。960px 只是未主动选择设备形态时的默认值；本次未引入以媒体查询替代用户选择的设备判定。

制作步骤由原生执行记录中的操作和状态分组，不存在的阶段不补齐。已完成产物显示真实预览与完成数量；无产物时显示等待占位，不编造百分比或剩余时间。等待明暗动效在减少动态偏好下关闭。完成后同一工作面显示完整视频、实际消耗、下载与“改一版”，制作记录可以展开。历史任务显示本次输入快照，“改一版”另建草稿。

成片封面通过已完成 run 的 video candidate 找到原生 video job，再读 `thumbnail_url`；加载失败会刷新该地址，最终回落到本次输入图或明确媒体图标。截图中仍可见图标回退，不能据此宣称所有历史任务都有封面，也不能以视频源 URL 冒充图片预览。

## 实际证据

本次文档阶段直接查看了以下本地截图及 JSON，未打开浏览器，也未重新运行测试：

| 证据 | 可支持的观察 |
|---|---|
| [桌面成片](../../releases/evidence/studio-video-task-local-20261106/desktop-result.png)（1319×801） | 配置快照、居中竖屏成片、下载/改一版、动态阶段数量和常驻历史共存；历史有原生测试视频封面，也有图标回退。 |
| [窄窗历史](../../releases/evidence/studio-video-task-local-20261106/narrow-history.png)（1080×800） | 历史改为右侧遮罩抽屉，可见任务焦点线；底下原视频与设置保留。 |
| [手机作品](../../releases/evidence/studio-video-task-local-20261106/mobile-result.png)（390×844） | 制作/作品切换、完整竖屏播放器、下载/改一版与既有底部导航；任务触发器有可见焦点。 |
| [手机设置](../../releases/evidence/studio-video-task-local-20261106/mobile-settings.png)（390×844） | “本次设置”、参考视频、要求和规格可读；改一版入口明确说明保留原任务。 |
| [手机历史](../../releases/evidence/studio-video-task-local-20261106/mobile-history.png)（390×844） | 遮罩抽屉、选中任务、完成/需处理文字、草稿分区和可见焦点。 |
| [键盘验收记录](../../releases/evidence/studio-video-task-local-20261106/keyboard-acceptance.json) | 窄窗 1080×800 和手机 390×844 的记录中，全部 `focusInside` 为 true；两者 `restored` 均为“打开最近任务”。结合 `dialogFocus` 与 Escape 处理支持抽屉焦点修正结论；JSON 本身不等于全部辅助技术验收。 |

所有可见视频均标明 **LOCAL TEST**。素材来自本地确定性测试链路，截图能够证明布局、状态和交付入口，不能证明真实供应商的生成质量。

主任务最终回传：后端相关测试 91 项、前端 216 个文件 / 1,742 项测试全部通过，编译与 API 契约检查通过；详情见[本地验收记录](../../releases/studio-video-task-local-validation-20261106.md)。本设计文档阶段未重跑测试。未部署，未验证生产服务，不恢复此前暂停的发布。

## 已有差异与未扩大的结论

现行 DESIGN.md / sidecar 记录暖灰底 `#f0efec`、深墨 `#192229`、细线 `#e8eaec` 及标题中文衬线；但既有 `studio-scenes.css` 在新版场景页和导航作用域已覆盖为白底 `#ffffff`、深墨 `#17202a`、细线 `#eceef1`、浅灰 `#f3f4f6`，操作标题也主要使用无衬线。最终截图体现这一场景页现状。此差异早于本次任务扩展，记录为既有文档与作用域实现的差异，不改写规范来追认，也不擅自恢复颜色或字体。

批准示意图的暖灰外底、演示人物与商品、今天/更早分组和完整五步过程，不是此次每个状态必须照搬的真实数据。实际完成截图为本次设置、当前真实阶段和本地测试视频；三列与操作顺序得到复核接受，不将示意内容或五步数量写成通用系统规则。

本地验收记录已由主任务同步两项修正的最终 ship 结论。本文不把既有差异或演示媒体转化为新设计规则。
