import { describe, expect, it } from "vitest";
import { SCENES_GROUP_ID, characterGroupId } from "@/canvas/core";
import { addBoardEdge, checkConnection, nodeKindOf, removeBoardEdge, type ConnectRejection } from "./connect";
import { sampleDoc } from "./test-fixtures";

// 连线规则只允许 CanvasBoard.edges 注释里那几种（drama-canvas.ts）。断结构与拒绝原因的代码，不断文案（§8.0.1 ⑩）。

const reason = (s: string, t: string) => {
  const c = checkConnection(sampleDoc(), s, t);
  return c.ok ? "ok" : c.reason;
};

describe("连线规则", () => {
  it("认得每种节点", () => {
    const d = sampleDoc();
    expect(nodeKindOf(d, "lk_a1")).toBe("look");
    expect(nodeKindOf(d, "sc_1")).toBe("scene");
    expect(nodeKindOf(d, "mt_img")).toBe("imageMaterial");
    expect(nodeKindOf(d, "mt_txt")).toBe("textMaterial");
    expect(nodeKindOf(d, characterGroupId("ch_a"))).toBe("charGroup");
    expect(nodeKindOf(d, SCENES_GROUP_ID)).toBe("sceneGroup");
    expect(nodeKindOf(d, characterGroupId("gone"))).toBeNull();
    expect(nodeKindOf(d, "nope")).toBeNull();
  });

  it("素材图 / 造型 / 场景 → 造型 / 场景 / 素材图：都能连", () => {
    const sources = ["mt_img", "lk_a2", "sc_2"];
    const targets = ["lk_b1", "sc_2", "mt_img", "lk_a2"];
    for (const s of sources) {
      for (const t of targets) {
        if (s === t) continue;
        expect(reason(s, t), `${s} → ${t}`).toBe("ok");
      }
    }
  });

  it("文字 → 造型 / 场景 / 素材图：能连；任何东西 → 文字：不能", () => {
    expect(reason("mt_txt", "lk_b1")).toBe("ok");
    expect(reason("mt_txt", "sc_2")).toBe("ok");
    expect(reason("mt_txt", "mt_img")).toBe("ok");
    for (const s of ["lk_a1", "sc_1", "mt_img"]) expect(reason(s, "mt_txt")).toBe<ConnectRejection>("text-target");
  });

  it("不许连自己、不许重复、不许连到分组、不认得的不连", () => {
    expect(reason("lk_a1", "lk_a1")).toBe("self");
    expect(reason("mt_img", "lk_a1")).toBe("duplicate"); // 已经有 ed_1
    expect(reason("lk_a1", "mt_img")).toBe("ok"); // 反方向不算重复
    expect(reason("mt_img", characterGroupId("ch_a"))).toBe("group");
    expect(reason(SCENES_GROUP_ID, "lk_a1")).toBe("group");
    expect(reason("mt_img", "nope")).toBe("unknown");
    expect(checkConnection(sampleDoc(), null, "lk_a1")).toEqual({ ok: false, reason: "unknown" });
  });

  it("addBoardEdge 只加允许的，重复加不会多出一条；removeBoardEdge 删一条", () => {
    const d = sampleDoc();
    const a = addBoardEdge(d, "sc_2", "lk_b1", "ed_new");
    expect(a.board.edges.map((e) => e.id)).toEqual(["ed_1", "ed_2", "ed_new"]);
    expect(addBoardEdge(a, "sc_2", "lk_b1", "ed_again")).toBe(a);
    expect(addBoardEdge(d, "lk_a1", "mt_txt")).toBe(d);
    expect(addBoardEdge(d, "lk_a1", "lk_a1")).toBe(d);
    const r = removeBoardEdge(a, "ed_1");
    expect(r.board.edges.map((e) => e.id)).toEqual(["ed_2", "ed_new"]);
    expect(removeBoardEdge(r, "ed_1")).toBe(r);
  });
});
