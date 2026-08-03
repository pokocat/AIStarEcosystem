package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * modelink 非终态收敛轮询（v0.105）。
 *
 * <p>官方明确「不应仅凭浏览器回调参数认定分组已激活」—— 刷脸分组的生效与素材的审核结论
 * 都必须由服务端主动 GET 上游确认。本轮询器负责把这两类非终态行推到终态：
 * <ul>
 *   <li>分组：preparing（建组中）/ validating（已回传刷脸结果，等平台判定）。
 *       awaiting_auth 不主动拉 —— 那是「等用户去刷脸」，由前端查会话 / 回调驱动；</li>
 *   <li>素材：pending / reviewing。</li>
 * </ul>
 *
 * <p>另有一个低频的<b>终态分组回收</b>任务（{@link #reclaimTerminalGroups()}）负责把用完的
 * liveness 分组删回上游 —— modelink 账号级只有 3 个分组配额。
 *
 * <p>无非终态行时直接返回（不打上游、不打日志）。单行失败只 WARN，不中断整轮。
 * 多实例部署需 ShedLock（沿用 DapTrashCleanupScheduler 同样的待办）。
 */
@Component
public class DapModelinkPoller {

    private static final Logger log = LoggerFactory.getLogger(DapModelinkPoller.class);

    private final DapMaterialGroupRepository groupRepo;
    private final DapMaterialRepository materialRepo;
    private final DapRealAuthService realAuth;
    private final DapMaterialService materials;
    private final DapProperties props;

    public DapModelinkPoller(DapMaterialGroupRepository groupRepo,
                             DapMaterialRepository materialRepo,
                             DapRealAuthService realAuth,
                             DapMaterialService materials,
                             DapProperties props) {
        this.groupRepo = groupRepo;
        this.materialRepo = materialRepo;
        this.realAuth = realAuth;
        this.materials = materials;
        this.props = props;
    }

    @Scheduled(fixedDelayString = "${aep.dap.modelink.poll-interval-seconds:10}000")
    public void poll() {
        List<DapMaterialGroup> groups = groupRepo.findByStatusIn(DapRealAuthService.PENDING_STATUSES);
        List<DapMaterial> mats = materialRepo.findByStatusIn(DapMaterialService.PENDING_STATUSES);
        if (groups.isEmpty() && mats.isEmpty()) return; // 常态：零上游请求

        for (DapMaterialGroup g : groups) {
            try {
                realAuth.refresh(g);
            } catch (Exception e) {
                log.warn("[dap-modelink-poll] group refresh failed id={} err={}", g.getId(), e.getMessage());
            }
        }
        for (DapMaterial m : mats) {
            try {
                materials.refresh(m);
            } catch (Exception e) {
                log.warn("[dap-modelink-poll] material refresh failed id={} err={}", m.getId(), e.getMessage());
            }
        }
    }

    /**
     * 终态分组回收（配额治理，v0.105-补丁）—— modelink 账号级只有 3 个分组，而 liveness 是
     * 「每次真人捕获建一个」，不回收很快就把整个平台的认证通道堵死。
     *
     * <p>判定刻意保守，三条同时满足才删：
     * <ol>
     *   <li>kind=liveness_face 且状态 <b>failed</b>（<b>active 绝不删</b> —— 生效授权的取证凭据）；</li>
     *   <li>创建已超过 {@code aep.dap.modelink.group-retention-hours}（默认 24h，留排障窗口）；</li>
     *   <li>本地没有挂在该组下的非 failed 素材（上游同样会以 409 拒绝非空分组）。</li>
     * </ol>
     * 删除失败只 WARN 并保留 {@code recycledAt=null}，下轮再试。
     */
    @Scheduled(fixedDelayString = "${aep.dap.modelink.group-reclaim-interval-seconds:3600}000",
            initialDelayString = "${aep.dap.modelink.group-reclaim-interval-seconds:3600}000")
    public void reclaimTerminalGroups() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(
                Math.max(1, props.getModelink().getGroupRetentionHours())));
        List<DapMaterialGroup> stale = groupRepo
                .findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore("liveness_face", "failed", cutoff);
        if (stale.isEmpty()) return; // 常态：零上游请求

        int freed = 0;
        for (DapMaterialGroup g : stale) {
            try {
                if (materialRepo.countByGroupIdAndStatusNot(g.getId(), "failed") > 0) {
                    log.info("[dap-modelink-reclaim] 跳过（组内仍有素材）id={}", g.getId());
                    continue;
                }
                if (realAuth.recycleGroup(g)) freed++;
            } catch (Exception e) {
                log.warn("[dap-modelink-reclaim] group reclaim failed id={} err={}", g.getId(), e.getMessage());
            }
        }
        if (freed > 0) log.info("[dap-modelink-reclaim] 已回收 {}/{} 个终态分组的上游配额", freed, stale.size());
    }
}
