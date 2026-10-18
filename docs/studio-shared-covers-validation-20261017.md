# Studio 项目与灵感统一封面验收

日期：2026-10-17。状态：已生产发布 a4092626；实际上线与线上验收见 [生产发布记录](studio-shared-covers-production-20261017.md)。上一版项目卡片已发布 4ed3ecf9，本次是新增的统一封面逻辑。

## 规则与复用

项目、个人模板与官方模板共用人工封面 → 已保存图片（采用图优先）→ 实际画布缩略图的顺序。图片加载失败继续尝试其他图片，最后显示画布。前端共用 ProjectCardPreview、projectPreview 与 CanvasCoverEditor；服务端共用 CanvasCoverService 与图片上传校验。

支持独立 JPG/PNG 上传、从画布选图、恢复自动、上传失败重试。封面只保存 coverKey；不添加画布节点，不改 doc、docVersion、不可变模板版本，不触发生成和积分。项目/个人模板仅属主可修改；官方模板仅 SUPER_ADMIN。内置 classpath 官方模板也支持 SUPER_ADMIN 上传封面：仅以 studio.builtin-cover.{id} 平台配置保存封面 key，不创建第二份模板或复制 doc，未来内置工作流更新仍立即生效，目录与按 id 解析共用同一覆盖信息。

新增 POST/PUT/DELETE /api/v1/ip-studio/covers/{project|template}/{id}；API 壳沿用 ApiResponse，返回 coverUrl。独立上传封面在替换或重置提交后清理，回滚只清理新上传，不删除原画布素材。模板更新发布保留人工上传封面。

## 检查

为避开其他任务同时修改工作区，在 HEAD=b635ae27 的临时工作树仅叠加本次代码与封面契约检查。

- 前端：canvas-cover.test.tsx 5 项、project-preview.test.ts 4 项、studio-create-home.test.tsx 12 项，共 21 项通过（含内置官方模板管理员封面入口）。覆盖优先级、坏图回落、无图画布、失败上传重试、共用选择/重置、项目分页/筛选/删除及模板目录。
- 服务端：CanvasCoverServiceTest 9 项、IpProjectServiceTest 46 项、StudioTemplateServiceTest 16 项、IpTemplateResolverTest 8 项与 IpDemoTemplateStripTest 12 项，共 91 项通过。覆盖权限、文档/版本不变、自动采用图、非法选图、失败保留、事务提交/回滚清理。
- AiAvatar typecheck 与 check:api-contract 通过。契约脚本保留已有无 handler/orphan 警告，本次 covers 路径与 POST/PUT/DELETE 均匹配。
- 首轮工作区测试受机器负载超时；隔离检查中删除重试测试暴露测试时序问题，现等待按钮恢复可用后重试，11 项目录测试已重新全过。现有 act() 测试告警仍在，未改无关逻辑。

## 浏览器验收

localhost:3013/templates 验证桌面与手机布局。当前真实内置模板无图片，因此按规则显示画布。另用只存在当前浏览器文档的 fetch fixture 对照自动图片、人工优先、无图三种卡片，测试个人模板上传 → 弹窗关闭 → 卡片更新、恢复自动 → 原图片恢复；刷新页面已移除 fixture。没有写生产数据、没有调用收费生成。上传的浏览器验收接口为本地 fixture，真实存储/权限/事务由上述服务端测试覆盖，未声称完成线上或真实数据库联调。

截图与检查日志位于 .studio-e2e/shared-covers/（忽略文件）。

内置官方模板补齐后新增服务端三项回归：仅存封面覆盖/不复制模板、普通用户与未知 id 拒绝、列表与解析一致。最终 21 项前端 + 91 项服务端全部通过，类型与契约检查也通过；结果记录在忽略目录的 *final 日志及 XML 报告。
