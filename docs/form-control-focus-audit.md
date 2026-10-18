# 表单控件聚焦样式检查（2026-10-17）

当前：代码 `81778bef` 已生产发布；以下保留本地检查时的事实。生产交互复验受本机网络限制，详见[发布记录](studio-workspace-production-release-20261017.md)。

## 范围与结论

检查五个 Web 子应用、admin、共享 UI 包、小程序和 design 应用的原生字段、组件库控件与焦点样式。静态检索覆盖 input、select、textarea、picker、contenteditable，以及 focus-visible / focus-within、内联 outline、box-shadow 和焦点事件；不将 figma 导出或 prototypes 当作运行应用。

确认的同类问题集中在 web-aiavatar：ip-brand-surface、ip-surface、账号工具及企业工作页的通用焦点规则，会覆盖组合字段内部输入框的 outline。资产库的真实浏览器复现中，Ant Input 外层已有圆角阴影焦点环，内层又出现直角 2px outline。原生 select 的外置轮廓与边框分离；画布数字/单位字段也会只框住内部输入节点。

music、drama、celebrity、star、admin 与共享 UI 的源码检查未发现同类的高优先级轮廓覆盖。admin 的兜底规则位于 base layer，组件在 utilities 使用自己的焦点环；celebrity 的 mo-input / mo-well 由外层 focus-within 显示，内部 inline outline:none；star 使用同一控件自身的 shadow。小程序的 WXSS 没有对应的浏览器 outline 规则。此结论是针对本次重复轮廓问题的源码审查，不代表其他应用所有字段都已逐页运行验收，也不等同于完整无障碍审计。

## 修复

- 新增 `apps/web-aiavatar/src/styles/control-focus.css`，在应用布局最后加载，统一几套外壳下的焦点归属。
- 原生文本、密码、数字、日期、select、textarea 和 contenteditable 的兜底 outline 贴合字段内沿。checkbox、radio、range、file、color 不套用文本字段的内沿规则。
- Ant Input/Password/Search/TextArea、Select/AutoComplete、InputNumber、日期时间选择器和单复选框内部节点，不再额外套用外壳 outline；保留组件本身的阴影、边框、错误及禁用状态。Ant Switch 自带 outline 保留。
- Radix 原语保留自己的焦点 ring；不修改共享或 vendored 原语。
- 剧本聊天、桌面嵌入文本编辑和画布尺寸/数量/时长字段由完整圆角容器显示焦点；内层不再画第二个框。手机文本编辑保留 Ant TextArea 自身焦点阴影，不再给外层同时画框。画布适配写在宿主 CSS，不改 vendor 文件。
- 助手独立文本域原有轮廓改为内沿，避免与字段边框分离。此前 StudioPageSearch 的整框焦点修复保留，项目、IP、模板与发行搜索继续共用。

## 验证

### 真实页面

使用本地 Next :3013 与已有开发账号，验证 `/projects` 的搜索及原生状态 select、`/assets?tab=objects` 的组合搜索、可搜索 Select、创建弹窗的文本域。通过 Tab 到达下拉框，以方向键展开、Escape 收起；弹窗取消退出，没有保存测试资产或调用生成。

修复后，资产搜索内部 outline 为 none，外层保留 2px 圆角焦点阴影；Select 内部输入 outline 为 none，外层阴影仍在；独立 TextArea 保留自身阴影。原生 select 为 2px 实线、8px 圆角、outline-offset -2px。390px 手机视口搜索正常，无页面横向溢出，验收后恢复临时视口。

实际页面截图：`.studio-e2e/focus-audit/assets-desktop.png`。

### 组件与级联回归

隔离测试页使用真实 React、Ant Design、画布 Radix Select 和 Next 输出的应用 CSS；这不是生产路由。品牌、画布、账号、企业、设定编辑五种实际作用域，每种验证原生输入/select/textarea、组合搜索、密码、数字、可搜索下拉、联想输入、日期、Ant TextArea、错误输入、checkbox、radio、Switch，共 70 项；另验证画布 Radix Select、带单位数字输入、剧本聊天和嵌入文本编辑，共 74 项。

