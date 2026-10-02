// 画布单测用的小文档（id 固定，结果可比）。只给 board 的测试用。
import type { CanvasLook, DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { emptyDoc } from "@/canvas/core";

export function look(id: string, name = "基础造型", over: Partial<CanvasLook> = {}): CanvasLook {
  return { id, name, prompt: "", episodes: [1], images: { versions: [] }, ...over };
}

/** 两个角色（林微 2 个造型、陈屹 1 个）、两个场景、一张素材图、一段文字、两条线。位置全空。 */
export function sampleDoc(over: Partial<DramaCanvasDoc> = {}): DramaCanvasDoc {
  const base = emptyDoc();
  return {
    ...base,
    characters: [
      { id: "ch_a", name: "林微", role: "lead", looks: [look("lk_a1"), look("lk_a2", "学生时期", { episodes: [1, 2] })] },
      { id: "ch_b", name: "陈屹", role: "support", looks: [look("lk_b1")] },
    ],
    scenes: [
      { id: "sc_1", name: "旧教室", prompt: "", episodes: [1], images: { versions: [] } },
      { id: "sc_2", name: "天台", prompt: "", episodes: [2], images: { versions: [] } },
    ],
    materials: [
      { id: "mt_img", name: "旧照片", kind: "image", images: { versions: [{ key: "k/photo.png" }] } },
      { id: "mt_txt", name: "色调", kind: "text", text: "冷蓝夜色" },
    ],
    board: {
      ...base.board,
      edges: [
        { id: "ed_1", source: "mt_img", target: "lk_a1" },
        { id: "ed_2", source: "mt_txt", target: "sc_1" },
      ],
    },
    ...over,
  };
}
