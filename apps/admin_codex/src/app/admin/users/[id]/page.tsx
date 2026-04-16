import { Ban, Coins, LogOut, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditLogs, entitlements, getUserById, ledgerRecords } from "@/lib/admin-data";

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const user = getUserById(params.id);

  return (
    <>
      <PageHeader
        eyebrow="User Detail"
        title={user.name}
        description={`所属租户：${user.tenant} · 最近登录：${user.lastLoginAt} · 注册方式：${user.signupMethod}`}
        actions={
          <>
            <Button variant="outline">
              <ShieldCheck data-icon="inline-start" />
              开通权益
            </Button>
            <Button variant="outline">
              <Coins data-icon="inline-start" />
              补点
            </Button>
            <Button variant="outline">
              <LogOut data-icon="inline-start" />
              强制下线
            </Button>
            <Button variant="destructive">
              <Ban data-icon="inline-start" />
              封禁账号
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>账号状态</CardDescription>
            <CardTitle>
              <StatusBadge kind="user-status" value={user.status} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>角色</CardDescription>
            <CardTitle>
              <StatusBadge kind="role" value={user.role} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>套餐</CardDescription>
            <CardTitle>
              <StatusBadge kind="plan" value={user.plan} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>积分余额</CardDescription>
            <CardTitle className="tabular-nums">{user.credits}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">基本信息</TabsTrigger>
          <TabsTrigger value="entitlements">权益信息</TabsTrigger>
          <TabsTrigger value="credits">积分详情</TabsTrigger>
          <TabsTrigger value="audit">操作记录</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>用户档案</CardTitle>
              <CardDescription>附录 B 中用户详情页的核心字段。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-secondary/35 p-4">邮箱：{user.email}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">手机号：{user.phone}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">注册时间：{user.registeredAt}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">最后登录：{user.lastLoginAt}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entitlements">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>当前权益</CardTitle>
              <CardDescription>展示套餐、功能点、额度及到期时间。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>对象</TableHead>
                    <TableHead>功能</TableHead>
                    <TableHead>额度</TableHead>
                    <TableHead>到期</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlements.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.feature}</TableCell>
                      <TableCell>{item.quota}</TableCell>
                      <TableCell>{item.expiresAt}</TableCell>
                      <TableCell>
                        <StatusBadge kind="entitlement-status" value={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>最近 50 条积分流水</CardTitle>
              <CardDescription>所有余额变化都应走不可变流水，而不是直接改余额字段。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>主体</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.subject}</TableCell>
                      <TableCell>
                        <StatusBadge kind="ledger-direction" value={record.direction} />
                      </TableCell>
                      <TableCell>{record.account}</TableCell>
                      <TableCell className="tabular-nums">{record.amount}</TableCell>
                      <TableCell>{record.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>最近审计日志</CardTitle>
              <CardDescription>高风险动作建议与租户、钱包、卡密页面交叉核查。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {auditLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border bg-secondary/35 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.action}</p>
                    <StatusBadge kind="result" value={item.result} />
                  </div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