结果：没有内部多余轮廓；原生字段仍有焦点提示；Ant 文本/日期/数字/下拉控件保留自身或父级焦点阴影；Switch 和 Radio 保留自身可见 outline；Radix 保留 3px ring；三种组合字段内部无 outline，外层为实线。额外核对五个 disabled 字段及错误输入的红色边框，状态未被覆盖。

测试页源码、打包文件与采样结果位于忽略目录 `.studio-e2e/focus-audit/`（`fixture.jsx`、`index.html`、`loaded.css`、`results.json`、`radio-results.json`）。Radio 用 Space 验证，避免方向键切换到其他 radio 导致焦点采样错误。

另外按 mobile 形态验证上述三种组合字段：数字和剧本聊天由外层显示焦点，嵌入文本编辑只保留自身阴影，外层 outline 为 none。结果见 `mobile-composed.json`。CSS 回归使用实际编译后的固定 `loaded.css`，避免 Next HMR 尚未重新生成静态样式时误验旧规则。

### 工具检查

- `pnpm typecheck:all`、`pnpm typecheck:admin` 通过。
- `pnpm check:api-contract` 通过；仍有既有 24 项 handler 与 271 项 orphan 提示，本次没有 API 改动。
- `git diff --check` 通过。纯 CSS/布局导入变更，没有运行后端测试或收费生成。
- 新增 `control-focus.css` 的设计检测结果为 0 项。
- 设计 hook 对布局指出既有 Outfit 字体引用与 DESIGN.md 不一致；该引用来自本次之前，保留未动，没有压制检查，也没有刷新设计侧文件。

未提交、未部署。其他应用仅做源码审查；生产环境和小程序真机未在本轮验收。

## 原生 select 弹层补修（2026-10-17）

后续截图指出的是系统原生 select 菜单与页面风格割裂；前一轮的焦点轮廓检查没有解决这部分。新增 `StudioSelect`，复用已有 Radix Select 原语，使用页面内 DOM 菜单：字段下方展开、白底细边线、选项浅灰高亮、右侧勾、长标签省略、视口碰撞处理和滚动。Portal 留在 Studio 内容令牌作用域，键盘选择、Escape 返回焦点、禁用项、空字符串“全部标签”由组件处理；不手写键盘交互。

替换项目页状态/排序、IP 状态/标签/排序/素材类别、发行账号平台/状态共八处。已有 Ant Select 保留；画布正文编辑器和故事板等其他语境的原生控件不在此次替换范围，未宣称全仓所有原生 select 均被替换。

验证：`studio-select.test.tsx`、`studio-create-home.test.tsx`、`ip-management.test.tsx`、`studio-distribution.test.tsx` 共 21 项通过，AiAvatar typecheck 与 diff 空白检查通过。新增测试使用真实 Radix 组件，覆盖 DOM listbox、空值、禁用项、Esc 和焦点恢复；原项目列表测试用实际选择菜单项验证筛选与分页。测试仍有现存 act 和 vitest 配置弃用提示。首次 pnpm test 透传参数未生效而误跑全套，已中断；其中无关的 material-library 出现 5 秒超时，不将该次执行计为全套通过。

浏览器实测项目页点击“草稿”后字段与筛选状态同步，排序通过 ArrowDown/Enter 从“最近编辑”切换为“最近创建”，Escape 返回字段；375 CSS 像素下菜单左右边界为 16–120.67px、页面无横向溢出，临时视口已恢复。桌面/手机展开截图为 `.studio-e2e/focus-audit/select-desktop.png`、`select-mobile.png`。本轮没有保存业务数据、删除画布、执行生成或部署。

设计扫描的 13px 字号与菜单 4px 内圆角是此次沿用/明确的工作页组件规格，已同步 DESIGN.md；未刷新已陈旧的设计 sidecar，未压制扫描。布局中既有 Outfit 提示仍保留。

## 全仓补查与页面内下拉统一（2026-10-17，发布记录另列）

本轮按用户要求重新枚举运行源码，覆盖全部 Web 应用、admin、design、小程序与 packages；不把 figma/prototypes 当作运行应用。原生控件声明共 input 255、textarea 57、select 40，包含通用组件，数量不等于独立页面数。另核对 Ant、共享 UI、两个画布富文本、TipTap 剧本/角色输入和短剧段级及行内编辑器。

