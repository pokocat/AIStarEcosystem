"use client";

// 官方内容运营后台 —— 「存为官方内容」发出去的那些东西的管理面（v0.192）。
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
import { Modal } from "antd";
import type { IpDemoAdmin } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useIdentity, isSuperAdminRole, isOperatorRole } from "@/proto/api";
import { IpStudioApi } from "@/ip/api";
import { ToastProvider, useToast } from "@/ip/common/toast";
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
      setLoadError(e instanceof Error ? e.message : "没加载出来，刷新页面再试");
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
      toast(row.enabled ? `「${row.name}」已下线，用户看不到了` : `「${row.name}」已重新上线`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "没成功，再试一次", "warn");
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
      toast(e instanceof Error ? e.message : "没存上，再试一次", "warn");
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
          ? `「${pendingDelete.name}」已删除，但有 ${res.assetsFailed} 个素材没清掉，要运维去存储里手动删`
          : `「${pendingDelete.name}」及其素材副本（${res.assetsRemoved} 个）已删除`,
        res.assetsFailed > 0 ? "warn" : "ok",
      );
      setPendingDelete(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "没删掉，再试一次", "warn");
    } finally {
      setBusy(null);
    }
  };

  if (authState === "no-platform") return <PlatformGateScreen />;
  if (authState !== "ok") return null;

  if (!isOperator) {
    return (
      <div className="ip-surface max-w-6xl mx-auto px-6 py-16 text-center">
        <p className="text-[14px]" style={{ color: "var(--ink-2)" }}>这一页只有平台运营能看。</p>
        <Link href="/projects" className="inline-block mt-4 text-[13px]" style={{ color: "var(--primary)" }}>
          ← 回到自由画布
        </Link>
      </div>
    );
  }

  const templates = rows.filter((r) => r.kind === "template");
  const examples = rows.filter((r) => r.kind !== "template");

  return (
    <div ref={surfaceRef} className="ip-surface max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-[12px] mb-2"
            style={{ color: "var(--ink-3)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 自由画布
          </Link>
          <h1 className="asset-name text-[24px]" style={{ color: "var(--ink)" }}>官方内容管理</h1>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            画布顶栏「存为官方内容」发出去的都在这里。
            <b>模板</b>进「新建画布」那一排，只给节点和提示词；
            <b>示例</b>进画布列表，素材成图一起给。
            下线随时能撤回；删除会把素材副本一起清掉，删了找不回来。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12.5px] disabled:opacity-60"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          刷新
        </button>
      </div>

      {loadError && (
        <div
          className="ledger-card p-4 mb-6 flex items-start gap-2.5"
          style={{ borderColor: "var(--err, #b4483c)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--err, #b4483c)" }} />
          <div className="min-w-0">
            <p className="text-[13px]" style={{ color: "var(--ink)" }}>{loadError}</p>
            <button type="button" onClick={() => void load()} className="mt-1.5 text-[12.5px]" style={{ color: "var(--primary)" }}>
              重试
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className="ledger-card p-8 text-center">
          <p className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>还没发过官方内容。</p>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--ink-3)" }}>
            在一张做好的画布里点顶栏「存为官方内容」，就会出现在这里。
          </p>
        </div>
      )}

      <Group title="工作流模板" hint="进「新建画布」那一排。只有节点和提示词，素材不跟着走。" rows={templates}
        {...{ busy, canDelete, toggle, setEditing, setDraft, setPendingDelete }} />
      <Group title="官方示例" hint="进画布列表。素材成图都在，用户点开是复制一份到自己那儿。" rows={examples}
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
        <div className="grid gap-3 pt-1">
          <Field label="名字">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              style={FIELD}
              placeholder="别人看到的名字"
            />
          </Field>
          <Field label="一句话说明">
            <input
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              style={FIELD}
              placeholder="选填。写清楚这套工作流能做出什么"
            />
          </Field>
          <Field label="排序" hint="数字小的排前面，一样大的按发布时间">
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))}
              style={FIELD}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title={`删除「${pendingDelete?.name ?? ""}」`}
        onCancel={() => setPendingDelete(null)}
        onOk={() => void confirmDelete()}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: busy === pendingDelete?.id }}
        getContainer={() => surfaceRef.current ?? document.body}
      >
        <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.7 }}>
          这条内容和它那份素材副本（{pendingDelete?.assetCount ?? 0} 个）会一起删掉，<b>不可恢复</b>。
          <br />
          已经拿它建过画布的用户不受影响 —— 那些是各自复制的一份。
          <br />
          只是想让别人看不到的话，<b>下线</b>就够了，随时能再打开。
        </p>
      </Modal>
    </div>
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
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="asset-name text-[18px]" style={{ color: "var(--ink)" }}>{title}</h2>
        <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{hint}</span>
      </div>
      <div className="grid gap-2.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="ledger-card p-3 flex items-center gap-3"
            style={{ opacity: row.enabled ? 1 : 0.55 }}
          >
            {row.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.coverUrl} alt="" loading="lazy"
                className="w-[56px] h-[42px] object-cover rounded-[7px] shrink-0"
                style={{ background: "var(--surface-2)" }} />
            ) : (
              <div className="w-[56px] h-[42px] rounded-[7px] shrink-0 grid place-items-center text-[10px]"
                style={{ background: "var(--surface-2)", color: "var(--ink-4, var(--ink-3))" }}>
                无封面
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="asset-name text-[15px] truncate" style={{ color: "var(--ink)" }} title={row.name}>
                  {row.name}
                </h3>
                {!row.enabled && (
                  <span className="shrink-0 inline-flex items-center px-1.5 h-[17px] rounded-full text-[10px] font-bold"
                    style={{ background: "var(--surface-3, #eef0f5)", color: "var(--ink-3)" }}>
                    已下线
                  </span>
                )}
              </div>
              <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--ink-3)" }}
                title={row.summary || undefined}>
                {row.summary || "（没写说明）"}
              </p>
              {/* 概览数字：判断「这条是不是空的 / 是不是那条重复的」，不用点进去看 */}
              <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--ink-3)" }}>
                {row.id} · {row.nodeCount} 个节点 · {row.assetCount} 个素材 · 排序 {row.sortOrder} · {formatDateTime(row.updatedAt ?? row.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <IconBtn label="编辑" onClick={() => { setDraft({ name: row.name, summary: row.summary, sortOrder: row.sortOrder }); setEditing(row); }}>
                <Pencil className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn
                label={row.enabled ? "下线" : "重新上线"}
                busy={busy === row.id}
                onClick={() => void toggle(row)}
              >
                {row.enabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </IconBtn>
              {canDelete && (
                <IconBtn label="删除（连素材，不可恢复）" danger onClick={() => setPendingDelete(row)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconBtn>
              )}
            </div>
          </div>
        ))}
      </div>
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
      className="grid place-items-center w-7 h-7 rounded-[7px] transition disabled:opacity-50"
      style={{
        background: "var(--surface-2)",
        color: danger ? "var(--err, #b4483c)" : "var(--ink-2)",
      }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : children}
    </button>
  );
}

/** 与画布顶栏那个「存为官方内容」弹窗同一套（ip/canvas-host.tsx 的 DEMO_FIELD）——
 *  同一件事的两个界面，输入框长得一样。 */
const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px",
  border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
  background: "var(--surface)", color: "var(--ink)",
  fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
        {label}
        {hint && <span className="ml-2 font-normal" style={{ color: "var(--ink-3)" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function DemosAdminPage() {
  return (
    <ToastProvider>
      <DemosPageInner />
    </ToastProvider>
  );
}
