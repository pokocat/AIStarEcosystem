"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Entitlement, PageResponse } from "@/types";
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

function statusVariant(status: Entitlement["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "expired":
      return "warning";
    case "revoked":
      return "destructive";
    default:
      return "secondary";
  }
}

function typeLabel(type: Entitlement["entitlementType"]) {
  return type.replace(/_/g, " ");
}

export default function EntitlementsPage() {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchEntitlements(p = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PageResponse<Entitlement>>(
        `/api/admin/entitlements?page=${p}&size=20`
      );
      setEntitlements(data.content);
      setTotalPages(data.totalPages);
      setPage(data.number);
    } catch {
      setError("Failed to load entitlements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntitlements(0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entitlements</h2>
          <p className="text-muted-foreground">
            Feature access, quotas, and plan entitlements per tenant
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchEntitlements(page)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Feature Code</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitlements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No entitlements found.
                  </TableCell>
                </TableRow>
              ) : (
                entitlements.map((ent) => (
                  <TableRow key={ent.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ent.tenantId}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ent.productId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {typeLabel(ent.entitlementType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ent.featureCode}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {ent.value}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ent.status)}>
                        {ent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(ent.validFrom)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(ent.validTo)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page - 1)}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
