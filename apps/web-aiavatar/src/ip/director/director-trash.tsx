"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import type { DirectorTrashedWork } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { StudioPage } from "../studio-page";
import { GalleryState, useStudioList } from "../studio-gallery";
import { useStudioFailure } from "../studio-errors";
import { isWorkGone } from "./director-shared";

/**
 * 导演台回收站：本人已删除的作品（含早先删除的），显示名称和删除时间，可以恢复。
 * 恢复的是原作品（原 ID、原内容），回到作品列表后保持停止，需要时再自己开始制作。不做永久删除和清空。
 */
export function DirectorTrash() {
  const auth = useRequireAuth();
  const trash = useStudioList(DirectorApi.listTrash, auth === "ok");
  const showFailure = useStudioFailure();
  const [restoring, setRestoring] = useState<string>();
  const [restored, setRestored] = useState<DirectorTrashedWork>();
  const lock = useRef(false);

  const restore = async (w: DirectorTrashedWork) => {
    if (lock.current) return;
    lock.current = true; setRestoring(w.id); setRestored(undefined);
    try {
      await DirectorApi.restoreWork(w.id);
      trash.setData(list => list.filter(x => x.id !== w.id));
      setRestored(w);
    } catch (e) {
      showFailure({ action: `恢复「${w.title}」`, error: e });
      if (isWorkGone(e)) trash.reload(); // 已经不在了（别处恢复过或不存在），刷新回收站
    } finally { lock.current = false; setRestoring(undefined); }
  };

  if (auth === "no-platform" || trash.notEnrolled) return <PlatformGateScreen/>;
  return <StudioPage title="回收站" description="删除的作品在这里，可以恢复" className="director-page director-trash-page"
    actions={<Link href="/director" className="ip-brand-secondary director-trash-back"><ArrowLeft size={16}/>返回作品列表</Link>}>
    {restored && <div className="director-notice director-trash-restored" role="status">
      <span>「{restored.title}」已恢复到作品列表，制作保持停止，需要时再开始。</span>
      <Link href={`/director/${encodeURIComponent(restored.id)}`}>打开作品</Link>
    </div>}
    {auth !== "ok" || trash.loading ? <GalleryState loading/> : trash.error ? <GalleryState error={trash.error} retry={trash.reload}/> :
      trash.data.length === 0 ? <div className="director-empty">
        <RotateCcw size={28}/>
        <h2>回收站是空的</h2>
        <p>删除的作品会放在这里，可以随时恢复。</p>
        <Link href="/director" className="ip-brand-button">返回作品列表</Link>
      </div> :
      <>
        <div className="director-list-toolbar"><span>{trash.data.length} 部已删除的作品</span><button className="studio-page-refresh" aria-label="刷新" onClick={trash.reload}><RefreshCw size={16}/></button></div>
        <div className="director-work-grid">{trash.data.map(w => <article key={w.id} className="director-work-card director-trash-card" aria-label={`已删除的作品 ${w.title}`}>
          <div className="director-work-open">
            <div className="director-work-cover">{w.coverUrl ? <img src={w.coverUrl} alt=""/> : <Clapperboard size={26}/>}</div>
            <div className="director-work-copy"><h3 title={w.title}>{w.title}</h3><small>删除于 {formatDateTime(w.deletedAt)}</small></div>
          </div>
          <footer className="director-trash-actions">
            <button type="button" className="ip-brand-secondary" disabled={!!restoring} aria-label={`恢复作品 ${w.title}`} onClick={() => void restore(w)}>
              {restoring === w.id ? <><Loader2 size={15} className="ip-loading-icon"/>恢复中</> : <><RotateCcw size={15}/>恢复</>}
            </button>
          </footer>
        </article>)}</div>
      </>}
  </StudioPage>;
}
