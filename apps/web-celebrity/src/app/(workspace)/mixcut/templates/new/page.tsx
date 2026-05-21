import { TemplateDetailClient } from "../[id]/template-detail-client";

// v0.21+：新建模板「不立即落库」入口。
// 用户从模板库点「新建模板」会跳到这里；进入草稿编辑器，第一次「保存」才真正创建模板，
// 关闭 / 取消则不在「我的模板」里留下空模板（修复历史副作用）。
export default function NewTemplatePage() {
  // mode="new" 时 TemplateDetailClient 会用内存默认模板初始化、跳过 getTemplate 调用，
  // 保存成功后 router.replace 到 /mixcut/templates/{realId}/edit
  return <TemplateDetailClient id="" mode="new" />;
}
