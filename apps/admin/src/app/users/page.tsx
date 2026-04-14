"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { User, PageResponse } from "@/types";
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

function statusVariant(status: User["status"]) {
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

function roleVariant(role: User["role"]) {
  switch (role) {
    case "platform_operator":
      return "default";
    case "finance_admin":
      return "info";
    case "producer":
      return "secondary";
    case "coach":
      return "secondary";
    default:
      return "outline";
  }
}

function planVariant(plan: User["plan"]) {
  switch (plan) {
    case "enterprise":
      return "default";
    case "pro":
      return "info";
    default:
      return "outline";
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchUsers(p = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PageResponse<User>>(
        `/api/admin/users?page=${p}&size=20`
      );
      setUsers(data.content);
      setTotalPages(data.totalPages);
      setPage(data.number);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers(0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">Manage platform users</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers(page)}
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
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>{user.username}</div>
                      {user.displayName && (
                        <div className="text-xs text-muted-foreground">
                          {user.displayName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email ?? user.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(user.role)}>
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={planVariant(user.plan)}>
                        {user.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {user.credits.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
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
            onClick={() => fetchUsers(page - 1)}
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
            onClick={() => fetchUsers(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
