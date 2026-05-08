# agent.md — 在本工程内做微信小程序时的"必读心智"

> 任何在 `apps/miniprogram/` 下工作的 agent，**先读完本文再动手**。
> 本文不是教程，是踩坑提醒，专门用来对抗微信小程序平台本身的不稳定。

---

## 一、微信小程序平台思维

微信小程序平台以 Bug 多、官方维护不足而"闻名"。在调试时，应始终把"平台本身存在问题"作为一个重要假设，而不是最后才考虑的可能性。

### 默认的调试思路

1. 在假设是我们代码出错之前，先问：这种行为是否符合已知的微信平台 Bug 或限制？
2. 优先搜索已有问题：社区论坛（v2ex、掘金、segmentfault）、Taro 的 GitHub issues，以及微信开放社区（developers.weixin.qq.com）—— 很多官方 Bug 报告多年都没有解决。
3. 如果行为无法解释、只在特定环境出现（例如 iOS vs Android、开发者工具 vs 真机），或者难以稳定复现——应高度怀疑是平台 Bug。

### 微信平台已知的不可靠类别

- **iOS 与 Android 差异**：CSS 渲染、JS 引擎行为、API 返回值在两端经常不同，必须同时测试。
- **开发者工具 vs 真机**：开发者工具基于 Chromium，而真机使用定制 JS 引擎（Android 为 V8，iOS 为 JavaScriptCore）。很多问题只会在真机上出现。
- **API 不一致**：同一个 API 在不同基础库版本下，返回结构或错误码可能不同。不要盲信文档——一定要以实际行为为准。
- **基础库版本碎片化**：用户可能使用不同版本的基础库。在某个版本修复的问题，可能在另一个版本出现新的问题。
- **分包 / 异步加载问题**：分包加载、预加载、独立分包存在已知的竞态条件和生命周期 Bug。
- **Canvas / WebGL**：非常脆弱，在不同设备和系统版本之间存在渲染差异。
- **存储与文件系统 API**：配额限制、错误码和异步行为不一致。

### 以变通方案为先的文化

一旦确认或怀疑是平台 Bug，目标应是找到可行的变通方案，而不是等待官方修复（大概率不会发生）。同时，应在代码注释以及 `.claude/skills/` 中记录该变通方案及推测的根本原因。

---

## 二、本工程已知/预判的微信坑（结合本次设计）

下面这些都是写本工程时**已经踩过 / 必须绕开**的，按页面/能力分类。

### 自定义 tabBar（custom-tab-bar/）

- `app.json` 设了 `tabBar.custom = true` 之后，**每个 tab 页**进入时必须主动调用 `this.getTabBar().setData({ selected: index })`，不然选中态错位（基础库 2.x ~ 3.x 都没修）。
- `getTabBar()` 在某些基础库版本可能返回 `undefined`（页面尚未挂载完成），必须做 `if (this.getTabBar()) { ... }` 保护。
- 中央"凸起"按钮（设计稿的霓虹绿"工作台"按钮）必须用 `position: relative` + 负 margin，**不能**依赖 `transform: translateY(-Npx)`，iOS 真机上 transform 在 tabBar 里会被裁切。
- tabBar 高度受 `safe-area-inset-bottom` 影响：iPhone 全面屏底部要预留 `env(safe-area-inset-bottom)`，`padding-bottom` 而不是 `height`，否则 X 系列底部黑条吃掉点击。

### 路由

- tabBar 页面之间必须用 `wx.switchTab`，**不能**用 `wx.navigateTo`（会静默失败，控制台只有 warning）。
- 非 tabBar 页跳 tabBar 页：`wx.switchTab`；tabBar 页之间携带参数无法走 query string，要塞 `globalData` 或 `wx.setStorageSync` 临时态。
- `wx.redirectTo` 不能跳到 tabBar 页（同上）。

### CSS / WXSS

- WXSS 不支持 `aspect-ratio`（截至基础库 3.5）。设计稿里大量 `aspectRatio: "9/16"` 必须改成显式 `width + height` 或 padding-bottom hack（`padding-bottom: 178%; height: 0`）。
- `-webkit-background-clip: text` 在 iOS 真机基础库 2.x 渲染异常（文字变全黑）—— 设计稿登录页"从一个激活码开始"那段渐变文字，本工程降级为纯色 + 单独一个绿色 view。
- `position: sticky` 在小程序 scroll-view 里失效，要换 `fixed` + 计算偏移。
- 不支持 CSS variables 跨组件继承到 `<wx-virtual-host>` 节点。我们把令牌挂到全局 `app.wxss` 的 `page` 选择器，每个页面再用具体值或 class，**不依赖**自定义组件 inheritStyle 透传。
- `box-shadow` 在 Android 低端机上可能丢失（GPU 合成 bug），关键阴影改用底层叠一个半透明 view 模拟。

### 网络

