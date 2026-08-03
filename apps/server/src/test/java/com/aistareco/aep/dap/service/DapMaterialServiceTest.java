package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.MaterialDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.AssetState;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.GroupState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DapMaterialService（v0.105 素材送审）：捕获素材送审 / 定妆图送审幂等 / 失败可重交 /
 * 按引用查询 / 审核结论收敛。
 */
class DapMaterialServiceTest {

    private static final String USER = "u_owner";

    private Map<String, DapMaterial> db;
    private DapMaterialRepository materialRepo;
    private DapAvatarRepository avatarRepo;
    private DapCaptureRepository captureRepo;
    private DapRealAuthService realAuth;
    private DapMaterialGroupRepository groupRepo;
    private Map<String, DapMaterialGroup> groupDb;
    private DapProperties props;
    private ModelinkService modelink;
    private FileStorageService storage;
    private DapMaterialService svc;
    private int seq;

    @BeforeEach
    void setUp() {
        db = new HashMap<>();
        seq = 0;
        materialRepo = mock(DapMaterialRepository.class);
        when(materialRepo.save(any())).thenAnswer(inv -> {
            DapMaterial m = inv.getArgument(0);
            db.put(m.getId(), m);
            return m;
        });
        when(materialRepo.existsById(anyString())).thenAnswer(inv -> db.containsKey(inv.getArgument(0, String.class)));
        when(materialRepo.findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc(anyString(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    List<DapMaterial> out = new ArrayList<>(db.values().stream()
                            .filter(m -> inv.getArgument(0, String.class).equals(m.getRefType())
                                    && inv.getArgument(1, String.class).equals(m.getRefId())
                                    && inv.getArgument(2, String.class).equals(m.getOwnerUserId()))
                            .toList());
                    out.sort(Comparator.comparing(DapMaterial::getCreatedAt).reversed());
                    return out;
                });

        avatarRepo = mock(DapAvatarRepository.class);
        when(avatarRepo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv ->
                Optional.ofNullable("DH-1".equals(inv.getArgument(0)) && USER.equals(inv.getArgument(1))
                        ? DapAvatar.builder().id("DH-1").ownerUserId(USER).name("周野").path("real")
                        .imageKey("dap/avatar/u/key.png").build()
                        : null));

        captureRepo = mock(DapCaptureRepository.class);
        realAuth = mock(DapRealAuthService.class);
        modelink = mock(ModelinkService.class);
        when(modelink.boundModel()).thenReturn("m1");
        when(modelink.isMockMode()).thenReturn(false);
        when(modelink.createAsset(anyString(), anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> new AssetState("qa-" + (++seq), "pending", null));

        storage = mock(FileStorageService.class);
        when(storage.signedUrl(anyString())).thenAnswer(inv -> "https://cdn.example/" + inv.getArgument(0, String.class));

        // 数字人专属 aigc 分组解析器（真实实现，仓储 mock）：默认建组即 active
        groupDb = new HashMap<>();
        groupRepo = mock(DapMaterialGroupRepository.class);
        when(groupRepo.save(any())).thenAnswer(inv -> {
            DapMaterialGroup g = inv.getArgument(0);
            groupDb.put(g.getId(), g);
            return g;
        });
        when(groupRepo.saveAndFlush(any())).thenAnswer(inv -> {
            DapMaterialGroup g = inv.getArgument(0);
            groupDb.put(g.getId(), g);
            return g;
        });
        when(groupRepo.existsById(anyString())).thenAnswer(inv -> groupDb.containsKey(inv.getArgument(0, String.class)));
        when(groupRepo.findByCallbackToken(anyString())).thenAnswer(inv -> groupDb.values().stream()
                .filter(g -> inv.getArgument(0, String.class).equals(g.getCallbackToken())).findFirst());
        when(modelink.createGroup(eq("aigc"), anyString(), anyString(), isNull()))
                .thenReturn(new GroupState("qg-aigc", "active", null, null, null));

        props = new DapProperties();
        DapAigcGroupResolver aigc = new DapAigcGroupResolver(groupRepo, modelink, props, new DapSupport(),
                mock(PlatformTransactionManager.class));

        svc = new DapMaterialService(materialRepo, avatarRepo, captureRepo, realAuth, aigc, modelink,
                storage, new DapSupport());
    }

    private DapCapture capture() {
        return DapCapture.builder().id("CAP-1").ownerUserId(USER).avatarId("DH-1")
                .footageKey("dap/capture/u/a.webm").footageContentType("video/webm")
                .frameKey("dap/capture/u/a.png").status("verified").createdAt(Instant.now()).build();
    }

    private DapMaterialGroup group() {
        return DapMaterialGroup.builder().id("MG-1").ownerUserId(USER).kind("liveness_face")
                .qgroupid("qg-1").status("active").callbackToken("tok").createdAt(Instant.now()).build();
    }

    @Test
    void submitForCaptureSendsFootageAndFrameIntoLivenessGroup() {
        List<MaterialDto> out = svc.submitForCapture(USER, capture(), group());

        assertEquals(2, out.size());
        assertEquals(2, db.size());
        // 真人素材必须显式挂在 active 的 liveness 分组下
        verify(modelink).createAsset(eq("video"), contains("footage"), eq("m1"),
                eq("https://cdn.example/dap/capture/u/a.webm"), eq("qg-1"));
        verify(modelink).createAsset(eq("image"), contains("frame"), eq("m1"),
                eq("https://cdn.example/dap/capture/u/a.png"), eq("qg-1"));
        assertTrue(out.get(0).qassetUri().startsWith("qasset://"));
        assertEquals("pending", out.get(0).status());
    }

    @Test
    void submitForCaptureIsIdempotent() {
        svc.submitForCapture(USER, capture(), group());
        svc.submitForCapture(USER, capture(), group());
        assertEquals(2, db.size(), "同 ref + 同源文件的非 failed 记录不重复送审");
        verify(modelink, times(2)).createAsset(anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void submitAvatarModerationUsesDedicatedAigcGroupAndIsIdempotent() {
        MaterialDto first = svc.submitAvatarModeration(USER, "DH-1");
        MaterialDto again = svc.submitAvatarModeration(USER, "DH-1");

        assertEquals(first.id(), again.id());
        assertEquals(1, db.size());
        assertEquals("avatar", first.refType());
        // AI 原创人物素材挂数字人专属 aigc 分组（不再混进平台默认组）
        verify(modelink, times(1)).createAsset(eq("image"), anyString(), eq("m1"),
                eq("https://cdn.example/dap/avatar/u/key.png"), eq("qg-aigc"));
    }

    // ── 数字人专属 aigc 分组（v0.105-补丁）──────────────────────

    @Test
    void dedicatedAigcGroupIsCreatedOnceAndSharedAcrossUsers() {
        svc.submitAvatarModeration(USER, "DH-1");
        // 第二个用户的 AI 人物送审复用同一个账号级共享分组，绝不再建一个（账号只有 3 个分组配额）
        when(avatarRepo.findByIdAndOwnerUserId(eq("DH-2"), eq("u_other"))).thenReturn(Optional.of(
                DapAvatar.builder().id("DH-2").ownerUserId("u_other").name("阿元").path("ai")
                        .imageKey("dap/avatar/o/key.png").build()));
        svc.submitAvatarModeration("u_other", "DH-2");

        verify(modelink, times(1)).createGroup(eq("aigc"), anyString(), anyString(), isNull());
        assertEquals(1, groupDb.size());
        DapMaterialGroup g = groupDb.values().iterator().next();
        assertEquals("aigc", g.getKind());
        assertEquals(DapAigcGroupResolver.PLATFORM_OWNER, g.getOwnerUserId(), "账号级共享行用系统 owner");
        verify(modelink, times(2)).createAsset(anyString(), anyString(), anyString(), anyString(), eq("qg-aigc"));
    }

    @Test
    void preconfiguredAigcGroupIsAdoptedInsteadOfCreated() {
        // 线上分组已手工建好（配额只有 3 个）→ 认领，不得再建一个
        props.getModelink().setAigcQgroupid("qgroup-live-1");
        when(modelink.getGroup("qgroup-live-1")).thenReturn(new GroupState("qgroup-live-1", "active", null, null, null));

        svc.submitAvatarModeration(USER, "DH-1");

        verify(modelink, never()).createGroup(anyString(), anyString(), anyString(), any());
        verify(modelink).createAsset(eq("image"), anyString(), eq("m1"), anyString(), eq("qgroup-live-1"));
    }

    @Test
    void aigcGroupNotYetActiveFallsBackToPlatformDefaultGroup() {
        // 首次使用时分组是异步 pending → 本次退回默认组（不传 group_id），送审不被阻断
        reset(modelink);
        when(modelink.boundModel()).thenReturn("m1");
        when(modelink.isMockMode()).thenReturn(false);
        when(modelink.createAsset(anyString(), anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> new AssetState("qa-" + (++seq), "pending", null));
        when(modelink.createGroup(eq("aigc"), anyString(), anyString(), isNull()))
                .thenReturn(new GroupState("qg-aigc", "pending", null, null, null));

        MaterialDto dto = svc.submitAvatarModeration(USER, "DH-1");

        assertEquals("pending", dto.status());
        verify(modelink).createAsset(eq("image"), anyString(), eq("m1"), anyString(), isNull());
        assertEquals(1, groupDb.size(), "分组行已落库，下次 refresh 到 active 即可复用");

        // 下一次送审：分组已 active → 素材直接进专属组，且不再重复建组
        when(modelink.getGroup("qg-aigc")).thenReturn(new GroupState("qg-aigc", "active", null, null, null));
        when(avatarRepo.findByIdAndOwnerUserId(eq("DH-2"), eq(USER))).thenReturn(Optional.of(
                DapAvatar.builder().id("DH-2").ownerUserId(USER).name("阿元").path("ai")
                        .imageKey("dap/avatar/u/k2.png").build()));
        svc.submitAvatarModeration(USER, "DH-2");

        verify(modelink, times(1)).createGroup(eq("aigc"), anyString(), anyString(), isNull());
        verify(modelink).createAsset(eq("image"), anyString(), eq("m1"),
                eq("https://cdn.example/dap/avatar/u/k2.png"), eq("qg-aigc"));
    }

    @Test
    void failedMaterialCanBeResubmitted() {
        MaterialDto first = svc.submitAvatarModeration(USER, "DH-1");
        db.get(first.id()).setStatus("failed");
        db.get(first.id()).setFailReason("素材未通过平台审核");

        MaterialDto retry = svc.submitAvatarModeration(USER, "DH-1");

        assertNotEquals(first.id(), retry.id());
        assertEquals(2, db.size());
        assertEquals("pending", retry.status());
    }

    @Test
    void listByRefReturnsNewestFirstAndRequiresQuery() {
        svc.submitAvatarModeration(USER, "DH-1");
        assertEquals(1, svc.listByRef(USER, "avatar", "DH-1").size());
        assertTrue(svc.listByRef(USER, "avatar", "DH-2").isEmpty());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.listByRef(USER, "avatar", ""));
        assertEquals("DAP_MATERIAL_REF_REQUIRED", ex.getCode());
    }

    @Test
    void avatarWithoutImageCannotBeSubmitted() {
        when(avatarRepo.findByIdAndOwnerUserId(eq("DH-9"), eq(USER))).thenReturn(Optional.of(
                DapAvatar.builder().id("DH-9").ownerUserId(USER).name("草稿").path("ai").build()));
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.submitAvatarModeration(USER, "DH-9"));
        assertEquals("DAP_NO_IMAGE", ex.getCode());
    }

    @Test
    void refreshConvergesReviewOutcome() {
        MaterialDto m = svc.submitAvatarModeration(USER, "DH-1");
        when(modelink.getAsset(anyString())).thenReturn(new AssetState("qa-1", "failed", "素材未通过平台审核"));

        svc.refresh(db.get(m.id()));

        assertEquals("failed", db.get(m.id()).getStatus());
        assertEquals("素材未通过平台审核", db.get(m.id()).getFailReason());

        // 终态不再打上游
        svc.refresh(db.get(m.id()));
        verify(modelink, times(1)).getAsset(anyString());
    }

    @Test
    void resubmitForCaptureRequiresActiveSession() {
        when(captureRepo.findByIdAndOwnerUserId(eq("CAP-1"), eq(USER))).thenReturn(Optional.of(capture()));
        when(realAuth.requireActiveSession(eq(USER), any())).thenReturn(group());

        assertEquals(2, svc.resubmitForCapture(USER, "CAP-1").size());
        verify(realAuth).requireActiveSession(eq(USER), any());
    }
}
