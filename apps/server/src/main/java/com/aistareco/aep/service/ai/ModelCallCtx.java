package com.aistareco.aep.service.ai;

import com.aistareco.aep.model.AiModelPurpose;

import java.net.http.HttpClient;

/**
 * 一次上游大模型同步 JSON 调用的上下文（给 {@link UpstreamModelHttp#sendJson} 用）。
 *
 * 承载「这次调用是谁、打哪个端点、归属哪个用户/子应用」等观测元信息，外加少量执行控制位
 * （重试次数 / 失败是否落用量 / 用哪个 HttpClient）。token 数 / 计费单位等只有调用方能解析的
 * 字段不在此处 —— 成功路径的用量落库仍由各调用方负责（见各客户端）。
 *
 * 用 {@link #builder(AiModelPurpose)} 构造；除 purpose / client 外都可省略。
 */
public final class ModelCallCtx {

    private final AiModelPurpose purpose;
    private final String endpointId;
    private final String endpointName;
    private final String model;
    private final String requestId;
    /** 显式归属用户（异步 worker 无 servlet 上下文时用）；为 null 时落库走当前 servlet 安全上下文。 */
    private final String ownerUserId;
    /** 显式子应用归属（music/drama/celebrity/aiavatar…）；为 null 时由 servlet / purpose 推断。 */
    private final String appCode;
    /** 发给上游的请求体（用于 io 日志 + 失败用量的 requestBodyJson）。含敏感大字段时调用方应自行脱敏后再塞。 */
    private final String requestBodyJson;
    /** 重放来源记录 id（admin 试运行 / 重放链路）；一般为 null。 */
    private final String replayOfRecordId;
    /** 失败（非 2xx / 网络异常）时是否由本原语 best-effort 落一条失败用量流水。 */
    private final boolean recordFailureUsage;
    /** 网络异常（IOException）最大尝试次数（含首次）；>1 时按 retryBackoffMs 退避重试。非 2xx 不重试。 */
    private final int maxAttempts;
    private final long retryBackoffMs;
    private final HttpClient client;

    private ModelCallCtx(Builder b) {
        this.purpose = b.purpose;
        this.endpointId = b.endpointId;
        this.endpointName = b.endpointName;
        this.model = b.model;
        this.requestId = b.requestId;
        this.ownerUserId = b.ownerUserId;
        this.appCode = b.appCode;
        this.requestBodyJson = b.requestBodyJson;
        this.replayOfRecordId = b.replayOfRecordId;
        this.recordFailureUsage = b.recordFailureUsage;
        this.maxAttempts = b.maxAttempts;
        this.retryBackoffMs = b.retryBackoffMs;
        this.client = b.client;
    }

    public AiModelPurpose purpose()      { return purpose; }
    public String endpointId()           { return endpointId; }
    public String endpointName()         { return endpointName; }
    public String model()                { return model; }
    public String requestId()            { return requestId; }
    public String ownerUserId()          { return ownerUserId; }
    public String appCode()              { return appCode; }
    public String requestBodyJson()      { return requestBodyJson; }
    public String replayOfRecordId()     { return replayOfRecordId; }
    public boolean recordFailureUsage()  { return recordFailureUsage; }
    public int maxAttempts()             { return maxAttempts; }
    public long retryBackoffMs()         { return retryBackoffMs; }
    public HttpClient client()           { return client; }

    /** purpose wire（== name()）；purpose 为 null 时返回 null。 */
    public String purposeWire() {
        return purpose == null ? null : purpose.name();
    }

    public static Builder builder(AiModelPurpose purpose) {
        return new Builder(purpose);
    }

    public static final class Builder {
        private final AiModelPurpose purpose;
        private String endpointId;
        private String endpointName;
        private String model;
        private String requestId;
        private String ownerUserId;
        private String appCode;
        private String requestBodyJson;
        private String replayOfRecordId;
        private boolean recordFailureUsage = true;
        private int maxAttempts = 1;
        private long retryBackoffMs = 0L;
        private HttpClient client;

        private Builder(AiModelPurpose purpose) {
            this.purpose = purpose;
        }

        public Builder endpoint(String endpointId, String endpointName) {
            this.endpointId = endpointId;
            this.endpointName = endpointName;
            return this;
        }

        public Builder model(String model)                       { this.model = model; return this; }
        public Builder requestId(String requestId)               { this.requestId = requestId; return this; }
        public Builder ownerUserId(String ownerUserId)           { this.ownerUserId = ownerUserId; return this; }
        public Builder appCode(String appCode)                   { this.appCode = appCode; return this; }
        public Builder requestBodyJson(String requestBodyJson)   { this.requestBodyJson = requestBodyJson; return this; }
        public Builder replayOfRecordId(String replayOfRecordId) { this.replayOfRecordId = replayOfRecordId; return this; }
        public Builder recordFailureUsage(boolean v)             { this.recordFailureUsage = v; return this; }
        public Builder maxAttempts(int maxAttempts)              { this.maxAttempts = maxAttempts; return this; }
        public Builder retryBackoffMs(long retryBackoffMs)       { this.retryBackoffMs = retryBackoffMs; return this; }
        public Builder client(HttpClient client)                 { this.client = client; return this; }

        public ModelCallCtx build() {
            if (client == null) {
                throw new IllegalArgumentException("ModelCallCtx.client 不能为空");
            }
            return new ModelCallCtx(this);
        }
    }
}
