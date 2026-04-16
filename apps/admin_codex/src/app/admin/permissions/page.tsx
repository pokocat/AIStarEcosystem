import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const permissions = [
  { code: "admin.staff.write", scope: "管理员账号 CRUD", grantedTo: "SUPER_ADMIN" },
  { code: "admin.user.suspend", scope: "用户封禁/解封", grantedTo: "SUPER_ADMIN, OPERATOR" },
  { code: "admin.credit.adjust", scope: "人工调差积分", grantedTo: "SUPER_ADMIN, OPERATOR" },
  { code: "admin.settings.write", scope: "系统设置", grantedTo: "SUPER_ADMIN" },
];

export default function PermissionsPage() {
  return (
    <>
      <PageHeader eyebrow="RBAC" title="权限点管理" description="对照附录 B.4 的访问控制矩阵，将页面能力显式映射到可授予权限点。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>权限点</CardTitle>
          <CardDescription>后续可扩展为更细粒度的 Spring Security 权限点集合。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限编码</TableHead>
                <TableHead>能力说明</TableHead>
                <TableHead>默认授予</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((item) => (
                <TableRow key={item.code}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell>{item.scope}</TableCell>
                  <TableCell>{item.grantedTo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
