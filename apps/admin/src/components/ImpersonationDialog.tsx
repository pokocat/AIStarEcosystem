"use client";

import * as React from "react";
import { apiFetch } from "@/api/_client";
import type { AepUser } from "@/types/account";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRODUCTS = [["drama", "短剧工坊"], ["music", "AI 音乐人"], ["celebrity", "明星带货"], ["aiavatar", "数字人资产平台"], ["star", "明星商务工作台"]];
export function ImpersonationDialog({ user, onClose }: { user: AepUser | null; onClose: () => void }) {
  const [product, setProduct] = React.useState("drama");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { setError(""); }, [user?.id]);
  async function login() {
    if (!user || busy) return;
    // 在用户点击时打开，避免异步响应后触发浏览器弹窗拦截。
    const tab = window.open("", "_blank");
    if (!tab) { setError("浏览器拦截了新窗口，请允许此站点打开弹窗后重试。"); return; }
    tab.opener = null;
    tab.document.body.textContent = "正在登录…";
    setBusy(true); setError("");
    try {
      const result = await apiFetch<{ handoffUrl: string }>(`/admin/aep-users/${encodeURIComponent(user.id)}/impersonate`, {
        method: "POST", body: { product },
      });
      if (tab.closed) throw new Error("新窗口已关闭，请重新发起。");
      tab.location.replace(result.handoffUrl);
      onClose();
    } catch (e) { tab.close(); setError(e instanceof Error ? e.message : "附身登录失败"); }
    finally { setBusy(false); }
  }
  return <Dialog open={!!user} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>附身登录</DialogTitle>
        <DialogDescription>以 {user?.displayName || user?.username} 的身份进入产品。操作会真实生效，权限和扣费与该用户一致。</DialogDescription>
      </DialogHeader>
      <label className="grid gap-2 text-sm">选择产品
        <select aria-label="选择产品" className="rounded-md border bg-background p-2" value={product} onChange={e => setProduct(e.target.value)} disabled={busy}>
          {PRODUCTS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>取消</Button>
        <Button onClick={() => void login()} disabled={busy}>{busy ? "正在登录…" : "登录用户账号"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
