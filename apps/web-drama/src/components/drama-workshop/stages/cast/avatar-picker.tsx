"use client";

// 数字人选择器 —— 从「我的数字人」(AiAvatar / DapAvatars) 真实列表里为角色绑定形象。
// v0.197：短剧设定页的角色卡和逐集制作的角色面板共用这一个选择器（原地打开，不再把人踢回设定页）。
import * as React from "react";
import { ExternalLink, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { DapAvatarsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";
import { aiErrorMessage } from "@/lib/ai-error";
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { CharacterDef } from "@/mocks/drama-workshop";

export interface BoundAvatar {
  id: string;
  name: string;
  image: string;
}

/** 把选中的数字人写到某个角色上（两个入口共用同一份规则，§8.0.1 ④）。 */
export function bindAvatarToChars(chars: CharacterDef[], charId: string, picked: BoundAvatar): CharacterDef[] {
  // 不再写 refCount 默认值：之前绑完一律显示「参考图 ×3」，其实一张都没有。
  return chars.map((x) =>
    x.id === charId ? { ...x, bound: true, avatarId: picked.id, avatarImage: picked.image } : x,
  );
}

/**
 * 解绑数字人（主要角色改成配角时用）：去掉绑定标记和数字人那张图 / id，
 * 用户自己上传或让 AI 画的定妆照（refUrl / refCdnKey）和多角度参考图（refImages）原样留着。
 * v0.197 评审 WB8：之前只改 bound，avatarId / avatarImage 还在，服务端出图照样拿那张数字人的脸当参考。
 */
export function unbindAvatar(c: CharacterDef): CharacterDef {
  const { avatarId: _id, avatarImage: _img, ...rest } = c;
  void _id;
  void _img;
  return { ...rest, bound: false };
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
  const [reloadKey, setReloadKey] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(panelRef, onClose, true);

  React.useEffect(() => {
    let alive = true;
    setErr(null);
    DapAvatarsApi.listMyDapAvatars()
      .then((r) => alive && setList(r))
      .catch((e) => alive && setErr(aiErrorMessage(e, "数字人列表没加载出来，请稍后重试")));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = () => {
    setList(null);
    setReloadKey((k) => k + 1);
  };

  // 没有定妆照的数字人不能绑定；一个能绑的都没有时按「空」处理，给去 AiAvatar 的入口和刷新
  //（口径同数字演员页的引入弹窗 ImportAvatarDialog）。
  const usable = list?.filter((a) => !!a.imageUrl) ?? [];
  const drafts = (list?.length ?? 0) - usable.length;
  const cur = list?.find((a) => a.id === sel) ?? null;
  const confirm = () => {
    if (!cur || !cur.imageUrl) return;
    onConfirm(char.id, { id: cur.id, name: cur.name, image: cur.imageUrl });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`为「${char.name}」绑定数字人`}
        className="card pop-in col"
        style={{ width: 620, maxWidth: "100%", maxHeight: "82vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", flex: "none", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              为「{char.name}」绑定数字人
            </div>
            <div className="faint" style={{ fontSize: 12 }}>从你在 AiAvatar（数字人平台）建好的数字人里选一个，每一集都用这张脸</div>
          </div>
          <div className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} title="关闭" aria-label="关闭" style={{ flex: "none" }}>
            <X size={18} />
          </button>
        </div>

        <div className="scroll" style={{ padding: 20, minHeight: 0 }}>
          {err ? (
            <div className="col gap-2" style={{ alignItems: "flex-start" }}>
              <div className="muted" style={{ fontSize: 13 }}>{err}</div>
              <button type="button" className="btn btn-line btn-sm" onClick={reload}>
                <RefreshCw size={13} /> 重试
              </button>
            </div>
          ) : !list ? (
            <div className="row gap-2 faint" style={{ fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "drama-spin .7s linear infinite" }} /> 加载中…
            </div>
          ) : usable.length === 0 ? (
            <div className="col center" data-testid="avatar-picker-empty" style={{ padding: "24px 10px", gap: 12, textAlign: "center" }}>
              <div className="col" style={{ gap: 6, alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>还没有能绑定的数字人</div>
                <div className="muted" style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.6 }}>
                  {drafts > 0
                    ? `你有 ${drafts} 个数字人还没做定妆照，定妆照做好才能绑定。去 AiAvatar 补上，回这里点「我做好了，刷新」。`
                    : "先去 AiAvatar 做一个数字人（可以用真人照片复刻，也可以让 AI 生成）。定妆照做好后，回这里点「我做好了，刷新」。"}
                </div>
                <div className="faint" style={{ fontSize: 12, maxWidth: 420, lineHeight: 1.6 }}>
                  不用数字人也行：关掉这里，在角色卡上传照片，或者让 AI 画一张定妆照。
                </div>
              </div>
              <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <a className="btn btn-grad btn-sm" href={DapAvatarsApi.AIAVATAR_URL} target="_blank" rel="noopener noreferrer">
                  <Sparkles size={14} /> 去 AiAvatar 创建数字人 <ExternalLink size={12} />
                </a>
                <button type="button" className="btn btn-line btn-sm" onClick={reload}>
                  <RefreshCw size={13} /> 我做好了，刷新
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSel(a.id)}
                  className="col"
                  title={a.imageUrl ? a.name : `${a.name}（还没有定妆照，不能绑定）`}
                  style={{
                    border: sel === a.id ? "2px solid var(--accent)" : "2px solid transparent",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--surface-2)",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                    gap: 0,
                    minWidth: 0,
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "3/4", background: a.imageUrl ? `center/cover no-repeat url(${a.imageUrl})` : "linear-gradient(135deg,var(--surface-3),var(--surface-2))" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 8px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row gap-3" style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", flex: "none", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
          {cur && !cur.imageUrl && (
            <span className="faint" style={{ fontSize: 12, marginRight: "auto" }}>这个数字人还没有定妆照，先去 AiAvatar 补一张</span>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            type="button"
            className="btn btn-grad"
            disabled={!cur || !cur.imageUrl}
            style={{ opacity: (cur && cur.imageUrl) ? 1 : 0.5, maxWidth: "100%", minWidth: 0 }}
            onClick={confirm}
            title={cur ? `绑定「${cur.name}」` : "先选一个数字人"}
          >
            <Sparkles size={15} fill="currentColor" strokeWidth={0} style={{ flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cur ? `绑定「${cur.name}」` : "绑定"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
