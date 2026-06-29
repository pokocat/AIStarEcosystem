"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 支付配置（v0.94 多渠道直连）
// 支付宝 / 微信渠道启用 + 机密运行时可配；多渠道并存，用户收银台自选。
// 机密永不明文回显（脱敏展示），留空=保留原值。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/feedback";
import { PaymentConfigApi } from "@/api";
import {
  PAYMENT_CRED_FIELDS,
  PAYMENT_WAY_OPTIONS,
  type PaymentChannelConfig,
} from "@/types/payment-config";

export default function AdminPaymentConfigPage() {
  const toast = useToast();
  const [list, setList] = React.useState<PaymentChannelConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await PaymentConfigApi.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="支付配置"
        description="支付宝 / 微信支付渠道启用 + 商户机密配置。多渠道并存，用户在收银台自选。机密加密落库、不回显明文（留空=保留原值）。"
      />
      {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
      {err && <div className="text-sm text-destructive">{err}</div>}
      {!loading &&
        !err &&
        list.map((ch) => (
          <ChannelCard key={ch.code} channel={ch} onSaved={refresh} toast={toast} />
        ))}
    </div>
  );
}

function ChannelCard({
  channel,
  onSaved,
  toast,
}: {
  channel: PaymentChannelConfig;
  onSaved: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}) {
  const fields = PAYMENT_CRED_FIELDS[channel.code] ?? [];
  const ways = PAYMENT_WAY_OPTIONS[channel.code] ?? [];
  const [enabled, setEnabled] = React.useState(channel.enabled);
  const [sandbox, setSandbox] = React.useState(channel.sandbox);
  const [defaultWayCode, setDefaultWayCode] = React.useState(channel.defaultWayCode);
  // 机密输入：留空提交即保留原值；占位显示脱敏旧值
  const [creds, setCreds] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  async function onSave() {
    setBusy(true);
    try {
      const filled = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim() !== ""));
      await PaymentConfigApi.update(channel.code, {
        enabled,
        sandbox,
        defaultWayCode,
        creds: filled,
      });
      setCreds({});
      await onSaved();
      toast.success({ title: `${channel.label} 已保存` });
    } catch (e) {
      toast.danger({ title: "保存失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    try {
      const r = await PaymentConfigApi.test(channel.code);
      if (r.ready) toast.success({ title: `${channel.label}：${r.message}` });
      else toast.warning({ title: `${channel.label}：${r.message}` });
    } catch (e) {
      toast.danger({ title: "自检失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          {channel.label}
          {channel.configured ? (
            <Badge tone="success" className="font-normal">已配置</Badge>
          ) : (
            <Badge tone="neutral" className="font-normal">未配置</Badge>
          )}
          {channel.enabled ? (
            <Badge tone="success" className="font-normal">已启用</Badge>
          ) : (
            <Badge tone="neutral" className="font-normal">已停用</Badge>
          )}
          {channel.sandbox && <Badge tone="warning" className="font-normal">沙箱</Badge>}
        </CardTitle>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} /> 启用
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={sandbox} onCheckedChange={setSandbox} /> 沙箱
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-medium">默认支付方式</div>
          <select
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
            value={defaultWayCode}
            onChange={(e) => setDefaultWayCode(e.target.value)}
          >
            {ways.map((w) => (
              <option key={w.code} value={w.code}>
                {w.label}（{w.code}）
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((f) => {
            const masked = channel.creds[f.key];
            const placeholder = masked ? `已配置：${masked}（留空保留）` : f.required ? "必填" : "可空";
            return (
              <div key={f.key} className={f.multiline ? "md:col-span-2" : ""}>
                <div className="mb-1 text-sm font-medium">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </div>
                {f.multiline ? (
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                    placeholder={placeholder}
                    value={creds[f.key] ?? ""}
                    onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    placeholder={placeholder}
                    value={creds[f.key] ?? ""}
                    onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void onSave()} disabled={busy}>
            保存
          </Button>
          <Button variant="outline" onClick={() => void onTest()} disabled={busy}>
            自检
          </Button>
          {channel.updatedBy && (
            <span className="text-xs text-muted-foreground">
              最后修改：{channel.updatedBy}
              {channel.updatedAt ? ` · ${new Date(channel.updatedAt).toLocaleString("zh-CN")}` : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
