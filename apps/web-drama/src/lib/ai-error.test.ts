import { describe, it, expect } from "vitest";
import { aiErrorMessage, FEATURE_NOT_READY } from "./ai-error";

// §8.0.1 ⑩：断契约（技术细节不外泄、编号保留、按码映射、引导去哪），不断具体措辞。
describe("aiErrorMessage", () => {
  it("技术泄漏的上游报错 → 兜底文案，保留编号供报障", () => {
    const leaked =
      '端点 agnes HTTP 404: {"error":{"message":"NotFoundError: OpenAIException","type":"upstream_error"}} · 追查号 99D2LCQHUUJD';
    const out = aiErrorMessage(new Error(leaked), "脚本生成失败，请稍后重试");
    expect(out.startsWith("脚本生成失败，请稍后重试")).toBe(true);
    expect(out).toContain("99D2LCQHUUJD");
    expect(out).not.toMatch(/HTTP|upstream_error|OpenAIException|\{/);
  });

  it("命中 HTTP 状态/JSON/异常类等技术特征 → 换兜底文案", () => {
    expect(aiErrorMessage(new Error("视频生成提交失败 HTTP 502"))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error('{"error":"boom"}'))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage(new Error("java.net.ConnectException: refused"))).toBe("AI 生成失败，请稍后重试");
  });

  // v0.88：按 ApiError.code 给专门的友好文案，而不是原文或通用兜底
  it("认识的错误码 → 专门的友好文案（既不是原文，也不是兜底）", () => {
    const fallback = "兜底";
    for (const code of [
      "AI_PROVIDER_TIMEOUT",
      "AI_NOT_CONFIGURED",
      "PROMPT_NOT_CONFIGURED",
      "IMAGE_NOT_CONFIGURED",
      "VIDEO_NOT_CONFIGURED",
      "DRAMA_SHORT_TTS_NOT_CONFIGURED",
      "AI_CALL_FAILED",
      "VIDEO_SUBMIT_FAILED",
      "AI_BAD_OUTPUT",
    ]) {
      const out = aiErrorMessage({ code, message: "raw-upstream-text" }, fallback);
      expect(out, code).not.toBe(fallback);
      expect(out, code).not.toContain("raw-upstream-text");
      expect(out, code).not.toContain(code);
    }
  });

  // v0.197：用户打不开管理后台，「未配置」类提示不许让用户去后台 / 提端点
  it("未配置类错误不引导用户去后台", () => {
    for (const code of ["AI_NOT_CONFIGURED", "PROMPT_NOT_CONFIGURED", "IMAGE_NOT_CONFIGURED", "VIDEO_NOT_CONFIGURED"]) {
      expect(aiErrorMessage({ code, message: "x" }), code).not.toMatch(/后台|端点|用途/);
    }
    const guide = "未为「视频生成」绑定 AI 模型端点。请到 管理后台 → 平台与配置 → AI 模型与 Key 绑定一个端点。";
    expect(aiErrorMessage(new Error(guide))).toBe(FEATURE_NOT_READY);
  });

  it("积分 / 余额不足 → 引导去积分钱包", () => {
    expect(aiErrorMessage({ code: "INSUFFICIENT_BALANCE", message: "x" })).toContain("积分钱包");
    expect(aiErrorMessage(new Error("积分不足，请充值后再试"))).toContain("积分钱包");
  });

  it("干净的业务/引导文案原样透出，但抹掉尾部追查号（对用户是噪声）", () => {
    expect(aiErrorMessage(new Error("请先写这场的场面描述再拆镜 · 追查号 ABC123"))).toBe(
      "请先写这场的场面描述再拆镜",
    );
    expect(aiErrorMessage(new Error("AI 生成失败，请稍后重试"))).toBe("AI 生成失败，请稍后重试");
    // 提到「后台」但不是让用户去后台配置的说明，不能被误伤
    const note = "生成仍在后台进行，请稍后回到本页或任务列表查看";
    expect(aiErrorMessage(new Error(note))).toBe(note);
  });

  it("空 / 非 Error 输入回落到兜底文案", () => {
    expect(aiErrorMessage(null, "大纲生成失败，请稍后重试")).toBe("大纲生成失败，请稍后重试");
    expect(aiErrorMessage(new Error(""))).toBe("AI 生成失败，请稍后重试");
    expect(aiErrorMessage("随便一段普通字符串")).toBe("随便一段普通字符串");
  });
});
