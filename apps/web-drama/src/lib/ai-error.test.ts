import { describe, it, expect } from "vitest";
import { aiErrorMessage } from "./ai-error";

describe("aiErrorMessage", () => {
  it("脱敏泄漏的上游报错，保留追查号（用户截图的真实场景）", () => {
    const leaked =
      '端点 agnes HTTP 404: {"error":{"message":"NotFoundError: OpenAIException – {\\"detail\\":\\"Not Found\\"}","type":"upstream_error","param":"","code":"404"}} · 追查号 99D2LCQHUUJD';
    expect(aiErrorMessage(new Error(leaked), "脚本生成失败，请稍后重试")).toBe(
      "脚本生成失败，请稍后重试（追查号 99D2LCQHUUJD）",
    );
  });

  it("命中 HTTP 状态/JSON/异常类等技术特征 → 换兜底文案", () => {
    expect(aiErrorMessage(new Error("视频生成提交失败 HTTP 502"))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error('{"error":"boom"}'))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error("java.net.ConnectException: refused"))).toBe("AI 生成失败，请稍后重试");
  });

  it("干净的业务/引导文案原样透出（含追查号）", () => {
    // 后端已在源头封装的友好文案
    expect(aiErrorMessage(new Error("AI 生成失败，请稍后重试 · 追查号 ABC123"))).toBe(
      "AI 生成失败，请稍后重试 · 追查号 ABC123",
    );
    // 业务校验文案
    expect(aiErrorMessage(new Error("积分不足，请充值后再试"))).toBe("积分不足，请充值后再试");
    // 「未配置模型端点」引导（含「端点」但无技术泄漏特征）不应被误伤
    const guide = "未为「视频生成」绑定 AI 模型端点。请到 管理后台 → 平台与配置 → AI 模型与 Key 绑定一个端点。";
    expect(aiErrorMessage(new Error(guide))).toBe(guide);
  });

  it("空 / 非 Error 输入回落到兜底文案", () => {
    expect(aiErrorMessage(null, "大纲生成失败，请稍后重试")).toBe("大纲生成失败，请稍后重试");
    expect(aiErrorMessage(new Error(""))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage("随便一段普通字符串")).toBe("随便一段普通字符串");
  });
});
