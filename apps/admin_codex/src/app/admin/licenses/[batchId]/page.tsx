import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBatchById, licenseKeys } from "@/lib/admin-data";

export default function LicenseBatchDetailPage({ params }: { params: { batchId: string } }) {
  const batch = getBatchById(params.batchId);

  return (
    <>
      <PageHeader
        eyebrow="License Batch"
        title={batch.id}
        description={`${batch.product} · ${batch.channel} · 有效期 ${batch.validRange}`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>套餐</CardDescription>
            <CardTitle>
              <StatusBadge kind="plan" value={batch.plan} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>卡密类型</CardDescription>
            <CardTitle>{batch.type}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>库存进度</CardDescription>
            <CardTitle>{batch.progress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>状态</CardDescription>
            <CardTitle>
              <StatusBadge kind="license-status" value={batch.status} />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>批次内卡密状态</CardTitle>
          <CardDescription>支持单条吊销，并保留激活用户与激活时间的审计信息。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>卡密 Hash</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>激活用户</TableHead>
                <TableHead>激活时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenseKeys.map((key) => (
                <TableRow key={key.key}>
                  <TableCell className="font-mono text-xs">{key.key}</TableCell>
                  <TableCell>
                    <StatusBadge kind="license-status" value={key.status} />
                  </TableCell>
                  <TableCell>{key.user}</TableCell>
                  <TableCell>{key.activatedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
