// ─────────────────────────────────────────────────────────────────────────────
// lib/graph.test.ts — 输入闸门与拓扑序，直接拿**内置工作流模板**当被测数据。
//
// 为什么必须用真模板：这两套模板是一条直链
//   n-source → n-identity → n-style → n-master → n-look-N → n-gen-N
// 风格与特征卡挂在主形象上游，并不直连每个出图节点。只看直接父节点的闸门会在
// 两套模板上一律报「缺人物特征卡 / 缺风格」，用户在界面上根本点不动运行 ——
// 这就是本文件要钉死的回归。
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { IpNode, IpProjectDoc, IpTemplate } from "@ai-star-eco/types";
import { SERVER_TEMPLATES } from "@/mocks/templates";
import {
  ancestorsOfType, collectGenerateInputs, generateNodes, masterGenerateNode,
  canConnect, missingInputsForRun, topoOrder, upstream,
} from "@/lib/graph";

/** 服务端模板真源目录（副本在 src/mocks/templates，见那里的说明）。 */
const SERVER_TEMPLATE_DIR = resolve(__dirname, "../../../server/src/main/resources/ipstudio/templates");

const TEMPLATE_IDS = ["portrait-bjd-trio", "portrait-sticker-six"] as const;

function template(id: string): IpTemplate {
  const found = SERVER_TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`模板副本里没有 ${id}`);
  return found;
}

/** 模板文档 + 已填好的照片与特征卡（真实用户跑到出图那一步时的样子）。 */
function readyDoc(id: string): IpProjectDoc {
  const doc = JSON.parse(JSON.stringify(template(id).doc)) as IpProjectDoc;
  for (const n of doc.nodes) {
    if (n.type === "source") n.data.assetKey = "ipstudio/source/u1/portrait.jpg";
    if (n.type === "identity") {
      n.data.text = "脸型：柔和的鹅蛋脸";
      n.data.promptEn = "a young person with a soft oval face";
    }
  }
  return doc;
}

describe("内置模板副本与服务端真源一致", () => {
  it.each(TEMPLATE_IDS)("%s 与服务端文件逐字相同", (id) => {
    const server = JSON.parse(readFileSync(resolve(SERVER_TEMPLATE_DIR, `${id}.json`), "utf8"));
    expect(template(id)).toEqual(server);
  });
});

describe("输入闸门（missingInputsForRun）", () => {
  it.each(TEMPLATE_IDS)("%s：特征卡填好后主形象可以运行", (id) => {
    const doc = readyDoc(id);
    const master = masterGenerateNode(doc);
    expect(master).toBeTruthy();
    expect(missingInputsForRun(doc, master!)).toEqual([]);
  });

  it.each(TEMPLATE_IDS)("%s：每个形象卡出图节点都可以运行", (id) => {
    const doc = readyDoc(id);
    const looks = generateNodes(doc).filter((n) => !n.data.isMaster);
    expect(looks.length).toBeGreaterThan(0);
    for (const node of looks) {
      expect({ node: node.id, missing: missingInputsForRun(doc, node) })
        .toEqual({ node: node.id, missing: [] });
    }
  });

  it.each(TEMPLATE_IDS)("%s：抽特征卡只要上游那张照片已上传", (id) => {
    const doc = readyDoc(id);
    const identity = doc.nodes.find((n) => n.type === "identity")!;
    expect(missingInputsForRun(doc, identity)).toEqual([]);
  });

  it("特征卡还没有内容时，主形象报的是「内容」而不是「没接上」", () => {
    const doc = readyDoc("portrait-bjd-trio");
    for (const n of doc.nodes) {
      if (n.type === "identity") { n.data.text = ""; n.data.promptEn = "  "; }
    }
    expect(missingInputsForRun(doc, masterGenerateNode(doc)!)).toEqual(["人物特征卡内容"]);
  });

  it("照片还没上传时，抽特征卡报缺一张照片", () => {
    const doc = JSON.parse(JSON.stringify(template("portrait-bjd-trio").doc)) as IpProjectDoc;
    const identity = doc.nodes.find((n) => n.type === "identity")!;
    expect(missingInputsForRun(doc, identity)).toEqual(["一张照片"]);
  });

  it("非主形象节点没接形象卡时仍然报缺形象卡（主形象豁免）", () => {
    const doc = readyDoc("portrait-bjd-trio");
    doc.edges = doc.edges.filter((e) => e.target !== "n-gen-1");
    // 断了形象卡这条边，n-gen-1 也就同时失去了风格 / 特征卡的上游
    expect(missingInputsForRun(doc, doc.nodes.find((n) => n.id === "n-gen-1")!))
      .toEqual(["人物特征卡", "风格", "形象卡"]);
  });

  it("形象卡四栏全空算缺内容", () => {
    const doc = readyDoc("portrait-bjd-trio");
    for (const n of doc.nodes) {
      if (n.type === "look" && n.id === "n-look-1") {
        n.data = { ...n.data, outfit: "", pose: "", expression: "", details: "", props: "" };
      }
    }
    expect(missingInputsForRun(doc, doc.nodes.find((n) => n.id === "n-gen-1")!))
      .toEqual(["形象卡内容"]);
  });
});

