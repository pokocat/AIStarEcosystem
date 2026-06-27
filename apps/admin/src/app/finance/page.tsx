"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 资金财务控制台首页（v2 §6）—— 真实资金账务一站式入口，FINANCE_ADMIN 专属。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, Scale, Wallet, AlertTriangle, Gift } from "lucide-react";
import { RequireFinanceAdmin } from "@/components/RequireFinanceAdmin";

const MODULES = [
  { href: "/finance/recharge-orders", label: "充值订单", icon: Coins, desc: "在线/线下充值核销 + 现金退款（资金面）" },
  { href: "/finance/reconciliation", label: "对账", icon: Scale, desc: "现金勾稽（排除影子）+ 积分负债单列 + drift 告警" },
  { href: "/finance/ledger", label: "结算中心", icon: Wallet, desc: "钱包 / 流水 / 复核" },
  { href: "/finance/risk", label: "异常风控", icon: AlertTriangle, desc: "异常打赏与提现" },
  { href: "/finance/recharge-packages", label: "充值套餐", icon: Gift, desc: "积分充值套餐 CRUD（含按子应用配置）" },
];

export default function FinanceConsolePage() {
  return (
    <RequireFinanceAdmin>
      <div className="admin-page space-y-6">
        <PageHeader
          title="资金财务控制台"
          description="真实资金账务（FINANCE_ADMIN 专属，与积分运营隔离）—— 充值、退款、对账、结算一站式。"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}>
              <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex items-start gap-3 p-5">
                  <m.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </RequireFinanceAdmin>
  );
}
