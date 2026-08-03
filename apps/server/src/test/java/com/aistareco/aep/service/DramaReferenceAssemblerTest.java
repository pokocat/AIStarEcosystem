package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaCharacter;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaScene;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.DramaCharacterRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaSceneRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.DramaReferenceAssembler.AppliedRef;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.DramaReferenceAssembler.Candidate;
import com.aistareco.aep.service.DramaReferenceAssembler.Capability;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * C-3 服务端参考装配（DramaReferenceAssembler）纯函数 + 集成矩阵（Mockito，无 Spring / 无网络）：
 *  - 裁剪 classifyImageRefs（priority / dedup / capability maxRefImages / local_unfetchable / over_max_refs）
 *  - classifyClipFrames（首尾帧 vs supportsFlf / local_unfetchable）
 *  - shot_ref 定位 episodeDocs 嵌套 shot + 角色 @cast 命中 / 文本名兜底 / 全员
 *  - scene 显式 sceneRefId / 名称兜底；prev_last_frame 文档优先 vs MaterialVideoJob 权威回退（lastFrameCdnKey）
 *  - 三级入参优先级 shot_ref &gt; ref_slots &gt; ref_images
 */
class DramaReferenceAssemblerTest {

    private final ObjectMapper om = new ObjectMapper();
    private final DramaProjectRepository projectRepo = mock(DramaProjectRepository.class);
    private final DramaCharacterRepository charRepo = mock(DramaCharacterRepository.class);
    private final DramaSceneRepository sceneRepo = mock(DramaSceneRepository.class);
    private final MaterialVideoJobRepository videoJobRepo = mock(MaterialVideoJobRepository.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);

    private DramaReferenceAssembler assembler() {
        // signKey：cdnKey → 稳定可抓取的 https URL；maybeSign：透传（不改）。
        when(signer.signKey(anyString())).thenAnswer(inv -> "https://oss.test/" + inv.getArgument(0));
        when(signer.maybeSign(anyString())).thenAnswer(inv -> inv.getArgument(0));
        return new DramaReferenceAssembler(projectRepo, charRepo, sceneRepo, videoJobRepo, signer, om);
    }

    private Candidate c(String role, String url) {
        return new Candidate(role, url);
    }

    // ── 纯函数：图像参考裁剪 priority / dedup / capability ─────────────────────────

    @Test
    void classify_priority_preserved_and_trimmed_by_maxRefImages() {
        List<Candidate> ordered = List.of(
                c("character", "https://oss.test/a.png"),
                c("character", "https://oss.test/b.png"),
                c("scene", "https://oss.test/c.png"),
                c("prev_last_frame", "https://oss.test/d.png"));
        // max=1 → 只首位 character 送达，其余 over_max_refs（末位先砍，identity 优先）。
        List<AppliedRef> m1 = DramaReferenceAssembler.classifyImageRefs(ordered, 1);
        assertEquals(1, m1.stream().filter(AppliedRef::applied).count());
        assertTrue(m1.get(0).applied());
        assertEquals("over_max_refs", m1.get(3).reason());
        // max=4 → 全送。
        assertEquals(4, DramaReferenceAssembler.classifyImageRefs(ordered, 4)
                .stream().filter(AppliedRef::applied).count());
        // max=6（>候选数） → 全送，无 over_max_refs。
        List<AppliedRef> m6 = DramaReferenceAssembler.classifyImageRefs(ordered, 6);
        assertEquals(4, m6.stream().filter(AppliedRef::applied).count());
        assertTrue(m6.stream().noneMatch(r -> "over_max_refs".equals(r.reason())));
    }

