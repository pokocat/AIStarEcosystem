"use client";

// 发布对话框 —— 选主形象节点 + 勾选要一起带上的造型 + 资产名；
// 成功后展示 DH- 编号与「去数字资产平台查看」。

import * as React from "react";
import { AlertTriangle, Check, CheckCircle2, ExternalLink, IdCard, Loader2, Send } from "lucide-react";
import type { IpNode, IpPublishResult } from "@ai-star-eco/types";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { currentProjectId } from "@/canvas-bridge/api";
import { AIAVATAR_URL } from "@/lib/external";
import { AssetsApi } from "@/api";
import { Field, TextInput } from "./fields";



/** 这个节点当前显示的那张图 —— 发布弹窗里的缩略图。 */
function thumbOf(node: CanvasNodeData): string | undefined {
  const md = node.metadata;
  if (!md) return undefined;
  const primary = md.images?.find((i) => i.id === md.primaryImageId) ?? md.images?.[0];
  return primary?.content || md.content || undefined;
}

/** 造型名就是节点标题 —— 用户在画布上给这张图起的名字。 */
function lookTitleFor(node: CanvasNodeData): string {
  const t = (node.title || "").trim();
  return t || "未命名造型";
}

export function PublishDialog({
  open, onOpenChange, onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (payload: { avatarName: string; masterNodeId: string; lookNodeIds: string[] }) => Promise<IpPublishResult>;
}) {
  const projectId = currentProjectId();
  const project = useCanvasStore((s) => s.projects.find((p) => p.id === projectId));
  const projectName = project?.title ?? "";

  /** 能发布的 = 画布上**已经出好图**的图节点。没有图的发布出去是空壳资产。 */
  const ready = React.useMemo(
    () => (project?.nodes ?? []).filter(
      (n) => n.type === "image" && Boolean(n.metadata?.storageKey || n.metadata?.images?.length),
    ),
    [project?.nodes],
  );

  const defaultMaster = React.useMemo(() => ready[0]?.id ?? "", [ready]);

  const [masterNodeId, setMasterNodeId] = React.useState(defaultMaster);
  const [lookIds, setLookIds] = React.useState<string[]>([]);
  const [avatarName, setAvatarName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<IpPublishResult | null>(null);
  const [cardBusy, setCardBusy] = React.useState(false);
  const [cardError, setCardError] = React.useState<string | null>(null);

  /**
   * 建草稿 → 直接把人送到名片编辑页去填联系方式。
   *
   * 新开一个标签页而不是当前页跳走：画布还开着，用户可能只是顺手做张名片。
   * 弹窗按钮触发的 window.open 一般不会被拦，被拦了也如实说，不装作成功。
   */
  const makeCard = async () => {
    if (!result) return;
    setCardBusy(true);
    setCardError(null);
    try {
      const card = await AssetsApi.createCardFromAvatar(result.avatarId);
      const win = window.open(`${AIAVATAR_URL}/cards`, "_blank", "noopener");
      if (!win) setCardError(`名片已建好（${card.regNo}），浏览器拦了新窗口，去数字资产平台的「我的名片」里填联系方式`);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "建卡没成功，稍后再试");
    } finally {
      setCardBusy(false);
    }
  };

  // 每次打开都按当前画布重置
  React.useEffect(() => {
    if (!open) return;
    const master = ready[0]?.id ?? "";
    setMasterNodeId(master);
    setLookIds(ready.filter((g) => g.id !== master).map((g) => g.id));
    setAvatarName(projectName || "");
    setError(null);
    setResult(null);
    setSubmitting(false);
  }, [open, ready, projectName]);

  const toggleLook = (id: string) => {
    setLookIds((list) => (list.includes(id) ? list.filter((i) => i !== id) : [...list, id]));
  };

  const submit = async () => {
    if (!avatarName.trim()) {
      setError("给这个形象起个名字，发布后在资产库里就用它。");
      return;
    }
    if (!masterNodeId) {
      setError("先在画布上给主形象选一张定稿图，才能发布。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await onPublish({
        avatarName: avatarName.trim(),
        masterNodeId,
        lookNodeIds: lookIds.filter((id) => id !== masterNodeId),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布没能完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5" style={{ color: "var(--ok)", width: 18, height: 18 }} />
                发布成功
              </DialogTitle>
              <DialogDescription>
                形象与造型已经登记进数字资产库，可以在各条业务线里引用了。
              </DialogDescription>
            </DialogHeader>
            <div className="p-3.5 rounded-xl" style={{ background: "var(--ok-soft)" }}>
              <div className="field-label mb-1" style={{ color: "var(--ok)" }}>数字人编号</div>
              <div className="text-[15px] font-bold mb-1" style={{ color: "var(--ok)", fontFamily: "var(--font-mono)" }}>
                {result.avatarId}
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--ok)" }}>
                含 {result.lookIds.length} 个造型
              </div>
            </div>
            {/* 做完形象紧接着最想做的事就是把它发出去 —— 名字和整柜造型都能自动带过去，
                用户只剩联系方式要填。这一步不给，人就得自己去另一个站从零建卡。 */}
            <div className="p-3.5 rounded-xl" style={{ background: "var(--primary-tint)" }}>
              <div className="text-[12.5px] leading-[1.7] mb-2.5" style={{ color: "var(--ink-2)" }}>
                可以直接做成一张 <b style={{ color: "var(--ink)" }}>数字名片</b> ——
                名字和这 {result.lookIds.length} 套造型自动带过去，访客能点着换装看，
                你只要再填联系方式。
              </div>
              <button
                onClick={makeCard}
                disabled={cardBusy}
                className="h-8 px-3.5 rounded-lg text-[12.5px] font-bold inline-flex items-center gap-1.5 transition hover:brightness-95 disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                {cardBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
                {cardBusy ? "建卡中" : "做成数字名片"}
              </button>
              {cardError && (
                <div className="mt-2 text-[12px]" style={{ color: "var(--err)", overflowWrap: "anywhere" }}>
                  {cardError}
                </div>
              )}
            </div>
            <DialogFooter>
              <a
                href={`${AIAVATAR_URL}/assets/${result.avatarId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12.5px] font-bold transition hover:brightness-95"
                style={{ background: "var(--action)", color: "var(--on-action)" }}
              >
                去数字资产平台查看 <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 rounded-lg text-[12.5px] font-semibold"
                style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}
              >
                留在画布
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>发布到数字资产库</DialogTitle>
              <DialogDescription>
                只有已经选好定稿图的形象才能发布。发布本身不花积分。
              </DialogDescription>
            </DialogHeader>

            {ready.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "var(--warn-soft)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                <p className="text-[12px] leading-relaxed min-w-0" style={{ color: "var(--warn)" }}>
                  还没有定稿的形象。先运行生成节点，在候选里点一张定稿，再回来发布。
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <Field label="资产名">
                  <TextInput
                    value={avatarName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAvatarName(e.target.value)}
                    placeholder="例如：小柚"
                  />
                </Field>

                <div>
                  <span className="field-label block mb-1.5">主形象（数字人本体）</span>
                  <div className="grid grid-cols-4 gap-2">
                    {ready.map((g) => {
                      const thumb = thumbOf(g);
                      const active = masterNodeId === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            setMasterNodeId(g.id);
                            setLookIds((list) => list.filter((id) => id !== g.id));
                          }}
                          className="relative rounded-lg overflow-hidden transition"
                          style={{
                            aspectRatio: "3/4",
                            border: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                            boxShadow: active ? "var(--shadow-ring)" : "none",
                            background: "var(--surface-3)",
                          }}
                          aria-pressed={active}
                          title={lookTitleFor(g)}
                        >
                          {thumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          )}
                          {active && (
                            <span
                              className="absolute bottom-1 right-1 rounded-full flex items-center justify-center"
                              style={{ background: "var(--primary)", width: 16, height: 16 }}
                            >
                              <Check className="w-2.5 h-2.5" style={{ color: "var(--on-primary)" }} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {ready.filter((g) => g.id !== masterNodeId).length > 0 && (
                  <div>
                    <span className="field-label block mb-1.5">一起带上的造型</span>
                    <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin pr-0.5">
                      {ready
                        .filter((g) => g.id !== masterNodeId)
                        .map((g) => {
                          const checked = lookIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              onClick={() => toggleLook(g.id)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition"
                              style={{
                                background: checked ? "var(--primary-tint)" : "var(--surface-2)",
                                border: `1px solid ${checked ? "var(--primary-soft)" : "var(--line-2)"}`,
                              }}
                              role="checkbox"
                              aria-checked={checked}
                            >
                              <span
                                className="shrink-0 w-4 h-4 rounded-md flex items-center justify-center"
                                style={{
                                  background: checked ? "var(--primary)" : "var(--surface)",
                                  border: `1px solid ${checked ? "var(--primary)" : "var(--line-3)"}`,
                                }}
                              >
                                {checked && <Check className="w-2.5 h-2.5" style={{ color: "var(--on-primary)" }} />}
                              </span>
                              <span className="text-[12px] font-semibold min-w-0 flex-1 truncate" style={{ color: "var(--ink)" }}>
                                {lookTitleFor(g)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-[12px] leading-relaxed px-3 py-2 rounded-lg" style={{ background: "var(--err-soft)", color: "var(--err)" }}>
                {error}
              </p>
            )}

            <DialogFooter>
              <button
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-9 px-4 rounded-lg text-[12.5px] font-semibold disabled:opacity-50"
                style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}
              >
                取消
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting || ready.length === 0}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12.5px] font-bold transition hover:brightness-95 disabled:opacity-60"
                style={{ background: "var(--action)", color: "var(--on-action)" }}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                确认发布
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
