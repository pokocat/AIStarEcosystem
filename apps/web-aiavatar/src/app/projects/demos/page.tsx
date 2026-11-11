"use client";

// 官方内容运营后台 —— 「保存为官方内容」发出去的那些东西的管理面（v0.192）。
//
// 为什么要有这一页：发布端点做好了、下线端点也做好了，但下线**没有任何前端调用方**
// （v0.159 那类死代码：编译绿、typecheck 绿，就是没人挂）。于是上线一条不合适的示例之后，
// 产品内没有任何办法把它撤下来。顺带这一页解决另外三件：
//   · 目录接口只查 enabled=true → 下线之后哪儿都看不见，想重新上线只能自己记住 demoId；
//   · 发布不传 demoId 就永远新建 → 同一张画布存两次 = 两张一样的卡，还删不掉；
//   · sortOrder 有字段没人能设，恒为 0 —— 而「新建画布」那一排是新用户的第一印象。
//
// 放在 web-aiavatar 而不是 apps/admin：发布这个动作本来就发生在画布顶栏，管理跟它放一起
// 才是同一条链（同 v0.73 短剧配方审核「在 web-drama 运营后台不进 admin」的先例）。

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Pencil, RefreshCw, Trash2,
} from "lucide-react";
import { ConfigProvider, Modal } from "antd";
import { StudioPage } from "@/ip/studio-page";
import type { IpDemoAdmin } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useIdentity, isSuperAdminRole, isOperatorRole } from "@/proto/api";
import { IpStudioApi } from "@/ip/api";
import { ToastProvider, useToast } from "@/ip/common/toast";
import { reportStudioError } from "@/ip/studio-errors";
import { formatDateTime } from "@/lib/datetime";

