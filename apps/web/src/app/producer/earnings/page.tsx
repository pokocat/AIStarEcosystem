"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";
import { formatCurrencyCny } from "@/mocks/shared";

export default function ProducerEarningsRoute() {
  const { copy } = useDictionary();
  const workspace = useProducerWorkspace();

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load earnings center" detail={workspace.errors[0]} />;
  }

  if (workspace.isBootstrapping || !workspace.dashboard) {
    return <LoadingPanel label="Loading earnings center..." />;
  }

  const { earningsSeries, transactions } = workspace.dashboard;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/10 pb-6">
        <h2 className="text-3xl font-black tracking-tight">{copy.producer.earnings.title}</h2>
        <p className="mt-2 text-sm text-gray-400">{copy.producer.earnings.subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl lg:col-span-5">
          <CardHeader>
            <CardTitle>Revenue Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningsSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="period" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ background: "#0c0c0e", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Bar dataKey="songRevenue" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="badgeRevenue" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl lg:col-span-7">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-gray-500">
                  <tr>
                    <th className="p-4 text-left">Date</th>
                    <th className="p-4 text-left">Description</th>
                    <th className="p-4 text-left">Amount</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((transaction) => {
                    const isIncome = transaction.direction === "in";
                    const amountStr = `${isIncome ? "+" : "-"} ${formatCurrencyCny(transaction.amount)}`;
                    return (
                      <tr key={transaction.id} className="hover:bg-white/5">
                        <td className="p-4 text-gray-500">{transaction.createdAt.slice(0, 10)}</td>
                        <td className="p-4 font-bold text-gray-300">{transaction.description}</td>
                        <td className={`p-4 font-mono font-black ${isIncome ? "text-emerald-400" : "text-white"}`}>
                          {amountStr}
                        </td>
                        <td className="p-4 text-right">
                          <Badge
                            variant="outline"
                            className={
                              transaction.status === "completed"
                                ? "border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-400"
                                : "border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 font-bold text-yellow-400"
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
