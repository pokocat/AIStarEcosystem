# Studio IP 人物库

2026-10-08，本地实现，未发布。对标用户已登录 Chrome 中的小云雀角色库与角色详情：先挑人物，点开看立绘、特写、表情、三视图和属性，再添加到画布。参考页面：[小云雀](https://xyq.jianying.com/project?projectId=10875501874188&generate_mode=agent&source=home_feature_canvas&entrance_from=smart_tool_entrance&canvasId=10893415539980&agent_thread_id=0cccf0fd-d717-4c0a-b13f-1d82bb7d7129)。只读查看布局，未将其中角色导入我方。

## 浏览和引用

原入口把主形象、历史版本与造型平铺成卡片，同一个人物出现多次。新入口“IP 人物库”以 `avatarId` 汇总，一位人物一张卡片；历史版本藏在详情中。搜索人物名称、已有描述、属性或素材名称，按 AI 原创/真人形象及已有素材类型筛选。

人物详情包含大图预览与主形象、脸部特写、表情、整张人物设定图、三视图/正侧背面、服装与细节、历史主形象分区；点击素材切换实际参考图片。属性只使用既有 `DapAvatar.def` 文本，不按图像猜年龄、性别或身份。缺少素材显示“未添加”，不会把一张整图冒充已经生成的独立视角。

右侧显示已填写的人物描述及默认 `DapVoice` 官方预设声音版本和真实试听。添加到画布保存所选 `ipId/avatarId/version/storageKey/lookId`，沿用当前默认声音的精确 `voiceId` 快照；声音试听地址不进入文档。保存失败保留操作入口，恢复保存复用已添加节点。已归档造型的后续归档默认仍为造型，不默认覆盖主形象。

## 持久化与权限

新增 V45 仅给 `dap_look` 添加可空 `asset_role VARCHAR(24)`，保留旧 `source`、文件与版本。类别为 sheet/portrait/three-view/front/side/back/expression/detail/look；主形象与历史类别由真实版本派生。旧造型未分类时仍显示为造型，不通过名字猜类别。与当前主图相同的 `source=final` 镜像不再重复展示。

`GET /v1/ip-studio/studio/ip-assets` 补充 `characterName/path/assetRole/description/attributes`，图片 URL 出 wire 时重签。`PUT /v1/ip-studio/studio/performers/{avatarId}/looks/{lookId}/role` 免费整理已有素材，校验 owner、人物与已完成 look 的精确归属。归档请求可指定 `assetRole`，旧缺字段请求仍返回原归档结果，避免升级后生成重复记录。模板归档从明确输出角色传类别，custom 归为 look。

不新增子应用或产品码，不导入第三方角色，不自动生成缺失素材。当前只有本人素材，尚无公共角色市场。属性编辑及自动提取、对整张设定图自动裁图归类仍未实现。

## 本地验收

真实浏览器：17 份素材汇总为 10 位人物；人物声音音频可读（3.52 秒，readyState=4）；主形象与声音添加到独立画布 `IPP-c820ea68` 并刷新保留。旧背面素材 `DL-38d082414bf049b49abc` 免费归类为 back 后进入视角区，引用保留 lookId。所有主形象 key 不变，没有重复资产记录，期间账本零变化。证据 `.studio-e2e/ip-library/report.json`、`browser-library.png`、`browser-person.png`。

后端归属/分类/迁移/执行及投影回归 22 项通过；前端完整 244 项通过；workspace（含 admin）typecheck、AiAvatar 生产构建和 API 契约门通过。生产数据库/代码未发布。


按用户最新要求，验收聚焦功能与交互，模型画质不阻塞功能。第二份一次设定图结果在浏览器显式采用并作为sheet归档到原人物（DL-4d0372b263ea405c886c），当前18份素材仍汇总10位人物。人物主图和默认声音v1保留，整图可跨画布引用；只提交一次镜头生成IPR-1719228b，8积分，原请求重放不再扣费。结果进入普通镜头图后的动作包括生成视频、继续改图和加入IP；选中整张设定图的动作则为生成镜头画面、修改设定图和另存人物素材。视频默认指令转为动作与镜头要求。详情见验证记录§16，功能证据位于`.studio-e2e/templates/one-shot/corrected/functional-report.json`。

## v0.206 · 统一入口与界面修复

工作台人物库、画布底部人物入口、节点参考、创作要求、商品视频和模板输入都使用同一人物详情选择器。入口只决定选用结果回填到画布、具体节点参考、表单或模板输入槽；取消返回原编辑位置。人物卡片使用真实内容高度，手机详情使用固定确认底栏。完整记录见 [界面审查](ip-studio-ui-audit.md)。
