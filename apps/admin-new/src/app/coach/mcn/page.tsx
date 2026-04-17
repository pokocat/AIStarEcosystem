import { Building2, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SignedArtists } from "@/mocks/coach";

interface MCNRow {
  name: string;
  artists: number;
  avgRoyalty: number;
  revenue: number;
  content: number;
}

function aggregate(): MCNRow[] {
  const map = new Map<string, MCNRow>();
  for (const a of SignedArtists) {
    const amount = Number(a.monthlyRevenue.replace(/[^\d-]/g, "")) || 0;
    const cur = map.get(a.mcn) ?? { name: a.mcn, artists: 0, avgRoyalty: 0, revenue: 0, content: 0 };
    cur.artists += 1;
    cur.avgRoyalty += a.royaltyRate;
    cur.revenue += amount;
    cur.content += a.contentCount;
    map.set(a.mcn, cur);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, avgRoyalty: Math.round(r.avgRoyalty / r.artists) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export default function McnPage() {
  const rows = aggregate();
  const total = rows.reduce((a, b) => a + b.revenue, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="MCN 机构"
        description="签约机构聚合视图 · 艺人数、平均分成、月收益"
        breadcrumb={[{ label: "艺人与经纪" }, { label: "MCN 机构" }]}
        actions={<Button size="sm">新增机构</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="合作机构" value={rows.length} icon={Building2} />
        <StatCard label="签约艺人" value={SignedArtists.length} icon={Users} />
        <StatCard label="机构月收益合计" value={`¥${total.toLocaleString("zh-CN")}`} icon={Wallet} tone="success" />
        <StatCard
          label="平均分成"
          value={`${Math.round(rows.reduce((a, b) => a + b.avgRoyalty, 0) / Math.max(1, rows.length))}%`}
          icon={Wallet}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>机构列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>机构</TableHead>
                <TableHead>签约艺人</TableHead>
                <TableHead>内容数</TableHead>
                <TableHead>平均分成</TableHead>
                <TableHead className="text-right">月收益合计</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="tabular-nums text-sm">{r.artists}</TableCell>
                  <TableCell className="tabular-nums text-sm">{r.content}</TableCell>
                  <TableCell className="tabular-nums text-sm">{r.avgRoyalty}%</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    ¥{r.revenue.toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">详情</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