    @Test
    void legacy_default_maxRefImages_is_6_matching_v097_frontend_cap() {
        // 回归守护：capability 未配置（D-11 seeder 回填的存量候选全 null）→ legacy 兼容默认 6
        // （= v0.97 前端 shotRefImages slice(0,6) 既有上限），不是保守 1——否则升级当天
        // 多参考一致性（角色+场景+镜间承接）被整体削到 1 张。
        assertEquals(6, DramaReferenceAssembler.LEGACY_MAX_REF_IMAGES);
        List<Candidate> six = List.of(
                c("character", "https://oss.test/c1.png"),
                c("character", "https://oss.test/c2.png"),
                c("character", "https://oss.test/c3.png"),
                c("character", "https://oss.test/c4.png"),
                c("scene", "https://oss.test/s.png"),
                c("prev_last_frame", "https://oss.test/p.png"));
        List<AppliedRef> m = DramaReferenceAssembler.classifyImageRefs(six, DramaReferenceAssembler.LEGACY_MAX_REF_IMAGES);
        assertEquals(6, m.stream().filter(AppliedRef::applied).count());
        assertTrue(m.stream().noneMatch(r -> "over_max_refs".equals(r.reason())));
    }

    @Test
    void classify_dedup_keeps_first_occurrence() {
        List<Candidate> ordered = List.of(
                c("character", "https://oss.test/same.png"),
                c("scene", "https://oss.test/same.png"));  // 同 URL → 去重，仅保留 character
        List<AppliedRef> m = DramaReferenceAssembler.classifyImageRefs(ordered, 6);
        assertEquals(1, m.size());
        assertEquals("character", m.get(0).role());
    }

    @Test
    void classify_local_ref_marked_unfetchable_and_does_not_consume_cap() {
        List<Candidate> ordered = List.of(
                c("character", "/cdn/drama/x.png"),          // dev fake-CDN 相对路径
                c("character", "https://oss.test/ok.png"));
        // max=1：本地项标 local_unfetchable 且不占额度 → https 项仍送达。
        List<AppliedRef> m = DramaReferenceAssembler.classifyImageRefs(ordered, 1);
        assertEquals("local_unfetchable", m.get(0).reason());
        assertFalse(m.get(0).applied());
        assertTrue(m.get(1).applied());
    }

    // ── 纯函数：视频首尾帧归类 ────────────────────────────────────────────────────

    @Test
    void clip_last_frame_gated_by_supportsFlf() {
        List<AppliedRef> yes = DramaReferenceAssembler.classifyClipFrames(
                "https://oss.test/f.png", "https://oss.test/l.png", true);
        assertEquals(2, yes.stream().filter(AppliedRef::applied).count());
        assertEquals("first_frame", yes.get(0).role());
        assertEquals("last_frame", yes.get(1).role());

        List<AppliedRef> no = DramaReferenceAssembler.classifyClipFrames(
                "https://oss.test/f.png", "https://oss.test/l.png", false);
        assertTrue(no.get(0).applied());
        assertFalse(no.get(1).applied());
        assertEquals("model_no_flf", no.get(1).reason());

        List<AppliedRef> local = DramaReferenceAssembler.classifyClipFrames("/cdn/f.png", "/cdn/l.png", true);
        assertTrue(local.stream().allMatch(r -> "local_unfetchable".equals(r.reason())));
    }

    // ── 集成：shot_ref 定位 episodeDocs 嵌套 shot + 角色装配 ─────────────────────────

    private void stubProject(String projectId, String ownerUserId, ObjectNode payload) {
        DramaProject row = DramaProject.builder()
                .id(projectId).ownerUserId(ownerUserId).payloadJson(payload.toString()).build();
        when(projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(eq(projectId), eq(ownerUserId)))
                .thenReturn(Optional.of(row));
    }

