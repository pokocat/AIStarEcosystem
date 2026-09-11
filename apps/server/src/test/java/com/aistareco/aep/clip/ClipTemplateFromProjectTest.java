package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.dto.ClipDtos.TemplateDto;
import com.aistareco.aep.clip.model.ClipTemplate;
import com.aistareco.aep.clip.repository.ClipTemplateRepository;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipProjectService;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * 把自己的草稿存成模板（照搬 ip studio 的 publish-as-demo）。
 *
 * <p>这组用例的重点**不是「存得进去」，是「该剥的剥干净了」**。ip studio 那边剥的是作者
 * 自己的照片；这里剥的是运营自己的数字人和声音 —— 不剥的话，每个用这套模板的人做出来的
 * 片子都顶着运营那张脸、用运营那个嗓子。这是会直接出现在用户成片里的错误。
 */
class ClipTemplateFromProjectTest {
    private ClipTemplateRepository repo;
    private ClipProjectService projects;
    private ClipTemplateService service;

    private static Map<String, Object> payload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("segments", new ArrayList<>(List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "大家好，我是老板",
                        "durationSec", 6,
                        // 段级生成产物：这条草稿跑出来的成品，跟模板没关系
                        "artifact", Map.of("url", "https://cdn/x.mp4"))),
                new LinkedHashMap<>(Map.of("no", 2, "role", "broll", "text", "门店空镜",
                        "durationSec", 4,
                        // 运营自己上传的素材
                        "assetId", "ca_my_upload", "assetLabel", "我家门店实拍.mp4", "brollSource", "upload")),
                new LinkedHashMap<>(Map.of("no", 3, "role", "tail", "text", "结尾",
                        "durationSec", 5,
                        // 平台预置素材：留着，本来就是给所有人用的
                        "assetId", "ca_preset_tail", "assetLabel", "通用片尾", "brollSource", "preset")))));
        // 运营自己的数字人与声音
        p.put("avatarId", "av_operator_face");
        p.put("voiceId", "vo_operator_voice");
        return p;
    }

    @BeforeEach
    void setUp() {
        repo = mock(ClipTemplateRepository.class);
        projects = mock(ClipProjectService.class);
        var storage = mock(com.aistareco.aep.service.storage.FileStorageService.class);
        when(storage.signedUrl(anyString())).thenReturn("https://cdn.example/x");
        when(repo.save(any(ClipTemplate.class))).thenAnswer(i -> i.getArgument(0));
        when(repo.findById(anyString())).thenReturn(Optional.empty());
        // 是不是预置素材**查库**，不看草稿里的 brollSource 标记：端上可以把自己上传的素材
        // 标成 preset，信那个标记就等于把私有 assetId 随模板发给所有人。
        var assets = mock(ClipAssetService.class);
        when(assets.isPreset("ca_preset_tail")).thenReturn(true);
        when(assets.isPreset("ca_my_upload")).thenReturn(false);
        service = new ClipTemplateService(repo, storage, assets, projects);

        ClipProject p = ClipProject.builder()
                .id("cp1").externalOwnerId("op1").templateId("ct0").templateName("原模板")
                .title("门店故事").payloadJson(payload()).avatarSeconds(6).build();
        when(projects.required(eq("op1"), eq("cp1"))).thenReturn(p);
    }

    private ClipTemplate saved() {
        var cap = org.mockito.ArgumentCaptor.forClass(ClipTemplate.class);
        verify(repo).save(cap.capture());
        return cap.getValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> segsOf(ClipTemplate t) {
        return (List<Map<String, Object>>) t.getScriptSkeletonJson().get("segments");
    }

    @Test
    void stripsTheOperatorsOwnAvatarAndVoice() {
        service.publishFromProject("op1", "cp1", null, "门店故事", "本地生活", "daily", "适合门店老板", true);
        ClipTemplate t = saved();
        String json = String.valueOf(t.getScriptSkeletonJson());
        assertFalse(json.contains("av_operator_face"), "运营自己的数字人进了模板 —— 每个用它的人都会顶着这张脸");
        assertFalse(json.contains("vo_operator_voice"), "运营自己的声音进了模板");
    }

    /** 草稿把自己上传的素材谎称成 preset —— 不能信，要查库。 */
    @Test
    void doesNotTrustTheDraftsOwnPresetFlag() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> segs =
                (List<Map<String, Object>>) projects.required("op1", "cp1").getPayloadJson().get("segments");
        segs.get(1).put("brollSource", "preset"); // 自己传的素材，标成预置

        service.publishFromProject("op1", "cp1", null, "n", "i", "k", "d", true);
        assertNull(segsOf(saved()).get(1).get("assetId"),
                "信了草稿里的 preset 标记 —— 私有 assetId 会随模板发给所有人");
    }

    @Test
    void stripsUploadedAssetsButKeepsPresetOnes() {
        service.publishFromProject("op1", "cp1", null, "门店故事", "本地生活", "daily", "说明", true);
        var segs = segsOf(saved());

        Map<String, Object> broll = segs.get(1);
        assertNull(broll.get("assetId"), "运营自己传的素材进了模板：用户会看到自己没权限的素材位");
        // 只清 assetId 不清 label 的话，用户会看到一个叫「我家门店实拍.mp4」、却点不开的空位
        assertNull(broll.get("assetLabel"), "素材名没跟着清掉");
        assertNull(broll.get("brollSource"));

        Map<String, Object> tail = segs.get(2);
        assertEquals("ca_preset_tail", tail.get("assetId"), "平台预置素材被误删了 —— 那本来就是给所有人用的");
        assertEquals("preset", tail.get("brollSource"));
    }

    @Test
    void dropsPerDraftArtifacts() {
        service.publishFromProject("op1", "cp1", null, "n", "i", "k", "d", true);
        assertNull(segsOf(saved()).get(0).get("artifact"), "这条草稿跑出来的成品跟模板没关系");
    }

    @Test
    void keepsTheStructureAndOptionallyTheText() {
        service.publishFromProject("op1", "cp1", null, "n", "i", "k", "d", true);
        var segs = segsOf(saved());
        assertEquals(3, segs.size());
        assertEquals("大家好，我是老板", segs.get(0).get("text"), "缺省保留正文：运营写的示范文案本身就是模板的价值");
        assertEquals(6, segs.get(0).get("durationSec"));
        assertEquals("avatar", segs.get(0).get("role"));
    }

    @Test
    void keepTextFalseEmptiesTextButKeepsTheSkeleton() {
        service.publishFromProject("op1", "cp1", null, "n", "i", "k", "d", false);
        var segs = segsOf(saved());
        assertEquals("", segs.get(0).get("text"));
        assertEquals(6, segs.get(0).get("durationSec"), "时长要留着当写作约束");
        assertEquals(3, segs.size());
    }

    // 存模板和上架是两个决定。直接 published 的话，一次手滑就推给了全平台每一个用户。
    @Test
    void alwaysLandsAsDraftNeverPublished() {
        service.publishFromProject("op1", "cp1", null, "n", "i", "k", "d", true);
        assertEquals("draft", saved().getStatus());
    }

    // 模板是超管一键推给全平台每个用户的内容。出了问题（分段错了、素材没剥干净、文案要改）
    // 第一件事是回去看它从哪条草稿来、谁存的 —— 照搬 ip_demo_template 的那两列。
    @Test
    void recordsWhichDraftItCameFromAndWhoSavedIt() {
        service.publishFromProject("op1", "cp1", null, "门店故事", "本地生活", "daily", "说明", true);
        ClipTemplate t = saved();
        assertEquals("cp1", t.getSourceProjectId());
        assertEquals("op1", t.getCreatedBy());
    }

    /**
     * **C 端拿不到出处。**
     *
     * TemplateDto 同时喂 /api/me/clip/templates（小程序）和运营面，而 created_by 是运营的
     * externalOwnerId。第一版把两列直接塞进 from()，等于每个小程序用户都能看到是哪个员工
     * 存的这套模板。当时没发现，是因为 application.yml 配了 non_null，而线上那 3 条存量模板
     * 的出处都是 NULL —— 要等到有人第一次存模板并上架，才会真的发出去。
     *
     * 这条用例盯的就是那个「要等到以后才暴露」的形态。
     */
    @Test
    void cSideTemplatesNeverCarryProvenance() {
        ClipTemplate t = ClipTemplate.builder().id("ct_x").status("published")
                .name("n").industry("i").themeKey("k").description("d")
                .scriptSkeletonJson(Map.of("segments", List.of()))
                .sourceProjectId("cp_secret").createdBy("op_secret").build();
        when(repo.findById("ct_x")).thenReturn(Optional.of(t));

        TemplateDto c = service.published("ct_x");
        assertNull(c.sourceProjectId(), "C 端不该知道这套模板从哪条草稿来");
        assertNull(c.createdBy(), "created_by 是运营的账号标识，绝不能发给小程序用户");
    }

    // 改版时覆盖成这一次的来源：想知道的是「现在这份是从哪来的」，不是第一版从哪来的。
    @Test
    void republishingFromAnotherDraftOverwritesTheProvenance() {
        ClipTemplate existing = ClipTemplate.builder().id("ct_x")
                .sourceProjectId("cp_old").createdBy("op_old").build();
        when(repo.findById("ct_x")).thenReturn(Optional.of(existing));
        service.publishFromProject("op1", "cp1", "ct_x", "n", "i", "k", "d", true);
        ClipTemplate t = saved();
        assertEquals("cp1", t.getSourceProjectId(), "还指着旧草稿的话，倒查会查到一条早就改过的稿子");
        assertEquals("op1", t.getCreatedBy());
    }

    @Test
    void updatingAnAlreadyPublishedTemplateAlsoGoesBackToDraft() {
        ClipTemplate existing = ClipTemplate.builder().id("ct_x").status("published")
                .timelineJson(Map.of("tracks", List.of("a"))).build();
        when(repo.findById("ct_x")).thenReturn(Optional.of(existing));
        service.publishFromProject("op1", "cp1", "ct_x", "n", "i", "k", "d", true);
        ClipTemplate t = saved();
        assertEquals("draft", t.getStatus(), "改版一条已上架的模板，要先下架再让人看一眼");
        assertEquals(Map.of("tracks", List.of("a")), t.getTimelineJson(), "时间线是模板自己的编排产物，不该被草稿清掉");
    }

    // 运营也不该凭一个 id 就把别人的草稿连素材抄成公开模板。
    @Test
    void cannotPublishSomeoneElsesDraft() {
        when(projects.required(eq("op2"), eq("cp1")))
                .thenThrow(BusinessException.notFound("CLIP_PROJECT_NOT_FOUND", "草稿不存在"));
        assertThrows(BusinessException.class,
                () -> service.publishFromProject("op2", "cp1", null, "n", "i", "k", "d", true));
        verify(repo, never()).save(any());
    }

    @Test
    void rejectsEmptyMeta() {
        for (String[] args : new String[][]{{"", "i", "k", "d"}, {"n", "", "k", "d"}, {"n", "i", "", "d"}, {"n", "i", "k", ""}}) {
            assertThrows(BusinessException.class,
                    () -> service.publishFromProject("op1", "cp1", null, args[0], args[1], args[2], args[3], true));
        }
        verify(repo, never()).save(any());
    }
}
