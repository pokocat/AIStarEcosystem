package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.AssetState;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.GroupState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DapModelinkPoller（v0.105）：非终态分组 / 素材向上游收敛；
 * 无非终态行时零上游请求；单行失败不中断整轮。
 */
class DapModelinkPollerTest {

    private DapMaterialGroupRepository groupRepo;
    private DapMaterialRepository materialRepo;
    private ModelinkService modelink;
    private DapProperties props;
    private DapModelinkPoller poller;

    @BeforeEach
    void setUp() {
        groupRepo = mock(DapMaterialGroupRepository.class);
        materialRepo = mock(DapMaterialRepository.class);
        modelink = mock(ModelinkService.class);
        when(groupRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(materialRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        props = new DapProperties();
        DapRealAuthService realAuth = new DapRealAuthService(groupRepo, mock(DapCaptureRepository.class),
                modelink, props, new DapSupport(), mock(DapConsentService.class));
        DapAigcGroupResolver aigc = new DapAigcGroupResolver(groupRepo, modelink, props, new DapSupport(),
                mock(PlatformTransactionManager.class));
        DapMaterialService materials = new DapMaterialService(materialRepo, mock(DapAvatarRepository.class),
                mock(DapCaptureRepository.class), realAuth, aigc, modelink,
                mock(FileStorageService.class), new DapSupport());
        poller = new DapModelinkPoller(groupRepo, materialRepo, realAuth, materials, props);
    }

    private DapMaterialGroup group(String status) {
        return DapMaterialGroup.builder().id("MG-1").ownerUserId("u").kind("liveness_face")
                .qgroupid("qg-1").status(status).callbackToken("tok").createdAt(Instant.now()).build();
    }

    private DapMaterial material(String status) {
        return DapMaterial.builder().id("MAT-1").ownerUserId("u").qassetid("qa-1").type("image")
                .name("avatar-DH-1").sourceKey("dap/avatar/u/k.png").status(status)
                .refType("avatar").refId("DH-1").createdAt(Instant.now()).build();
    }

    @Test
    void convergesPreparingGroupToActive() {
        DapMaterialGroup g = group("preparing");
        when(groupRepo.findByStatusIn(any())).thenReturn(List.of(g));
        when(materialRepo.findByStatusIn(any())).thenReturn(List.of());
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "active", null, null, null));

        poller.poll();

        assertEquals("active", g.getStatus());
        verify(groupRepo).save(g);
    }

