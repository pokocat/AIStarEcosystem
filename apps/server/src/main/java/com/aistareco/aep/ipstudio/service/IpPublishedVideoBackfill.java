package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.model.DapDerivative;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 一次性回填：把**已发布**项目画布上的成片登记成视频类衍生资产（v0.181）。
 *
 * <p>v0.181 之前发布只登记图片（{@code DapAvatar} + {@code DapLook}），画布视频哪儿也不去。
 * 而发布是**一次性**动作（重复发布 409），所以已经发布过的 IP 光靠新代码永远补不上 ——
 * 用户在名片里就是没有视频可选，动态名片对他们等于没上线。
 *
 * <p>幂等：按 {@code fileKey} 去重，重复启动是 0 次写入。失败只 WARN，不阻断启动。
 */
@Component
@Order(75)
public class IpPublishedVideoBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(IpPublishedVideoBackfill.class);

    private final IpProjectRepository projects;
    private final DapDerivativeRepository derivRepo;
    private final ObjectMapper om;

    public IpPublishedVideoBackfill(IpProjectRepository projects,
                                    DapDerivativeRepository derivRepo,
                                    ObjectMapper om) {
        this.projects = projects;
        this.derivRepo = derivRepo;
        this.om = om;
    }

    @Override
    public void run(String... args) {
        int added = 0;
        try {
            for (IpProject p : projects.findByStatusAndDeletedAtIsNull(IpProject.STATUS_PUBLISHED)) {
                added += backfillOne(p);
            }
        } catch (Exception e) {
            log.warn("[ipstudio] 已发布项目的视频资产回填失败: {}", e.getMessage());
            return;
        }
        if (added > 0) log.info("[ipstudio] 回填视频资产 {} 条（发布早于 v0.181 的项目）", added);
    }

    private int backfillOne(IpProject p) {
        String avatarId = p.getPublishedAvatarId();
        if (avatarId == null || avatarId.isBlank() || p.getDocJson() == null) return 0;

        Set<String> known = new HashSet<>();
        int nextIdx = 0;
        for (DapDerivative d : derivRepo.findByAvatarIdAndDerivKeyOrderByIdxAsc(avatarId, "video")) {
            if (d.getFileKey() != null) known.add(d.getFileKey());
            nextIdx = Math.max(nextIdx, d.getIdx() + 1);
        }

        JsonNode doc;
        try {
            doc = om.readTree(p.getDocJson());
        } catch (Exception e) {
            return 0;   // 文档坏了不该让回填把启动带崩
        }

        int added = 0;
        for (JsonNode node : IpDocs.nodes(doc)) {
            if (!IpDocs.T_VIDEO.equals(IpDocs.typeOf(node))) continue;
            JsonNode md = IpDocs.metadataOf(node);
            String key = IpDocs.text(md, "storageKey");
            if (key == null || key.isBlank() || known.contains(key)) continue;
            String title = IpDocs.text(node, "title");
            String seconds = IpDocs.text(md, "seconds");
            derivRepo.save(DapDerivative.builder()
                    .id("DV-" + IpProjectService.hex8())
                    .avatarId(avatarId)
                    .ownerUserId(p.getOwnerUserId())
                    .derivKey("video")
                    .idx(nextIdx++)
                    .kind("video")
                    .fileKey(key)
                    .label(IpPublishService.videoLabel(title, nextIdx - 1))
                    .spec(seconds == null || seconds.isBlank() ? "MP4" : seconds + "s · MP4")
                    .bytes(0)
                    .createdAt(Instant.now())
                    .build());
            known.add(key);
            added++;
        }
        return added;
    }

}
