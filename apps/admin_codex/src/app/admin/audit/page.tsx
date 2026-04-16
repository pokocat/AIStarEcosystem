import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditLogs } from "@/lib/admin-data";

export default function AuditPage() {
  return (
    <>
      <PageHeader eyebrow="Audit" title="审计日志" description="审计日志只读，记录所有关键写操作与失败原因，支持后续按操作人、IP、目标实体筛选。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>最近审计记录</CardTitle>
          <CardDescription>展开明细时应展示请求参数与变更前后 diff；这里先用摘要代替。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>目标</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>结果</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.createdAt}</TableCell>
                  <TableCell>{log.operator}</TableCell>
                  <TableCell>
                    <StatusBadge kind="role" value={log.role} />
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.target}</TableCell>
                  <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                  <TableCell>
                    <StatusBadge kind="result" value={log.result} />
                  </TableCell>
                  <TableCell className="max-w-[380px] text-sm text-muted-foreground">{log.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
