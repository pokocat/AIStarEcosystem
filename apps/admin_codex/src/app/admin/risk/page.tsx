import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { riskRecords } from "@/lib/admin-data";

export default function RiskPage() {
  return (
    <>
      <PageHeader eyebrow="Risk" title="风控事件" description="聚焦异地登录、频繁兑换、批量生成与可疑注册等事件，支持处置与误报标记。" />
      <Alert variant="warning">
        <ShieldAlert className="size-4" />
        <AlertTitle>当前有高风险事件待处理</AlertTitle>
        <AlertDescription>建议值班同学先从高风险异地登录开始，必要时直接联动封禁账号与强制下线。</AlertDescription>
      </Alert>
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>风险列表</CardTitle>
          <CardDescription>状态包括待处理、已处理和误报，后续可加入处置说明弹窗。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>风险等级</TableHead>
                <TableHead>触发类型</TableHead>
                <TableHead>相关用户</TableHead>
                <TableHead>触发时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>建议</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskRecords.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <StatusBadge kind="risk-level" value={item.level} />
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell className="font-medium">{item.user}</TableCell>
                  <TableCell>{item.triggeredAt}</TableCell>
                  <TableCell>
                    <StatusBadge kind="risk-status" value={item.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.suggestion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
