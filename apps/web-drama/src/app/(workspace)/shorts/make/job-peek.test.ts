import { afterEach, describe, expect, it, vi } from "vitest";
import { pollClipJob, pollFrameJob } from "@/api/render";
import { peekJob } from "./job-peek";

// 「这条任务还在不在」的判定，fixture 照服务端**真实的响应体**写（§8.0.1 ⑦：不照前端以为的写）：
//   · 不存在 / 不属于你的任务：Controller 回 ApiResponse.of(null)，application.yml 配了
//     jackson default-property-inclusion: non_null → 响应体是 {"success":true}，没有 data 字段。
//   · 服务端从不对缺失任务回 404；404 只会来自网关（HTML 页），那时不知道任务在不在。
// 这里走真的 apiFetch（只替换 fetch），断的是结果状态，不断文案（§8.0.1 ⑩）。

function respond(status: number, body: string, contentType = "application/json") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

function stubFetch(impl: () => unknown) {
  const fn = vi.fn(async () => impl());
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const frame = { jobId: "fj_1", kind: "frame" as const };
const clip = { jobId: "mvj_1", kind: "clip" as const };

describe("peekJob：服务端说「没有这条任务」才算没了", () => {
  it("non_null 序列化后的空结果 {success:true}（没有 data）→ missing，首帧、视频都是", async () => {
    stubFetch(() => respond(200, '{"success":true}'));
    expect((await peekJob(frame)).state).toBe("missing");
    expect((await peekJob(clip)).state).toBe("missing");
  });

  it("显式 data:null 也算 missing", async () => {
    stubFetch(() => respond(200, '{"success":true,"data":null}'));
    expect((await peekJob(frame)).state).toBe("missing");
  });

  it("还在跑 → running；到终态 → terminal（带上任务）", async () => {
    stubFetch(() => respond(200, '{"success":true,"data":{"id":"mvj_1","status":"running"}}'));
    expect((await peekJob(clip)).state).toBe("running");
    stubFetch(() => respond(200, '{"success":true,"data":{"id":"mvj_1","status":"ready","video_url":"https://x/v.mp4"}}'));
    const done = await peekJob(clip);
    expect(done.state).toBe("terminal");
    expect(done.state === "terminal" && (done.job as { video_url?: string }).video_url).toBe("https://x/v.mp4");
  });

  it("断网 / 5xx / 网关 404：查不准 → unknown，任务号要留着（不能放开重新生成）", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    expect((await peekJob(clip)).state).toBe("unknown");
    stubFetch(() => respond(500, '{"success":false,"error":{"code":"INTERNAL_ERROR","message":"x"}}'));
    expect((await peekJob(clip)).state).toBe("unknown");
    stubFetch(() => respond(404, "<html>Not Found</html>", "text/html"));
    expect((await peekJob(frame)).state).toBe("unknown");
  });
});

describe("后台等任务时任务没了：轮询抛错之后的对账能判成 missing（不再永远卡在生成中）", () => {
  it("轮询遇到空结果会抛错，接着 peekJob 判 missing（watchPending / render 的 catch 走的就是这条）", async () => {
    stubFetch(() => respond(200, '{"success":true}'));
    await expect(pollFrameJob(frame.jobId, { timeoutMs: 0 })).rejects.toBeInstanceOf(TypeError);
    await expect(pollClipJob(clip.jobId, { timeoutMs: 0 })).rejects.toBeInstanceOf(TypeError);
    const peek = await pollClipJob(clip.jobId, { timeoutMs: 0 }).catch(() => peekJob(clip));
    expect(peek).toEqual({ state: "missing" });
  });
});
