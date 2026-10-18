# Group 描述与复刻模板精简

- 在现有 Group 上提供说明预览、编辑、清空和只读全文查看。使用现有画布令牌和 Ant Modal，不新增节点类型或执行器。
- 说明保存为 `metadata.groupDescription`；首次添加时向上扩展组框，为三行预览留空间，成员素材和连线位置不动。
- 模板快照保留 `groupId` 和 Group 的 `groupDescription`；创建个人副本时重映射成员的组 ID。普通复制亦保留说明。
- 禁用 React Flow 的选中节点提层，防止组框遮挡内部素材；编辑画布和只读模板共用该行为。
- 本轮不调用收费模型、不调整积分或开通，不涉及数据库迁移。

验证：前端 31 项定向测试通过；后端 StudioTemplateServiceTest、StudioTemplateCanvasCopyTest 通过；全仓类型、后台类型、后端编译和 API 契约门通过（契约扫描保留既有缺 handler 提示）。本地浏览器已验证说明编辑/预览与成员可见性。正式构建、上线和模板实测结果待补录。
