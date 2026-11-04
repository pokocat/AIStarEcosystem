# 灵感库扩充：12 个官方示例（2026-11-03）

## 做了什么

参考 小云雀、OiiOii、Flova、LibTV 的灵感页与「做同款」技能，挑出我们现有能力做得出的案例类型，
**按类型重写提示词、用我们自己的模型重新出图出片**，以超管「存为官方内容」（`kind=example`，素材复制到 `ipstudio/demo/`）发布到线上。
没有搬运对方的图片、视频、角色或品牌：对方的「精选作品」多是创作者原创或基于他人 IP（游戏、影视）的二创，不能直接拿来；
出图时要求商品无品牌标识，第一版耳机外形太像某知名耳机，已重做成自有造型并删除旧画布。

| 排序 | 示例（demoId） | 类型 | 参考来源 | 画布 |
|---|---|---|---|---|
| 1 | 双11 大促海报（IPD-5774df0e） | 图片 3:4 | OiiOii「黑五品牌大促海报」 | 1 张 |
| 2 | 电梯开门大促（IPD-4141fa2f） | 视频 9:16 · 5 秒 | OiiOii「电梯开门大促」 | 首帧 → 成片 |
| 3 | 毛毡小柴 IP 形象设定（IPD-8efe8479） | 图片 16:9 | OiiOii「毛毡 IP」 | 1 张 |
| 4 | 材质变形香水广告（IPD-09fea259） | 视频 | OiiOii「材质变形效果」 | 首帧 → 成片 |
| 5 | 抹茶曲奇种草四宫格（IPD-fd45e522） | 图片 1:1 | OiiOii「商品生活方式种草」 | 1 张 |
| 6 | 日系夏日汽水广告（IPD-3153e20e） | 视频 | OiiOii「日系夏日感官品牌广告」 | 首帧 → 成片 |
| 7 | 保温杯电商套图（IPD-ae7a0c31） | 图片 1:1 ×4 | OiiOii「商品套图」 | 白底主图 → 场景 / 细节 / 卖点（以主图为参考） |
| 8 | 米线店到店广告（IPD-9379affe） | 视频 | LibTV「米线店 TVC」 | 首帧 → 成片 |
| 9 | 宠物零食广告（IPD-f53623f8） | 视频 | OiiOii「宠物类产品品牌广告」 | 首帧 → 成片 |
| 10 | 毛毡科普：云是怎么来的（IPD-398b0826） | 视频 | LibTV「毛茸茸」3D 毛毡科普 | 首帧 → 成片 |
| 11 | 珍珠吊坠首饰展示（IPD-6bc495e8） | 视频 | OiiOii「首饰佩戴展示」 | 首帧 → 成片 |
| 12 | 极简黑科技耳机展示（IPD-b1703685） | 视频 | LibTV「纯黑极客风产品展示」 | 首帧 → 成片 |

- 模型：图片 GPT Image 2（1K，16 积分 / 张）；视频 minimax-h3 图生视频 768p 5 秒，H3 限时五折 155 积分 / 条，智能优化开启。
- 花费：超管个人账户 5,736 → 4,049，共 1,687 积分（16 张图 + 9 条视频，含被替换的第一版耳机）。
- 每个示例的节点已改名（首帧 / 成片；白底主图 / 场景图 / 细节图 / 卖点图），sortOrder 1–12 让图片和视频交替出现在灵感墙前几行；原「潮玩个人 IP」保持 0。

## 首页悬停播放（2026-11-04 已生产发布）

用户要求：灵感墙上图片静态显示，视频卡平时显示静帧，鼠标移上去自动静音播放。

- 示例的 `doc` 里只存 storageKey，不带签名地址（只有 `coverUrl` 签名），所以前端拿不到可播放的视频地址。
  服务端 `IpTemplateDto` 新增可空 `previewVideoUrl`：只对 `kind=example` 取第一段视频节点当前采用的 key（`CanvasCoverService.firstVideoKey`）签名，签不出就不给，卡片退回静态封面。
  契约同步 `packages/types` 的 `IpTemplate.previewVideoUrl` 与 `specs/openapi.yaml`。
- 前端 `ProjectCardPreview` 收 `videoUrl`：有封面时以封面作 poster、`preload="none"`；没有封面用 `#t=0.1` 取首帧。监听整张卡（最近的按钮 / 链接）的 mouseenter / focus 播放、离开暂停并回到开头；静音在元素上设置。右上角小标说明这是视频，播放时淡出。首页灵感墙（`FeedCard`）和「灵感」页（`TemplateCard`）都接上。
- 验证：server 编译 + `CanvasCoverServiceTest`（10 个，含新增 `firstVideoKey`）、web-aiavatar typecheck + 首页 / 手机首页 / 预览测试 18 个、`pnpm check:api-contract` 全部通过。浏览器里的悬停效果没有实测（本次会话浏览器面板未显示，无法截图）。
- 正式站默认旧版首页，旧版的「灵感故事」是固定的四张示意卡，不读灵感库；这批示例在新版首页和 `/templates`「精选案例」里看得到。

## 生产发布（2026-11-04）

- 制品 `20261104-inspiration-hover-video`，main `c3dc6750b`，服务 server + web-aiavatar；构建参数 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 `manifest.env`）。无迁移。
- 同包带上线：线上上一版 `e060a7f36` 之后 main 上的导演台「按用户给的标题行分集」（`options.marker`，只新增字段）与 PC 站第一批文案。发布前核对 DTO 与 openapi：只增不删。
- 重启前核对：没有进行中的画布任务和视频任务。`deploy-release.sh` 自带的 verify 全绿。
- 线上验收（超管账号，`/templates`「精选案例」）：接口 13 个示例中 9 个带视频的返回 OSS 签名地址，4 个图片示例不返回；卡片 `<video>` 静音、`preload=none`、有封面；鼠标移上去开始播放（3 秒后 `currentTime` 2.4、`is-playing`），移开后暂停并回到 0。新版首页的灵感墙用同一个组件，没有单独点验。
- 回滚：重新部署 `20261103-director-episode-codes` 的 server + web-aiavatar。
