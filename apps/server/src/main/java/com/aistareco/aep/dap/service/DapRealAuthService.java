package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.RealAuthSessionDto;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.GroupState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 真人授权（刷脸认证）链路（v0.105）—— 替代此前「素材存在即视为核验通过」的假核验。
 *
 * <p>流程：
 * <pre>
 *   1. start()      建 liveness_face 分组 → 拿 qgroupid（status=preparing）
 *   2. getSession() 轮询到 awaiting_auth → 返回 h5Url（约 120s 有效），用户在该页面刷脸
 *   3. 刷脸完成 → 浏览器回跳 GET /api/v1/real-auth/callback?state=<callbackToken>&resultCode=&bytedToken=
 *      handleCallback() 把 resultCode + byted_token 回传上游（202 受理）→ 本地 status=validating
 *   4. 轮询器 / getSession() 收敛远端终态 → active（授权成立）或 failed
 *   5. captures/{id}/verify 只在分组 active 时放行（见 DapCaptureService.verify）
 * </pre>
 *
 * <p>§8.0：未绑定 modelink 端点且不允许 mock → start() 直接 503，**不落会话行**、不产假授权。
 * 官方明确「不应仅凭浏览器回调参数认定分组已激活」，故回调只负责回传凭证，生效与否一律以
 * GET 分组的远端状态为准。
 */
@Service
public class DapRealAuthService {

    private static final Logger log = LoggerFactory.getLogger(DapRealAuthService.class);

    /** 本地非终态（轮询器需要继续收敛的状态）。 */
    public static final java.util.List<String> PENDING_STATUSES = java.util.List.of("preparing", "validating");

    private final DapMaterialGroupRepository groupRepo;
    private final DapCaptureRepository captureRepo;
    private final ModelinkService modelink;
    private final DapProperties props;
    private final DapSupport support;

    public DapRealAuthService(DapMaterialGroupRepository groupRepo,
                              DapCaptureRepository captureRepo,
                              ModelinkService modelink,
                              DapProperties props,
                              DapSupport support) {
        this.groupRepo = groupRepo;
        this.captureRepo = captureRepo;
        this.modelink = modelink;
        this.props = props;
        this.support = support;
    }

    // ── 会话 ───────────────────────────────────────────────────

    /** 开启（或幂等复用）某次真人捕获的刷脸认证会话。 */
    @Transactional
    public RealAuthSessionDto start(String userId, String captureId) {
        DapCapture c = requiredCapture(userId, captureId);
        if (c.getFootageKey() == null || c.getFootageKey().isBlank()) {
            throw BusinessException.badRequest("DAP_NO_FOOTAGE", "请先录制或上传素材");
        }
        // 幂等：同一次捕获已有未失败的会话 → 刷新后原样返回，不重复建组
        if (c.getAuthGroupId() != null) {
            DapMaterialGroup existing = groupRepo.findByIdAndOwnerUserId(c.getAuthGroupId(), userId).orElse(null);
            if (existing != null && !"failed".equals(existing.getStatus())) {
                return refreshAndBuild(existing);
            }
            // 上次认证失败 → 下面会另建一个上游分组。modelink 账号级只有 3 个分组，
            // 不先把旧的删掉，两次失败重试就能把整个平台的分组配额漏光（v0.105-补丁修复）。
            if (existing != null) recycleGroup(existing);
        }

        String id = uniqueId();
        String token = UUID.randomUUID().toString().replace("-", "");
        String model = modelink.boundModel();
        String callbackUrl = callbackUrl(token);
        boolean mock = modelink.isMockMode();

        // 先调上游再落库：未配置（503）/ 上游失败时不留下悬空会话行（§8.0 不产假数据）
        GroupState st = modelink.createGroup("liveness_face", groupName(captureId), model, callbackUrl);

        Instant now = Instant.now();
        DapMaterialGroup g = DapMaterialGroup.builder()
                .id(id)
                .ownerUserId(userId)
                .kind("liveness_face")
                .model(model)
                .qgroupid(st.qgroupid())
                .status(mapStatus(st.status(), "preparing"))
                .failReason(st.failReason())
                .avatarId(c.getAvatarId())
                .captureId(c.getId())
                .callbackToken(token)
                .bytedToken(st.bytedToken())
                .mock(mock)
                .createdAt(now)
                .updatedAt(now)
                .build();
        groupRepo.save(g);

        c.setAuthGroupId(g.getId());
        captureRepo.save(c);
        log.info("[dap-realauth] session started id={} capture={} qgroupid={} mock={}",
                g.getId(), c.getId(), g.getQgroupid(), mock);
        return RealAuthSessionDto.from(g, st.h5Link());
    }

    /** 查询会话（非终态时向上游刷新一次；awaiting_auth 时带出 h5Url）。 */
    @Transactional
    public RealAuthSessionDto getSession(String userId, String id) {
        return refreshAndBuild(required(userId, id));
    }

    public DapMaterialGroup required(String userId, String id) {
        return groupRepo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_AUTH_SESSION_NOT_FOUND", "认证会话不存在或无权访问"));
    }

