import type { EnterpriseRole, EnterpriseMemberStatus } from "@ai-star-eco/types/enterprise";
export const ENTERPRISE_ROLE_LABEL: Record<EnterpriseRole, string> = { owner: "主账号", manager: "管理员", member: "成员" };
export const ENTERPRISE_MEMBER_STATUS_LABEL: Record<EnterpriseMemberStatus, string> = { active: "正常", suspended: "已停用", removed: "已退出" };
export const ENTERPRISE_BALANCE_LABELS = { enterprise: "企业待分配积分", enterprise_member: "我的企业积分", personal: "个人积分" } as const;
