# 客户端图片上传处理

2026-11-01，本地开发，评审修正后；未发布。

## 用户行为与阈值

支持 HEIC / HEIF、JPG、PNG 及浏览器可读取的图片。选择大图后静默转换/压缩，不弹首次导入说明，也不在助手、素材库或导演台常驻显示压缩说明。只在实际失败时提示原因。

原始文件没有 50MB 等字节拒绝门槛。按接口的实际边界决定是否需要处理，不再全局强制压到 4MB / 4096：

| 入口 | 原图直传条件 | 超出时 |
|---|---|---|
| 画布、封面、DAP 图片表单 | JPG/PNG ≤15 MiB，长边 ≤8000，总像素 ≤6400 万 | 自动转换/压缩 |
| 助手附件、个人素材库/素材导入 | JPG/PNG ≤8 MiB，长边 ≤8000，总像素 ≤2400 万 | 自动转换/压缩 |
| 视频生成区 | 使用所选模型的图片字节上限；长边与像素限制可由调用方配置 | 自动转换/压缩 |

`imageUploadLimits` 使用调用方覆盖值，不再用 Math.min 把调用方锁死在全局上限。符合入口条件的 JPG/PNG 不解码、不重新压缩，字节保持不变；只在扩展名或 MIME 不符时修正封装。12MB 普通手机照片可在画布原样上传，同一张图在 8MB 素材入口会静默处理。

必须重新编码时，画布的面积预算为 1600 万像素，以避免移动浏览器创建超大画布。长边仍可超过 4096；例如合成 48MP 图输出 4618×3464。遇到画布分配/编码失败时继续尝试更小的画布。JPG 从质量 0.9 开始，必要时降至 0.8，再按比例缩小。

所有需要处理的 PNG 都实际检查透明像素：完全不透明的 PNG 照片输出 JPG，透明图保留 PNG。透明度按 64 行条带读取，避免额外分配一份全尺寸 RGBA 缓冲。

隐私元数据不在本次范围，不对合规原图额外清理；重编码本身可能不保留原元数据。

## 唯一实现与入口

共享实现为 `packages/api-client/src/image-upload.ts` 的 `prepareImageForUpload` / `prepareImageFormData`。`studio-image-file.ts` 只绑定素材入口的 8 MiB / 8000 / 2400 万策略并委托处理，未复制压缩逻辑。

接入：Studio 自由画布/节点、项目和模板封面、助手附件、素材库和个人库/选择器、导演台；AiAvatar 数字人照片及既有 DAP multipart 图片表单；明星带货视频生成区首尾帧和图片参考素材。

只有需要解码/编码的工作进入单槽队列。合规原图不等待另一张 HEIC 的 120 秒超时。相同 File 与相同入口策略复用结果，失败不阻塞下一张。

已在 OSS 的生成结果保留原有短路，不下载后重新上传。UI/存储元数据以处理后文件或服务端回包为准。

## HEIC、方向、色彩与内存

按字节识别 ftyp 主品牌及兼容品牌，排除明确 AVIF；mif1/msf1 只是容器线索，最终由解码器确认。优先原生解码，显式使用 `imageOrientation: 'from-image'`；失败后才创建独立 Worker。

Worker 使用固定 `libheif-js@1.23.5/libheif-wasm/libheif-bundle.mjs`。**WASM 是 base64 内嵌在约 2MB 的 JS bundle 中，不是独立 .wasm 下载**。Worker 和解码代码按需加载，由本站交付，无第三方 CDN；拆分 .wasm 交付另列 TODO。

libheif 只选择主图，按容器属性转向一次，不再按 EXIF 重转，不合成增益图。WASM 路径识别主图关联的 Display P3 nclx/ICC 属性，给 ImageData 标记 P3，再由浏览器转入 sRGB 输出画布。其它未识别色彩配置的准确性未全面验证。

libheif-js 的 display 接口仍需原尺寸 RGBA 缓冲，缩小输出画布不能消除此开销。在 get_width/get_height 之后、创建 ImageData 和 display 之前检查解码像素预算：设备声明内存 ≤2GiB 时 3200 万，≥8GiB 时 1.28 亿，其余或未知时 6400 万。48MP 在常规预算内；低内存设备或超高像素 HEIC 的 WASM 分支会给内存不足提示，避免先分配数百 MB。原生解码在预算检查前已尝试。