    /**
     * 核验闸：该次捕获必须已有 active 的刷脸认证会话，否则 409。
     * 由 {@link DapCaptureService#verify} 调用 —— verify 是「真人授权成立」的唯一完成漏斗。
     */
    @Transactional
    public DapMaterialGroup requireActiveSession(String userId, DapCapture c) {
        DapMaterialGroup g = c.getAuthGroupId() == null ? null
                : groupRepo.findByIdAndOwnerUserId(c.getAuthGroupId(), userId).orElse(null);
        if (g == null) throw notCompleted(null);
        refresh(g);
        if (!"active".equals(g.getStatus())) throw notCompleted(g);
        return g;
    }

    private static BusinessException notCompleted(DapMaterialGroup g) {
        String extra = g == null ? ""
                : ("failed".equals(g.getStatus()) ? "（上次认证未通过，请重新发起）" : "（认证进行中，请稍候）");
        return new BusinessException(HttpStatus.CONFLICT, "DAP_AUTH_NOT_COMPLETED",
                "请先完成刷脸认证" + extra);
    }

    // ── 远端状态收敛 ───────────────────────────────────────────

    /**
     * 向上游刷新一次分组状态并落库（终态直接返回）。
     * 返回上游快照（可能为 null：终态或无 qgroupid 时不发请求）。
     */
    @Transactional
    public GroupState refresh(DapMaterialGroup g) {
        if (g == null || isTerminal(g.getStatus()) || g.getQgroupid() == null) return null;
        GroupState st = modelink.getGroup(g.getQgroupid());
        String remote = st.status() == null ? "" : st.status();
        // validating（已回传刷脸结果、等平台判定）期间远端仍是 awaiting_auth → 保持本地 validating，
        // 只有远端给出 active / failed 才收敛。
        boolean holdValidating = "validating".equals(g.getStatus()) && !"active".equals(remote) && !"failed".equals(remote);
        if (!holdValidating) {
            g.setStatus(mapStatus(remote, g.getStatus()));
        }
        if (st.bytedToken() != null && !st.bytedToken().isBlank()) g.setBytedToken(st.bytedToken());
        if (st.failReason() != null && !st.failReason().isBlank()) g.setFailReason(st.failReason());
        g.setUpdatedAt(Instant.now());
        groupRepo.save(g);
        if ("active".equals(g.getStatus())) {
            log.info("[dap-realauth] session active id={} capture={}", g.getId(), g.getCaptureId());
        } else if ("failed".equals(g.getStatus())) {
            log.warn("[dap-realauth] session failed id={} capture={} reason={}",
                    g.getId(), g.getCaptureId(), g.getFailReason());
        }
        return st;
    }

    // ── 分组回收（配额治理，v0.105-补丁）─────────────────────────

    /**
     * best-effort 回收上游分组，把 modelink 的分组配额（账号级仅 3 个）还回去。
     *
     * <p>安全边界：
     * <ul>
     *   <li>只回收 <b>failed</b> 分组。<b>active 绝不删</b> —— 那是生效授权的取证凭据，
     *       删了授权链就断了；非终态上游也会以 409 拒绝。</li>
     *   <li>删成功才打 {@code recycledAt}；删失败（409 非空 / 上游抖动）只 WARN 并保留，
     *       由回收器下轮重试 —— 绝不阻断调用方（新建会话 / 整轮清理）。</li>
     * </ul>
     *
     * @return 上游分组是否已确认不存在（删成功或本就没有 qgroupid）
     */
    @Transactional
    public boolean recycleGroup(DapMaterialGroup g) {
        if (g == null || g.getRecycledAt() != null) return false;
        if (!"failed".equals(g.getStatus())) return false;
        if (g.getQgroupid() == null || g.getQgroupid().isBlank()) {
            markRecycled(g);
            return true;
        }
        try {
            modelink.deleteGroup(g.getQgroupid());
        } catch (RuntimeException e) {
            log.warn("[dap-realauth] 回收上游分组失败（保留，下轮再试）id={} qgroupid={} err={}",
                    g.getId(), g.getQgroupid(), e.getMessage());
            return false;
        }
        markRecycled(g);
        log.info("[dap-realauth] 已回收上游分组 id={} qgroupid={}", g.getId(), g.getQgroupid());
        return true;
    }

    private void markRecycled(DapMaterialGroup g) {
        g.setRecycledAt(Instant.now());
        g.setUpdatedAt(Instant.now());
        groupRepo.save(g);
    }

    private RealAuthSessionDto refreshAndBuild(DapMaterialGroup g) {
        GroupState st = refresh(g);
        return RealAuthSessionDto.from(g, st == null ? null : st.h5Link());
    }

    // ── 刷脸回跳 ───────────────────────────────────────────────

