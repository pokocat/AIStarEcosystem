# 占位人脸样本（mock 模式）

`real-female.jpeg` / `real-male.jpeg` 是当前 mock seed 默认使用的真实人像样本。
`face-1.svg` ～ `face-4.svg` 是**可被 MediaPipe FaceLandmarker 检测**的正面占位人脸
（五官齐全、对比清晰），作为真实样本之外的补位素材。mock 模式（`NEXT_PUBLIC_USE_MOCK=1`）
下这些图片会用作 AiAvatar 封面 / 打样 / 标准出图，让「人像精调工作台」的真实关键点检测能直接命中。

由 `scripts/gen-sample-faces.mjs` 生成；改样式后重新运行即可：

```bash
node apps/web-aiavatar/scripts/gen-sample-faces.mjs
```

## 用你自己的照片看全流程效果

两种方式（任选其一）：

1. **UI 上传（推荐，最贴近真实流程）**：
   新建AiAvatar → 选「真人授权复刻」→ 在「素材」Tab 上传你的照片。
   mock 会读取**真实图片字节**，封面 / 打样 / 出图 / 精调全程用你这张真实照片，
   精调工作台的 MediaPipe 会在你的真实人脸上检测眼睛 / 脸轮廓 / 鼻 / 嘴关键点。

2. **替换默认脸**：把你的图片转存为 `real-female.jpeg` / `real-male.jpeg`（保持文件名），
   或直接改 `seed.ts` 的 `SAMPLE_FACES` 指向你的 `.jpg`，刷新即生效。

> 真实检测需要 MediaPipe 的 WASM + 模型（默认走官方 CDN，离线/内网见根 `.env.example`
> 的 `NEXT_PUBLIC_MEDIAPIPE_*`）。检测不可用时自动回退「居中估计」锚点，精调仍可用。
