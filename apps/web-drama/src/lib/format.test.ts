import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCredits,
  formatCurrency,
  formatCompactNumber,
  formatPercent,
  formatSignedCurrency,
  formatSignedCredits,
  formatDuration,
} from "./format";

// 展示层格式化是「后端存原始整数、前端格式化」契约的落点（product_spec §3.1）。
// 这些断言锁住边界：负数 / 零 / NaN / 千分位 / 分→元 / 紧凑单位 / 时长进位。

describe("formatNumber", () => {
  it("加千分位、截断小数", () => {
    expect(formatNumber(128500)).toBe("128,500");
    expect(formatNumber(1234.9)).toBe("1,234");
    expect(formatNumber(0)).toBe("0");
  });
  it("非有限值兜底为 0", () => {
    expect(formatNumber(NaN)).toBe("0");
    expect(formatNumber(Infinity)).toBe("0");
  });
});

describe("formatCredits", () => {
  it("等同 formatNumber", () => {
    expect(formatCredits(128500)).toBe("128,500");
  });
});

describe("formatCurrency（分 → 元）", () => {
  it("两位小数 + 货币符号", () => {
    expect(formatCurrency(12850)).toBe("¥128.50");
    expect(formatCurrency(12850, "USD")).toBe("$128.50");
  });
  it("整百分也补两位小数", () => {
    expect(formatCurrency(10000)).toBe("¥100.00");
  });
  it("0 / 缺省安全", () => {
    expect(formatCurrency(0)).toBe("¥0.00");
  });
});

describe("formatCompactNumber", () => {
  it("K / M / B 进位", () => {
    expect(formatCompactNumber(128000)).toBe("128K");
    expect(formatCompactNumber(2_300_000)).toBe("2.3M");
    expect(formatCompactNumber(1_500_000_000)).toBe("1.5B");
  });
  it("千以下原样", () => {
    expect(formatCompactNumber(999)).toBe("999");
  });
});

describe("formatPercent", () => {
  it("默认无小数，可指定位数", () => {
    expect(formatPercent(35)).toBe("35%");
    expect(formatPercent(35.5, 1)).toBe("35.5%");
  });
  it("非有限值兜底 0%", () => {
    expect(formatPercent(NaN)).toBe("0%");
  });
});

describe("带符号格式化（流水用）", () => {
  it("formatSignedCurrency 正负号", () => {
    expect(formatSignedCurrency(8200)).toBe("+¥82.00");
    expect(formatSignedCurrency(-20000)).toBe("-¥200.00");
  });
  it("formatSignedCredits 正负号", () => {
    expect(formatSignedCredits(8200)).toBe("+8,200");
    expect(formatSignedCredits(-20000)).toBe("-20,000");
  });
});

describe("formatDuration", () => {
  it("分钟 < 1 小时 → mm:ss", () => {
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(5)).toBe("0:05");
  });
  it("≥ 1 小时 → hh:mm:ss 补零", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7820)).toBe("2:10:20");
  });
  it("负数 / 小数兜底", () => {
    expect(formatDuration(-10)).toBe("0:00");
    expect(formatDuration(59.9)).toBe("0:59");
  });
});
