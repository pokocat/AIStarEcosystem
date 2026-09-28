// 整份保存（ctx.saveData）里的旧快照回正（v0.197 复核，WB2 的反方向）。
//
// ctx.saveData(next) 收的是一整份文档。调用方（合成成片 assemble.tsx、分镜防抖 epscript.tsx）拿的是
// **渲染时**的 data 拼出来的：`withEpisodeDoc(data, ep, …)` = `{ ...data, episodeDocs: { ...data.episodeDocs, [ep]: … } }`。
// 合成要等好几秒、分镜防抖要等 1.5 秒，这期间别处写进来的东西（右侧角色面板原地绑的数字人、另一集的分镜 / 成片）
// 都不在那份快照里，整份存下去就被写回旧值：界面上 reducer 还显示已绑定，刷新之后绑定没了。
//
// 办法：页面每次换文档都记下「哪些值被换掉了」。整份保存进来时，如果某个字段（或 episodeDocs 里的某一集）
// 还是一个**已经被换掉的旧值**，说明调用方根本没改它、只是拿着旧快照原样带过来 —— 换回最新值。
// 调用方真改过的字段是新对象，不在记录里，照常写入。快照里缺的字段 / 缺的那几集（快照之后才加的）也补回最新值。
//
// 只用在整份保存（saveData）上。patchData 是在最新文档上算出来的，本来就不旧；它删掉的字段是真删，不能补回来。
// 按引用判断，所以前提是文档不可变更新（本仓的写法都是展开复制，没有原地改）。
import type { ProjectData } from "@/mocks/drama-workshop";

type Docs = NonNullable<ProjectData["episodeDocs"]>;

export interface DocHistory {
  /** 文档从 prev 换成 next：被换掉的字段旧值、episodeDocs 里每一集被换掉的旧值，都记为「已过期」。 */
  record(prev: ProjectData, next: ProjectData): void;
  /** 把旧快照拼出来的整份文档 next 回正到 cur（当前最新文档）上：过期的值换回最新值，缺的补回来。 */
  rebase(next: ProjectData, cur: ProjectData): ProjectData;
}

const isObj = (v: unknown): v is object => v !== null && typeof v === "object";

export function createDocHistory(): DocHistory {
  const superseded = new WeakSet<object>();
  const isStale = (v: unknown) => isObj(v) && superseded.has(v);

  const record: DocHistory["record"] = (prev, next) => {
    if (prev === next) return;
    const p = prev as unknown as Record<string, unknown>;
    const n = next as unknown as Record<string, unknown>;
    for (const k of Object.keys(p)) {
      if (p[k] !== n[k] && isObj(p[k])) superseded.add(p[k] as object);
    }
    const pd = prev.episodeDocs;
    const nd = next.episodeDocs;
    if (pd && pd !== nd) {
      for (const e of Object.keys(pd)) {
        if (pd[e] !== nd?.[e] && isObj(pd[e])) superseded.add(pd[e]);
      }
    }
  };

  const rebaseDocs = (nd: Docs | undefined, cd: Docs | undefined): Docs | undefined => {
    if (nd === cd) return nd;
    if (!nd) return cd; // 快照里还没有 episodeDocs，之后才有
    if (!cd) return isStale(nd) ? undefined : nd;
    const out: Docs = { ...nd };
    for (const e of Object.keys(nd)) {
      if (nd[e] === cd[e] || !isStale(nd[e])) continue;
      if (e in cd) out[e] = cd[e];
      else delete out[e]; // 这一集后来被删了，旧快照不能把它带回来
    }
    for (const e of Object.keys(cd)) {
      if (!(e in nd)) out[e] = cd[e]; // 快照之后才写的那几集
    }
    return out;
  };

  const rebase: DocHistory["rebase"] = (next, cur) => {
    if (next === cur) return next;
    const n = next as unknown as Record<string, unknown>;
    const c = cur as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { ...n };
    for (const k of new Set([...Object.keys(n), ...Object.keys(c)])) {
      if (k === "episodeDocs") continue;
      if (n[k] === c[k]) continue;
      if (n[k] === undefined || isStale(n[k])) {
        if (c[k] === undefined) delete out[k];
        else out[k] = c[k];
      }
    }
    const docs = rebaseDocs(next.episodeDocs, cur.episodeDocs);
    if (docs === undefined) delete out.episodeDocs;
    else out.episodeDocs = docs;
    return out as unknown as ProjectData;
  };

  return { record, rebase };
}