    /** 造一个含 episodeDocs[3].storyboard.scenes[sc_3_1].shots + characters/scenes 的 payload。 */
    private ObjectNode payloadWithShot(String[] cast, String shotDesc) {
        ObjectNode root = om.createObjectNode();
        var chars = root.putArray("characters");
        ObjectNode ch1 = chars.addObject();
        ch1.put("id", "ch_1"); ch1.put("name", "林夏"); ch1.put("avatarImage", "https://oss.test/doc-avatar.png");
        var scenesArr = root.putArray("scenes");
        ObjectNode sa = scenesArr.addObject();
        sa.put("id", "sa_1"); sa.put("name", "咖啡馆"); sa.put("refUrl", "https://oss.test/cafe-doc.png");

        ObjectNode storyboard = om.createObjectNode();
        var scArr = storyboard.putArray("scenes");
        ObjectNode sc = scArr.addObject();
        sc.put("id", "sc_3_1");
        var shots = sc.putArray("shots");
        ObjectNode s1 = shots.addObject();
        s1.put("id", "sc_3_1_s1");
        var castArr = s1.putArray("cast");
        if (cast != null) for (String x : cast) castArr.add(x);
        s1.put("desc", shotDesc == null ? "" : shotDesc);

        ObjectNode script = om.createObjectNode();
        var scriptScenes = script.putArray("scenes");
        ObjectNode ss = scriptScenes.addObject();
        ss.put("id", "sc_3_1"); ss.put("place", "咖啡馆内景 · 白天");

        ObjectNode ed = om.createObjectNode();
        ObjectNode ed3 = ed.putObject("3");
        ed3.set("storyboard", storyboard);
        ed3.set("script", script);
        root.set("episodeDocs", ed);
        return root;
    }

    private ObjectNode shotRefBody(boolean chain) {
        ObjectNode body = om.createObjectNode();
        ObjectNode ref = body.putObject("shot_ref");
        ref.put("project_id", "dp_1");
        ref.put("episode_no", 3);
        ref.put("scene_id", "sc_3_1");
        ref.put("shot_id", "sc_3_1_s1");
        ref.put("chain_consistency", chain);
        return body;
    }

    @Test
    void shotRef_cast_hit_uses_entity_front_ref() {
        stubProject("dp_1", "u1", payloadWithShot(new String[]{"ch_1"}, "林夏走进店里"));
        DramaCharacter ch = DramaCharacter.builder().id("ch_1").projectId("dp_1").name("林夏")
                .refImagesJson("[{\"cdnKey\":\"char/front-k\",\"angle\":\"front\"}]").build();
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of(ch));