- `wx.request` 必须在小程序管理后台配置 `request 合法域名`，否则真机调试包白屏。**开发态**勾选 IDE → "详情 → 本地设置 → 不校验合法域名"。
- `wx.request` 没有 `fetch` 那样的 stream 支持，**轮询**任务进度只能 `setInterval` + 主动请求；要在 `onUnload` 里 `clearInterval`，不然页面切走任务还在跑、内存泄漏、有时候还会触发"前后台切换 setData 报警"。
- HTTPS 证书 SAN/链不全在 iOS 上会失败、Android 反而能过——线上接入务必两端都跑一次。

### 渲染 / 长列表

- `wx:for` 渲染 100+ 项卡片在 iOS 滑动会卡顿。设计稿的"明星市场"网格做了截断（默认 12 项），加载更多再走分页。
- `<scroll-view>` + `flex` 在 iOS Safari 内核会出现"列表反复抖动"问题，给最外层加 `will-change: transform` 可以缓解。

### setData

- 不要把 `mocks` 整个对象 setData，2KB 以上的 payload 在低端机上 setData 自身会成为渲染瓶颈。**只 setData 视图实际依赖的字段**。
- setData 路径写法 `'list[0].views': '8.2w'` 比 `setData({ list: newList })` 高效得多，但 path 不能包含 `?.`、不能跨数组类型变化（数组改对象会报错）。

### 字体 / 图标

- 小程序不支持远程 webfont，`@font-face` 仅本地文件。设计稿里的"霓虹绿等宽字体" `JetBrains Mono` 在小程序里**没有**，统一降级到系统等宽：`-apple-system-mono, "SF Mono", Menlo, Consolas, monospace`。
- 不要用 emoji 撑业务图标（"✦"、"✓"、"›"），因为 iOS 系统字体偶尔渲染成彩色 emoji，破坏黑白霓虹绿调性。本工程对 ✦ 这种用 view + 矢量字符替代，对其余按钮文字直接用 ASCII 箭头 `›`/`→`。

### 存储

- `wx.setStorageSync` 单条 1MB 上限、整个域 10MB 上限。激活码、token 走 setStorageSync OK；视频元数据走 globalData。
- `wx.getStorageSync` 在某些 iOS 版本第一次启动返回的是 string `""` 而不是 `undefined`，判空必须 `if (!cached || !cached.token)`。

### 生命周期

- `onShow` 会在 tabBar 切换时反复触发，**不要**在 `onShow` 里发起未去重的请求。
- `onLoad` 的 `options` 对象在某些基础库会缺字段（特别是从 webview 跳回来的 case），关键字段加 `??` 兜底。

---

## 三、本次生成参照的注意事项

写代码时如果命中以上场景，**优先按本文说的变通方案做**，并在代码里**用单行注释**写明"为什么这样写"（指向 agent.md 对应小节）。如果发现新的平台 Bug，**追加到本文**。

每条变通方案的注释格式建议：

```js
// 平台坑：iOS 真机 transform 会被 tabBar 裁切。改用 margin-top 负值。详见 apps/miniprogram/agent.md「自定义 tabBar」
```

不要写"// 修复 bug"这种没信息量的注释。

---

## 四、本工程边界（再次提醒）

- **后端**：复用 `apps/server`（Spring Boot, 8080），仅消费已存在的 `/celebrity/*` 等接口，**不**新建后端模块。
- **运营**：复用 `apps/admin`（Next.js, 3003），所有"审核/价格/分账/上下架"在 admin 完成，**小程序不出现 admin UI**。
- **数据形状**：以 `apps/web/src/types/celebrity-zone.ts` 为单一真源；小程序侧 `utils/api.js` 字段名与之逐字段对齐。
- 不引入 Taro/Uni/npm 构建。原生 WXML/WXSS/JS。

---

## 五、文档同步纪律（**Strict — 在 miniprogram 改东西的 agent 必读**）

> 小程序的所有"看得见的能力"必须在文档里有对应记录，否则下一个 agent 进来会重做或踩同一个坑。

**任何一项小程序变更**（加新页面 / 新 API 调用 / 新 mock 数据 / 新平台坑）都要同步：

1. **`apps/miniprogram/README.md` 版本日志** —— 加一行新版条目（如 v0.5.4 / 2026-05-09 ...）
2. **`product_spec_ai_celebrity.md` 顶部版本节** —— 在「六、版本日志」追加新版本，写清楚做了什么、消费的接口、已知限制
3. **如踩到新平台坑**（iOS/Android 差异、新 API 行为不一致、setData 大对象问题等）—— 在本文（agent.md）对应小节加一段，并在代码里加 `// 平台坑：... 详见 agent.md「分类」` 注释
4. **如新增 / 改了 API 调用** —— 字段名严格对齐 `apps/web/src/types/celebrity-zone.ts`（真源）；server 缺接口时在 `specs/openapi.yaml` 同步加 path

**总文档地图**：[`docs/INDEX.md`](../../docs/INDEX.md) | **三端总协议**：[`AGENTS.md`](../../AGENTS.md) 「文档同步纪律」段。

不更新文档就发 commit = 给后续 agent 留 drift。**不要这么做。**
