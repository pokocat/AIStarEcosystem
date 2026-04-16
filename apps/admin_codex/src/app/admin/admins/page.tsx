import { Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAccounts } from "@/lib/admin-data";

export default function AdminAccountsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="管理员账号"
        description="对应 v1.3.0 新增的管理员账号 CRUD 页面，普通平台用户已与管理员实体完全分离。"
        actions={
          <Button>
            <Plus data-icon="inline-start" />
            新建管理员
          </Button>
        }
      />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>平台管理员列表</CardTitle>
          <CardDescription>SUPER_ADMIN 可执行创建、角色调整、状态变更与删除。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>显示名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最近登录</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.username}</TableCell>
                  <TableCell>{account.displayName}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <StatusBadge kind="role" value={account.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="user-status" value={account.status} />
                  </TableCell>
                  <TableCell>{account.lastLoginAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
