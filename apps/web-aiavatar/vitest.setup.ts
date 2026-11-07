// 默认 findBy / waitFor 只等 1 秒。pnpm test:all 同时跑全部项目，机器一忙就差这一点，报「找不到元素」的假失败（2026-11-07）。
// 这里等的是页面出现结果，不是在测速度，真卡住的用例照样会失败。
if (typeof document !== "undefined") {
  const { configure } = await import("@testing-library/react");
  configure({ asyncUtilTimeout: 5_000 });
}
export {};
