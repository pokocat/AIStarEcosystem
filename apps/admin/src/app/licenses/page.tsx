"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { LicenseBatch, LicenseKey, PageResponse } from "@/types";
import { formatDate } from "@/lib/utils";
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

type Tab = "batches" | "keys";

function keyStatusVariant(status: LicenseKey["status"]) {
  switch (status) {
    case "activated":
      return "success";
    case "sold":
      return "info";
    case "allocated":
      return "secondary";
    case "created":
      return "outline";
    case "expired":
      return "warning";
    case "revoked":
      return "destructive";
    default:
      return "outline";
  }
}

function licenseTypeVariant(type: LicenseBatch["licenseType"]) {
  switch (type) {
    case "plan_activation":
      return "default";
    case "credit_pack":
      return "info";
    case "seat_expansion":
      return "secondary";
    case "addon":
      return "outline";
    default:
      return "outline";
  }
}

export default function LicensesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("batches");

  const [batches, setBatches] = useState<LicenseBatch[]>([]);
  const [batchPage, setBatchPage] = useState(0);
  const [batchTotalPages, setBatchTotalPages] = useState(0);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [keyPage, setKeyPage] = useState(0);
  const [keyTotalPages, setKeyTotalPages] = useState(0);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  async function fetchBatches(p = 0) {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const data = await apiFetch<PageResponse<LicenseBatch>>(
        `/api/admin/license-batches?page=${p}&size=20`
      );
      setBatches(data.content);
      setBatchTotalPages(data.totalPages);
      setBatchPage(data.number);
    } catch {
      setBatchError("Failed to load license batches.");
    } finally {
      setBatchLoading(false);
    }
  }

  async function fetchKeys(p = 0) {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const data = await apiFetch<PageResponse<LicenseKey>>(
        `/api/admin/license-keys?page=${p}&size=20`
      );
      setKeys(data.content);
      setKeyTotalPages(data.totalPages);
      setKeyPage(data.number);
    } catch {
      setKeyError("Failed to load license keys.");
    } finally {
      setKeyLoading(false);
    }
  }

  useEffect(() => {
    fetchBatches(0);
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "keys" && keys.length === 0) {
      fetchKeys(0);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Licenses</h2>
          <p className="text-muted-foreground">
            License batches and individual key tracking
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            activeTab === "batches" ? fetchBatches(batchPage) : fetchKeys(keyPage)
          }
          disabled={activeTab === "batches" ? batchLoading : keyLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              (activeTab === "batches" ? batchLoading : keyLoading)
                ? "animate-spin"
                : ""
            }`}
          />
          Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["batches", "keys"] as Tab[]).map((tab) => (
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

      {/* Batches tab */}
      {activeTab === "batches" && (
        <>
          {batchError && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
              {batchError}
            </div>
          )}
          <div className="rounded-lg border bg-card">
            {batchLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Activated</TableHead>
                    <TableHead>Valid From</TableHead>
                    <TableHead>Valid To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No license batches found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-sm font-semibold">
                          {batch.batchNo}
                        </TableCell>
                        <TableCell>
                          <Badge variant={licenseTypeVariant(batch.licenseType)}>
                            {batch.licenseType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {batch.productId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {batch.settlementMode.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {batch.totalCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="text-green-400">
                            {batch.activatedCount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(batch.validFrom)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(batch.validTo)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          {batchTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchBatches(batchPage - 1)}
                disabled={batchPage === 0 || batchLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {batchPage + 1} of {batchTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchBatches(batchPage + 1)}
                disabled={batchPage >= batchTotalPages - 1 || batchLoading}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Keys tab */}
      {activeTab === "keys" && (
        <>
          {keyError && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
              {keyError}
            </div>
          )}
          <div className="rounded-lg border bg-card">
            {keyLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Masked Code</TableHead>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activated By</TableHead>
                    <TableHead>Activated At</TableHead>
                    <TableHead>Expires At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No license keys found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    keys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-mono text-sm font-semibold tracking-wider">
                          {key.maskedCode}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {key.batchId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={keyStatusVariant(key.status)}>
                            {key.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {key.activatedByUserId ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(key.activatedAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(key.expiresAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          {keyTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchKeys(keyPage - 1)}
                disabled={keyPage === 0 || keyLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {keyPage + 1} of {keyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchKeys(keyPage + 1)}
                disabled={keyPage >= keyTotalPages - 1 || keyLoading}
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
