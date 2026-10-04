import { afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// 测试里的浏览器存储：本机和 CI 用同一种，每条用例从空的开始（2026-10-04 加）。
//
// 1. Node ≥ 25 自带全局 localStorage / sessionStorage；没给 --localstorage-file 时那个 localStorage 连 getItem 都没有。
//    vitest 3 的 jsdom 环境看到全局上已经有这个名字就不覆盖，于是本机（Node 25）拿到的是 Node 那个坏的：写入一律抛错、
//    被业务代码的 try/catch 吞掉，「按画布记在 localStorage」的东西在本机测试里从没真记住过；CI（Node 22）拿到的是
//    jsdom 的、能用。同一份测试本机绿、CI 红：episodes-view 两条用例在 CI 上红了一天多、4 个 PR 带着它合进 main，本机一直是绿的。
//    这里一律换回 jsdom 自己的那两个。不用 `--no-experimental-webstorage`：Node 20（engines 允许）不认这个参数。
// 2. jsdom 环境按文件建，同一文件里前一条用例经界面写进存储的东西会留给后一条（那次就是前一条在顶栏换了视频模型）。
//    每条用例前清空。用例要预置存储，在自己的 beforeEach 或用例里写（这里的 beforeEach 先跑）。
//    用例自己换上的假存储（内存版 / 会抛错的）照样能用，这里只清当前挂着的那个。
// 结构测试见 src/test-env.test.ts。
// ─────────────────────────────────────────────────────────────────────────────

type StorageName = "localStorage" | "sessionStorage";
const NAMES: StorageName[] = ["localStorage", "sessionStorage"];

const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  // 只取描述符、不读值：读 Node 25 那个 localStorage 会打一行 --localstorage-file 的警告
  const saved = new Map(NAMES.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const));
  for (const name of NAMES) {
    Object.defineProperty(globalThis, name, { configurable: true, enumerable: true, writable: true, value: dom.window[name] });
  }
  afterAll(() => {
    for (const [name, d] of saved) {
      if (d) Object.defineProperty(globalThis, name, d);
      else delete (globalThis as Partial<Record<StorageName, Storage>>)[name];
    }
  });
}

beforeEach(() => {
  if (!dom) return;
  for (const name of NAMES) {
    try {
      globalThis[name].clear();
    } catch {
      /* 用例自己挂了一个会抛错的存储（模拟隐私模式），由它自己收拾 */
    }
  }
});
