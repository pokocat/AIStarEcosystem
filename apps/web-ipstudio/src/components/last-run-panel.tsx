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
        className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold transition hover:brightness-95 max-w-[200px]"
        style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
        title="看这次实际发给模型的提示词和参考图"
      >
        <FileText className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          上次发给模型{last.refs.length ? ` · 参考图 ${applied}/${last.refs.length}` : ""}
        </span>
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        title="上次实际发给模型的内容"
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
                      {r.applied ? " —— 已送给模型" : ` —— 没用上${r.reason ? `（${r.reason}）` : ""}`}
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
            {last.prompt || "（这次运行没有留下提示词）"}
          </pre>
          <p className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
            你写的那段在中间，前后是系统按模板补的构图与负面词。参考图决定「像谁」，
            提示词里对长相、发型、穿着的描述会覆盖参考图里的对应部分 ——
            想保留参考图的样子，就别在提示词里把它重新描述一遍。
          </p>
        </div>
      </Modal>
    </>
  );
}