    @Test
    void convergesValidatingGroupToFailedWithReason() {
        DapMaterialGroup g = group("validating");
        when(groupRepo.findByStatusIn(any())).thenReturn(List.of(g));
        when(materialRepo.findByStatusIn(any())).thenReturn(List.of());
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "failed", null, null, "刷脸未通过"));

        poller.poll();

        assertEquals("failed", g.getStatus());
        assertEquals("刷脸未通过", g.getFailReason());
    }

    @Test
    void convergesReviewingMaterialToApproved() {
        DapMaterial m = material("reviewing");
        when(groupRepo.findByStatusIn(any())).thenReturn(List.of());
        when(materialRepo.findByStatusIn(any())).thenReturn(List.of(m));
        when(modelink.getAsset("qa-1")).thenReturn(new AssetState("qa-1", "approved", null));

        poller.poll();

        assertEquals("approved", m.getStatus());
        verify(materialRepo).save(m);
    }

    @Test
    void noPendingRowsMeansNoUpstreamCalls() {
        when(groupRepo.findByStatusIn(any())).thenReturn(List.of());
        when(materialRepo.findByStatusIn(any())).thenReturn(List.of());

        poller.poll();

        verifyNoInteractions(modelink);
    }

    // ── 终态分组回收（配额治理，v0.105-补丁）────────────────────

    private DapMaterialGroup aged(String status, long hoursAgo) {
        DapMaterialGroup g = group(status);
        g.setCreatedAt(Instant.now().minus(Duration.ofHours(hoursAgo)));
        return g;
    }

    @Test
    void reclaimsStaleFailedGroupToFreeUpstreamQuota() {
        DapMaterialGroup g = aged("failed", 48);
        when(groupRepo.findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(eq("liveness_face"), eq("failed"), any()))
                .thenReturn(List.of(g));
        when(materialRepo.countByGroupIdAndStatusNot(eq("MG-1"), eq("failed"))).thenReturn(0L);

        poller.reclaimTerminalGroups();

        verify(modelink).deleteGroup("qg-1");
        assertNotNull(g.getRecycledAt());
    }

    @Test
    void reclaimNeverTouchesActiveGroups() {
        // 查询本身就只捞 failed —— active 是生效授权的取证凭据，绝不进回收范围
        when(groupRepo.findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(anyString(), anyString(), any()))
                .thenReturn(List.of());

        poller.reclaimTerminalGroups();

        verify(groupRepo).findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(eq("liveness_face"), eq("failed"), any());
        verifyNoInteractions(modelink);

        // 即便有人直接拿 active 行调回收，也必须被挡下
        DapMaterialGroup active = group("active");
        assertFalse(new DapRealAuthService(groupRepo, mock(DapCaptureRepository.class), modelink,
                props, new DapSupport(), mock(DapConsentService.class)).recycleGroup(active));
        verify(modelink, never()).deleteGroup(anyString());
    }

    @Test
    void reclaimRespectsRetentionWindow() {
        // 未超期的行根本不在查询结果里（cutoff = now - retention）
        props.getModelink().setGroupRetentionHours(24);
        when(groupRepo.findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(anyString(), anyString(), any()))
                .thenAnswer(inv -> {
                    Instant cutoff = inv.getArgument(2, Instant.class);
                    DapMaterialGroup fresh = aged("failed", 2);
                    return fresh.getCreatedAt().isBefore(cutoff) ? List.of(fresh) : List.<DapMaterialGroup>of();
                });

        poller.reclaimTerminalGroups();

        verify(modelink, never()).deleteGroup(anyString());
    }

    @Test
    void reclaimSkipsGroupsThatStillHoldMaterials() {
        DapMaterialGroup g = aged("failed", 48);
        when(groupRepo.findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(anyString(), anyString(), any()))
                .thenReturn(List.of(g));
        when(materialRepo.countByGroupIdAndStatusNot(eq("MG-1"), eq("failed"))).thenReturn(2L);

        poller.reclaimTerminalGroups();

        verify(modelink, never()).deleteGroup(anyString());
        assertNull(g.getRecycledAt());
    }

    @Test
    void reclaimKeepsRowForRetryWhenUpstreamRefusesDelete() {
        DapMaterialGroup g = aged("failed", 48);
        when(groupRepo.findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(anyString(), anyString(), any()))
                .thenReturn(List.of(g));
        when(materialRepo.countByGroupIdAndStatusNot(anyString(), anyString())).thenReturn(0L);
        doThrow(new RuntimeException("409 非空")).when(modelink).deleteGroup("qg-1");

        poller.reclaimTerminalGroups();

        assertNull(g.getRecycledAt(), "删失败保留，下轮再试");
    }

    @Test
    void oneFailingRowDoesNotAbortTheSweep() {
        DapMaterialGroup g = group("preparing");
        DapMaterial m = material("pending");
        when(groupRepo.findByStatusIn(any())).thenReturn(List.of(g));
        when(materialRepo.findByStatusIn(any())).thenReturn(List.of(m));
        when(modelink.getGroup("qg-1")).thenThrow(new RuntimeException("上游抖动"));
        when(modelink.getAsset("qa-1")).thenReturn(new AssetState("qa-1", "reviewing", null));

        poller.poll();

        assertEquals("preparing", g.getStatus());
        assertEquals("reviewing", m.getStatus(), "分组刷新失败不影响素材收敛");
    }
}