| 应用 | 原生 input | textarea | 原生 select |
|---|---:|---:|---:|
| apps/web-celebrity | 80 | 18 | 1 |
| apps/design | 1 | 0 | 0 |
| apps/web-drama | 77 | 22 | 26 |
| apps/admin | 6 | 4 | 3 |
| apps/web-star | 14 | 5 | 4 |
| apps/miniprogram | 7 | 0 | 0 |
| apps/web-music | 19 | 1 | 3 |
| apps/web-aiavatar | 38 | 6 | 3 |
| packages/ui | 1 | 1 | 0 |
| packages/landing | 12 | 0 | 0 |
| packages/api-client | 0 | 0 | 0 |

### 本轮修复

- 六个 Web 应用的 40 处原生 select 声明（27 个文件）统一使用共享 SelectField；既有 Ant / Radix Select 不重写。沿用 Radix 的页面内菜单、键盘选择、禁用、Esc 关闭与焦点恢复，菜单有真实选项、勾选、长标签省略和视口边界处理。保留各产品原来的字段样式；菜单从触发器读取实际主题令牌，音乐深色不会变白色菜单。
- 兼容原回调的真实 HTMLSelectElement change 事件与 wire value；空字符串选项可选，隐藏兼容字段用于表单取值/重置及 ref，不能被 Tab 或读屏重复访问。程序 focus 转给可见字段；外部 form 关联保留。组件限定为单值选择。
- CanvasConfigComposer 同样存在“组词时暂停 value 同步，却继续画占位提示”的问题：组词期间立即隐藏提示，提交/取消后恢复，并阻止候选词 Enter/方向键被引用菜单接管。编辑区由 12px 圆角父层显示焦点，不重复框内部。
- 短剧 Editable 原本把组词确认的 Enter 当作失焦提交；加入 composition / isComposing / 229 识别。普通 Enter 与原失焦提交仍保留。
- 短剧通用 TextInput / TextArea 原本 inline outline:none 且无替代提示，补内沿焦点；其他组件继续按自己的边框/阴影显示。
- 浏览器确认富文本格式菜单在选择后会把焦点还给下拉触发器，覆盖 TipTap 的编辑焦点；现在返回原文档光标，保持当前阅读位置。故事板与付款设置继续使用正常字段焦点恢复。

### 验证与范围

- 六套应用的生产 CSS 配合真实 React / Ant / Radix / TipTap 组件做隔离浏览器回归：组合输入内部无多余 outline，外层焦点阴影保留，禁用与错误状态保留。菜单支持空值、长标签、主题跟随；390px 下六套菜单均在 x=20..356 内，页面无横向溢出。
- Ant Modal 中打开菜单、选择、Esc 仅关闭菜单、焦点返回字段，通过；富文本选择章节标题后 activeElement 是“剧本文档”，真实 h2 已写入。中文 composition 模拟下编辑区是 ca、占位已隐藏，内部 outline none、12px 外层轮廓可见，确认汉字后持久值更新。
- 新控件覆盖真实 change 事件、空值、disabled、外部更新、表单 FormData/reset、外部 form 与 ref.focus；业务测试覆盖模型/价格/引用、付款偏好、故事板草稿失败恢复以及富文本结构/光标。测试总数和发布结果见对应发布记录。
- 浏览器页为隔离回归页，静态 CSS 从六个线上入口获取，再加载本轮变更；不是逐个业务页面的全量点击验收。首次并行检查因本机内存竞争产生超时，改为单 worker 并复验；保留真实断言，未以超时结果计通过。
- 小程序与 design 仅源码复查，无同类浏览器焦点/富文本组词叠层实现；未宣称微信真机回归。原生搜狗输入法未做系统级注入；composition 由真实组件事件回归与浏览器模拟覆盖。没有提交收费生成或写生产业务数据。
- 设计检测两项 advisory：vendor 配置栏既有 11px 说明、故事板既有 15px 标题（从 select 样式迁给新字段）；沿用原设计，不改字阶、不压制规则。

证据：`.studio-e2e/form-controls-v2/` 的六套桌面/手机截图、`results.json`、`css-sources.json` 与富文本焦点截图。临时页和 bundle 不进入生产包。
