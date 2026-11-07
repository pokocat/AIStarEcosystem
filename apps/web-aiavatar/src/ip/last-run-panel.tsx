"use client";

// 顶栏的「上次发给模型」—— 把最近一次出图的真实提示词与参考图生效情况摊开给用户看。
//
// 这是排查「出的图不像参考图」唯一有用的入口：用户写的那段只是最终提示词的一部分，
// 参考图也可能因为读不到被跳过。看不到这两样，就只能靠反复重跑去猜。

import * as React from "react";
import { Modal } from "antd";
import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { useLastRun } from "@/canvas-bridge/last-run";

export function LastRunPanel() {
  const last = useLastRun((s) => s.last);
  const [open, setOpen] = React.useState(false);
  if (!last) return null;

  const applied = last.refs.filter((r) => r.applied).length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ip-canvas-last-run studio-host-more-item"
        title="查看实际发送给模型的提示词和参考图"
        aria-label="上次发给模型"
      >
        <FileText aria-hidden="true" />
        <span className="truncate">
          上次发给模型{last.refs.length ? ` · 参考图 ${applied}/${last.refs.length}` : ""}
        </span>
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        title="上次实际发送给模型的内容"
      >
        <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          运行号 {last.id}
          {last.size ? ` · 画幅 ${last.size}` : ""}
          {last.count ? ` · ${last.count} 张` : ""}
        </div>

        {last.refs.length > 0 && (
          <div className="mt-3">
            <div className="text-[13px] font-bold mb-1.5">参考图</div>
            <ul className="space-y-1">
              {last.refs.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12.5px]">
                  {r.applied ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-[1px]" style={{ color: "var(--ok)" }} />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 mt-[1px]" style={{ color: "var(--err)" }} />
                  )}
                  <span className="min-w-0">
                    图 {i + 1} · {r.note}
                    <span style={{ color: "var(--ink-3)" }}>
                      {r.applied ? " · 已发送" : ` · 未使用${r.reason ? `（${r.reason}）` : ""}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <div className="text-[13px] font-bold mb-1.5">完整提示词</div>
          <pre
            className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words rounded-lg p-3 max-h-[46vh] overflow-auto"
            style={{ background: "var(--surface-2)", color: "var(--ink-1)" }}
          >
            {last.prompt || "（本次运行未记录提示词）"}
          </pre>
          <p className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
            你写的内容在中间，前后是系统按模板补充的构图与负面词。参考图决定人物长相，
            提示词中对长相、发型、穿着的描述会覆盖参考图的对应部分。
            如需保留参考图的样子，请勿在提示词中重新描述。
          </p>
        </div>
      </Modal>
    </>
  );
}
