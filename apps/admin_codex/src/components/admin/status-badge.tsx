import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

type StatusKind =
  | "role"
  | "plan"
  | "user-status"
  | "license-status"
  | "risk-level"
  | "risk-status"
  | "result"
  | "feature-status"
  | "entitlement-status"
  | "ledger-direction";

const statusMap: Record<StatusKind, Record<string, { label: string; variant: ComponentProps<typeof Badge>["variant"] }>> = {
  role: {
    SUPER_ADMIN: { label: "SUPER_ADMIN", variant: "default" },
    OPERATOR: { label: "OPERATOR", variant: "secondary" },
    fan: { label: "Fan", variant: "secondary" },
    producer: { label: "Producer", variant: "default" },
    coach: { label: "Coach", variant: "warning" },
  },
  plan: {
    free: { label: "Free", variant: "neutral" },
    pro: { label: "Pro", variant: "secondary" },
    enterprise: { label: "Enterprise", variant: "default" },
  },
  "user-status": {
    active: { label: "Active", variant: "success" },
    suspended: { label: "Suspended", variant: "warning" },
    deleted: { label: "Deleted", variant: "neutral" },
    healthy: { label: "Healthy", variant: "success" },
    frozen: { label: "Frozen", variant: "warning" },
  },
  "license-status": {
    active: { label: "正常", variant: "success" },
    expiring: { label: "即将到期", variant: "warning" },
    revoked: { label: "已吊销", variant: "destructive" },
    created: { label: "Created", variant: "neutral" },
    sold: { label: "Sold", variant: "secondary" },
    activated: { label: "Activated", variant: "success" },
  },
  "risk-level": {
    high: { label: "高", variant: "destructive" },
    medium: { label: "中", variant: "warning" },
    low: { label: "低", variant: "secondary" },
  },
  "risk-status": {
    pending: { label: "待处理", variant: "warning" },
    resolved: { label: "已处理", variant: "success" },
    false_positive: { label: "误报", variant: "neutral" },
  },
  result: {
    success: { label: "成功", variant: "success" },
    failed: { label: "失败", variant: "destructive" },
  },
  "feature-status": {
    enabled: { label: "启用", variant: "success" },
    disabled: { label: "禁用", variant: "neutral" },
  },
  "entitlement-status": {
    effective: { label: "生效中", variant: "success" },
    expiring: { label: "临近到期", variant: "warning" },
    revoked: { label: "已撤销", variant: "destructive" },
  },
  "ledger-direction": {
    grant: { label: "补赠", variant: "success" },
    consume: { label: "消耗", variant: "warning" },
    refund: { label: "退回", variant: "secondary" },
    manual_expire: { label: "人工过期", variant: "destructive" },
  },
};

export function StatusBadge({ kind, value }: { kind: StatusKind; value: string }) {
  const fallback = { label: value, variant: "outline" as const };
  const config = statusMap[kind][value] ?? fallback;

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
