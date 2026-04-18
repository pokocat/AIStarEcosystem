"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "success" | "warning";
  requireReason?: boolean;
  reasonPlaceholder?: string;
  onConfirm?: (reason: string) => void;
  children?: React.ReactNode;
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "primary",
  requireReason = false,
  reasonPlaceholder = "补充操作理由（将写入审计日志）",
  onConfirm,
  children,
}: ActionDialogProps) {
  const [reason, setReason] = React.useState("");

  const variant =
    tone === "danger" ? "destructive" : tone === "success" ? "success" : tone === "warning" ? "warning" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {requireReason && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">操作备注</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant as "default" | "destructive" | "success" | "warning"}
            disabled={requireReason && !reason.trim()}
            onClick={() => {
              onConfirm?.(reason);
              setReason("");
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
