"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emitGlobalError } from "@/lib/global-errors";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    emitGlobalError({
      title: "页面渲染异常",
      description: error.message,
      source: error.digest ? `digest:${error.digest}` : undefined,
      fingerprint: `route-error:${error.digest ?? error.message}`,
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            页面加载失败
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            当前页面遇到运行错误，已在右下角显示错误提示。
          </p>
          <pre className="max-h-36 overflow-auto rounded-md border border-border bg-surface-muted p-3 text-xs text-foreground/80">
            {error.message}
          </pre>
          <Button type="button" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            重试
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
