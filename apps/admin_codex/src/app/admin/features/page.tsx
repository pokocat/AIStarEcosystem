import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { features } from "@/lib/admin-data";

export default function FeaturesPage() {
  return (
    <>
      <PageHeader eyebrow="Features" title="功能点管理" description="维护 Feature Code、说明、关联套餐和全局启停状态。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>功能清单</CardTitle>
          <CardDescription>便于运营确认某个能力是否对某类套餐开放，以及是否暂时禁用。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>关联套餐</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature) => (
                <TableRow key={feature.code}>
                  <TableCell className="font-mono text-xs">{feature.code}</TableCell>
                  <TableCell>{feature.name}</TableCell>
                  <TableCell>{feature.description}</TableCell>
                  <TableCell>{feature.plans.join(" / ")}</TableCell>
                  <TableCell>
                    <StatusBadge kind="feature-status" value={feature.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
