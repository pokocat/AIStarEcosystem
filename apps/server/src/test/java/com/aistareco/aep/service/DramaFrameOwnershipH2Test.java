package com.aistareco.aep.service;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.service.storage.StorageQuotaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 2026-09-30 热修：短剧首帧交给聚算 H3 前的归属判定（{@link DramaReferenceAssembler#ownedFrameKey}）
 * 在真实 H2 上跑一遍 —— 两条新查询（存储台账 {@code ...CdnKeyIn}、任务行末帧带 {@code APP_EXPR} 的 JPQL）
 * 用 mock 测不出拼写 / 语义错误，这里让它们真的执行。
 *
 * <p>配置与 {@code MaterialVideoJobAppScopeTest} 完全一致，复用同一个缓存上下文，不多起一次 Spring。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mvj-app-scope;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true",
        "aep.cdn.driver=local"
})
class DramaFrameOwnershipH2Test {

    @Autowired private DramaReferenceAssembler assembler;
    @Autowired private StorageQuotaService storage;
    @Autowired private StorageAssetRepository storageRepo;
    @Autowired private MaterialVideoJobRepository jobRepo;

    private final String me = "frame-owner-" + UUID.randomUUID();
    private final String other = "frame-other-" + UUID.randomUUID();
    private final String uid = UUID.randomUUID().toString().replace("-", "");

    @Test
    void ledger_frame_is_owned_by_its_recorder_only_and_matches_with_or_without_oss_prefix() {
        String key = "drama/frames/" + uid + ".png";
        // 走真实的记账入口（renderFrame 出首帧时就是这么记的）
        storage.record("drama", me, "分镜首帧", null, key, 1234);

        assertEquals(key, assembler.ownedFrameKey(me, key));
        // keyOf 从生产 URL 抽出来的是带 OSS key-prefix 的对象键 → 仍对得上，返回台账那份
        assertEquals(key, assembler.ownedFrameKey(me, "media/" + key));
        // 别人的图：查不到
        assertNull(assembler.ownedFrameKey(other, key));
        assertNull(assembler.ownedFrameKey(other, "media/" + key));
    }

    @Test
    void ledger_rows_of_other_apps_do_not_count() {
        String key = "material-assets/" + uid + ".png";
        storageRepo.save(StorageAsset.builder().id("sa_" + uid.substring(0, 16)).app("celebrity")
                .ownerUserId(me).category("素材").cdnKey(key).bytes(10).createdAt(OffsetDateTime.now()).build());
        assertNull(assembler.ownedFrameKey(me, key));
    }

    @Test
    void drama_job_last_frame_is_owned_including_legacy_null_app_rows() {
        String newKey = "media/material-videos/mvj_new_" + uid + "/last-frame.png";
        String legacyKey = "media/material-videos/mvj_old_" + uid + "/last-frame.png";
        String celebKey = "media/material-videos/mvj_cel_" + uid + "/last-frame.png";
        job("mvj_new_" + uid, me, "drama", "drama-shot", newKey);
        job("mvj_old_" + uid, me, null, "drama-shot", legacyKey);      // app 列回填前的老行，按 kind 推断
        job("mvj_cel_" + uid, me, "celebrity", "baseline", celebKey); // 本人但带货线的任务：不算短剧素材

        assertEquals(newKey, assembler.ownedFrameKey(me, newKey));
        assertEquals(legacyKey, assembler.ownedFrameKey(me, legacyKey));
        assertNull(assembler.ownedFrameKey(me, celebKey));
        assertNull(assembler.ownedFrameKey(other, newKey));
    }

    private void job(String id, String owner, String app, String kind, String lastFrameKey) {
        jobRepo.save(MaterialVideoJob.builder()
                .id(id).ownerUserId(owner).app(app).kind(kind).scriptId("dp_x")
                .name(id).status("succeeded").progress(100).lastFrameCdnKey(lastFrameKey)
                .createdAt(OffsetDateTime.now()).build());
    }
}
