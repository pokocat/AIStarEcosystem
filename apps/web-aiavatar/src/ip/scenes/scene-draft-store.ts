"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IpProject, IpProjectDoc } from "@ai-star-eco/types";
import { saveDraftDoc, stableJson } from "./scene-drafts";

/**
 * 场景页（AI 图片 / AI 视频）的草稿与保存队列。
 *
 * 页面随时能换草稿（从「最近」打开另一份、点「新建」），而保存、上传、任务回包都是异步的
 * （2026-10-30 复核：A 的保存还没回来时打开 B，A 的回包把页面换回了 A）。所以：
 * - 每次保存在**发起时**就定下是哪份草稿；排队也是按草稿各排各的，旧草稿的修改不会套到后来打开的草稿上；
 * - 回包只记到自己那份草稿上，页面上开着的还是它才刷新页面；
 * - 换草稿时 begin() 换一个会话号，上传、提交这些旧操作据此知道页面已经不是它的了，只把自己草稿的事做完。
 */
export function useSceneDraftStore() {
  const [draft, setDraft] = useState<IpProject>();
  const current = useRef<IpProject>(undefined);
  const latest = useRef(new Map<string, IpProject>());
  const tails = useRef(new Map<string, Promise<unknown>>());
  const session = useRef(0);

  /** 页面要换到别的草稿（打开、新建）：从这一刻起，旧操作不再改这一页。 */
  const begin = useCallback(() => ++session.current, []);
  /** 这份草稿后面还要保存，但不摆到页面上（页面已经换走了）。 */
  const remember = useCallback((project: IpProject) => { latest.current.set(project.id, project); }, []);
  /** 摆一份草稿到页面上；ticket 是 begin() 给的号，中途又换过就不摆。 */
  const show = useCallback((project: IpProject | undefined, ticket = session.current) => {
    if (ticket !== session.current) return false;
    current.current = project;
    if (project) latest.current.set(project.id, project);
    setDraft(project);
    return true;
  }, []);
  /** 页面还停在 ticket 那一刻、开着的还是这份草稿吗。 */
  const onPage = useCallback((ticket: number, projectId?: string) =>
    ticket === session.current && (projectId === undefined || current.current?.id === projectId), []);

  /** 文档一次只存一份：同一份草稿的保存排队，后一次基于前一次的结果，不会拿旧版本去覆盖。 */
  const persist = useCallback((mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId = current.current?.id) => {
    if (!projectId) return Promise.reject(new Error("草稿还没准备好"));
    const job = (tails.current.get(projectId) ?? Promise.resolve()).then(async () => {
      const base = latest.current.get(projectId);
      if (!base) throw new Error("草稿还没准备好");
      const saved = await saveDraftDoc(base, mutate(base.doc));
      latest.current.set(projectId, saved);
      if (current.current?.id === projectId) { current.current = saved; setDraft(saved); }
      return saved;
    });
    tails.current.set(projectId, job.catch(() => undefined));
    return job;
  }, []);
  /** 这份草稿排着的保存都落地（打开它之前等一下，读到的就是最新一版）。 */
  const settled = useCallback((projectId: string) => tails.current.get(projectId) ?? Promise.resolve(), []);

  return { draft, current, session, begin, remember, show, onPage, persist, settled };
}

type StateField = "sceneImageState" | "sceneVideoState";

/**
 * 页面上的创作条件（补充要求、选项、设置、改了一半的脚本）改完 600ms 写进草稿，刷新、从「最近」再打开都按它放回。
 *
 * - 只在已经有草稿时写；还没有草稿（第一次生成 / 上传之前）只留在页面上。
 * - 和打开这份草稿时会摆出的一样就不写：光打开一份老草稿不会多存一版（会改它的更新时间，「最近」的顺序就乱了）。
 * - 换草稿时，上一份还没写出去的那次立刻写给上一份，不会套到新打开的草稿上（走同一个保存队列，见 persist）。
 * - 页面卸载时不补写（AGENTS §8.0.1 ⑮：卸载 / 隐藏时写持久化会被 StrictMode 的空状态抹掉）；最多丢最后 600ms 的输入。
 * 写失败不打扰用户：页面上的内容还在，下一次改动会再写。
 */
export function useSceneStateSave<K extends StateField>(field: K, draft: IpProject | undefined, value: NonNullable<IpProjectDoc[K]>,
  persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<IpProject>,
  /** 这份草稿打开时页面会摆出的条件（openedImageState / openedVideoState）：和它一样就不写。 */
  opened: (doc: IpProjectDoc) => NonNullable<IpProjectDoc[K]>, delay = 600) {
  const pending = useRef<{ projectId: string; value: NonNullable<IpProjectDoc[K]>; timer: ReturnType<typeof setTimeout> }>(undefined);
  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer); pending.current = undefined;
    void persist(doc => ({ ...doc, [field]: p.value }), p.projectId).catch(() => undefined);
  }, [field, persist]);
  const key = stableJson(value);
  const saved = draft ? stableJson(opened(draft.doc)) : "";
  const draftId = draft?.id;
  const latest = useRef(value); latest.current = value;
  useEffect(() => {
    if (pending.current && pending.current.projectId !== draftId) flush();
    if (pending.current) { clearTimeout(pending.current.timer); pending.current = undefined; }
    if (!draftId || key === saved) return;
    pending.current = { projectId: draftId, value: latest.current, timer: setTimeout(flush, delay) };
  }, [key, saved, draftId, flush, delay]);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current.timer); }, []);
}
