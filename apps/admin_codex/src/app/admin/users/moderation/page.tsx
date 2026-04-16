import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moderationRecords } from "@/lib/admin-data";

export default function UserModerationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Moderation"
        title="封禁与删号记录"
        description="用于回顾近期待处理和已执行的账号治理动作，方便联动审计日志与风控事件。"
      />

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>最近治理动作</CardTitle>
          <CardDescription>所有写操作均应进入 AuditLog，此处聚焦账号层动作。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moderationRecords.map((record) => (
                <TableRow key={`${record.user}-${record.createdAt}`}>
                  <TableCell className="font-medium">{record.user}</TableCell>
                  <TableCell className="font-medium">{record.action}</TableCell>
                  <TableCell>{record.reason}</TableCell>
                  <TableCell>{record.operator}</TableCell>
                  <TableCell>{record.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
