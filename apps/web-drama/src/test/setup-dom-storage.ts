// ─────────────────────────────────────────────────────────────────────────────
// 测试环境：保证 window.localStorage / sessionStorage 是能用的 Storage（2026-10-05）。
//
// Node 25 起 Node 自带的 webstorage 全局（没给 --localstorage-file 时是个空壳，setItem 都不是函数）
// 盖住了 jsdom 的那份；本机跑测试时写 localStorage 一律被 try/catch 吞掉、什么都存不下。CI 用 Node 22，
// 拿到的是 jsdom 真的 Storage —— 于是同一份测试在本机绿、在 CI 红：一条用例把「这张画布选的视频模型」
// 写进 localStorage，后面的用例在 CI 上读到它，本机读不到（v0.198.1 之后 main 上 frontend-tests 一直红的原因）。
//
// 这里只在当前 Storage 不能用时换成内存版，让本机和 CI 的行为一致；能用（Node 22 / jsdom）就什么都不动。
// 每个测试文件各自一个进程环境，内存版不会跨文件串；同一文件里用例之间要隔离，在那个文件的 beforeEach 里 clear()。
// ─────────────────────────────────────────────────────────────────────────────

/** 和 Web Storage 同一套方法（不写 implements Storage：那个接口带字符串索引签名，类实现不了）。 */
class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(String(key)) ? this.map.get(String(key))! : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }
}

function usable(s: unknown): boolean {
  if (!s || typeof (s as Storage).setItem !== "function") return false;
  try {
    const probe = "__storage_probe__";
    (s as Storage).setItem(probe, "1");
    (s as Storage).removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  let current: unknown;
  try {
    current = (globalThis as Record<string, unknown>)[name];
  } catch {
    current = undefined;
  }
  if (usable(current)) continue;
  // vitest 的 jsdom 环境里 window === globalThis，定义在 globalThis 上 window 也就有了
  Object.defineProperty(globalThis, name, { configurable: true, value: new MemoryStorage() });
}

// 让这个文件是模块：不然 MemoryStorage / usable 会变成整个 web-drama 类型程序里的全局名字，
// 产品代码不 import 也能引用到、typecheck 照过、运行时才报 ReferenceError
export {};