    /**
     * 浏览器刷脸回跳（无 JWT，靠不可枚举的 state = callbackToken 防伪）。
     *
     * <p>幂等：{@code validateCalledAt} 是唯一闸 —— byted_token 是一次性凭证，重复回调不得二次回传。
     * 返回极简自包含 HTML（无外链），真正的生效判定由后续轮询 GET 分组收敛。
     */
    @Transactional
    public String handleCallback(String state, String resultCode, String bytedToken) {
        if (state == null || state.isBlank()) return page(false, "认证链接无效", "请返回应用重新发起认证。");
        DapMaterialGroup g = groupRepo.findByCallbackToken(state).orElse(null);
        if (g == null) {
            log.warn("[dap-realauth] callback with unknown state（可能是过期或伪造链接）");
            return page(false, "认证链接已失效", "请返回应用重新发起认证。");
        }
        boolean ok = "10000".equals(resultCode);
        if (isTerminal(g.getStatus()) || g.getValidateCalledAt() != null) {
            // 重复回调：不再消耗一次性凭证
            return page("failed".equals(g.getStatus()) ? false : ok,
                    "认证已提交", "该认证结果已处理，请返回应用查看结果。");
        }
        // 先占幂等闸再调上游：并发 / 重复回跳只会有一次回传
        g.setValidateCalledAt(Instant.now());
        g.setUpdatedAt(Instant.now());
        groupRepo.saveAndFlush(g);

        String token = bytedToken != null && !bytedToken.isBlank() ? bytedToken : g.getBytedToken();
        try {
            // 非 10000 也照实透传：平台据此判 failed，不消耗有效凭证
            modelink.visualValidate(g.getQgroupid(), resultCode == null ? "" : resultCode, token);
        } catch (RuntimeException e) {
            // 回传从未到达上游 → 这次会话已经死了，必须**当场判终态 failed**：
            //   · validateCalledAt 已占闸，重复回跳不会再回传（一次性凭证也已作废）；
            //   · 远端会永远停在 awaiting_auth，refresh() 的 holdValidating 会把本地
            //     永久 hold 在 validating —— 用户卡在「核验中」，轮询器还每 10s 空转这行。
            // 置 failed 后：轮询器不再碰（终态）、前端可给「重新认证」、start() 会为
            // failed 会话另建新分组拿新凭证，链路自洽。
            log.warn("[dap-realauth] visual-validate 回传失败 id={} err={} → 会话判 failed", g.getId(), e.getMessage());
            g.setStatus("failed");
            g.setFailReason("认证结果回传失败：" + e.getMessage());
            g.setUpdatedAt(Instant.now());
            groupRepo.save(g);
            return page(false, "认证提交失败", "认证结果没能提交成功，请返回应用重新发起认证。");
        }
        g.setStatus("validating");
        g.setUpdatedAt(Instant.now());
        groupRepo.save(g);

        return ok
                ? page(true, "认证已提交", "请返回应用查看结果，我们正在确认你的授权。")
                : page(false, "认证未通过", "请返回应用重试刷脸认证。");
    }

    // ── helpers ───────────────────────────────────────────────

    /** modelink 状态 → 本地状态；未知值保留原状态。 */
    static String mapStatus(String remote, String fallback) {
        if (remote == null) return fallback;
        return switch (remote.toLowerCase()) {
            case "pending" -> "preparing";
            case "awaiting_auth" -> "awaiting_auth";
            case "active" -> "active";
            case "failed" -> "failed";
            default -> fallback;
        };
    }

    static boolean isTerminal(String status) {
        return "active".equals(status) || "failed".equals(status);
    }

    private String callbackUrl(String token) {
        String base = props.getModelink().getCallbackBaseUrl();
        String b = base == null || base.isBlank() ? "" : base.trim();
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b + "/api/v1/real-auth/callback?state=" + token;
    }

    private static String groupName(String captureId) {
        String n = "aiavatar-liveness-" + captureId;
        return n.length() <= 64 ? n : n.substring(0, 64);
    }

    private DapCapture requiredCapture(String userId, String captureId) {
        return captureRepo.findByIdAndOwnerUserId(captureId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_CAPTURE_NOT_FOUND", "捕获会话不存在或无权访问"));
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("MG");
            if (!groupRepo.existsById(id)) return id;
        }
        return "MG-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** 回跳落地页：自包含内联样式，不引外链、不含任何用户数据。 */
    private static String page(boolean ok, String title, String desc) {
        String accent = ok ? "#1F9D55" : "#D6453C";
        return """
                <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>%s</title>
                <style>
                  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#F4F6F8;margin:0;
                       min-height:100vh;display:grid;place-items:center;padding:24px;}
                  .card{max-width:360px;width:100%%;background:#fff;border:1px solid #E3E8EE;border-radius:16px;
                        padding:32px 28px;text-align:center;}
                  .dot{width:56px;height:56px;border-radius:99px;margin:0 auto 18px;display:grid;place-items:center;
                       background:%s;color:#fff;font-size:26px;font-weight:700;}
                  h1{font-size:19px;margin:0 0 8px;color:#1B2330;}
                  p{font-size:13.5px;color:#7A8699;line-height:1.6;margin:0;}
                </style></head><body><div class="card">
                <div class="dot">%s</div><h1>%s</h1><p>%s</p>
                </div></body></html>
                """.formatted(title, accent, ok ? "✓" : "!", title, desc);
    }
}
