// 全局内容运营后台「接没接上」的结构测试。
//
// 这一整块工作的起因就是这类事故：`POST /demos/{demoId}/enabled`（下线）后端写好了、
// 注释还专门解释了「为什么下线维持运营级不要超管」，但**前端零调用方** ——
// 编译绿、typecheck 绿，上线一条不合适的示例之后产品内撤不下来。
// 与 publish-wiring.test.ts 同一条纪律（v0.159 的教训）：编译器查不出「写了没人挂」。

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const api = read("src/ip/api/ip-studio.ts");
const page = read("src/app/projects/demos/page.tsx");
const list = read("src/app/projects/page.tsx");
const host = read("src/ip/canvas-host.tsx");

describe("运营后台必须真的接到那四个端点", () => {
  it("四个管理动作都有 API 函数，且路径是字面量（契约门是静态扫描，拼出来的路径它读不懂）", () => {
    expect(api).toContain('"/v1/ip-studio/demos"');
    expect(api).toMatch(/\/v1\/ip-studio\/demos\/\$\{encodeURIComponent\(demoId\)\}/);
    expect(api).toMatch(/\/v1\/ip-studio\/demos\/\$\{encodeURIComponent\(demoId\)\}\/enabled/);
    expect(api).toMatch(/method:\s*"DELETE"/);
  });

  it("管理页把四个都调上了 —— 尤其是此前零调用方的「下线」", () => {
    for (const fn of ["listDemosForAdmin", "updateDemo", "setDemoEnabled", "deleteDemo"]) {
      expect(page, `${fn} 没人调 = 这一页又白写了`).toContain(fn);
    }
  });

  it("有入口能走到这一页 —— 没有链接的页面等于不存在", () => {
    expect(list).toContain('href="/projects/demos"');
    expect(list).toContain("isOperator");
  });

  it("删除比下线更难：页面按超管判定显示，下线按运营", () => {
    // 「难删除、易下线」—— 撤掉一个尴尬的示例应当尽量容易，
    // 而删除不可逆、连素材一起清，要超管。服务端才是真闸，这里只管别把按钮摆错。
    expect(page).toContain("isSuperAdminRole");
    expect(page).toContain("isOperatorRole");
    expect(page).toMatch(/canDelete\s*=\s*isSuperAdminRole/);
  });

  it("发布弹窗给得出「覆盖已有」—— 否则同一张画布存两次就是两张一样的卡", () => {
    expect(host).toContain("demoTarget");
    expect(host).toContain("listDemosForAdmin");
    expect(host).toMatch(/demoId:\s*demoTarget\s*\|\|\s*undefined/);
  });
});
