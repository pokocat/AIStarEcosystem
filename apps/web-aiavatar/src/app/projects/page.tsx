"use client";

// 自由画布（原「项目」，v0.191 改名）—— 我的画布 + 从模板新建 + 空白画布。

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, Coins, Layers, Loader2, Plus, Sparkles, Trash2,
} from "lucide-react";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { USE_MOCK, isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { EnrollmentGate } from "@ai-star-eco/landing";
// 删除确认用 antd Modal 而不是 shadcn AlertDialog：本 app 明令不套用共享
// shadcn 设计系统（PRODUCT.md / DECISIONS.md），而画布整套已经在用 antd。
// 这也是搬进来时唯一一处真正用到 @ai-star-eco/ui 的地方，改掉它整个依赖就摘干净了。
import { Modal } from "antd";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "@/ip/api";
import { ToastProvider, useToast } from "@/ip/common/toast";
import { MockBadge } from "@/ip/common/mock-badge";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function ProjectsPageInner() {
  const router = useRouter();
  const { toast } = useToast();
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  // 并入前这一页在 ipstudio 的 AuthProvider 下，未登录会自动跳登录页。
  // 本 app 没挂那套 —— 不接这个闸的话 legacy 模式下 401 只会显示一句加载失败。
  const authState = useRequireAuth();
  const [templates, setTemplates] = React.useState<IpTemplate[]>([]);
  const [projects, setProjects] = React.useState<IpProjectSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = React.useState(false);
  const [creating, setCreating] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<IpProjectSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [tpl, list] = await Promise.all([IpStudioApi.listTemplates(), IpStudioApi.listProjects()]);
      setTemplates(tpl);
      setProjects(list);
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setLoadError(e instanceof Error ? e.message : "项目列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (authState !== "ok") return;
    void load();
  }, [load, authState]);

  const create = async (templateId?: string) => {
    setCreating(templateId ?? "blank");
    try {
      const project = await IpStudioApi.createProject(templateId ? { templateId } : {});
      router.push(`/projects/${project.id}`);
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else toast(e instanceof Error ? e.message : "新建失败，请重试", "warn");
      setCreating(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await IpStudioApi.deleteProject(pendingDelete.id);
      setProjects((list) => list.filter((p) => p.id !== pendingDelete.id));
      toast("项目已删除", "ok");
      setPendingDelete(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败，请重试", "warn");
    } finally {
      setDeleting(false);
    }
  };

  if (authState === "no-platform") return <PlatformGateScreen />;
  if (authState !== "ok") return null;

  if (notEnrolled) {
    return (
      <EnrollmentGate
        product="aiavatar"
        productLabel="数字资产平台"
        // 开通成功后要**同时**清掉 notEnrolled —— 只调 load() 的话这个状态一直是 true，
        // 用户开通完仍停在开通页，只能自己刷新（旧 AuthProvider 的 refreshMe 已随之删除）。
        onActivated={async () => { setNotEnrolled(false); await load(); }}
        theme={{
          bg: "var(--canvas)", surface: "var(--surface)", fg: "var(--ink)",
          fgMuted: "var(--ink-2)", accent: "var(--accent)", accentFg: "var(--accent-fg)",
          border: "var(--line-2)", radius: "15px",
        }}
      />
    );
  }

  return (
    // ip-surface：这一页整套视觉都用工作台那份令牌（ledger-card / asset-name /
    // --shadow-card / --primary-soft …）。不套作用域的话它们要么解析成空
    // （实测 --shadow-card 为空 → 卡片没有阴影），要么拿到 aiavatar 那套青色值。
    <div ref={surfaceRef} className="ip-surface max-w-6xl mx-auto px-6 py-8">
      {/* ── 新建 ── */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="asset-name text-[24px]" style={{ color: "var(--ink)" }}>开始一个 IP</h1>
            <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
              选一套内置工作流，节点已经排好，填照片就能跑；也可以从空白画布自己搭。
            </p>
          </div>
          {USE_MOCK && <MockBadge label="示例数据" />}
        </div>

        {loading && templates.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ledger-card h-[168px] animate-pulse" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => void create(t.id)}
                disabled={creating !== null}
                className="ledger-card text-left p-5 transition disabled:opacity-60 hover:-translate-y-0.5"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="field-label mb-1.5">工作流模板</div>
                    <h3 className="asset-name text-[18px] leading-tight" style={{ color: "var(--ink)" }}>{t.name}</h3>
                  </div>
                  <span
                    className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    {creating === t.id
                      ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary-700)" }} />
                      : <Sparkles className="w-4 h-4" style={{ color: "var(--primary-700)" }} />}
                  </span>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed line-clamp-2" style={{ color: "var(--ink-2)" }}>
                  {t.summary}
                </p>
                <div className="mt-4 flex items-center gap-3 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {t.lookCount} 个造型
                  </span>
                  <span className="inline-flex items-center gap-1 tabular">
                    <Coins className="w-3 h-3" /> 约 {t.estimatedCredits} 积分
                  </span>
                </div>
              </button>
            ))}

            <button
              onClick={() => void create()}
              disabled={creating !== null}
              className="text-left p-5 rounded-[15px] transition disabled:opacity-60 hover:-translate-y-0.5"
              style={{ border: "1px dashed var(--line-3)", background: "var(--surface-2)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="field-label mb-1.5">自由搭建</div>
                  <h3 className="asset-name text-[18px]" style={{ color: "var(--ink)" }}>空白画布</h3>
                </div>
                <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-3)" }}>
                  {creating === "blank"
                    ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--ink-2)" }} />
                    : <Plus className="w-4 h-4" style={{ color: "var(--ink-2)" }} />}
                </span>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                自己拖节点、自己连线。适合已经想清楚要什么的老手。
              </p>
            </button>
          </div>
        )}
      </section>

      {/* ── 我的项目 ── */}
      <section>
        <h2 className="asset-name text-[20px] mb-4" style={{ color: "var(--ink)" }}>我的画布</h2>

        {loadError ? (
          <div className="ledger-card p-8 text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--err)" }} />
            <p className="text-[13px] mb-4" style={{ color: "var(--ink-2)" }}>{loadError}</p>
            <button
              onClick={() => void load()}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold transition hover:brightness-95"
              style={{ background: "var(--action)", color: "var(--on-action)" }}
            >
              重新加载
            </button>
          </div>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ledger-card h-[210px] animate-pulse" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="ledger-card p-10 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>还没有 IP 项目</p>
            <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>从上面挑一套工作流模板，几分钟就能出第一组形象。</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="ledger-card overflow-hidden group">
                <Link href={`/projects/${p.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--surface-3)" }}>
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl} alt="" className="w-full h-full object-cover transition group-hover:scale-[1.02]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-6 h-6" style={{ color: "var(--ink-4)" }} />
                      </div>
                    )}
                    {USE_MOCK && p.coverUrl && (
                      <div className="absolute top-2 left-2"><MockBadge /></div>
                    )}
                    <span
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={p.status === "published"
                        ? { background: "var(--ok-soft)", color: "var(--ok)" }
                        : { background: "var(--img-chip)", color: "var(--ink)" }}
                    >
                      {p.status === "published" ? "已发布" : "草稿"}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="asset-name text-[17px] truncate" style={{ color: "var(--ink)" }} title={p.name}>
                      {p.name}
                    </h3>
                    <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="reg truncate" title={p.publishedAvatarId ? `资产编号 ${p.publishedAvatarId}` : undefined}>
                        {p.publishedAvatarId ?? "未发布"}
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--ink-3)" }}>{formatWhen(p.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center justify-between px-4 pb-3.5 -mt-1">
                  <Link
                    href={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold"
                    style={{ color: "var(--primary-700)" }}
                  >
                    打开画布 <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => setPendingDelete(p)}
                    className="p-1.5 rounded-lg transition hover:bg-[var(--err-soft)]"
                    title="删除项目"
                    aria-label={`删除项目 ${p.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={pendingDelete !== null}
        title="删除这个项目？"
        onCancel={() => setPendingDelete(null)}
        onOk={() => void confirmDelete()}
        okText={deleting ? "删除中…" : "确认删除"}
        cancelText="取消"
        okButtonProps={{ danger: true, loading: deleting }}
        cancelButtonProps={{ disabled: deleting }}
        // 删除在途时不给关：关掉也停不下已经发出的请求，用户只会以为没成功而重来一次
        mask={{ closable: !deleting }}   /* antd 6：maskClosable 已废弃（v0.159 踩过同一条） */
        keyboard={!deleting}
        closable={!deleting}
        // 容器要指到**本页**的作用域根，不能 querySelector(".ip-surface") ——
        // 第一个命中的是桌面顶栏那个 <header>，而它在手机上是 display:none，
        // 弹窗挂进去就整个看不见（手机上没法确认删除）。
        getContainer={() => surfaceRef.current ?? document.body}
      >
        <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.7 }}>
          「{pendingDelete?.name}」的画布与已生成的候选图都会一起移除。已发布成数字资产的形象不受影响。
        </p>
      </Modal>
    </div>
  );
}

// ToastProvider 在并入时漏挂了 —— `useToast()` 缺 Provider 会静默退化成空函数，
// 于是「新建失败」「删除失败」这些提示一条都不会出现（组件还在、依赖被删掉了）。
export default function ProjectsPage() {
  return (
    <ToastProvider>
      <ProjectsPageInner />
    </ToastProvider>
  );
}
