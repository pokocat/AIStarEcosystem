import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const roles = [
  { role: "SUPER_ADMIN", scope: "平台级", description: "拥有全部模块与系统设置权限。" },
  { role: "OPERATOR", scope: "平台级", description: "负责日常运营、巡检、开通和调账。" },
  { role: "tenant_admin", scope: "租户级", description: "未来可扩展的租户管理员角色。" },
];

export default function RolesPage() {
  return (
    <>
      <PageHeader eyebrow="RBAC" title="角色列表" description="展示平台当前已实现的两级管理员角色，并预留后续更细粒度的租户级角色。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>角色矩阵</CardTitle>
          <CardDescription>实际实现以 SUPER_ADMIN 和 OPERATOR 为主，未来继续扩展 RBAC。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色</TableHead>
                <TableHead>层级</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((item) => (
                <TableRow key={item.role}>
                  <TableCell>
                    <StatusBadge kind="role" value={item.role} />
                  </TableCell>
                  <TableCell>{item.scope}</TableCell>
                  <TableCell>{item.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
