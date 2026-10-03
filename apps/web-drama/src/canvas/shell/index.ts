// ─────────────────────────────────────────────────────────────────────────────
// canvas/shell —— 画布外壳组件（v0.198）。四个页面（剧本 / 角色和场景 / 逐集制作 / 单集编辑器）用这些，
// 不要自己再写竖条、顶栏、底部提示条。样式都在 styles/pages/canvas.css（`.cv-*`），页面自己的样式写进
// 各自的 canvas-script.css / canvas-assets.css / canvas-board.css / canvas-episodes.css。
//
// 页面的骨架（[canvasId]/layout.tsx 已经挂好竖条、顶栏、Provider 和 CanvasGate，页面拿到的一定是已加载的文档）：
//   <div className="cv-page">…正文…</div>          常规页面：居中 1120px，底部给提示条让出高度
//   <div className="cv-fill">…</div>              整块铺满（画布 board 用）：占满内容区，不滚动、无内边距
//   <CanvasNextBar hint=… prev=… next=… />         页面底部的提示条（放在页面组件里任意位置，fixed 定位）
//
// 组件：
//   CanvasShell({ canvasId, children })            layout 用，页面不用管
//   CanvasRail({ canvasId })                       竖条（layout 已挂）；CANVAS_STEPS 是三步的名字 / 图标 / 一句说明
//   stepOfPath(pathname, canvasId)                 当前路径在哪一步
//   CanvasTopbar()                                 顶栏（layout 已挂）
//   CanvasTopbarSlot({ slot: "left"|"right", children })
//                                                  往顶栏里塞页面自己的东西：left 在标题和风格 / 画幅 chip 后面
//                                                  （如「逐集制作 / 第 1 集」），right 在保存状态前面（如视频模型、合成成片）
//   CanvasNextBar({ hint, prev?, next? })          底部居中深色提示条；prev / next 是 NextBarAction：
//                                                  { label, href? | onClick?, disabled?, disabledReason?（禁用时就地写一行）,
//                                                    cost?（按钮上带 ✦N）, busy? }
//   DesktopHint({ storageKey?, children? })        「电脑上更好用」可关闭的提示，只在 ≤720 显示；关掉后这台设备记住
//   CanvasGate({ children, skeleton? })            loading 骨架 / not-found / error 三种态；layout 已包，页面一般不用
//   CanvasGateSkeleton()                           默认骨架（页面内局部加载也可以借用）
//   StylePickerButton({ value, onChange, disabled?, className?, note? })
//   StylePickerDialog({ open, value, onClose, onChange, note? })
//                                                  全剧风格浮层（分类 + 色带格子 + 自定义一句）
//
// 图和视频（画布里显示图 / 视频一律用这两个，不要自己写 <img src={asset.url}>）：
//   CanvasImage({ asset?: {key, url?} | null, alt, fit?: "cover"|"contain", className?, style?, placeholder? })
//                                                  没有 asset → placeholder（缺省中性占位，不写字）；<img> 出错时按 key 换新地址
//                                                  （签名 1 小时过期）：几张同时失败合成一次请求（一次 ≤100 个），新地址内存缓存
//                                                  50 分钟、按画布隔离；同一个地址连续失败只换一次（换来的成功加载过就清零，之后再过期还能再换），
//                                                  还不行显示「图片加载失败」。**不改文档**。
//                                                  尺寸由 className / style 给（占位 div 也用同一套，布局不跳）。
//   CanvasVideo({ version?: {key, url?} | null, poster?: {key, url?} | null, controls?(默认 true), autoPlay?, muted?, loop?, className?, style? })
//                                                  同样的换新逻辑（视频出错时顺带给封面换新）；还不行显示「视频加载失败」。
//   resignCanvasAsset(canvasId, key)               自己要拼地址时（如下载按钮）用的底层函数，走同一个队列和缓存。
//   不在 CanvasDocProvider 里时（拿不到 canvasId）不换新，出错直接显示占位。
//
// 切集说明（粘贴剧本新建后显示一次）：
//   rememberSplitNotes(canvasId, notes)            新建页调，存 sessionStorage（drama-canvas-split-notes:<id>）
//   SplitNotesBanner({ canvasId, episodeCount })   剧本页页首，读到就显示（可关闭），读完即删
// ─────────────────────────────────────────────────────────────────────────────

export { CanvasShell } from "./canvas-shell";
export { CanvasRail, CANVAS_STEPS, stepOfPath, type CanvasRailProps } from "./canvas-rail";
export { CanvasTopbar, CanvasTopbarSlot, type CanvasTopbarSlotProps } from "./canvas-topbar";
export { CanvasNextBar, type CanvasNextBarProps, type NextBarAction } from "./next-bar";
export { DesktopHint, type DesktopHintProps } from "./desktop-hint";
export { CanvasGate, CanvasGateSkeleton, type CanvasGateProps } from "./canvas-gate";
export { StylePickerButton, StylePickerDialog, type StylePickerDialogProps } from "./style-picker";
export { CanvasImage, CanvasVideo, resignCanvasAsset, RESIGN_CACHE_TTL_MS, RESIGN_BATCH_MAX, type CanvasImageProps, type CanvasVideoProps } from "./media";
export { SplitNotesBanner, rememberSplitNotes, takeSplitNotes, type SplitNotesBannerProps } from "./split-notes";
