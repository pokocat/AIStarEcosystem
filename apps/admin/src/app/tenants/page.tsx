"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Tenant, PageResponse } from "@/types";
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

function statusVariant(status: Tenant["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "warning";
    case "deleted":
      return "destructive";
    default:
      return "secondary";
  }
}

function typeVariant(type: Tenant["type"]) {
  switch (type) {
    case "organization":
      return "info";
    case "channel":
      return "secondary";
    default:
      return "outline";
  }
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchTenants(p = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PageResponse<Tenant>>(
        `/api/admin/tenants?page=${p}&size=20`
      );
      setTenants(data.content);
      setTotalPages(data.totalPages);
      setPage(data.number);
    } catch {
      setError("Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTenants(0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tenants</h2>
          <p className="text-muted-foreground">
            Organizations, channels, and personal workspaces
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchTenants(page)}
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
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner ID</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No tenants found.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant={typeVariant(tenant.type)}>
                        {tenant.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tenant.status)}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tenant.ownerUserId}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tenant.createdAt)}
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
            onClick={() => fetchTenants(page - 1)}
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
            onClick={() => fetchTenants(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
