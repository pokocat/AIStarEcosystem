package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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

    public DapModelinkPoller(DapMaterialGroupRepository groupRepo,
                             DapMaterialRepository materialRepo,
                             DapRealAuthService realAuth,
                             DapMaterialService materials) {
        this.groupRepo = groupRepo;
        this.materialRepo = materialRepo;
        this.realAuth = realAuth;
        this.materials = materials;
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
}
