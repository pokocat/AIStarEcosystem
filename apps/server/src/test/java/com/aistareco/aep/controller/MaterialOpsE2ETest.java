package com.aistareco.aep.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 素材运营 HTTP 接口端到端测试。
 * 走真链路：dev profile（DevAutoAuthFilter 自动登录满足 /api/material/** 的 authenticated）
 * + 内存 H2（隔离）+ 全部 seeder 跑过（脚本/视频/爆款/商品落库）。
 * 覆盖：脚本 list/get/save、视频 list/筛选/batch/delete、爆款 list、商品库集成（p1-p6）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mat-e2e;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
class MaterialOpsE2ETest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper om;

    private JsonNode dataOf(String path) throws Exception {
        String body = mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return om.readTree(body).get("data");
    }

    // ── 脚本 ─────────────────────────────────────────────────────────────────
    @Test
    void listScripts_returnsSharedScripts() throws Exception {
        // 共享脚本（爆款同款 / 官方模板，owner=null）对所有登录用户可见。
        mvc.perform(get("/api/material/scripts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id=='asset-2604')]").exists())  // viral_clone 共享
                .andExpect(jsonPath("$.data[?(@.id=='asset-2401')]").exists()); // template 共享
    }

    @Test
    void scriptScope_isolatesPrivateScripts() throws Exception {
        // 3 个个人脚本（asset-2598/asset-2477/asset-2398）分属 3 个 studio。
        // 当前登录用户至多看到属于自己的那些；其余别人的私有脚本既不在列表里，
        // 也无法通过 getScript 直接取到（owner 校验返回 null）。
        List<String> seedPrivate = List.of("asset-2598", "asset-2477", "asset-2398");
        JsonNode data = dataOf("/api/material/scripts");
        List<String> visiblePrivate = new ArrayList<>();
        boolean sawLegacyOwner = false;
        for (JsonNode s : data) {
            String id = s.get("id").asText();
            if (seedPrivate.contains(id)) visiblePrivate.add(id);
            JsonNode cb = s.get("created_by");
            if (cb != null && "user-bb".equals(cb.asText())) sawLegacyOwner = true;
        }
        // 隔离：绝不会看到全部 3 个（最多看到自己的）
        assertTrue(visiblePrivate.size() <= 1, "个人脚本应按归属隔离，实际可见: " + visiblePrivate);
        // 归属人已映射到真实 seed 用户：列表里不该再有 mock 的 user-bb
        assertTrue(!sawLegacyOwner, "created_by 不应再是 mock 的 user-bb");

        // 不可见的别人私有脚本：getScript 也取不到
        for (String id : seedPrivate) {
            if (!visiblePrivate.contains(id)) {
                mvc.perform(get("/api/material/scripts/" + id))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data").doesNotExist()); // success:true, data:null
            }
        }
    }

    @Test
    void getScript_returnsFullPayloadWithBlocks() throws Exception {
        mvc.perform(get("/api/material/scripts/asset-2604"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value("asset-2604"))
                .andExpect(jsonPath("$.data.product_id").value("p4"))
                .andExpect(jsonPath("$.data.tier").value("S"))
                .andExpect(jsonPath("$.data.blocks.length()").value(5))
                .andExpect(jsonPath("$.data.blocks[0].kind").value("hook"))
                .andExpect(jsonPath("$.data.metrics.ctr_pct").value(9.2));
    }

    @Test
    void saveScript_thenGetBack_roundTrips() throws Exception {
        String body = """
                {"id":"asset-e2e-1","kind":"my_script","name":"E2E 测试脚本","tier":"D",
                 "category":"美妆","hook_type":"反差","product_id":"p3","duration_sec":18,
                 "audience":["女性 25-35"],"platforms":["douyin"],
                 "blocks":[{"kind":"hook","label":"钩子","dur":3,"text":"测试钩子","shot":"特写"}],
                 "metrics":{"uses_count":0,"ctr_pct":0,"diversity_pct":0,"completion_pct":0,"best_video":null,"last_used_at":"2026-05-29T00:00:00Z"},
                 "source":{"type":"user","author":"e2e"},"tags":["测试"],"cover_color":"#7c5cff"}
                """;
        mvc.perform(post("/api/material/scripts").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("asset-e2e-1"));

        mvc.perform(get("/api/material/scripts/asset-e2e-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("E2E 测试脚本"))
                .andExpect(jsonPath("$.data.blocks[0].text").value("测试钩子"));
    }

    // ── 视频 ─────────────────────────────────────────────────────────────────
    @Test
    void listVideos_returnsSeeded() throws Exception {
        mvc.perform(get("/api/material/videos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id=='video-2604-001')]").exists());
    }

    @Test
    void listVideos_filterByProduct() throws Exception {
        // p4 关联 4 条视频；断言返回的每条 product_id 都是 p4
        mvc.perform(get("/api/material/videos").param("product_id", "p4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.product_id!='p4')]").isEmpty())
                .andExpect(jsonPath("$.data[?(@.id=='video-2604-001')]").exists());
    }

    @Test
    void addVideosBatch_thenDelete() throws Exception {
        String body = """
                {"videos":[{"id":"video-e2e-1","script_id":"asset-2604","product_id":"p4","kind":"variant",
                 "name":"E2E 派生视频","status":"ready","duration_sec":30,"aspect_ratio":"9:16",
                 "variant_config":{"character":"human-002","scene":"gym","weather":"sunny","lighting":"warm","role_relation":"个人","voice":"voice-male-02"},
                 "metrics":null,"cover_color":"#22b59a","thumb_emoji":"🎬","created_at":"2026-05-29T00:00:00Z",
                 "generated_at":"2026-05-29T00:00:10Z","render_cost_sec":92,"model":"sora-zh-v3"}]}
                """;
        mvc.perform(post("/api/material/videos/batch").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mvc.perform(get("/api/material/videos"))
                .andExpect(jsonPath("$.data[?(@.id=='video-e2e-1')]").exists());

        mvc.perform(delete("/api/material/videos/video-e2e-1"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/material/videos"))
                .andExpect(jsonPath("$.data[?(@.id=='video-e2e-1')]").isEmpty());
    }

    // ── 爆款雷达 ───────────────────────────────────────────────────────────────
    @Test
    void listViralHits_returnsSeeded() throws Exception {
        mvc.perform(get("/api/material/viral-hits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(4))
                .andExpect(jsonPath("$.data[0].structure.length()").value(5));
    }

    // ── 商品库集成 ─────────────────────────────────────────────────────────────
    @Test
    void productLibrary_includesMaterialProducts() throws Exception {
        // 6 个带货商品并入共享 /api/products；脚本关联商品超链可直达
        mvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id=='p4')]").exists())
                .andExpect(jsonPath("$.data[?(@.id=='p1')]").exists());

        mvc.perform(get("/api/products/p4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("颈椎按摩仪 Pro"))
                .andExpect(jsonPath("$.data.priceCents").value(22900));
    }
}