Worker 成功、失败或超时后都会释放。没有新增服务端解码依赖，服务端原有大小、尺寸、真实格式与归属校验继续生效。

## 失败信息

| 错误码 | 用户提示 |
|---|---|
| IMAGE_PROCESSING_TIMEOUT | 图片处理时间较长，请重试 |
| IMAGE_HEIC_CONVERSION_FAILED | 这张 HEIC 没能在浏览器里转换，可以先转成 JPG 再上传 |
| IMAGE_NOT_RECOGNIZED | 这个文件不是能识别的图片 |
| IMAGE_DECODE_FAILED | 这张图片内容损坏或无法读取，可以重新导出为 JPG 后上传 |
| IMAGE_MEMORY_LIMIT | 这张图片需要的内存较多，当前浏览器无法处理，可以先缩小图片或换设备上传 |
| IMAGE_ENCODE_FAILED | 浏览器没能处理这张图片，可以导出为 JPG 或换个浏览器上传 |

只有超时提示重试，不把永久性转换失败或内存不足统一解释为重试。

## DAP 真人链路与后端范围

代码核对：screen-real → CaptureApi.footage → apiUpload 的图片字段会进行同一套处理。DapCaptureService.uploadFootage 保存返回 MIME、key、bytes，并将 image/* 直接作为 frameKey；没有依赖原图字节、EXIF 或文件校验和。后续本人刷脸是独立的 Modelink H5 授权流程。因此代码层接受重新编码的 JPG/PNG。此结论不是生产真人核验验收；未调用供应商刷脸、建付费分组或生成。

本次未改服务端。直接绕过前端传原始 HEIC 的错误分类、clip 现有 HEIC 白名单及外部口播客户端接入，均已记录在 TODO。不能声称外部口播客户端已具备这套端上转换能力。

## 评审后的验证

构建与浏览器测试全部经 devq 串行调度；应用源码和依赖在临时副本中，未修改/重启其他聊天的运行服务。

- web-celebrity 使用仓库真实的 `pnpm --filter @ai-star-eco/web-celebrity run build`，**Next 16 Turbopack** 构建通过。
- 对该构建运行 next start，Chrome 访问仅存在于临时副本中的验收页，从实际 `/_next/static/chunks/turbopack-worker-*.js` 加载 HEIC Worker，转换成功，无页面脚本异常。
- 同一副本使用原有 dev 脚本启动 Turbopack dev，Chrome 在允许的 localhost origin 完成同组验收，未改 allowedDevOrigins。
- web-aiavatar 使用原来的 `pnpm run build`（webpack）构建通过。
- Chrome：约 6.4MB、6000×4000 的合成 JPG 在素材入口保留原对象/字节；合成 12MB、4032×3024 JPG 在画布入口保留，在 8MB 素材入口压缩且不缩小尺寸。
- libheif 官方 example.heic：空 MIME，转成 JPG，1280×854、427729 字节。
- 合成 48MP JPEG：输出 4618×3464、94827 字节；不再统一限制长边 4096。
- 带尾部填充的不透明 PNG 照片：输出 JPG，保留 4032×3024；透明 PNG 保持 PNG，透明点 alpha=0。
- 合成 P3 HEIC：JPG 中心像素 [188,124,27]，系统原生解码参考 [187,124,25]，最大通道差 2。
- 非图片内容返回 IMAGE_NOT_RECOGNIZED。
- EXIF orientation=6 的合成 JPEG 原生解码为 200×320，压缩后 125×200，保持竖向与比例。
- 相关回归共 181 项通过（共享包 6、Studio 67、celebrity 108）；全工作区串行 typecheck、管理后台 typecheck、后端离线 compile、API 契约和 diff 检查均通过。

浏览器记录见 `docs/releases/client-image-upload-review-20261101/turbopack-results.json`。新增回归包含入口阈值、PNG 透明度、方向参数、Worker 分配前保护、失败分类和原图绕过慢队列；最终检查结果见同目录验证记录。

仍未完成：iPhone Safari 真机，特别是 iOS 16 / 17 的选图 accept 行为和 WASM 路径；不同厂商真实 HDR/高像素 HEIC 全覆盖。未发布生产。

## 依赖

项目与对应源码：https://github.com/catdad-experiments/libheif-js 。固定版本/完整性记录在 pnpm-lock.yaml，分发说明在 packages/api-client/THIRD_PARTY_NOTICES.md。
