'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { IpTemplate } from '@ai-star-eco/types';
import { ProjectCardPreview } from './project-card-preview';
import { inspirationPlacement, templateKind, templateRatio, templateSpec, type RatioKnown } from './template-facts';

const KIND_LABEL = { video: '视频', image: '图片', canvas: '模板' } as const;
/** 名字底下的小字：类型、比例和时长。 */
export const inspirationLabel = (t: IpTemplate) => [KIND_LABEL[templateKind(t)], templateSpec(t.doc)].filter(Boolean).join(' · ');

/**
 * 灵感墙（首页和灵感页共用）：按作品的真实比例摆，放进当前最矮的一列，不裁图。一次摆一页，滚到底接着摆。
 * 接口一次给全部，分页只是为了不一次加载几十张大图。
 */
export function InspirationWall({ items, resetKey, onOpen, manage, pageSize = 18, minColumn = 236 }: {
  items: IpTemplate[]; onOpen: (template: IpTemplate) => void;
  /** 换分类、换搜索词时回到第一页。 */
  resetKey?: string;
  /** 卡片上给管理者的操作。 */
  manage?: (template: IpTemplate) => ReactNode;
  pageSize?: number; minColumn?: number;
}) {
  const wall = useRef<HTMLDivElement>(null), end = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  // 一换分类就回到第一页：在渲染时判断，不会先把上一个分类翻到的张数摆出来再收回去。
  const [page, setPage] = useState({ key: resetKey, shown: pageSize });
  const shown = page.key === resetKey ? page.shown : pageSize;
  const nextPage = () => setPage(p => ({ key: resetKey, shown: (p.key === resetKey ? p.shown : pageSize) + pageSize }));
  // 在画之前量好列数：卡片换列会重新挂载，先按默认列数画一遍就要闪一下、重放一次进场。
  useLayoutEffect(() => {
    const el = wall.current;
    if (!el) return;
    const fit = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
      setColumns(Math.max(2, Math.min(6, Math.floor((el.clientWidth + gap) / (minColumn + gap)))));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [minColumn]);
  const more = shown < items.length;
  const canObserve = typeof IntersectionObserver !== 'undefined';
  useEffect(() => {
    const el = end.current;
    if (!el || !more || !canObserve) return;
    // 离底部还有一屏多就开始摆，滚的时候看不到空白。
    const watch = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) nextPage(); }, { rootMargin: '900px 0px' });
    watch.observe(el);
    return () => watch.disconnect();
    // 摆完这一页如果还看得到底部，换一个观察者才会再触发一次，所以依赖 shown。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, canObserve, pageSize, shown, resetKey]);
  const placed = useMemo(() => inspirationPlacement<IpTemplate & RatioKnown>(items.slice(0, shown), columns), [items, shown, columns]);
  return <>
    <div ref={wall} className="inspiration-wall">{placed.map((column, c) =>
      <div key={c} className="inspiration-wall-column">{column.map(({ item, index }) =>
        <InspirationCard key={item.versionId || item.id} template={item} onOpen={onOpen} manage={manage?.(item)} order={index % pageSize}/>)}</div>)}
    </div>
    {/* 不能自动接着摆的浏览器也不能看不到后面的内容。 */}
    <div ref={end} className="inspiration-wall-end">{more
      ? canObserve ? <span role="status"><Loader2 size={16} className="studio-gallery-spinner" aria-hidden="true"/>正在加载</span>
        : <button type="button" className="ip-brand-secondary" onClick={nextPage}>加载更多</button>
      : items.length > pageSize && <span>已经到底了</span>}</div>
  </>;
}

/** 一张作品：图按原比例，指针移上去视频开始播、出现「做同款」，名字像展签一样放在图下面。点开是详情弹窗。 */
function InspirationCard({ template, onOpen, manage, order }: { template: IpTemplate; onOpen: (t: IpTemplate) => void; manage?: ReactNode; order: number }) {
  const known = templateRatio(template.doc);
  const [loaded, setLoaded] = useState<number>();
  const ratio = known ?? loaded;
  const closed = template.enabled === false;
  return <article className={`inspiration-card${closed ? ' is-closed' : ''}`} style={{ '--inspiration-order': order } as React.CSSProperties}>
    <button type="button" className="inspiration-card-open" disabled={closed} aria-label={`预览模板 ${template.name}`} title={template.summary || template.name} onClick={() => onOpen(template)}>
      <span className={`inspiration-card-media${ratio ? '' : ' is-unsized'}`} style={ratio ? { aspectRatio: String(ratio) } : undefined}
        // 比例写在文档里的卡片不用等；写不出来的（老示例、人工封面）等图片到了再按它摆。
        onLoadCapture={known ? undefined : e => { const img = e.target as HTMLImageElement; if (img.naturalWidth && img.naturalHeight) setLoaded(img.naturalWidth / img.naturalHeight); }}>
        <ProjectCardPreview key={template.coverUrl || template.versionId || template.id} doc={template.doc} coverUrl={template.coverUrl} videoUrl={template.previewVideoUrl} stepsFirst/>
        {!closed && <span className="inspiration-card-action" aria-hidden="true">做同款</span>}
      </span>
      <span className="inspiration-card-label"><strong>{template.name}</strong><small>{closed ? '已停用' : inspirationLabel(template)}</small></span>
    </button>
    {manage && <div className="inspiration-card-manage">{manage}</div>}
  </article>;
}