        var asm = assembler().assembleFrame(shotRefBody(false), "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/char/front-k"), asm.imageRefs());
        JsonNode items = asm.appliedRefs().get("items");
        assertEquals("character", items.get(0).get("role").asText());
    }

    @Test
    void shotRef_empty_cast_falls_back_to_text_name_match() {
        // cast 空，但画面文本含角色名「林夏」→ 文本兜底命中 ch_1。
        stubProject("dp_1", "u1", payloadWithShot(new String[]{}, "特写：林夏低头不语"));
        DramaCharacter ch = DramaCharacter.builder().id("ch_1").projectId("dp_1").name("林夏")
                .refImagesJson("[{\"cdnKey\":\"char/front-k\",\"angle\":\"front\"}]").build();
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of(ch));

        var asm = assembler().assembleFrame(shotRefBody(false), "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/char/front-k"), asm.imageRefs());
    }

    @Test
    void shotRef_no_cast_no_text_falls_back_to_all_characters() {
        // cast 空、文本无名 → 退回本项目全体有形象角色。
        stubProject("dp_1", "u1", payloadWithShot(new String[]{}, "空镜：雨夜街道"));
        DramaCharacter ch = DramaCharacter.builder().id("ch_1").projectId("dp_1").name("林夏")
                .refImagesJson("[{\"cdnKey\":\"char/front-k\",\"angle\":\"front\"}]").build();
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of(ch));

        var asm = assembler().assembleFrame(shotRefBody(false), "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/char/front-k"), asm.imageRefs());
    }

    @Test
    void shotRef_no_entity_falls_back_to_doc_avatar() {
        // 无实体行 → 兜底文档 avatarImage。
        stubProject("dp_1", "u1", payloadWithShot(new String[]{"ch_1"}, "林夏走进店里"));
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of());

        var asm = assembler().assembleFrame(shotRefBody(false), "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/doc-avatar.png"), asm.imageRefs());
    }

    // ── 集成：场景参考 显式 sceneRefId vs 名称兜底 ────────────────────────────────

    @Test
    void shotRef_scene_ref_explicit_binding_via_entity() {
        ObjectNode payload = payloadWithShot(new String[]{"ch_1"}, "林夏");
        // storyboard 场景显式绑定 sceneRefId=sa_1。
        ((ObjectNode) payload.path("episodeDocs").path("3").path("storyboard").path("scenes").get(0))
                .put("sceneRefId", "sa_1");
        stubProject("dp_1", "u1", payload);
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of());
        DramaScene scene = DramaScene.builder().id("sa_1").projectId("dp_1").name("咖啡馆")
                .refImagesJson("[{\"cdnKey\":\"scene/env-k\",\"angle\":\"env\"}]").build();
        when(sceneRepo.findByIdAndProjectIdAndDeletedAtIsNull("sa_1", "dp_1")).thenReturn(Optional.of(scene));

        var asm = assembler().assembleFrame(shotRefBody(true), "u1", new Capability(6, false, false));
        assertTrue(asm.imageRefs().contains("https://oss.test/scene/env-k"));
    }

    @Test
    void shotRef_scene_ref_name_match_fallback() {
        // 无显式 sceneRefId → 按 ScriptScene.place「咖啡馆内景」包含 SceneAsset.name「咖啡馆」兜底命中文档 refUrl。
        stubProject("dp_1", "u1", payloadWithShot(new String[]{"ch_1"}, "林夏"));
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of());

        var asm = assembler().assembleFrame(shotRefBody(true), "u1", new Capability(6, false, false));
        assertTrue(asm.imageRefs().contains("https://oss.test/cafe-doc.png"));
    }

    // ── 集成：同场上一镜末帧 文档优先 vs job 权威回退 ──────────────────────────────

    private ObjectNode payloadTwoShots(String s1LastFrameUrl) {
        ObjectNode root = payloadWithShot(new String[]{"ch_1"}, "");
        var shots = (com.fasterxml.jackson.databind.node.ArrayNode) root.path("episodeDocs").path("3")
                .path("storyboard").path("scenes").get(0).path("shots");
        if (s1LastFrameUrl != null) ((ObjectNode) shots.get(0)).put("lastFrameUrl", s1LastFrameUrl);
        ObjectNode s2 = shots.addObject();
        s2.put("id", "sc_3_1_s2");
        s2.putArray("cast");
        return root;
    }

    private ObjectNode shotRefBodyS2(boolean chain) {
        ObjectNode body = shotRefBody(chain);
        ((ObjectNode) body.path("shot_ref")).put("shot_id", "sc_3_1_s2");
        return body;
    }

    @Test
    void prevLastFrame_prefers_document() {
        stubProject("dp_1", "u1", payloadTwoShots("https://oss.test/s1-doc-last.png"));
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of());

        var asm = assembler().assembleFrame(shotRefBodyS2(true), "u1", new Capability(6, false, false));
        assertTrue(asm.imageRefs().contains("https://oss.test/s1-doc-last.png"));
    }

    @Test
    void prevLastFrame_authoritative_job_fallback_uses_lastFrameCdnKey() {
        // 文档本镜无末帧 → MaterialVideoJob 权威回退，读 C-1 lastFrameCdnKey→signKey（不过期）。
        stubProject("dp_1", "u1", payloadTwoShots(null));
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of());
        MaterialVideoJob job = MaterialVideoJob.builder()
                .id("mvj_1").ownerUserId("u1").scriptId("dp_1").status("succeeded")
                .variantConfigJson("{\"scene_id\":\"sc_3_1\",\"shot_id\":\"sc_3_1_s1\"}")
                .lastFrameCdnKey("material-videos/mvj_1/last-frame.png")
                .lastFrameUrl("https://upstream.temp/expired.png")
                .build();
        when(videoJobRepo.findScopedByScript("u1", MaterialVideoJobService.APP_DRAMA, "dp_1"))
                .thenReturn(List.of(job));

        var asm = assembler().assembleFrame(shotRefBodyS2(true), "u1", new Capability(6, false, false));
        assertTrue(asm.imageRefs().contains("https://oss.test/material-videos/mvj_1/last-frame.png"));
    }

    // ── 集成：三级入参优先级 shot_ref > ref_slots > ref_images ─────────────────────

    @Test
    void input_priority_shotRef_wins_over_slots_and_images() {
        stubProject("dp_1", "u1", payloadWithShot(new String[]{"ch_1"}, "林夏"));
        DramaCharacter ch = DramaCharacter.builder().id("ch_1").projectId("dp_1").name("林夏")
                .refImagesJson("[{\"cdnKey\":\"char/front-k\",\"angle\":\"front\"}]").build();
        when(charRepo.findByProjectIdAndDeletedAtIsNull("dp_1")).thenReturn(List.of(ch));

        ObjectNode body = shotRefBody(false);
        // 同时带 ref_slots / ref_images —— 应被 shot_ref 覆盖忽略。
        ObjectNode slots = body.putObject("ref_slots");
        slots.putObject("scene_ref").put("url", "https://oss.test/should-not-be-used.png");
        body.putArray("ref_images").add("https://oss.test/also-ignored.png");

        var asm = assembler().assembleFrame(body, "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/char/front-k"), asm.imageRefs());
    }

    @Test
    void input_priority_slots_used_when_no_shotRef() {
        ObjectNode body = om.createObjectNode();
        ObjectNode slots = body.putObject("ref_slots");
        slots.putArray("character_refs").addObject().put("url", "https://oss.test/slot-char.png");
        slots.putObject("scene_ref").put("cdnKey", "slot/scene-k");

        var asm = assembler().assembleFrame(body, "u1", new Capability(6, false, false));
        assertTrue(asm.imageRefs().contains("https://oss.test/slot-char.png"));
        assertTrue(asm.imageRefs().contains("https://oss.test/slot/scene-k"));
    }

    @Test
    void input_priority_legacy_refImages_role_ref() {
        ObjectNode body = om.createObjectNode();
        body.putArray("ref_images")
                .add("https://oss.test/legacy1.png");
        ((com.fasterxml.jackson.databind.node.ArrayNode) body.get("ref_images")).add("/cdn/legacy2.png");

        var asm = assembler().assembleFrame(body, "u1", new Capability(6, false, false));
        assertEquals(List.of("https://oss.test/legacy1.png"), asm.imageRefs());
        JsonNode items = asm.appliedRefs().get("items");
        assertEquals("ref", items.get(0).get("role").asText());
        assertEquals("local_unfetchable", items.get(1).get("reason").asText());
    }

    // ── 集成：clip 装配 shot_ref 派生首帧 + 尾帧受 capability 门控 ─────────────────

    @Test
    void assembleClip_shotRef_derives_own_frame_and_gates_last_frame() {
        ObjectNode payload = payloadTwoShots(null);
        // s2 自身已锁首帧。
        var shots = (com.fasterxml.jackson.databind.node.ArrayNode) payload.path("episodeDocs").path("3")
                .path("storyboard").path("scenes").get(0).path("shots");
        ((ObjectNode) shots.get(1)).put("frameUrl", "https://oss.test/s2-own.png");
        ((ObjectNode) shots.get(1)).put("endFrameUrl", "https://oss.test/s2-end.png");
        stubProject("dp_1", "u1", payload);

        // supportsFlf=false → 末帧 model_no_flf。
        var noFlf = assembler().assembleClip(shotRefBodyS2(true), "u1", new Capability(1, false, false));
        assertEquals("https://oss.test/s2-own.png", noFlf.firstFrameUrl());
        assertEquals("https://oss.test/s2-end.png", noFlf.lastFrameUrl());
        JsonNode items = noFlf.appliedRefs().get("items");
        assertEquals("model_no_flf", items.get(1).get("reason").asText());

        // supportsFlf=true → 首尾帧都送达。
        var flf = assembler().assembleClip(shotRefBodyS2(true), "u1", new Capability(1, true, false));
        assertEquals(2, flf.appliedRefs().get("applied").asInt());
    }
}
