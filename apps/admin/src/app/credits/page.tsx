"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Wallet, LedgerEntry, PageResponse } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Tab = "wallets" | "ledger";

function entryTypeVariant(type: LedgerEntry["entryType"]) {
  switch (type) {
    case "credit":
      return "success";
    case "debit":
      return "destructive";
    case "freeze":
      return "warning";
    case "unfreeze":
      return "info";
    case "expire":
      return "secondary";
    default:
      return "outline";
  }
}

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("wallets");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletsError, setWalletsError] = useState<string | null>(null);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [entryPage, setEntryPage] = useState(0);
  const [entryTotalPages, setEntryTotalPages] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  async function fetchWallets() {
    setWalletsLoading(true);
    setWalletsError(null);
    try {
      const data = await apiFetch<Wallet[]>("/api/admin/wallets");
      setWallets(data);
    } catch {
      setWalletsError("Failed to load wallets.");
    } finally {
      setWalletsLoading(false);
    }
  }

  async function fetchEntries(p = 0) {
    setEntriesLoading(true);
    setEntriesError(null);
    try {
      const data = await apiFetch<PageResponse<LedgerEntry>>(
        `/api/admin/ledger-entries?page=${p}&size=30`
      );
      setEntries(data.content);
      setEntryTotalPages(data.totalPages);
      setEntryPage(data.number);
    } catch {
      setEntriesError("Failed to load ledger entries.");
    } finally {
      setEntriesLoading(false);
    }
  }

  useEffect(() => {
    fetchWallets();
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "ledger" && entries.length === 0) {
      fetchEntries(0);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Credits &amp; Wallets</h2>
          <p className="text-muted-foreground">
            Tenant wallets and credit ledger transactions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            activeTab === "wallets" ? fetchWallets() : fetchEntries(entryPage)
          }
          disabled={activeTab === "wallets" ? walletsLoading : entriesLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              (activeTab === "wallets" ? walletsLoading : entriesLoading)
                ? "animate-spin"
                : ""
            }`}
          />
          Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["wallets", "ledger"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Wallets tab */}
      {activeTab === "wallets" && (
        <>
          {walletsError && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
              {walletsError}
            </div>
          )}
          <div className="rounded-lg border bg-card">
            {walletsLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead className="text-right">Total Balance</TableHead>
                    <TableHead className="text-right">Gift</TableHead>
                    <TableHead className="text-right">Recharge</TableHead>
                    <TableHead className="text-right">Plan</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No wallets found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets.map((wallet) => (
                      <TableRow key={wallet.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {wallet.tenantId}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-green-400">
                          {wallet.totalBalance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {wallet.giftBalance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {wallet.rechargeBalance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {wallet.planBalance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateTime(wallet.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {/* Ledger tab */}
      {activeTab === "ledger" && (
        <>
          {entriesError && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
              {entriesError}
            </div>
          )}
          <div className="rounded-lg border bg-card">
            {entriesLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No ledger entries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.tenantId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entryTypeVariant(entry.entryType)}>
                            {entry.entryType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          <span
                            className={
                              entry.entryType === "credit" || entry.entryType === "unfreeze"
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {entry.entryType === "credit" || entry.entryType === "unfreeze"
                              ? "+"
                              : "-"}
                            {Math.abs(entry.amount).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {entry.balanceAfter.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {entry.description}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          {entryTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchEntries(entryPage - 1)}
                disabled={entryPage === 0 || entriesLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {entryPage + 1} of {entryTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchEntries(entryPage + 1)}
                disabled={entryPage >= entryTotalPages - 1 || entriesLoading}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
