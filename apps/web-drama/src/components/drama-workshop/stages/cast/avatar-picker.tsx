"use client";

// 数字人选择器 —— 从「我的数字人」(AiAvatar / DapAvatars) 真实列表里为角色绑定形象。
import * as React from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { DapAvatarsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";
import { aiErrorMessage } from "@/lib/ai-error";
import type { CharacterDef } from "@/mocks/drama-workshop";

export interface BoundAvatar {
  id: string;
  name: string;
  image: string;
}

interface AvatarPickerProps {
  char: CharacterDef;
  onClose: () => void;
  onConfirm: (charId: string, picked: BoundAvatar) => void;
}

export function AvatarPicker({ char, onClose, onConfirm }: AvatarPickerProps) {
  const [list, setList] = React.useState<DapAvatarLite[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    DapAvatarsApi.listMyDapAvatars()
      .then((r) => alive && setList(r))
      .catch((e) => alive && setErr(aiErrorMessage(e, "数字人列表加载失败，请稍后重试")));
    return () => {
      alive = false;
    };
  }, []);

  const cur = list?.find((a) => a.id === sel) ?? null;
  const confirm = () => {
    if (!cur) return;
    onConfirm(char.id, { id: cur.id, name: cur.name, image: cur.imageUrl ?? "" });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 620, maxWidth: "94vw", maxHeight: "82vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", flex: "none", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>为「{char.name}」绑定数字人</div>
            <div className="faint" style={{ fontSize: 12 }}>从「我的数字人」中选一个，跨集形象一致</div>
          </div>
          <div className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="scroll" style={{ padding: 20, minHeight: 0 }}>
          {err ? (
            <div className="muted" style={{ fontSize: 13 }}>{err}</div>
          ) : !list ? (
            <div className="row gap-2 faint" style={{ fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "drama-spin .7s linear infinite" }} /> 加载中…
            </div>
          ) : list.length === 0 ? (
            <div className="col center" style={{ padding: "30px 10px", gap: 8, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: 13, maxWidth: 320 }}>你还没有数字人。去 AiAvatar 创建数字人后，即可在这里绑定为角色形象。</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSel(a.id)}
                  className="col"
                  style={{
                    border: sel === a.id ? "2px solid var(--accent)" : "2px solid transparent",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--surface-2)",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                    gap: 0,
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "3/4", background: a.imageUrl ? `center/cover no-repeat url(${a.imageUrl})` : "linear-gradient(135deg,var(--surface-3),var(--surface-2))" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 8px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row gap-3" style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", flex: "none", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-grad" disabled={!cur} style={{ opacity: cur ? 1 : 0.5 }} onClick={confirm}>
            <Sparkles size={15} fill="currentColor" strokeWidth={0} /> 锁定{cur ? ` ${cur.name}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
