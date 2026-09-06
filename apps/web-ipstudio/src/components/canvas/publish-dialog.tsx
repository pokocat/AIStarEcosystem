"use client";

// 发布对话框 —— 选主形象节点 + 勾选要一起带上的造型 + 资产名；
// 成功后展示 DH- 编号与「去数字资产平台查看」。

import * as React from "react";
import { AlertTriangle, Check, CheckCircle2, ExternalLink, Loader2, Send } from "lucide-react";
import type { IpNode, IpPublishResult } from "@ai-star-eco/types";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { useCanvasStore } from "@/lib/canvas-store";
import { generateNodes } from "@/lib/graph";
import { resolveSelectedCandidate } from "@/lib/selection";
import { Field, TextInput } from "./inspector/fields";

const AIAVATAR_URL = process.env.NEXT_PUBLIC_AIAVATAR_URL ?? "http://localhost:3013";

function lookTitleFor(doc: ReturnType<typeof useCanvasStore.getState>["doc"], gen: IpNode & { type: "generate" }): string {
  const look = doc.edges
    .filter((e) => e.target === gen.id)
    .map((e) => doc.nodes.find((n) => n.id === e.source))
    .find((n) => n?.type === "look");
  if (look && look.type === "look" && look.data.title.trim()) return look.data.title;
  return gen.label || "未命名造型";
}

export function PublishDialog({
  open, onOpenChange, onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (payload: { avatarName: string; masterNodeId: string; lookNodeIds: string[] }) => Promise<IpPublishResult>;
}) {
  const doc = useCanvasStore((s) => s.doc);
  const runsById = useCanvasStore((s) => s.runsById);
  const projectName = useCanvasStore((s) => s.name);

  const gens = React.useMemo(() => generateNodes(doc), [doc]);
  const ready = React.useMemo(
    () => gens.filter((g) => resolveSelectedCandidate(g, runsById) !== null),
    [gens, runsById],
  );

  const defaultMaster = React.useMemo(
    () => ready.find((g) => g.data.isMaster)?.id ?? ready[0]?.id ?? "",
    [ready],
  );

  const [masterNodeId, setMasterNodeId] = React.useState(defaultMaster);
  const [lookIds, setLookIds] = React.useState<string[]>([]);
  const [avatarName, setAvatarName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<IpPublishResult | null>(null);

  // 每次打开都按当前画布重置
  React.useEffect(() => {
    if (!open) return;
    const master = ready.find((g) => g.data.isMaster)?.id ?? ready[0]?.id ?? "";
    setMasterNodeId(master);
    setLookIds(ready.filter((g) => g.id !== master).map((g) => g.id));
    const publishNode = doc.nodes.find((n) => n.type === "publish");
    setAvatarName(
      (publishNode?.type === "publish" && publishNode.data.avatarName) || projectName || "",
    );
    setError(null);
    setResult(null);
    setSubmitting(false);
  }, [open, ready, doc.nodes, projectName]);

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
            <DialogFooter>
              <a
                href={`${AIAVATAR_URL}/assets/${result.avatarId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12.5px] font-bold transition hover:opacity-90"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
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
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="例如：小柚"
                  />
                </Field>

                <div>
                  <span className="field-label block mb-1.5">主形象（数字人本体）</span>
                  <div className="grid grid-cols-4 gap-2">
                    {ready.map((g) => {
                      const sel = resolveSelectedCandidate(g, runsById);
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
                          title={lookTitleFor(doc, g)}
                        >
                          {sel && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sel.candidate.url} alt="" className="w-full h-full object-cover" />
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
                                {lookTitleFor(doc, g)}
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
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[12.5px] font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
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
