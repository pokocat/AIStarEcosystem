"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { DirectorAssetKind, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { InlineError, kindLabel, useBusy, useEscape, dialogFocus } from "./director-shared";

const KINDS: DirectorAssetKind[] = ["character", "scene", "prop", "product"];

/** 提取出来的资产先在这里过一遍：勾选要的、改名，再保存进本作品；不保存就丢掉这份清单。 */
export function ExtractReview({ work, apply, onClose }: { work: DirectorWork; apply: (w: DirectorWork) => void; onClose: () => void }) {
  const pending = work.pendingExtract!;
  // 每份清单单独记勾选和改名（父组件按 runId 换 key）；取不到时按默认值，不沿用上一份。
  const [stored, setPicks] = useState(() => Object.fromEntries(pending.items.map(i => [i.itemId, { include: true, name: i.name, droppedForms: [] as string[] }])));
  const picks: Record<string, { include: boolean; name: string; droppedForms: string[] }> = Object.fromEntries(pending.items.map(i => [i.itemId, stored[i.itemId] ?? { include: true, name: i.name, droppedForms: [] }]));
  const [error, setError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const chosen = pending.items.filter(i => picks[i.itemId]?.include);
  const fresh = chosen.filter(i => !i.matchId).length;
  const save = () => void run("save", async () => {
    apply(await DirectorApi.edit(work.id, "extract.save", pending.runId, null, { items: pending.items.map(i => ({ itemId: i.itemId, include: !!picks[i.itemId]?.include, name: picks[i.itemId]?.name.trim() ?? i.name, droppedForms: picks[i.itemId]?.droppedForms ?? [] })) }));
    onClose();
  }, setError);
  const discard = () => void run("discard", async () => { apply(await DirectorApi.edit(work.id, "extract.discard", pending.runId, null)); onClose(); }, setError);
  const set = (key: string, patch: Partial<{ include: boolean; name: string; droppedForms: string[] }>) => setPicks(p => ({ ...p, [key]: { ...picks[key], ...patch } }));
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog director-extract" role="dialog" aria-modal="true" aria-labelledby="director-extract-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-extract-title">确认资产</h2><button type="button" aria-label="稍后再看" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <p className="director-dialog-note">{pending.batch ? `正文太长，AI 一次读不完全剧，这次读了第 ${pending.batch.fromNo}–${pending.batch.toNo} 集（共 ${pending.batch.total} 集），识别到 ${pending.items.length} 项。保存后在「资产」里点「继续提取」读剩下的集。`
        : `从全剧识别到 ${pending.items.length} 项。`}勾选要保存的，名字可以直接改；已有的同一项会合并，不重复新建。</p>
      <div className="director-extract-list">{KINDS.map(kind => {
        const list = pending.items.filter(i => i.kind === kind);
        if (!list.length) return null;
        return <section key={kind}><h3>{kindLabel[kind]}<small>{list.length}</small></h3>
          <ul>{list.map(i => {
            const pick = picks[i.itemId];
            const nos = i.episodeNos.length === work.episodes.length && i.episodeNos.length > 1 ? "全剧" : i.episodeNos.length ? `第 ${i.episodeNos.join("、")} 集` : "";
            return <li key={i.itemId} className={pick.include ? undefined : "is-off"}>
              <input type="checkbox" aria-label={`保存${pick.name}`} checked={pick.include} onChange={e => set(i.itemId, { include: e.target.checked })}/>
              <div>
                <div className="director-extract-head">
                  <input aria-label="资产名称" value={pick.name} maxLength={40} disabled={!pick.include || i.kind === "product"} title={i.kind === "product" ? "商品的名称在商品库修改，这里的叫法会记成别名" : undefined} onChange={e => set(i.itemId, { name: e.target.value })}/>
                  <span className={i.matchId ? "is-match" : "is-new"} title={i.matchId ? `与本作品已有的「${i.matchName}」是同一项，保存时合并` : "本作品里还没有，保存时新建"}>{i.matchId ? `已有：${i.matchName}` : "新"}</span>
                  {nos && <small>{nos}</small>}
                </div>
                <p title={i.description}>{i.description || "暂无描述"}</p>
                {!!i.forms?.length && <div className="director-chips director-extract-forms" role="group" aria-label={`${pick.name}的形态`}>
                  <small>剧情里的其他形态</small>
                  {i.forms.map(f => { const on = !pick.droppedForms.includes(f.name);
                    return <button key={f.name} type="button" aria-pressed={on} disabled={!pick.include} title={f.description}
                      onClick={() => set(i.itemId, { droppedForms: on ? [...pick.droppedForms, f.name] : pick.droppedForms.filter(x => x !== f.name) })}>{f.name}</button>; })}
                </div>}
              </div>
            </li>;
          })}</ul></section>;
      })}</div>
      <InlineError message={error}/>
      <footer>
        <button type="button" className="ip-brand-text-button director-danger" disabled={!!busy} onClick={discard}>不保存</button>
        <span className="director-spacer"/>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>稍后再看</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || chosen.length === 0 || chosen.some(i => !picks[i.itemId].name.trim())} onClick={save}>
          保存资产（{chosen.length} 项{fresh ? `，新增 ${fresh}` : ""}）</button>
      </footer>
    </div>
  </div>;
}
