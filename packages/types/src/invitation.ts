/** 全生态账号注册邀请，由 aibuzz-id 保存；不表示产品开通或分佣资格。 */
export interface InvitationAccount {
  displayName: string;
  avatarUrl: string | null;
  status: "active" | "suspended" | "merged" | "closed";
}

export interface RegistrationInvitation {
  id: string;
  account: InvitationAccount;
  createdAt: string;
}

export interface InvitationOverview {
  inviteCode: string | null;
  canInvite: boolean;
  inviter: InvitationAccount | null;
  invitedAt: string | null;
  records: RegistrationInvitation[];
  total: number;
  page: number;
  pageSize: number;
}