function DemosPageInner() {
  const { toast } = useToast();
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const authState = useRequireAuth();
  const identity = useIdentity();
  const isOperator = isOperatorRole(identity?.operatorRole);
  // 删除要超管（不可逆、没有回收站）；看 / 改 / 下线是运营。服务端才是真闸，
  // 这里只决定按钮显不显示 —— 藏起来的按钮不是权限。
  const canDelete = isSuperAdminRole(identity?.operatorRole);

  const [rows, setRows] = React.useState<IpDemoAdmin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<IpDemoAdmin | null>(null);
  const [draft, setDraft] = React.useState({ name: "", summary: "", sortOrder: 0 });
  const [pendingDelete, setPendingDelete] = React.useState<IpDemoAdmin | null>(null);
  // 请求序号：连点刷新时慢的那次不能覆盖快的那次（v0.155 同一类）
  const reqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await IpStudioApi.listDemosForAdmin();
      if (seq !== reqRef.current) return;
      setRows(list);
    } catch (e) {
      if (seq !== reqRef.current) return;
      setLoadError(e instanceof Error ? e.message : "官方内容加载失败，请稍后刷新重试。");
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (authState !== "ok" || !isOperator) return;
    void load();
  }, [authState, isOperator, load]);

  const toggle = async (row: IpDemoAdmin) => {
    setBusy(row.id);
    try {
      await IpStudioApi.setDemoEnabled(row.id, !row.enabled);
      // 作废在途的列表请求：慢的那次 GET 若在这之后返回，会把刚改的状态盖回旧值
      reqRef.current++;
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)));
      toast(row.enabled ? `「${row.name}」已下线` : `「${row.name}」已重新上线`, "ok");
    } catch (e) {
      // 操作没做成弹错误弹窗（原因、下一步、错误详情），不只是底部一条提示
      reportStudioError(e, { action: `${row.enabled ? "下线" : "上线"}「${row.name}」` });
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = draft.name.trim();
    if (!name) return;
    setBusy(editing.id);
    try {
      await IpStudioApi.updateDemo(editing.id, {
        name,
        summary: draft.summary.trim(),
        sortOrder: draft.sortOrder,
      });
      setEditing(null);
      await load();   // 排序变了要重排，就地改字段不够
      toast("已保存", "ok");
    } catch (e) {
      reportStudioError(e, { action: `保存「${editing.name}」的修改` });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(pendingDelete.id);
    try {
      const res = await IpStudioApi.deleteDemo(pendingDelete.id);
      reqRef.current++;   // 作废在途的列表请求，别让旧响应把删掉的这条插回来
      setRows((list) => list.filter((r) => r.id !== pendingDelete.id));
      // 素材清理是 best-effort，失败会被后端吞掉并照样返回成功 —— 所以按**它报回来的数字**
      // 说话。说「素材副本已删除」而实际一个都没删，是假成功（§8.0）。
      toast(
        res.assetsFailed > 0
          ? `「${pendingDelete.name}」已删除，${res.assetsFailed} 个素材未能清理，需运维在存储中手动删除。`
          : `「${pendingDelete.name}」及其素材副本（${res.assetsRemoved} 个）已删除`,
        res.assetsFailed > 0 ? "warn" : "ok",
      );
      setPendingDelete(null);
    } catch (e) {
      reportStudioError(e, { action: `删除「${pendingDelete.name}」` });
    } finally {
      setBusy(null);
    }
  };

  if (authState === "no-platform") return <PlatformGateScreen />;
  if (authState !== "ok") return null;

  if (!isOperator) {
    return <StudioPage title="官方内容管理" description="管理发布到灵感与创作入口的官方内容。" className="studio-demo-admin">
      <div className="studio-demo-state"><p>此页面仅平台运营可访问。</p><Link className="ip-brand-secondary" href="/projects">返回项目</Link></div>
    </StudioPage>;
  }

  const templates = rows.filter((r) => r.kind === "template");
  const examples = rows.filter((r) => r.kind !== "template");

  return (
    <StudioPage title="官方内容管理" description="管理工作流模板与官方示例的展示信息、排序和上线状态。" className="studio-demo-admin" contentRef={surfaceRef} actions={<>
      <Link className="ip-brand-secondary" href="/templates"><ArrowLeft size={16} aria-hidden="true"/>返回灵感</Link>
      <button type="button" className="ip-brand-secondary" onClick={() => void load()} disabled={loading}>
        {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true"/> : <RefreshCw size={16} aria-hidden="true"/>}刷新
      </button>
    </>}>
      <p className="studio-demo-note">下线后用户将看不到此内容，可随时重新上线。删除将清理素材副本，且无法恢复；已复制到用户画布的内容不受影响。</p>
      {loading && <div className="studio-demo-state" role="status"><Loader2 size={20} className="animate-spin" aria-hidden="true"/><p>正在加载官方内容…</p></div>}
      {loadError && <div className="studio-demo-state is-error" role="alert"><AlertCircle size={20} aria-hidden="true"/><p>{loadError}</p><button type="button" className="ip-brand-secondary" onClick={() => void load()}>重试</button></div>}
      {!loading && !loadError && rows.length === 0 && <div className="studio-demo-state"><p>还没有官方内容。</p><p>在画布右上角「⋯」中选择「保存为官方内容」，发布后将显示在这里。</p></div>}
      <Group title="工作流模板" hint="用于新建画布，用户使用时将复制到自己的画布。" rows={templates}
        {...{ busy, canDelete, toggle, setEditing, setDraft, setPendingDelete }} />
      <Group title="官方示例" hint="包含素材和成品，用户使用时将复制到自己的画布。" rows={examples}
        {...{ busy, canDelete, toggle, setEditing, setDraft, setPendingDelete }} />

      {/* 编辑：只改展示信息。种类不给改 —— 模板与实例的区别是文档里有没有素材，
          光改一个标签只会得到「标着模板、内容却带素材」。 */}
      <Modal
        open={editing !== null}
        title="编辑展示信息"
        onCancel={() => setEditing(null)}
        onOk={() => void saveEdit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={busy === editing?.id}
        okButtonProps={{ disabled: !draft.name.trim() }}
        getContainer={() => surfaceRef.current ?? document.body}
      >
        <div className="studio-demo-form">
          <Field label="名称">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="studio-demo-field"
              placeholder="用户看到的名称"
            />
          </Field>
          <Field label="一句话说明">
            <input
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              className="studio-demo-field"
              placeholder="选填，例如：一张照片生成多角度人物设定图"
            />
          </Field>
          <Field label="排序" hint="数字越小越靠前，相同时按发布时间排序">
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))}
              className="studio-demo-field"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title={`删除「${pendingDelete?.name ?? ""}」？`}
        onCancel={() => setPendingDelete(null)}
        onOk={() => void confirmDelete()}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: busy === pendingDelete?.id }}
        getContainer={() => surfaceRef.current ?? document.body}
      >
        <p className="studio-demo-delete-note">
          此内容及其 {pendingDelete?.assetCount ?? 0} 个素材副本将一并删除，<b>无法恢复</b>。
          <br />
          已用它创建的用户画布不受影响。
          <br />
          如只需对用户隐藏，可选择<b>下线</b>，之后可随时重新上线。
        </p>
      </Modal>
    </StudioPage>
  );
}

