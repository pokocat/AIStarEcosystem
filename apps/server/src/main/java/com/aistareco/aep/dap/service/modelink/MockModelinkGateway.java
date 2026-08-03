package com.aistareco.aep.dap.service.modelink;

import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * modelink 的内存 mock（**仅 dev / 联调**；由 {@code aep.dap.modelink.allow-mock} 显式开启，
 * 生产 profile 默认关闭且开启即打 ERROR 横幅，§8.0）。
 *
 * <p>状态机按「创建时刻 + 时间差」惰性推进，不开线程：
 * <pre>
 *   liveness_face: 2s 后 pending → awaiting_auth（给出 h5_link + byted_token）
 *                  visualValidate("10000") 后 3s → active；其它 result_code → failed
 *   aigc:          2s 后 pending → active
 *   asset:         2s 后 pending → reviewing；5s 后 approved
 *                  （name 含 "fail" 的 5s 后 failed）
 * </pre>
 * 产出的分组 / 素材在业务侧一律带 {@code mock=true} 标记，绝不与真实认证混淆。
 */
@Component
public class MockModelinkGateway implements ModelinkGateway {

    private final ConcurrentHashMap<String, MockGroup> groups = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, MockAsset> assets = new ConcurrentHashMap<>();
    private final Supplier<Instant> clock;

    public MockModelinkGateway() {
        this(Instant::now);
    }

    /** 测试可注入可控时钟。 */
    public MockModelinkGateway(Supplier<Instant> clock) {
        this.clock = clock;
    }

    private static final class MockGroup {
        String kind;
        Instant createdAt;
        Instant validatedAt;
        String resultCode;
        String bytedToken;
    }

    private static final class MockAsset {
        String name;
        Instant createdAt;
    }

    @Override
    public GroupState createGroup(String kind, String name, String model, String callbackUrl) {
        String id = "mock-grp-" + UUID.randomUUID().toString().substring(0, 12);
        MockGroup g = new MockGroup();
        g.kind = "liveness_face".equals(kind) ? "liveness_face" : "aigc";
        g.createdAt = clock.get();
        g.bytedToken = "mock-byted-" + UUID.randomUUID().toString().substring(0, 10);
        groups.put(id, g);
        return snapshot(id, g);
    }

    @Override
    public GroupState getGroup(String qgroupid) {
        MockGroup g = groups.get(qgroupid);
        if (g == null) throw notFound("分组不存在（mock）: " + qgroupid);
        return snapshot(qgroupid, g);
    }

    @Override
    public void visualValidate(String qgroupid, String resultCode, String bytedToken) {
        MockGroup g = groups.get(qgroupid);
        if (g == null) throw notFound("分组不存在（mock）: " + qgroupid);
        if (g.validatedAt == null) {
            g.validatedAt = clock.get();
            g.resultCode = resultCode;
        }
    }

    @Override
    public AssetState createAsset(String type, String name, String model, String url, String qgroupid) {
        String id = "mock-ast-" + UUID.randomUUID().toString().substring(0, 12);
        MockAsset a = new MockAsset();
        a.name = name == null ? "" : name;
        a.createdAt = clock.get();
        assets.put(id, a);
        return snapshot(id, a);
    }

    @Override
    public AssetState getAsset(String qassetid) {
        MockAsset a = assets.get(qassetid);
        if (a == null) throw notFound("素材不存在（mock）: " + qassetid);
        return snapshot(qassetid, a);
    }

    // ── 惰性状态推进 ───────────────────────────────────────────

    private GroupState snapshot(String id, MockGroup g) {
        long since = secondsSince(g.createdAt);
        if (g.validatedAt != null) {
            if (secondsSince(g.validatedAt) < 3) {
                return new GroupState(id, "awaiting_auth", h5(id), g.bytedToken, null);
            }
            return "10000".equals(g.resultCode)
                    ? new GroupState(id, "active", null, null, null)
                    : new GroupState(id, "failed", null, null, "刷脸未通过（mock，result_code=" + g.resultCode + "）");
        }
        if (since < 2) return new GroupState(id, "pending", null, null, null);
        if ("aigc".equals(g.kind)) return new GroupState(id, "active", null, null, null);
        return new GroupState(id, "awaiting_auth", h5(id), g.bytedToken, null);
    }

    private AssetState snapshot(String id, MockAsset a) {
        long since = secondsSince(a.createdAt);
        boolean shouldFail = a.name.toLowerCase(Locale.ROOT).contains("fail");
        if (since < 2) return new AssetState(id, "pending", null);
        if (since < 5) return new AssetState(id, "reviewing", null);
        return shouldFail
                ? new AssetState(id, "failed", "素材未通过平台审核（mock）")
                : new AssetState(id, "approved", null);
    }

    private long secondsSince(Instant t) {
        return Duration.between(t, clock.get()).getSeconds();
    }

    private static String h5(String id) {
        return "about:blank#mock-face-auth-" + id;
    }

    private static BusinessException notFound(String msg) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "DAP_MODELINK_CALL_FAILED", msg);
    }
}
