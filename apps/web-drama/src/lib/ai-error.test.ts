import { describe, it, expect } from "vitest";
import { aiErrorMessage } from "./ai-error";

describe("aiErrorMessage", () => {
  it("技术泄漏的上游报错 → 兜底文案，保留追查号供报障", () => {
    const leaked =
      '端点 agnes HTTP 404: {"error":{"message":"NotFoundError: OpenAIException","type":"upstream_error"}} · 追查号 99D2LCQHUUJD';
    expect(aiErrorMessage(new Error(leaked), "脚本生成失败，请稍后重试")).toBe(
      "脚本生成失败，请稍后重试（追查号 99D2LCQHUUJD）",
    );
  });

  it("命中 HTTP 状态/JSON/异常类等技术特征 → 换兜底文案", () => {
    expect(aiErrorMessage(new Error("视频生成提交失败 HTTP 502"))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error('{"error":"boom"}'))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error("java.net.ConnectException: refused"))).toBe("AI 生成失败，请稍后重试");
  });

  // v0.88：按 ApiError.code 给可操作友好文案（用户真模型链路常见异常）
  it("按错误码给友好文案（超时 / 未配置 / 无法解析）", () => {
    expect(aiErrorMessage({ code: "AI_PROVIDER_TIMEOUT", message: "timeout" })).toContain("超时");
    expect(aiErrorMessage({ code: "AI_NOT_CONFIGURED", message: "x" })).toContain("绑定");
    expect(aiErrorMessage({ code: "PROMPT_NOT_CONFIGURED", message: "x" })).toContain("提示词");
    expect(aiErrorMessage({ code: "AI_BAD_OUTPUT", message: "x" })).toContain("换个说法");
    expect(aiErrorMessage({ code: "VIDEO_NOT_CONFIGURED", message: "x" })).toContain("视频生成");
  });

  it("积分 / 余额不足 → 引导去积分钱包", () => {
    expect(aiErrorMessage({ code: "INSUFFICIENT_BALANCE", message: "x" })).toContain("钱包");
    expect(aiErrorMessage(new Error("积分不足，请充值后再试"))).toContain("钱包");
  });

  it("干净的业务/引导文案原样透出，但抹掉尾部「追查号」（对用户是噪声）", () => {
    expect(aiErrorMessage(new Error("请先写这场的场面描述再拆镜 · 追查号 ABC123"))).toBe(
      "请先写这场的场面描述再拆镜",
    );
    expect(aiErrorMessage(new Error("AI 生成失败，请稍后重试"))).toBe("AI 生成失败，请稍后重试");
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