function Group({
  title, hint, rows, busy, canDelete, toggle, setEditing, setDraft, setPendingDelete,
}: {
  title: string;
  hint: string;
  rows: IpDemoAdmin[];
  busy: string | null;
  canDelete: boolean;
  toggle: (row: IpDemoAdmin) => void | Promise<void>;
  setEditing: (row: IpDemoAdmin) => void;
  setDraft: (d: { name: string; summary: string; sortOrder: number }) => void;
  setPendingDelete: (row: IpDemoAdmin) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="studio-demo-group" aria-label={title}>
      <header className="studio-demo-group-heading"><h2>{title}<span>{rows.length}</span></h2><p>{hint}</p></header>
      <ul className="studio-demo-list">
        {rows.map((row) => (
          <li key={row.id} className="studio-demo-row" data-enabled={row.enabled}>
            <div className="studio-demo-cover">{row.coverVideoUrl ? (
              <video src={`${row.coverVideoUrl}#t=0.1`} preload="metadata" muted playsInline aria-label="视频封面" />
            ) : row.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.coverUrl} alt="" loading="lazy" />
            ) : <span>无封面</span>}</div>
            <div className="studio-demo-info">
              <div className="studio-demo-title"><h3 title={row.name}>{row.name}</h3><span className="studio-demo-status" data-enabled={row.enabled}>{row.enabled ? "已上线" : "已下线"}</span></div>
              <p className="studio-demo-summary" title={row.summary || undefined}>{row.summary || "暂无说明"}</p>
              <div className="studio-demo-meta"><span>{row.nodeCount} 个节点</span><span>{row.assetCount} 个素材</span><span>排序 {row.sortOrder}</span><time>{formatDateTime(row.updatedAt ?? row.createdAt)}</time></div>
              <p className="studio-demo-id" title={row.id}>{row.id}</p>
            </div>
            <div className="studio-demo-actions" role="group" aria-label={`${row.name}的操作`}>
              <IconBtn label="编辑" onClick={() => { setDraft({ name: row.name, summary: row.summary, sortOrder: row.sortOrder }); setEditing(row); }}><Pencil size={16} /></IconBtn>
              <IconBtn label={row.enabled ? "下线" : "重新上线"} busy={busy === row.id} onClick={() => void toggle(row)}>{row.enabled ? <EyeOff size={16} /> : <Eye size={16} />}</IconBtn>
              {canDelete && <IconBtn label="删除" danger onClick={() => setPendingDelete(row)}><Trash2 size={16} /></IconBtn>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IconBtn({
  label, onClick, children, danger, busy,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={label}
      aria-label={label}
      className="studio-demo-action"
      data-danger={danger || undefined}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="studio-demo-form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function DemosAdminPage() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#192229", borderRadius: 8, fontFamily: "var(--ip-ui, sans-serif)" } }}><ToastProvider>
      <DemosPageInner />
    </ToastProvider></ConfigProvider>
  );
}
