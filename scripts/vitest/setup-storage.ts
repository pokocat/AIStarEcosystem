// ─────────────────────────────────────────────────────────────────────────────
// 全仓 vitest 共用的 setupFiles：让本机（Node 25）和 CI（Node 22）看到同一种 Web Storage（2026-10-05）。
// 引用方：apps/web-drama、apps/web-aiavatar、packages/api-client 的 vitest.config.ts。一条规则只写这一处（AGENTS.md §8.0.1 ④）。
//
// Node 25 起 Node 自带的 webstorage 全局（没给 --localstorage-file 时是个空壳，setItem 都不是函数）
// 盖住了 jsdom 的那份；本机跑测试时写 localStorage 一律被 try/catch 吞掉、什么都存不下。CI 用 Node 22，
// 拿到的是 jsdom 真的 Storage —— 于是同一份测试在本机绿、在 CI 红：一条用例把「这张画布选的视频模型」
// 写进 localStorage，后面的用例在 CI 上读到它，本机读不到（v0.198.1 之后 main 上 frontend-tests 一直红的原因）。
//
// 「一致」在两种测试环境里是两件不同的事：
//
// · jsdom 环境（有 document）：Node 22 上 localStorage / sessionStorage 是 jsdom 的真 Storage。
//   本机 Node 25 上两个都被 Node 自己的盖住：localStorage 是空壳，sessionStorage 能用但不是 jsdom 那份。
//   → 不是 jsdom 那份就换回 jsdom 自己的（vitest 在 jsdom 环境里把实例挂在 globalThis.jsdom 上）；
//     万一拿不到（换了别的 DOM 环境），现有的不能用时再退到下面的内存版。已经是 jsdom 那份（Node 22）就什么都不动。
//
// · node 环境（没有 document）：Node 22 上**根本没有** localStorage / sessionStorage 这两个全局
//   （webstorage 在 22 上要显式 --experimental-webstorage 才有）。本机 Node 25 上却有：
//   localStorage 是空壳，sessionStorage 甚至是能用的内存版。
//   → 把这两个全局删掉，让本机和 CI 一样「没有」。**不能**在这里装内存版：那会让 CI 上原本
//     没有 Storage 的用例突然有了，改的是 CI 的行为而不是本机的。api-client 的测试就是故意
//     在 node 环境里自己装最小 window shim，靠「全局没有 Storage」暴露越界访问。
//
// 每个测试文件各自一个进程环境，这里的改动不会跨文件串；同一文件里用例之间要隔离，在那个文件的 beforeEach 里 clear()。
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_NAMES = ["localStorage", "sessionStorage"] as const;

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

function read(target: object, name: string): unknown {
  try {
    return (target as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}

const g = globalThis as Record<string, unknown>;

if (typeof g.document !== "undefined") {
  // jsdom 环境：要一份能用的 Storage，优先 jsdom 自己的（和 Node 22 上拿到的是同一个对象）
  const jsdomWindow = (g.jsdom as { window?: object } | undefined)?.window;
  for (const name of STORAGE_NAMES) {
    const current = read(g, name);
    const fromJsdom = jsdomWindow ? read(jsdomWindow, name) : undefined;
    // 已经是 jsdom 那份（Node 22），或拿不到 jsdom 的但现有的能用：不动
    if (usable(fromJsdom) ? current === fromJsdom : usable(current)) continue;
    // Node 25 的 sessionStorage 能用但不是 jsdom 那份（进程级、不按页面来源分），也换回 jsdom 的
    let value = usable(fromJsdom) ? fromJsdom : new MemoryStorage();
    // vitest 的 jsdom 环境里 window === globalThis，定义在 globalThis 上 window 也就有了。
    // 写成 get/set 访问器，和 Node 22 上 vitest 挂 jsdom 全局的形状一样（不可枚举、可配置；
    // 赋值会替换，不会在严格模式下抛错）
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: false,
      get: () => value,
      set: (next: unknown) => {
        value = next;
      },
    });
  }
} else {
  // node 环境：Node 22 上没有这两个全局，Node 25 的也删掉（能用的 sessionStorage 一样删，22 上它也不存在）
  for (const name of STORAGE_NAMES) {
    if (Object.getOwnPropertyDescriptor(globalThis, name)?.configurable) {
      delete g[name];
    }
  }
}

// 让这个文件是模块：不然 MemoryStorage / usable 会变成引用它的类型程序里的全局名字，
// 产品代码不 import 也能引用到、typecheck 照过、运行时才报 ReferenceError
export {};
