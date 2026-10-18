# 数字人形象「精调 / 美颜」技术方案调研

> 调研日期：2026-06-07 ·针对 web-aiavatar（数字人资产平台，移动端 H5）「几何微调」功能
> 背景：当前精调滑杆（脸型/眼睛/鼻梁/嘴型/下巴）走「参数→英文指令→Agnes i2i 重绘」，
> 调整不确定、不可预览、可能漂移身份。本文调研「真正生效」的 web 照片美颜方案并给出落地建议。

---

## 0. TL;DR

| 结论 | 一句话 |
|---|---|
| **推荐主线** | **浏览器端确定性美颜**：MediaPipe Face Landmarker（478 关键点，Apache-2.0 免费商用）+ Canvas/WebGL 位移场变形 + 磨皮美白 shader + LUT 滤镜。**实时预览、零成本、像素级保身份**，与现有滑杆 UI 一一对应 |
| 快速替代 | Face++ 人像美化 API（美颜+美型+滤镜，0.1 元/次，在售）——1~2 天可接通，但无实时预览、维度不全 |
| 已排除 | 阿里云 viapi 人脸美型/美妆 **已下架**（2025-08~10 月）；腾讯/火山 Web 美颜 SDK 是直播视频流场景 + 商务 license，不适合单张照片 |
| Agnes i2i | **保留但改定位**：只做「AI 一键精修/风格化」等语义级编辑，不再承担精确几何滑杆 |

---

## 1. 现状与问题

当前链路（v0.51，`DapJobRunner.runWarp`）：

```
前端 5 滑杆（-50..50）→ POST /api/v1/avatars/{id}/warp
→ server 把参数拼成英文指令（"slightly decrease face shape by 20%…"）
→ Agnes i2i（agnes-image-2.1-flash，identityInput=当前形象图）整图重绘
→ 新图落 OSS → 新版本
```

问题本质：**用生成式模型做确定性几何编辑**。

1. **不生效/过度生效不可控**——扩散模型对「眼睛 +10%」这类细粒度数值指令几乎不敏感，要么没变化要么整脸重画；
2. **身份漂移**——i2i 重绘改变微观纹理与五官细节，「保持同一人」约束经常失败，与数字人资产「身份一致性」的核心诉求冲突；
3. **无预览**——每次调整都是一次异步任务（数秒~数十秒），用户无法拖动滑杆即时看效果；
4. **不可复算**——同参数两次结果不同，版本回溯失去意义。

而「美颜」在工业界（美图/抖音/各直播 SDK）是一套**确定性图像处理**：人脸关键点 → 局部网格变形（瘦脸/大眼）+ 皮肤滤波（磨皮/美白）+ 调色（滤镜）。这类算法不需要 AI 生成，在浏览器里就能实时跑。

## 2. 需求拆解：四类诉求对应不同技术

| 用户诉求 | 技术本质 | 合适的实现 |
|---|---|---|
| 滑杆精调（脸型/眼睛/鼻梁/嘴型/下巴） | 确定性局部几何变形（液化） | 关键点 + 网格/位移场 warp |
| 一键美颜（磨皮/美白/牙齿亮白） | 皮肤区域滤波 + 调色 | 皮肤 mask + shader |
| 滤镜 | 全图调色 | 3D LUT |
| 「帮我变好看/换妆容/换风格」 | 语义级编辑 | 生成式 i2i（Agnes，保留） |

> 关键认知：前三类**不该**用大模型做；第四类**只能**用大模型做。现在的问题是用第四类技术做了第一类需求。

## 3. 方案盘点

### 方案 A（推荐）：浏览器端确定性美颜

**组成**：

