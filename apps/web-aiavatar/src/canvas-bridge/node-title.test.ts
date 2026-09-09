import { describe, expect, it } from "vitest";
import { autoNodeTitle, looksAutoTitled } from "./node-title";

// 素材取自线上那条官方示例（v0.194 手工改过标题的那一条）真实的提示词
const 主形象 = "基于图1角色的面部特征，用图2的图片人物穿着和风格，生成一个精致3D娃娃质感的潮玩娃娃形象图片。手上拿着一个圆头棒棒糖";
const 拿手机 = "戴米白色针织冷帽（帽上缝着彩色小布标、笑脸刺绣、花朵徽章），戴复古圆形金边太阳镜，嘴里叼着彩色圆头棒棒糖。穿宽松浅驼色露肩针织衫";
const 视频 = "【主体与画风】主角是参考图中的潮玩女孩，纯白色干净棚拍背景。\n【视频镜头与动作控制(共8秒)】: ";

describe("自动标题", () => {
  it("限长，卡片头一行放得下", () => {
    for (const p of [主形象, 拿手机, 视频]) {
      expect(autoNodeTitle(p, "出图").length).toBeLessThanOrEqual(13); // 12 + 省略号
    }
  });

  it("剥掉【小节标记】—— 否则标题全是「【主体与画风】…」", () => {
    expect(autoNodeTitle(视频, "视频").startsWith("【")).toBe(false);
    expect(autoNodeTitle("[Style] a cat", "图")).not.toContain("[Style]");
    expect(autoNodeTitle("1. 一只猫", "图")).toBe("一只猫");
  });

  it("不从括号中间断开 —— 按顿号切会切出「（帽上缝着彩色小布标」这种", () => {
    const t = autoNodeTitle(拿手机, "出图");
    const open = (t.match(/（/g) || []).length, close = (t.match(/）/g) || []).length;
    expect(open, `括号被切开了：${t}`).toBe(close);
  });

  it("切到第一个硬停顿", () => {
    expect(autoNodeTitle("一只猫。坐在窗台上", "图")).toBe("一只猫");
  });

  it("没有提示词就用类型默认名，不给空标题", () => {
    expect(autoNodeTitle("", "出图")).toBe("出图");
    expect(autoNodeTitle(null, "出图")).toBe("出图");
    expect(autoNodeTitle("   ", "出图")).toBe("出图");
  });
});

describe("认得出「没改过的自动标题」", () => {
  it("线上那批 slice(0,32) 的老标题一律命中", () => {
    expect(looksAutoTitled(拿手机.slice(0, 30), 拿手机)).toBe(true);
    expect(looksAutoTitled(主形象.slice(0, 30), 主形象)).toBe(true);
  });

  it("本函数自己派生的值也命中（截断号不影响判断）", () => {
    expect(looksAutoTitled(autoNodeTitle(主形象, "出图"), 主形象)).toBe(true);
  });

  it("人手改过的名字不命中", () => {
    expect(looksAutoTitled("③ 招牌形象", 主形象)).toBe(false);
    expect(looksAutoTitled("穿针织衫拿手机", 拿手机)).toBe(false);
    expect(looksAutoTitled("开屏打招呼 · 8 秒", 视频)).toBe(false);
  });

  it("短名字一律放过，即使碰巧是提示词开头", () => {
    expect(looksAutoTitled("一只猫", "一只猫坐在窗台上")).toBe(false);
  });

  it("没提示词的节点（上传的图）不算", () => {
    expect(looksAutoTitled("图片", null)).toBe(false);
  });
});
