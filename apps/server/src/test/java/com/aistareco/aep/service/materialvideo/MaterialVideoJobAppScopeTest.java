package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 回归：{@code material_video_job} 被两条业务线共用（明星带货素材运营 + AI 短剧分镜 / 整集出片），
 * 列表与单查必须按 {@code app} 分区 —— 此前只按 owner 过滤，导致同一用户在
 * <b>明星带货素材库里看到 AI 短剧的视频资产</b>（反向：短剧任务中心里看到带货视频）。
 *
 * <p>用真实 H2 跑（不是 Mockito）：分区判定里含 {@code app} 为 null 的老数据按 {@code kind}
 * 前缀推断的 CASE 表达式（{@link MaterialVideoJobRepository#APP_EXPR}），必须验证 JPQL 真能执行、
 * 且回填前后结果一致。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mvj-app-scope;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true",
        "aep.cdn.driver=local"
})
class MaterialVideoJobAppScopeTest {

    @Autowired private MaterialVideoJobRepository repo;
    @Autowired private MaterialVideoJobService svc;

    private final String user = "mvj-scope-" + UUID.randomUUID();

    private void seed(String id, String app, String kind, String scriptId, String productId) {
        repo.save(MaterialVideoJob.builder()
                .id(id).ownerUserId(user).app(app).kind(kind)
                .scriptId(scriptId).productId(productId)
                .name(id).status("succeeded").progress(100)
                .createdAt(OffsetDateTime.now()).build());
    }

    private Set<String> idsOf(List<JsonNode> cards) {
        return cards.stream().map(c -> c.path("id").asText()).collect(Collectors.toSet());
    }

    @Test
    void listJobs_partitionsByApp_includingLegacyNullAppRows() {
        seed("mvj_cel_new", MaterialVideoJobService.APP_CELEBRITY, "baseline", "sc_1", "prod_1");
        seed("mvj_drama_new", MaterialVideoJobService.APP_DRAMA, "drama-shot", "dp_1", null);
        // 老数据：app 列是 v0.108 才加的，历史行为 null → 按 kind 前缀推断分区。
        seed("mvj_cel_legacy", null, "variant", "sc_1", "prod_1");
        seed("mvj_drama_legacy", null, "drama-episode", "dp_1", null);

        Set<String> celebrity = idsOf(svc.listJobs(user, null, null, MaterialVideoJobService.APP_CELEBRITY));
        assertEquals(Set.of("mvj_cel_new", "mvj_cel_legacy"), celebrity,
                "带货素材库不能出现短剧视频资产");

        Set<String> drama = idsOf(svc.listJobs(user, null, null, MaterialVideoJobService.APP_DRAMA));
        assertEquals(Set.of("mvj_drama_new", "mvj_drama_legacy"), drama,
                "短剧任务中心不能出现带货视频资产");

        // 带过滤条件的两条查询路径同样分区。
        assertEquals(Set.of("mvj_cel_new", "mvj_cel_legacy"),
                idsOf(svc.listJobs(user, "sc_1", null, MaterialVideoJobService.APP_CELEBRITY)));
        assertEquals(Set.of("mvj_cel_new", "mvj_cel_legacy"),
                idsOf(svc.listJobs(user, null, "prod_1", MaterialVideoJobService.APP_CELEBRITY)));
        assertEquals(Set.of("mvj_drama_new", "mvj_drama_legacy"),
                idsOf(svc.listJobs(user, "dp_1", null, MaterialVideoJobService.APP_DRAMA)));
    }

    @Test
    void getJob_deniesCrossAppLookup() {
        seed("mvj_x_drama", MaterialVideoJobService.APP_DRAMA, "drama-shot", "dp_2", null);
        seed("mvj_x_cel", MaterialVideoJobService.APP_CELEBRITY, "baseline", "sc_2", "prod_2");
        seed("mvj_x_drama_legacy", null, "drama-shot", "dp_2", null);

        assertNotNull(svc.getJob("mvj_x_drama", user, MaterialVideoJobService.APP_DRAMA));
        assertNull(svc.getJob("mvj_x_drama", user, MaterialVideoJobService.APP_CELEBRITY));
        assertNull(svc.getJob("mvj_x_drama_legacy", user, MaterialVideoJobService.APP_CELEBRITY));
        assertNotNull(svc.getJob("mvj_x_cel", user, MaterialVideoJobService.APP_CELEBRITY));
        assertNull(svc.getJob("mvj_x_cel", user, MaterialVideoJobService.APP_DRAMA));
    }

    @Test
    void backfillFillsLegacyRowsFromKind() {
        seed("mvj_bf_drama", null, "drama-shot", "dp_3", null);
        seed("mvj_bf_cel", null, "baseline", "sc_3", null);

        repo.backfillAppFromKind();

        assertEquals(MaterialVideoJobService.APP_DRAMA, repo.findById("mvj_bf_drama").orElseThrow().getApp());
        assertEquals(MaterialVideoJobService.APP_CELEBRITY, repo.findById("mvj_bf_cel").orElseThrow().getApp());
        // 回填后分区结果不变（回填只为走索引，不改语义）。
        assertEquals(Set.of("mvj_bf_drama"),
                idsOf(svc.listJobs(user, "dp_3", null, MaterialVideoJobService.APP_DRAMA)));
    }
}
