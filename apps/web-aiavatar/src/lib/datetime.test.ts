import { describe, expect, it } from "vitest";
import { formatDateTime } from "./datetime";

describe("时间戳显示", () => {
  it("统一成 年-月-日 时:分:秒", () => {
    expect(formatDateTime("2026-09-09T06:49:36Z")).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("按本地时区算，不是把 ISO 前十位切下来", () => {
    // UTC 的 2026-09-09T23:30 在 +08 已经是 09-10 07:30。
    // 老写法 `iso.slice(0, 10)` 会显示 09-09，晚上落库的东西全差一天。
    const s = formatDateTime("2026-09-09T23:30:00Z");
    const local = new Date("2026-09-09T23:30:00Z");
    expect(s.slice(0, 10)).toBe(
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`,
    );
  });

  it("24 小时制，不出现 AM/PM 也不出现「下午」", () => {
    const s = formatDateTime("2026-09-09T14:05:09Z");
    expect(s).not.toMatch(/[上下]午|AM|PM/i);
  });

  it("空值与坏值给占位，不显示 Invalid Date", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("")).toBe("—");
    expect(formatDateTime("不是时间")).toBe("—");
    expect(formatDateTime(undefined, "未记录")).toBe("未记录");
  });
});

describe("全站只有这一种时间显示", () => {
  it("没有页面再自己切 ISO 前十位 —— 那既不带时分秒，也差了一个时区", async () => {
    const { execSync } = await import("node:child_process");
    // 只查真的作用在时间字段上的那种切法
    const hits = execSync(
      `grep -rnE "(publishedAt|updatedAt|createdAt|importedAt|statusUpdatedAt|signedAt)[^)]*\\.slice\\(0, ?10\\)" ` +
      `app components ip shell proto 2>/dev/null || true`,
      { cwd: process.cwd() + "/src", encoding: "utf8" },
    ).trim();
    expect(hits, `这些地方还在切 ISO：\n${hits}`).toBe("");
  });

  it("没有页面再自己拼「N 分钟前」—— 要对时间做事的人得先在脑子里换算一遍", async () => {
    const { execSync } = await import("node:child_process");
    const hits = execSync(
      `grep -rnE '"[0-9$]*\\{?[a-z]*\\}? ?(分钟|小时|天)前"|\`\\$\\{[a-z]+\\} (分钟|小时|天)前\`' ` +
      `app components/hub components/card ip shell 2>/dev/null || true`,
      { cwd: process.cwd() + "/src", encoding: "utf8" },
    ).trim();
    expect(hits, `这些地方还在拼相对时间：\n${hits}`).toBe("");
  });
});
