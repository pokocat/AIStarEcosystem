// 剧本审阅中心 — 设计真源 v4 screens-hub-v2.jsx `REVIEW_QUEUE_INIT`:
// 跨项目待审队列,原地通读、原地通过。
export interface ReviewItem {
  id: string;
  /** 关联项目 id(PROJECT_DATA 键) */
  pid: string;
  ep: number;
  title: string;
  type: string;
  cover: { from: string; to: string };
  words: number;
  /** 剧本生成时间，ISO 8601（与服务端时间字段同形，展示走 formatDateTime，§4.8） */
  updated: string;
  status: "pending" | "approved";
}

export const REVIEW_QUEUE_INIT: ReviewItem[] = [
  { id: "r1", pid: "p1", ep: 1, title: "落地窗后", type: "悬疑短剧", cover: { from: "#f97316", to: "#e11d48" }, words: 420, updated: "2026-09-27T06:32:00.000Z", status: "pending" },
  { id: "r2", pid: "p3", ep: 1, title: "闪婚老公竟是隐藏首富", type: "都市甜宠", cover: { from: "#f472b6", to: "#fb7185" }, words: 300, updated: "2026-09-26T10:05:00.000Z", status: "pending" },
  { id: "r3", pid: "p2", ep: 1, title: "重生后她在冷宫杀疯了", type: "宫斗", cover: { from: "#db2777", to: "#9333ea" }, words: 310, updated: "2026-09-24T03:20:00.000Z", status: "approved" },
];

export const REVIEW_PENDING_COUNT = REVIEW_QUEUE_INIT.filter((x) => x.status === "pending").length;