1. **人脸关键点**：[`@mediapipe/tasks-vision` FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
   - 478 个 3D 关键点（468 面部 + 10 虹膜），WASM/WebGL 推理，npm 直接装，Apache-2.0 可商用；
   - 静态图单次推理几十~几百 ms（中端手机），**每张图只需检测一次**，之后拖滑杆零开销。
2. **几何变形（5 个滑杆）**：WebGL fragment shader 反向位移场（业界美颜 SDK 通用做法），
   每个特征 = 若干控制点 + 高斯衰减半径的局部位移/缩放：
   - 脸型：下颌轮廓点沿法线向内/外位移（瘦脸/宽脸）
   - 眼睛：以左右眼中心做径向缩放（大眼/小眼）
   - 鼻梁：鼻翼两侧水平收紧/放宽 + 鼻梁提升
   - 嘴型：以嘴部中心缩放
   - 下巴：颏点垂直位移（拉长/缩短）
   - 数学上等价于简化版 MLS（Moving Least Squares, Schaefer 2006）；纯 shader 实现 60fps 实时拖动。
3. **一键美颜**：用关键点生成皮肤 mask（脸部椭圆 − 眉眼嘴），高反差保留磨皮 + 曲线美白
   （算法可参考 Apache-2.0 的 [GPUPixel](https://github.com/pixpark/gpupixel) 美颜 shader，移植到 GLSL ES）；
   预设「轻度/标准/重度」三档 = 参数包。
4. **滤镜**：512×512 3D LUT 贴图，一个 shader 通吃所有滤镜，新增滤镜 = 新增一张 LUT png。
5. **落库**：用户点「应用精调」→ 离屏 canvas 全分辨率渲染 → `toBlob` → 走现有上传通道
   （`FileStorageService` → OSS key → `avatarService.addVersion(..., "refine", key)`），
   版本链 / 扣费点完全复用，server 仅新增一个「接收成品图」的轻量入口（或复用现有上传）。

**优点**：拖动即所见（实时预览）、像素级保身份、结果可复算、零边际成本、断网也能预览、
与现有滑杆 UI 完全吻合。
**代价**：需要自研 ~1k 行前端图形代码（关键点接入 1 天 + warp shader 3~5 天 + 磨皮/LUT 3~5 天 + 联调）；
web-aiavatar 当前零图形依赖，需引入 `@mediapipe/tasks-vision`（约 5MB wasm+模型，首次加载需 loading 态 + CDN 缓存）。

**工程要点（踩坑预告）**：

- **canvas 跨域污染**：形象图来自 OSS/CDN 签名 URL，`<img>` 画进 canvas 后要导出必须
  ① OSS/CDN 配 CORS（`Access-Control-Allow-Origin`）+ `<img crossorigin="anonymous">`，
  或 ② 经 server 同源代理取图（dev 环境 `/cdn` rewrite 本来就是同源）。**这是 P0 必须先打通的一项**。
- 预览可用降采样纹理（≤1080p），「应用」时再用原图全分辨率重渲，保证手机流畅；
- 多人脸图取最大人脸；检测失败（侧脸/遮挡）降级为只开放滤镜/美白，滑杆置灰并提示；
- WASM 资源自托管到自家 OSS/CDN（合规 + 国内加载速度），不要走 jsDelivr。

### 方案 B：服务端自托管 beauty-service（方案 A 的后端镜像）

Python 微服务（与 sau-service 同部署模式）：MediaPipe Python（Apache-2.0）取关键点 +
OpenCV（Apache-2.0）`remap` 做同一套位移场变形 + `bilateralFilter` 磨皮。
单张 CPU 处理 100~300ms，无需 GPU。接入方式 = 在 `DapJobRunner.runWarp` 里把
「调 Agnes」换成「调 beauty-service」，前端零改动。

- 优点：前端零工作量、算法真值在服务端（可复算、可批处理）、Java 侧只是换一个 HTTP 调用；
- 缺点：**无实时预览**（仍是异步任务体验，治标不治本）、多一个常驻服务要运维。
- 定位建议：不作为首选；若走方案 A，后续有「服务端复算/批量出图」需求时再补，
  且应与前端共享同一份位移场参数定义，保证两端结果一致。

> 也可用 GFPGAN（Apache-2.0，可商用）做「AI 画质增强/老照片修复」类增值能力；
> 注意 **CodeFormer 是 S-Lab 非商用许可，不可用于本产品**。

### 方案 C：云 API / 商用 SDK

| 服务 | 现状（2026-06 核实） | 价格 | 评估 |
|---|---|---|---|
| **Face++ 人像美化 API**（美颜+美型+滤镜） | ✅ 在售（旷视官网价目表 2023-06 版仍生效） | 按量 **0.1 元/次**（QPS 3）；次数包 25 万次起 0.08 元/次；另有纯美颜 API 0.01 元/次（仅美白磨皮） | 1~2 天接通；美型维度为大眼/瘦脸/小脸，**鼻梁、嘴型缺位**，与现有 5 滑杆不完全对应；无实时预览；用户照片出境到第三方需合规评估 |
| 阿里云 viapi 人脸美型 FaceTidyup | ❌ **2025-08-14 停新开、2025-10-14 已下架** | — | 不可选。人脸美妆 FaceMakeup 也已于 2025-08-12 下架；五官分割 ParseFace 2026-04-20 下架。viapi 人脸处理类目整体在收缩，**不建议再押注** |
| 阿里云 viapi 人脸美颜 FaceBeauty / 智能美肤 RetouchSkin | ⚠️ 文档仍在、未见下架公告 | 按次计费 | 即便可用也只覆盖磨皮美白（无美型）；平台收缩趋势下风险高 |
| 腾讯云 Web 美颜特效 SDK（tencentcloud-webar） | ✅ 在售 | 正式 License 商务议价（试用 28 天免费），按域名授权 | 为**摄像头视频流**直播美颜设计；用在单张照片编辑属于错配，license 成本不透明 |
| 火山引擎智能美化特效 / 相芯 FaceUnity 等 | ✅ 在售 | SDK 离线授权，商务议价（业内普遍数万/年起） | 能力最全（媲美抖音），但采购重、集成重，适合未来做「视频实时美颜」时再评估 |

### 方案 D：Agnes i2i（现状）——改定位，不下线

保留为「**AI 一键精修**」入口：画质增强、妆容、发型、风格化等语义编辑（这正是 i2i 擅长的），
prompt 走现有 `dap.image_warp` 模板体系可后台调。**把它从精确滑杆链路上摘下来**。

## 4. 方案对比

| 维度 | A 浏览器端 | B 服务端自托管 | C Face++ API | D Agnes i2i（现状） |
|---|---|---|---|---|
| 调整确定生效 | ✅ 确定性 | ✅ 确定性 | ✅ 确定性 | ❌ 不可控 |
| 实时预览 | ✅ 60fps | ❌ 异步任务 | ❌ 异步任务 | ❌ 异步任务 |
| 身份一致 | ✅ 像素级 | ✅ 像素级 | ✅ | ❌ 易漂移 |
| 5 滑杆覆盖 | ✅ 全部可做 | ✅ 全部可做 | ⚠️ 缺鼻梁/嘴型 | 名义全覆盖 |
| 边际成本 | 0 | 服务器成本 | 0.1 元/次 | Agnes 免费但慢 |
| 工期 | ~2 周 | ~1 周 | 1~2 天 | 已有 |
| 许可/合规 | Apache-2.0；照片不出端（最优） | Apache-2.0；照片留在自有服务器 | 照片送第三方，需合规评估 | 照片送 Agnes（现状已如此） |
| 维护风险 | 自有代码 | 自有服务 | 依赖旷视存续 | 依赖 Agnes |

## 5. 推荐落地路径

> **状态更新（2026-06-07）**：P0 已按本方案落地（AGENTS.md v0.52）：`apps/web-aiavatar/src/proto/beauty/*`
> + server `/v1/avatars/{id}/image`、`/v1/avatars/{id}/refine-apply`。取图走同源端点（CDN 免配 CORS）。

**P0（~2 周）：前端确定性美颜上线**

1. 打通 OSS/CDN CORS（或同源代理），验证 canvas 可导出——半天，**先做**；
2. 引入 FaceLandmarker，形象详情/精调页加载图后做一次关键点检测；
3. WebGL 位移场 warp 实现 5 滑杆 + 实时预览 + 长按对比原图；
4. 「应用精调」= 全分辨率渲染 → 上传 → `addVersion("refine")`，沿用现有版本/扣费体系
   （建议前端直出成品后，server 端 `warp` 任务保留入参记录以便审计与复算）；
5. 一键美颜（三档预设）+ 6~10 个 LUT 滤镜（低成本高感知，建议同期带上）。

**P1（择机）**：服务端 beauty-service 复算端（共享参数定义），支撑批量出图/标准图集统一美化；
或在 P0 之前先用 Face++ API 顶 1~2 周作为过渡（如果 P0 排期紧张）。

**P2**：把 Agnes 入口改名「AI 精修」，与滑杆精调并列为两个功能；未来做视频数字人实时美颜时再评估商用 SDK。

## 6. 风险与注意

- **人脸数据合规**：方案 A 全程在用户设备处理，是合规最优解；若选 C，需在隐私政策中披露第三方处理并评估《个人信息保护法》敏感个人信息（人脸）出境/委托处理条款。
- **真人复刻形象的授权边界**：精调会改变真人五官，建议在授权协议（DapLicense）中明示「允许的修饰范围」。
- **MediaPipe 模型加载**：首次 ~5MB，需 loading 骨架 + 自托管 CDN；低端机检测可能 >500ms，属可接受（一次性）。
- **变形幅度护栏**：位移场幅度按人脸尺寸归一化并设上限（如 ±8% 瞳距），避免用户拉满产生鬼畜结果损害「资产」严肃感。
- **文档纪律**：落地时按 AGENTS.md §5/§9 同步 openapi（若新增成品图上传端点）与 README 版本日志。

## 7. 主要参考

- MediaPipe Face Landmarker (Web)：https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MLS 变形论文实现参考：https://github.com/PooneetThaper/ImageDeformation ；WebGL 液化示例：https://webgl2fundamentals.org/webgl/lessons/webgl-qna-creating-a-smudge-liquify-effect.html ；WebGL 滤镜库 glfx.js：https://evanw.github.io/glfx.js/docs/
- GPUPixel（Apache-2.0 美颜滤镜引擎，shader 可移植；无 Web 构建目标）：https://github.com/pixpark/gpupixel
- Face++ 人像美化 API 价目：https://www.faceplusplus.com.cn/document/guide_docs/api_pricing ；产品页：https://www.faceplusplus.com.cn/face-beautify-shape/
- 阿里云 viapi 下架公告（FaceTidyup 含在 2025-08 公测停服批次）：https://help.aliyun.com/zh/viapi/product-overview/announcement-on-the-discontinuation-of-certain-public-testing-services-on-the-visual-intelligence-open-platform ；付费能力停服公告（2026-04-20 批次）：https://help.aliyun.com/zh/viapi/product-overview/announcement-on-the-stop-of-partial-payment-ability-of-visual-intelligence-open-platforms
- 腾讯云 Web 美颜特效 License：https://cloud.tencent.com/document/product/616/71368
- GFPGAN（Apache-2.0）：https://github.com/TencentARC/GFPGAN
