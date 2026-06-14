// ─────────────────────────────────────────────────────────────────────────────
// mocks/interactive-drama.ts — 互动短剧 mock 内存 store（USE_MOCK=1）。
// 模块级 Map，client 端跨页导航保持（新建 → 列表可见 → 编辑 → 生成 → 持久）。
// 仅 type-import api 的类型，避免运行时循环依赖。
// ─────────────────────────────────────────────────────────────────────────────

import type { InteractiveSeries } from "@/api/interactive-drama";

const SHOWREEL = ["/videos/showreel-01.mp4", "/videos/showreel-02.mp4", "/videos/showreel-03.mp4"];
export function pickShowreel(): string {
  return SHOWREEL[Math.floor(Math.random() * SHOWREEL.length)];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const store = new Map<string, InteractiveSeries>();

function seed() {
  // ① 落地窗后 · 互动版 —— 6 集 / 2 互动点 / 3 结局，前两集已生成。
  const demo1: InteractiveSeries = {
    id: "dis_demo_chuanghou",
    title: "落地窗后 · 互动版",
    genre: "都市悬疑",
    logline: "她在落地窗后撞见真相，而你替她做下每一个选择。",
    status: "draft",
    start_episode_id: "ep_s1_10",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-07T14:32:00.000Z",
    episodes: [
      {
        id: "ep_s1_10",
        title: "第10集 · 真相浮现",
        synopsis: "她在落地窗后看清了他和别人的牵手，心跳几乎停掉。",
        duration_sec: 75,
        gen_status: "ready",
        video_job_id: "mvj_seed_1",
        video_url: "/videos/showreel-01.mp4",
        interaction: {
          prompt: "看完这一集，她该当面拆穿他吗？",
          choices: [
            { id: "ch_s1_10_a", label: "当面拆穿", next_episode_id: "ep_s1_11a" },
            { id: "ch_s1_10_b", label: "假装不知", next_episode_id: "ep_s1_11b" },
          ],
          countdown_sec: 10,
          default_choice_id: null,
        },
        next_episode_id: null,
        is_ending: false,
      },
      {
        id: "ep_s1_11a",
        title: "第11集 · 拆穿线",
        branch_label: "拆穿线",
        synopsis: "她冲上前质问，他跪地求原谅，眼泪真假难辨。",
        duration_sec: 80,
        gen_status: "ready",
        video_job_id: "mvj_seed_2",
        video_url: "/videos/showreel-02.mp4",
        interaction: {
          prompt: "他跪下来求原谅，她该……",
          choices: [
            { id: "ch_s1_11a_a", label: "原谅他", next_episode_id: "ep_s1_he" },
            { id: "ch_s1_11a_b", label: "转身离开", next_episode_id: "ep_s1_be" },
          ],
          countdown_sec: 8,
          default_choice_id: null,
        },
        next_episode_id: null,
        is_ending: false,
      },
      {
        id: "ep_s1_11b",
        title: "第11集 · 隐忍线",
        branch_label: "隐忍线",
        synopsis: "她假装什么都没看见，却开始暗中收集证据。",
        duration_sec: 80,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: "ep_s1_open",
        is_ending: false,
      },
      {
        id: "ep_s1_he",
        title: "大结局 · 破镜重圆",
        branch_label: "拆穿线",
        synopsis: "误会解开，两人在落地窗前重新牵手。",
        duration_sec: 90,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: null,
        is_ending: true,
        ending_label: "HE · 重圆",
      },
      {
        id: "ep_s1_be",
        title: "大结局 · 各自天涯",
        branch_label: "拆穿线",
        synopsis: "她头也不回地走进电梯，落地窗映出两个世界。",
        duration_sec: 90,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: null,
        is_ending: true,
        ending_label: "BE · 错过",
      },
      {
        id: "ep_s1_open",
        title: "大结局 · 悬念待续",
        branch_label: "隐忍线",
        synopsis: "证据集齐的那一刻，门铃响了——画面戛然而止。",
        duration_sec: 85,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: null,
        is_ending: true,
        ending_label: "开放结局",
      },
    ],
  };

  // ② 霸总的选择 · 互动甜宠 —— 1 互动点 / 2 结局，全部待生成。
  const demo2: InteractiveSeries = {
    id: "dis_demo_bazong",
    title: "霸总的选择 · 互动甜宠",
    genre: "都市甜宠",
    logline: "一纸婚约，签或不签，由屏幕前的你决定。",
    status: "draft",
    start_episode_id: "ep_s2_1",
    created_at: "2026-06-06T10:00:00.000Z",
    updated_at: "2026-06-06T18:08:00.000Z",
    episodes: [
      {
        id: "ep_s2_1",
        title: "第 1 集 · 闪婚之夜",
        synopsis: "陌生男人递来一份婚约，落款是她最熟悉的名字。",
        duration_sec: 60,
        gen_status: "idle",
        video_url: null,
        interaction: {
          prompt: "她要不要签下这份婚约？",
          choices: [
            { id: "ch_s2_1_a", label: "签下名字", next_episode_id: "ep_s2_2a" },
            { id: "ch_s2_1_b", label: "撕掉合约", next_episode_id: "ep_s2_2b" },
          ],
          countdown_sec: 10,
          default_choice_id: null,
        },
        next_episode_id: null,
        is_ending: false,
      },
      {
        id: "ep_s2_2a",
        title: "第 2 集 · 接受线",
        branch_label: "接受线",
        synopsis: "签字之后，这场契约婚姻甜得猝不及防。",
        duration_sec: 65,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: null,
        is_ending: true,
        ending_label: "甜宠结局",
      },
      {
        id: "ep_s2_2b",
        title: "第 2 集 · 逃离线",
        branch_label: "逃离线",
        synopsis: "她撕掉合约夺门而出，却撞进另一场算计。",
        duration_sec: 65,
        gen_status: "idle",
        video_url: null,
        interaction: null,
        next_episode_id: null,
        is_ending: true,
        ending_label: "反转结局",
      },
    ],
  };

  store.set(demo1.id, demo1);
  store.set(demo2.id, demo2);
}
seed();

export function allSeries(): InteractiveSeries[] {
  return [...store.values()]
    .map(clone)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
}

export function getSeriesById(id: string): InteractiveSeries | undefined {
  const s = store.get(id);
  return s ? clone(s) : undefined;
}

export function putSeries(s: InteractiveSeries): InteractiveSeries {
  store.set(s.id, clone(s));
  return clone(s);
}

export function removeSeries(id: string): void {
  store.delete(id);
}