describe("上游收集（collectGenerateInputs）", () => {
  it("出图节点的直接父节点只有形象卡 —— 只看直接父节点必然误报缺特征卡/缺风格", () => {
    const doc = readyDoc("portrait-bjd-trio");
    expect(upstream(doc, "n-gen-1").map((n) => n.type)).toEqual(["look"]);
  });

  it("出图节点隔着形象卡与主形象也能拿到特征卡与风格", () => {
    const doc = readyDoc("portrait-bjd-trio");
    const inputs = collectGenerateInputs(doc, "n-gen-2");
    expect(inputs.identity?.id).toBe("n-identity");
    expect(inputs.style?.id).toBe("n-style");
    expect(inputs.look?.id).toBe("n-look-2");
    expect(inputs.master?.id).toBe("n-master");
    expect(inputs.source?.id).toBe("n-source");
    expect(inputs.references).toEqual([]);
  });

  it("主形象节点本身不会把自己当主形象参考", () => {
    const doc = readyDoc("portrait-bjd-trio");
    const inputs = collectGenerateInputs(doc, "n-master");
    expect(inputs.master).toBeUndefined();
    expect(inputs.look).toBeUndefined();
    expect(inputs.identity?.id).toBe("n-identity");
    expect(inputs.style?.id).toBe("n-style");
  });

  it("同类型多个上游时取最近的那一个", () => {
    const doc = readyDoc("portrait-bjd-trio");
    const near: IpNode = {
      id: "style-near", type: "style", position: { x: 0, y: 0 },
      data: { name: "近的风格", promptEn: "near style", custom: true },
    };
    doc.nodes.push(near);
    doc.edges.push({ id: "e-style-near", source: "style-near", target: "n-gen-1" });
    expect(collectGenerateInputs(doc, "n-gen-1").style?.id).toBe("style-near");
  });

  it("环形连线不会把遍历转死", () => {
    const doc = readyDoc("portrait-bjd-trio");
    doc.edges.push({ id: "e-cycle", source: "n-gen-1", target: "n-source" });
    expect(ancestorsOfType(doc, "n-gen-1", "identity", 8).map((n) => n.id)).toEqual(["n-identity"]);
  });

  it("超过跳数上限的祖先不算数（形象卡只看 2 跳）", () => {
    const doc = readyDoc("portrait-bjd-trio");
    // n-master 的上游是 n-style(1) / n-identity(2)，没有形象卡 —— 3 跳外的也不该被捞进来
    expect(ancestorsOfType(doc, "n-master", "look", 2)).toEqual([]);
    expect(ancestorsOfType(doc, "n-gen-1", "source", 2)).toEqual([]);
    expect(ancestorsOfType(doc, "n-gen-1", "source", 8).map((n) => n.id)).toEqual(["n-source"]);
  });
});

describe("连线规则覆盖内置模板", () => {
  // 模板画了什么线，画布就必须能画出同样的线。少放行一种，节点组件那边也会少一个
  // 入边端口 —— React Flow 直接画不出那条边，用户看到的是断开的链子。
  it.each(TEMPLATE_IDS)("%s：每条模板连线都被允许", (id) => {
    const doc = template(id).doc;
    for (const edge of doc.edges) {
      const without: IpProjectDoc = { ...doc, edges: doc.edges.filter((e) => e.id !== edge.id) };
      const s = doc.nodes.find((n) => n.id === edge.source)!;
      const t = doc.nodes.find((n) => n.id === edge.target)!;
      expect({ edge: `${s.type}→${t.type}`, ok: canConnect(without, edge.source, edge.target) })
        .toEqual({ edge: `${s.type}→${t.type}`, ok: true });
    }
  });

  it("照片与参考图不接入边，publish 不出边，同一对不重复连", () => {
    const doc = template("portrait-bjd-trio").doc;
    expect(canConnect(doc, "n-identity", "n-source")).toBe(false);
    expect(canConnect(doc, "n-publish", "n-master")).toBe(false);
    expect(canConnect(doc, "n-master", "n-master")).toBe(false);
    expect(canConnect(doc, "n-style", "n-master")).toBe(false); // 已经连过了
  });
});

describe("拓扑序（topoOrder）", () => {
  it.each(TEMPLATE_IDS)("%s：主形象排在所有形象卡出图之前", (id) => {
    const order = topoOrder(template(id).doc).map((n) => n.id);
    const masterAt = order.indexOf("n-master");
    expect(masterAt).toBeGreaterThanOrEqual(0);
    const looksAt = order
      .map((nodeId, i) => ({ nodeId, i }))
      .filter(({ nodeId }) => nodeId.startsWith("n-gen-"))
      .map(({ i }) => i);
    expect(looksAt.length).toBe(template(id).lookCount);
    for (const at of looksAt) expect(at).toBeGreaterThan(masterAt);
  });

  it.each(TEMPLATE_IDS)("%s：每个节点都只出现一次", (id) => {
    const doc = template(id).doc;
    const order = topoOrder(doc).map((n) => n.id);
    expect(order.length).toBe(doc.nodes.length);
    expect(new Set(order).size).toBe(doc.nodes.length);
  });

  it("有环时不抛错，剩余节点补在尾部", () => {
    const doc = readyDoc("portrait-bjd-trio");
    doc.edges.push({ id: "e-cycle", source: "n-gen-1", target: "n-look-1" });
    const order = topoOrder(doc).map((n) => n.id);
    expect(order.length).toBe(doc.nodes.length);
    expect(new Set(order).size).toBe(doc.nodes.length);
  });
});
